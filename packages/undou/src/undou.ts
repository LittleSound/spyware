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
  let draft: Record<string | number | symbol, any>
  let cacheKey = 0
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
      clearCache()
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
        initDraftAndProxy()
      }

      return proxiedValue
    },
    set value(newVal) {
      isDirty = false
      clearCache()

      setSource(produce(source, (_) => {
        return (newVal === undefined ? nothing : newVal) as any
      }, patchListener))
    },
  }

  return immerRoot

  function initDraftAndProxy() {
    if (isObject(source)) {
      draft = createDraft(source)
      clearCache()
      proxiedValue = createProxy(source, () => {
        if (proxiedValue === INVALID)
          initDraftAndProxy()
        return draft
      }) as UndouDraft<T>
    }
    else {
      proxiedValue = source as UndouDraft<T>
    }
  }

  function setSource<S extends T>(value: S) {
    source = value
    proxiedValue = INVALID
    draft = {}
  }

  function clearCache() {
    cacheKey += 1
  }

  function commit() {
    if (!isDirty)
      return
    setSource(finishDraft(draft, patchListener))
    clearCache()
    isDirty = false
  }

  function dye() {
    isDirty = true
    clearCache()
    scheduler!(commit)
  }

  function createProxy(target: any, subDraft: () => Record<string | number | symbol, any>) {
    target = Array.isArray(target) ? [] : {}
    return new Proxy(target, {
      get(ctx, prop) {
        if (prop === STATE_PROXY_SYMBOL) {
          return true
        }
        if (prop === STATE_DRAFT) {
          return subDraft()
        }

        let value = Reflect.get(subDraft(), prop)

        if (isDraft(value)) {
          let proxyCatch = ctx[prop] as { source: unknown, proxy: unknown } | undefined
          const originalValue = original(value)

          if (proxyCatch && proxyCatch.source === originalValue)
            return proxyCatch.proxy

          let key = cacheKey
          ctx[prop] = proxyCatch = {
            source: originalValue,
            proxy: createProxy(originalValue, () => {
              if (key === cacheKey) {
                return value
              }
              key = cacheKey
              return value = Reflect.get(subDraft(), prop)
            }),
          }

          return proxyCatch.proxy
        }

        return value
      },

      set(_, prop, value) {
        if (isUndouProxy(value))
          value = value[STATE_DRAFT]

        const result = Reflect.set(subDraft(), prop, value)
        dye()
        return result
      },

      deleteProperty(_, prop) {
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

      defineProperty(_, prop, descriptor) {
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
