import type { Draft, Objectish, Patch, PatchListener } from 'immer'
import { enablePatches, nothing, original } from 'immer'

enablePatches()
import { applyPatches, createDraft, finishDraft, isDraft, produce } from 'immer'

const STATE_SOURCE = Symbol('state-source')
const STATE_SYMBOL = Symbol('state-symbol')
const STATE_PROXY_SYMBOL = Symbol('state-proxy-symbol')
const STATE_DRAFT = Symbol('state-draft')
const INVALID = {} as const as any

export interface UndouState<T> {
  readonly [STATE_SYMBOL]: true
  [STATE_SOURCE]: T
  readonly isDirty: boolean
  readonly commit: () => void
  value: UndouDraft<T>
}

export type UndouDraft<T> = T extends Objectish ? UndouProxy<T> : T
type UndouProxy<T, S = Draft<T>> = {
  [K in keyof S]: UndouDraft<S[K]>
} & Partial<UndouProxyInternal<T>>
interface UndouProxyInternal<T> {
  [STATE_PROXY_SYMBOL]: true
  [STATE_DRAFT]: Draft<T>
}

// TODO 为了正确跟踪 Array 的 push，pop 等操作。为 Array 的方法增加包装器 "Array Instrumentations"。

/**
 * 返回 undou State 并记录对它的修改历史。
 */
export function undou<T>(source: T, patchListener?: PatchListener | undefined, scheduler?: (commit: () => void) => void): UndouState<T> {
  if (isUndou(source)) {
    throw new Error('The source has been handled by an state proxy.')
  }

  let proxiedValue: UndouDraft<T> = INVALID
  let draft: Record<string | number | symbol, any> | undefined
  let draftCacheKey = 0
  let pendingPromise: Promise<void> | undefined
  let isDirty = false

  if (patchListener) {
    const _patchListener = patchListener
    patchListener = (patches, inversePatches) => {
      if (patches.length === 0 && inversePatches.length === 0)
        return
      _patchListener(patches, inversePatches)
    }
  }

  if (!scheduler) {
    // 在所有的同步修改完成后，再生成一条修改记录。
    // 这样的设计更符合实际的使用场景。
    scheduler = (commit) => {
      if (pendingPromise)
        return
      pendingPromise = Promise.resolve().then(() => {
        commit()
        pendingPromise = undefined
      })
    }
  }

  const immerRoot = {
    [STATE_SYMBOL]: true as const,
    get [STATE_SOURCE]() {
      return source
    },
    set [STATE_SOURCE](value) {
      proxiedValue = INVALID
      setSource(value)
    },

    get isDirty() {
      return isDirty
    },

    get commit() {
      return commit
    },

    get value() {
      if (proxiedValue === INVALID) {
        initProxy()
      }

      return proxiedValue
    },
    set value(newVal) {
      proxiedValue = INVALID
      setSource(produce(source, (_) => {
        return (newVal === undefined ? nothing : newVal) as any
      }, patchListener))
      isDirty = false
    },
  }

  return immerRoot

  function initProxy() {
    if (isObject(source)) {
      let catchedDraft: typeof draft
      const initDraft = () => {
        catchedDraft = draft = createDraft(source as Objectish)
      }
      initDraft()

      const theSelf = proxiedValue = createProxy(source, () => {
        // 如果 proxiedValue 被修改了，则说明根被替换了。这个 proxy 就已经失效了。所以不要在追踪这个 proxy 的 draft 了。
        if (proxiedValue !== theSelf)
          return catchedDraft!
        if (!draft)
          initDraft()
        return draft!
      }) as UndouDraft<T>
    }
    else {
      proxiedValue = source as UndouDraft<T>
    }
  }

  function setSource<S extends T>(value: S) {
    source = value
    draft = undefined
    clearDraftCache()
  }

  function clearDraftCache() {
    draftCacheKey += 1
  }

  function commit() {
    if (!isDirty || !draft)
      return
    setSource(finishDraft(draft, patchListener))
    clearDraftCache()
    isDirty = false
  }

  function dye() {
    isDirty = true
    scheduler!(commit)
  }

  interface ProxyCatch {
    enable: boolean
    proxy: unknown
  }

  function clearProxyCatch(ctx: Record<string | number | symbol, ProxyCatch | undefined>, prop: string | number | symbol) {
    const proxyCatch = ctx[prop]
    if (proxyCatch) {
      proxyCatch.enable = false
      ctx[prop] = undefined
    }
  }

  function createProxy(target: any, subDraft: () => Record<string | number | symbol, any>) {
    const dummy: Record<string | number | symbol, ProxyCatch | undefined> = (Array.isArray(target) ? [] : {}) as any
    return new Proxy(dummy, {
      get(ctx, prop) {
        if (prop === STATE_PROXY_SYMBOL) {
          return true
        }
        if (prop === STATE_DRAFT) {
          return subDraft()
        }

        let value = Reflect.get(subDraft(), prop)

        if (isDraft(value)) {
          let proxyCatch = ctx[prop]
          const originalValue = original(value)

          if (proxyCatch && proxyCatch.enable)
            return proxyCatch.proxy

          let key = draftCacheKey
          ctx[prop] = proxyCatch = {
            enable: true,
            proxy: createProxy(originalValue, () => {
              // 如果 proxyCatch 的 enable 为 false，则说明这个 object 已经被从当前的 state 树中移除了。
              // 这时候如果访问 subDraft 会返回一个空对象，所以只能返回 value 了。
              if (!proxyCatch!.enable || key === draftCacheKey) {
                return value
              }
              key = draftCacheKey
              const newDraft = subDraft()
              if (newDraft)
                value = Reflect.get(newDraft, prop)
              return value
            }),
          }

          return proxyCatch.proxy
        }

        return value
      },

      set(ctx, prop, value) {
        clearProxyCatch(ctx, prop)

        if (isUndouProxy(value))
          value = value[STATE_DRAFT]

        const result = Reflect.set(subDraft(), prop, value)
        dye()
        return result
      },

      deleteProperty(ctx, prop) {
        clearProxyCatch(ctx, prop)

        const result = Reflect.deleteProperty(subDraft(), prop)
        dye()
        return result
      },

      has(_, prop) {
        return Reflect.has(subDraft(), prop)
      },

      ownKeys() {
        return Reflect.ownKeys(subDraft())
      },

      getOwnPropertyDescriptor(_, prop) {
        return Reflect.getOwnPropertyDescriptor(subDraft(), prop)
      },

      setPrototypeOf(_, proto) {
        const result = Reflect.setPrototypeOf(subDraft(), proto)
        dye()
        return result
      },

      isExtensible(_) {
        return Reflect.isExtensible(subDraft())
      },

      preventExtensions(_) {
        const result = Reflect.preventExtensions(subDraft())
        dye()
        return result
      },

      getPrototypeOf(_) {
        return Reflect.getPrototypeOf(subDraft())
      },

      defineProperty(ctx, prop, descriptor) {
        clearProxyCatch(ctx, prop)

        const result = Reflect.defineProperty(subDraft(), prop, descriptor)
        dye()
        return result
      },
    })
  }
}

/**
 * 将修改记录应用到状态上并修改状态。
 * 如果状态是脏的，则先提交修改记录。
 */
export function patchState(state: UndouState<any>, patches: Patch[]) {
  state.commit()
  let source = state[STATE_SOURCE]
  source = applyPatches(source, patches)
  state[STATE_SOURCE] = source
}

/**
 * 克隆传入的状态，并返回一个新状态。新状态与旧状态完全独立，不会互相影响。
 * 如果状态是脏的，fork 前会先提交修改记录。
 * 之后可以使用 patchState 来重新同步 fork 后的状态之间的差异。
 *
 * 设计单独的 forkState API 将相比于直接将 state 传入 useImmerProxy 带来更清晰的语义。
 */
export function forkState<T>(state: UndouState<T>, patchListener?: PatchListener | undefined): UndouState<T> {
  state.commit()
  const raw = state[STATE_SOURCE]
  return undou(raw, patchListener)
}

/**
 * 判断一个值是不是 Undou State
 */
export function isUndou<T>(value: UndouState<T> | unknown): value is UndouState<T> {
  return isObject(value) && (value as any)[STATE_SYMBOL] === true
}

function isUndouProxy<T>(value: UndouProxy<T> & UndouProxyInternal<T> | unknown): value is UndouProxy<T> & UndouProxyInternal<T> {
  return isObject(value) && (value as any)[STATE_PROXY_SYMBOL] === true
}

function isObject(value: any): value is Objectish {
  return typeof value === 'object' && value !== null
}
