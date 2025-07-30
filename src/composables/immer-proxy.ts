import type { Draft, Objectish, PatchListener } from 'immer'
import { enablePatches } from 'immer'

export type { Patch } from 'immer'

enablePatches()
import { createDraft, finishDraft, isDraft } from 'immer'

// TODO 支持数组 push 之类的操作

/**
 * 记录一个对象的修改历史。
 * @param source
 */

export function useImmerProxy<T extends Objectish>(source: T, patchListener?: PatchListener | undefined): Draft<T> {
  let draft = createDraft(source) as Record<string | number | symbol, any>
  let cacheKey = 0

  return createProxy(() => draft) as Draft<T>

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

  function submitDraft() {
    source = finishDraft(draft, patchListener)
    cacheKey += 1
    draft = createDraft(source)
  }
}
