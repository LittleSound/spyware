<script setup lang="ts">
import type { Patch } from 'undou'
import { patchState, undou } from 'undou'

interface PatchItem {
  direct: Patch[]
  inverse: Patch[]
}
const undoStack = ref<PatchItem[]>([])
const redoStack = ref<PatchItem[]>([])

const state = undou({
  name: 'hello, spy!',
  description: 'the project being developed by littlesound.',
  version: '0.0.1',
}, (patches, inversePatches) => {
  undoStack.value.push(markRaw({
    direct: patches,
    inverse: inversePatches,
  }))
  redoStack.value.length = 0
})

const showState = shallowRef(state)

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

;(window as any).spywareState = state
</script>

<template>
  <div p10 flex="~ col gap-10">
    <div>
      <h1 text-xl font-900>
        Spyware
      </h1>
      <p>use <span class="text-blue-300">window.spywareState.value</span> in console to play with undo/redo</p>
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
      <pre class="text-sm text-blue-300 font-mono whitespace-pre-wrap break-words" v-text="JSON.stringify(showState, null, 2)" />
    </div>

    <div flex="~ col gap-5">
      <div flex="~ col gap-2">
        <h2 text-lg font-100>
          Undos
        </h2>
        <div v-for="(patch, index) in undoStack" :key="index">
          <p text-green-300>
            {{ patch.direct }}
          </p>
          <p text-sm text-red-300>
            {{ patch.inverse }}
          </p>
        </div>
      </div>
      <div flex="~ col gap-2">
        <h2 text-lg font-100>
          Redos
        </h2>
        <div v-for="(patch, index) in redoStack" :key="index">
          <p text-green-300>
            {{ patch.direct }}
          </p>
          <p text-sm text-red-300>
            {{ patch.inverse }}
          </p>
        </div>
      </div>
    </div>

    <div flex="~ items-center gap-5" font-100>
      <div flex="~ items-center gap-2">
        <div rounded-full bg-green-300 h-2 w-2 />
        <div op-75>
          Direct Patches
        </div>
      </div>
      <div flex="~ items-center gap-2">
        <div rounded-full bg-red-300 h-2 w-2 />
        <div op-75>
          Inverse Patches
        </div>
      </div>
    </div>
  </div>
</template>
