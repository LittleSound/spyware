import type { Patch } from '../src/index'
import { describe, expect, it } from 'vitest'
import { forkState, isUndou, patchState, undou } from '../src/undou'

function nextTick() {
  return Promise.resolve().then(() => {})
}

describe('undou', () => {
  it('should works', async () => {
    const changes: Patch[] = []
    const inverseChanges: Patch[] = []

    const state = undou({
      foo: { bar: 'baz' },
    }, (patches, inversePatches) => {
      changes.push(...patches)
      inverseChanges.push(...inversePatches)
    })

    expect(isUndou(state)).toBe(true)

    expect(state.value).toMatchInlineSnapshot(`
      {
        "foo": {
          "bar": "baz",
        },
      }
    `)

    expect(changes).toEqual([])
    expect(inverseChanges).toEqual([])
    expect(state.isDirty).toBe(false)

    state.value.foo.bar = 'qux'
    expect(state.value.foo.bar).toBe('qux')
    expect(state.isDirty).toBe(true)

    await nextTick()
    expect(state.isDirty).toBe(false)
    expect(changes).toMatchInlineSnapshot(`
      [
        {
          "op": "replace",
          "path": [
            "foo",
            "bar",
          ],
          "value": "qux",
        },
      ]
    `)
    expect(inverseChanges).toMatchInlineSnapshot(`
      [
        {
          "op": "replace",
          "path": [
            "foo",
            "bar",
          ],
          "value": "baz",
        },
      ]
    `)
  })

  it('should works with basic types', async () => {
    const changes: Patch[] = []
    const inverseChanges: Patch[] = []
    const state = undou('foo', (patches, inversePatches) => {
      changes.push(...patches)
      inverseChanges.push(...inversePatches)
    })

    expect(state.value).toBe('foo')

    state.value = 'bar'
    expect(state.value).toBe('bar')

    await nextTick()
    expect(changes).toMatchInlineSnapshot(`
      [
        {
          "op": "replace",
          "path": [],
          "value": "bar",
        },
      ]
    `)
    expect(inverseChanges).toMatchInlineSnapshot(`
      [
        {
          "op": "replace",
          "path": [],
          "value": "foo",
        },
      ]
    `)

    patchState(state, inverseChanges)
    expect(state.value).toBe('foo')
  })

  it('should patch state', async () => {
    const changes: Patch[] = []
    const inverseChanges: Patch[] = []
    const state = undou({
      foo: 'bar',
    }, (patches, inversePatches) => {
      changes.push(...patches)
      inverseChanges.push(...inversePatches)
    })

    state.value.foo = 'baz'

    await nextTick()

    patchState(state, inverseChanges)
    expect(state.value.foo).toBe('bar')

    patchState(state, changes)
    expect(state.value.foo).toBe('baz')
  })

  it('should fork state', async () => {
    const changes: Patch[] = []
    const inverseChanges: Patch[] = []
    const state = undou({
      foo: 100,
      bar: 200,
    }, (patches, inversePatches) => {
      changes.push(...patches)
      inverseChanges.push(...inversePatches)
    })

    // fork will commit the uncommitted changes
    state.value.foo += 1

    const forkedChanges: Patch[] = []
    const forkedInverseChanges: Patch[] = []
    const forkedState = forkState(state, (patches, inversePatches) => {
      forkedChanges.push(...patches)
      forkedInverseChanges.push(...inversePatches)
    })
    expect(isUndou(forkedState)).toBe(true)

    expect(state.value.foo).toBe(101)
    expect(forkedState.value.foo).toBe(101)
    expect(state.isDirty).toBe(false)
    expect(changes).toMatchInlineSnapshot(`
      [
        {
          "op": "replace",
          "path": [
            "foo",
          ],
          "value": 101,
        },
      ]
    `)
    expect(inverseChanges).toMatchInlineSnapshot(`
      [
        {
          "op": "replace",
          "path": [
            "foo",
          ],
          "value": 100,
        },
      ]
    `)

    // forked state is independent
    state.value.foo += 1
    forkedState.value.bar += 1

    expect(state.value).toMatchInlineSnapshot(`
      {
        "bar": 200,
        "foo": 102,
      }
    `)
    expect(forkedState.value).toMatchInlineSnapshot(`
      {
        "bar": 201,
        "foo": 101,
      }
    `)

    await nextTick()

    expect(changes).toMatchInlineSnapshot(`
      [
        {
          "op": "replace",
          "path": [
            "foo",
          ],
          "value": 101,
        },
        {
          "op": "replace",
          "path": [
            "foo",
          ],
          "value": 102,
        },
      ]
    `)
    expect(inverseChanges).toMatchInlineSnapshot(`
      [
        {
          "op": "replace",
          "path": [
            "foo",
          ],
          "value": 100,
        },
        {
          "op": "replace",
          "path": [
            "foo",
          ],
          "value": 101,
        },
      ]
    `)
    expect(forkedChanges).toMatchInlineSnapshot(`
      [
        {
          "op": "replace",
          "path": [
            "bar",
          ],
          "value": 201,
        },
      ]
    `)
    expect(forkedInverseChanges).toMatchInlineSnapshot(`
      [
        {
          "op": "replace",
          "path": [
            "bar",
          ],
          "value": 200,
        },
      ]
    `)

    // patch can merge changes from different states
    // patch will commit the uncommitted changes
    state.value.foo += 1
    patchState(state, forkedChanges)
    expect(state.value).toMatchInlineSnapshot(`
      {
        "bar": 201,
        "foo": 103,
      }
    `)
    expect(changes).toMatchInlineSnapshot(`
      [
        {
          "op": "replace",
          "path": [
            "foo",
          ],
          "value": 101,
        },
        {
          "op": "replace",
          "path": [
            "foo",
          ],
          "value": 102,
        },
        {
          "op": "replace",
          "path": [
            "foo",
          ],
          "value": 103,
        },
      ]
    `)
    expect(inverseChanges).toMatchInlineSnapshot(`
      [
        {
          "op": "replace",
          "path": [
            "foo",
          ],
          "value": 100,
        },
        {
          "op": "replace",
          "path": [
            "foo",
          ],
          "value": 101,
        },
        {
          "op": "replace",
          "path": [
            "foo",
          ],
          "value": 102,
        },
      ]
    `)
  })

  it('should works with array', async () => {
    const changes: Patch[] = []
    const inverseChanges: Patch[] = []
    const state = undou({
      foo: [1, 2],
    }, (patches, inversePatches) => {
      changes.push(...patches)
      inverseChanges.push(...inversePatches)
    })

    expect(Array.isArray(state.value.foo)).toBe(true)
    expect(state.value.foo).toMatchInlineSnapshot(`
      [
        1,
        2,
      ]
    `)

    state.value.foo.push(3)
    expect(state.value.foo).toMatchInlineSnapshot(`
      [
        1,
        2,
        3,
      ]
    `)
    expect(state.isDirty).toBe(true)

    await nextTick()
    expect(state.isDirty).toBe(false)
    expect(changes).toMatchInlineSnapshot(`
      [
        {
          "op": "add",
          "path": [
            "foo",
            2,
          ],
          "value": 3,
        },
      ]
    `)
    expect(inverseChanges).toMatchInlineSnapshot(`
      [
        {
          "op": "remove",
          "path": [
            "foo",
            2,
          ],
        },
      ]
    `)

    state.value.foo.pop()
    expect(state.value.foo).toMatchInlineSnapshot(`
      [
        1,
        2,
      ]
    `)
    expect(state.isDirty).toBe(true)

    await nextTick()
    expect(state.isDirty).toBe(false)
    expect(changes).toMatchInlineSnapshot(`
      [
        {
          "op": "add",
          "path": [
            "foo",
            2,
          ],
          "value": 3,
        },
        {
          "op": "remove",
          "path": [
            "foo",
            2,
          ],
        },
      ]
    `)
  })

  it('should replace root state', async () => {
    const changes: Patch[] = []
    const inverseChanges: Patch[] = []
    const state = undou({
      foo: 100,
    } as any, (patches, inversePatches) => {
      changes.push(...patches)
      inverseChanges.push(...inversePatches)
    })

    state.value = {
      bar: 200,
    }

    expect(state.value.foo).toBe(undefined)
    expect(state.value.bar).toBe(200)

    await nextTick()

    state.value = undefined
    expect(state.value).toBe(undefined)

    await nextTick()

    state.value = {
      bar: 200,
    }
    state.value.bar = 300

    await nextTick()
    expect(state.value.foo).toBe(undefined)
    expect(state.value.bar).toBe(300)

    expect(changes).toMatchInlineSnapshot(`
      [
        {
          "op": "replace",
          "path": [],
          "value": {
            "bar": 200,
          },
        },
        {
          "op": "replace",
          "path": [],
          "value": undefined,
        },
        {
          "op": "replace",
          "path": [],
          "value": {
            "bar": 200,
          },
        },
        {
          "op": "replace",
          "path": [
            "bar",
          ],
          "value": 300,
        },
      ]
    `)
  })

  it('should be equal when the state is unchanged', async () => {
    const state = undou({
      foo: { bar: 'baz' },
    })

    expect(state.value.foo).toBe(state.value.foo)

    state.value.foo.bar = 'qux'
    expect(state.value.foo).toBe(state.value.foo)

    const oldFoo = state.value.foo
    state.value.foo = { bar: 'baz' }
    expect(state.value.foo).not.toBe(oldFoo)
  })

  it('should move the property of the state', async () => {
    const changes: Patch[] = []
    const inverseChanges: Patch[] = []
    const state = undou({
      foo: { a: 1 },
      bar: {} as { a?: number },
    }, (patches, inversePatches) => {
      changes.push(...patches)
      inverseChanges.push(...inversePatches)
    })

    expect(state.value.foo.a).toBe(1)

    await nextTick()

    state.value.bar = state.value.foo
    expect(state.value.bar).toEqual({ a: 1 })

    state.value.bar.a = 2
    expect(state.value.foo).toEqual({ a: 2 })
    expect(state.value.bar).toEqual({ a: 2 })

    await nextTick()
    expect(changes).toMatchInlineSnapshot(`
      [
        {
          "op": "replace",
          "path": [
            "foo",
            "a",
          ],
          "value": 2,
        },
        {
          "op": "replace",
          "path": [
            "bar",
          ],
          "value": {
            "a": 2,
          },
        },
      ]
    `)
    expect(inverseChanges).toMatchInlineSnapshot(`
      [
        {
          "op": "replace",
          "path": [
            "foo",
            "a",
          ],
          "value": 1,
        },
        {
          "op": "replace",
          "path": [
            "bar",
          ],
          "value": {},
        },
      ]
    `)
  })
})
