import type { Draft, Objectish, PatchListener } from 'immer'
import { enablePatches } from 'immer'

export type { Patch } from 'immer'

enablePatches()
import { applyPatches, createDraft, finishDraft, isDraft } from 'immer'

const STATE_SOURCE = Symbol('state-source')
const STATE_SYMBOL = Symbol('state-symbol')

export interface SpiedState<T extends Objectish> {
  readonly [STATE_SYMBOL]: true
  [STATE_SOURCE]: T
  readonly isDirty: boolean
  readonly commit: () => void
  value: Draft<T>
}

/**
 * 返回 Spyware State 并记录对它的修改历史。
 */
export function spyware<T extends Objectish>(source: T, patchListener?: PatchListener | undefined, scheduler?: (commit: () => void) => void): SpiedState<T> {
  let draft = createDraft(source) as Record<string | number | symbol, any>
  let cacheKey = 0
  let pendingPromise: Promise<void> | undefined
  let isDirty = false

  if (isSpyware(source)) {
    throw new Error('The source has been handled by an state proxy.')
  }

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

  const _value = createProxy(() => draft) as Draft<T>

  const immerRoot = {
    [STATE_SYMBOL]: true as const,
    get [STATE_SOURCE]() {
      return source
    },
    set [STATE_SOURCE](value) {
      setSource(value)
    },

    get isDirty() {
      return isDirty
    },

    get commit() {
      return commit
    },

    get value() {
      return _value
    },
    set value(value) {
      draft = value
      dye()
    },
  }

  return immerRoot

  function setSource(value: T) {
    clearCache()
    draft = createDraft(source = value)
  }

  function clearCache() {
    cacheKey += 1
  }

  function commit() {
    if (!isDirty)
      return
    setSource(finishDraft(draft, patchListener))
    isDirty = false
  }

  function dye() {
    isDirty = true
    clearCache()
    scheduler!(commit)
  }

  function createProxy(subDraft: () => Record<string | number | symbol, any>) {
    return new Proxy({}, {
      get(_, prop) {
        let value = Reflect.get(subDraft(), prop)
        if (isDraft(value)) {
          let key = cacheKey
          return createProxy(() => {
            if (key === cacheKey) {
              return value
            }
            key = cacheKey
            return value = Reflect.get(subDraft(), prop)
          })
        }
        return value
      },

      set(_, prop, value) {
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
        const descriptor = Reflect.getOwnPropertyDescriptor(subDraft(), prop)
        if (descriptor && prop === 'length' && Array.isArray(subDraft())) {
          return { ...descriptor, configurable: true }
        }
        return descriptor
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
export function patchState(state: SpiedState<Objectish>, patches: Patch[]) {
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
export function forkState<T extends Objectish>(state: SpiedState<T>, patchListener?: PatchListener | undefined): SpiedState<T> {
  state.commit()
  const raw = state[STATE_SOURCE]
  return spyware(raw, patchListener)
}

/**
 * 判断一个值是不是 Spyware State
 */
export function isSpyware(value: any): value is SpiedState<Objectish> {
  return typeof value === 'object' && value !== null && (value as any)[STATE_SYMBOL] === true
}
