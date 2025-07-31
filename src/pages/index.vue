<script setup lang="ts">
import type { Patch } from '~/composables/immer-proxy'
import { patchState, useImmerProxy } from '~/composables/immer-proxy'

interface PatchItem {
  direct: Patch[]
  inverse: Patch[]
}
const undoStack = ref<PatchItem[]>([])
const redoStack = ref<PatchItem[]>([])

const state = useImmerProxy({
  name: 'immer-proxy',
  description: 'the project being developed by littlesound.',
}, (patches, inversePatches) => {
  undoStack.value.push(markRaw({
    direct: patches,
    inverse: inversePatches,
  }))
  redoStack.value.length = 0
})

const showState = shallowRef(state)

function update() {
  triggerRef(showState)
}

function undo() {
  if (undoStack.value.length === 0)
    return
  const patch = undoStack.value.pop()!
  redoStack.value.push(patch)
  patchState(state, patch.inverse)
}

function redo() {
  if (redoStack.value.length === 0)
    return
  const patch = redoStack.value.pop()!
  undoStack.value.push(patch)
  patchState(state, patch.direct)
}

;(window as any).immerState = state
;(window as any).immerUpdate = update
</script>

<template>
  <div p10 flex="~ col gap-10">
    <div>
      <h1 text-xl font-900>
        immer-proxy
      </h1>
      <p>use <span class="text-green-300">window.immerState</span> in console to play with immer-proxy</p>
    </div>

    <div flex="~ gap-2">
      <button btn :disabled="undoStack.length === 0" class="disabled:opacity-50" @click="undo">
        Undo ({{ undoStack.length }})
      </button>
      <button btn :disabled="redoStack.length === 0" class="disabled:opacity-50" @click="redo">
        Redo ({{ redoStack.length }})
      </button>
    </div>

    <div>
      <h2 text-lg font-100>
        State
      </h2>
      <pre class="text-sm text-green-300 font-mono whitespace-pre-wrap break-words" v-text="JSON.stringify(showState, null, 2)" />
    </div>

    <div>
      <h2 text-lg font-100>
        Patches
      </h2>
      <div v-for="(patch, index) in undoStack" :key="index" text-green-300>
        <p>{{ patch.direct }}</p>
      </div>
      <div v-for="(patch, index) in redoStack" :key="index" text-red-300>
        <p>{{ patch.direct }}</p>
      </div>
    </div>
    <div>
      <h2 text-lg font-100>
        Inverse Patches
      </h2>
      <div v-for="(patch, index) in undoStack" :key="index" text-red-300>
        <p>{{ patch.inverse }}</p>
      </div>
      <div v-for="(patch, index) in redoStack" :key="index" text-green-300>
        <p>{{ patch.inverse }}</p>
      </div>
    </div>
  </div>
</template>
