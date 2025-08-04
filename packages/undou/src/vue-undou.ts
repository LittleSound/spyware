import type { Objectish, Patch } from 'immer'
import type { Ref } from 'vue'
import { customRef, getCurrentScope, onScopeDispose } from 'vue'
import { undou } from './undou'

export interface VueSpywareStore<T extends Objectish> {
  state: T
  $ref: <K>(path: string) => Ref<K>
  toRefs: <K extends Record<string, string>>(paths: K) => { [P in keyof K]: Ref<unknown> }
  readonly undou: ReturnType<typeof undou<T>>
  subscribe: (callback: (patches: Patch[], inversePatches: Patch[]) => void) => () => void
  subscribePath: (path: string, callback: (patches: Patch[], inversePatches: Patch[]) => void) => () => void
}

function accessNestedProperty(obj: unknown, path: string[]): unknown {
  return path.reduce((current: unknown, key: string) => {
    if (current !== null && typeof current === 'object' && key in current) {
      return (current as Record<string, unknown>)[key]
    }
    return undefined
  }, obj)
}

function setNestedProperty(obj: Record<string, unknown>, path: string[], value: unknown): void {
  const last = path.pop()
  if (!last)
    return

  if (path.length === 0) {
    obj[last] = value
    return
  }

  const parent = path.reduce((current: Record<string, unknown>, key: string) => {
    if (current[key] === undefined) {
      current[key] = {}
    }
    return current[key] as Record<string, unknown>
  }, obj)

  parent[last] = value
}

export function createSpywareStore<T extends Objectish>(initialState: T): VueSpywareStore<T> {
  const pathListeners = new Map<string, Set<() => void>>()
  const globalListeners = new Set<(patches: Patch[], inverse: Patch[]) => void>()
  const pathSubscribers = new Map<string, Set<(patches: Patch[], inverse: Patch[]) => void>>()

  const spywareState = undou(initialState, (patches, inversePatches) => {
    globalListeners.forEach(fn => fn(patches, inversePatches))

    const pathCallbacks = new Map<string, {
      subscribers: Set<(patches: Patch[], inverse: Patch[]) => void>
      listeners: Set<() => void>
      patches: Patch[]
      inversePatches: Patch[]
    }>()

    patches.forEach((patch, index) => {
      let partialPath = ''
      patch.path.forEach((part, i) => {
        partialPath = i === 0 ? String(part) : `${partialPath}.${part}`

        if (!pathCallbacks.has(partialPath)) {
          pathCallbacks.set(partialPath, {
            subscribers: new Set(),
            listeners: new Set(),
            patches: [],
            inversePatches: [],
          })
        }

        const entry = pathCallbacks.get(partialPath)!
        entry.patches.push(patch)
        entry.inversePatches.push(inversePatches[index])

        pathSubscribers.get(partialPath)?.forEach(fn => entry.subscribers.add(fn))
        pathListeners.get(partialPath)?.forEach(fn => entry.listeners.add(fn))
      })
    })

    pathCallbacks.forEach(({ subscribers, listeners, patches: pathPatches, inversePatches: pathInverse }) => {
      subscribers.forEach(fn => fn(pathPatches, pathInverse))
      listeners.forEach(fn => fn())
    })
  })

  const store: VueSpywareStore<T> = {
    get state() {
      return spywareState.value as T
    },

    $ref<K>(path: string) {
      return customRef<K>((track, trigger) => {
        const getParts = () => path.split('.')

        if (!pathListeners.has(path)) {
          pathListeners.set(path, new Set())
        }
        const listeners = pathListeners.get(path)!
        listeners.add(trigger)

        const scope = getCurrentScope()
        if (scope) {
          onScopeDispose(() => {
            listeners.delete(trigger)
            if (listeners.size === 0) {
              pathListeners.delete(path)
            }
          })
        }

        return {
          get() {
            track()
            const parts = getParts()
            try {
              return accessNestedProperty(spywareState.value, parts) as K
            }
            catch {
              return undefined as K
            }
          },
          set(newValue: K) {
            const parts = getParts()
            setNestedProperty(spywareState.value as Record<string, unknown>, parts, newValue)
          },
        }
      })
    },

    toRefs<K extends Record<string, string>>(paths: K): { [P in keyof K]: Ref<unknown> } {
      const result: Record<string, Ref<unknown>> = {}
      for (const [key, path] of Object.entries(paths)) {
        result[key] = this.$ref(path)
      }
      return result as { [P in keyof K]: Ref<unknown> }
    },

    get undou() {
      return spywareState
    },

    subscribe(callback: (patches: Patch[], inversePatches: Patch[]) => void) {
      globalListeners.add(callback)

      const unsubscribe = () => globalListeners.delete(callback)

      const scope = getCurrentScope()
      if (scope) {
        onScopeDispose(unsubscribe)
      }

      return unsubscribe
    },

    subscribePath(path: string, callback: (patches: Patch[], inversePatches: Patch[]) => void) {
      if (!pathSubscribers.has(path)) {
        pathSubscribers.set(path, new Set())
      }
      const subscribers = pathSubscribers.get(path)!
      subscribers.add(callback)

      const unsubscribe = () => {
        subscribers.delete(callback)
        if (subscribers.size === 0) {
          pathSubscribers.delete(path)
        }
      }

      const scope = getCurrentScope()
      if (scope) {
        onScopeDispose(unsubscribe)
      }

      return unsubscribe
    },
  }

  return store
}

export function useSpywareStore<T extends Objectish>(initialState: T) {
  return createSpywareStore(initialState)
}
