<script setup lang="ts">
import type { Patch } from '~/composables/immer-proxy'
import { useImmerProxy } from '~/composables/immer-proxy'

const patches = ref<Patch[]>([])
const inversePatches = ref<Patch[]>([])

const state = useImmerProxy({
  name: 'immer-proxy',
  description: 'the project being developed by littlesound.',
}, (_patches, _inversePatches) => {
  patches.value.push(..._patches)
  inversePatches.value.push(..._inversePatches)
})

const showState = shallowRef(state)

function update() {
  triggerRef(showState)
}

;(window as any).immerState = state
;(window as any).immerUpdate = update
</script>

<template>
  <div p10 flex="~ col gap-10">
    <h1 text-xl font-900>
      immer-proxy
    </h1>
    <p>use <span class="text-green-300">window.immerState</span> in console to play with immer-proxy</p>
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
      <div v-for="(patch, index) in patches" :key="index">
        <p>{{ patch }}</p>
      </div>
    </div>
    <div>
      <h2 text-lg font-100>
        Inverse Patches
      </h2>
      <div v-for="(patch, index) in inversePatches" :key="index">
        <p>{{ patch }}</p>
      </div>
    </div>
  </div>
</template>
