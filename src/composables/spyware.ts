import type { Draft, Objectish, PatchListener } from 'immer'
import { enablePatches } from 'immer'

export type { Patch } from 'immer'

enablePatches()
import { applyPatches, createDraft, finishDraft, isDraft } from 'immer'

// TODO 支持数组 push 之类的操作

const STATE_SOURCE = Symbol('state-source')
const STATE_SYMBOL = Symbol('state-symbol')

export interface SpiedState<T extends Objectish> {
  readonly [STATE_SYMBOL]: true
  [STATE_SOURCE]: T
  value: Draft<T>
}

/**
 * 返回 Spyware State 并记录对它的修改历史。
 */
export function spyware<T extends Objectish>(source: T, patchListener?: PatchListener | undefined): SpiedState<T> {
  let draft = createDraft(source) as Record<string | number | symbol, any>
  let cacheKey = 0

  if (isSpyware(source)) {
    throw new Error('The source has been handled by an state proxy.')
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

    get value() {
      return _value
    },
    set value(value) {
      submitDraft(value)
    },
  }

  return immerRoot

  function setSource(value: T) {
    source = value
    cacheKey += 1
    draft = createDraft(source)
  }

  function submitDraft(value = draft) {
    setSource(finishDraft(value, patchListener))
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
        submitDraft()
        return result
      },

      deleteProperty(_, prop) {
        const result = Reflect.deleteProperty(subDraft(), prop)
        submitDraft()
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
        submitDraft()
        return result
      },

      isExtensible(_) {
        return Reflect.isExtensible(subDraft())
      },

      preventExtensions(_) {
        const result = Reflect.preventExtensions(subDraft())
        submitDraft()
        return result
      },

      getPrototypeOf(_) {
        return Reflect.getPrototypeOf(subDraft())
      },

      defineProperty(_, prop, descriptor) {
        const result = Reflect.defineProperty(subDraft(), prop, descriptor)
        submitDraft()
        return result
      },
    })
  }
}

/**
 * 将修改记录应用到状态上并修改状态。
 */
export function patchState(state: SpiedState<Objectish>, patches: Patch[]) {
  let source = state[STATE_SOURCE]
  source = applyPatches(source, patches)
  state[STATE_SOURCE] = source
}

/**
 * 克隆传入的状态，并返回一个新状态。新状态与旧状态完全独立，不会互相影响。
 * 之后可以使用 patchState 来重新同步 fork 后的状态之间的差异。
 *
 * 设计单独的 forkState API 将相比于直接将 state 传入 useImmerProxy 带来更清晰的语义。
 */
export function forkState<T extends Objectish>(state: SpiedState<T>, patchListener?: PatchListener | undefined): SpiedState<T> {
  const raw = state[STATE_SOURCE]
  return spyware(raw, patchListener)
}

/**
 * 判断一个值是不是 Spyware State
 */
export function isSpyware(value: any): value is SpiedState<Objectish> {
  return typeof value === 'object' && value !== null && (value as any)[STATE_SYMBOL] === true
}
