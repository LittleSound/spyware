<script setup lang="ts">
import type { Patch } from 'undou'

defineProps<{
  patch: Patch
}>()
</script>

<template>
  <div space-x-1>
    <div title="op" px1 border rounded inline-flex min-w-4.5em justify-center>
      {{ patch.op }}
    </div>
    <div flex="inline" title="path">
      <div v-for="(item, index) of patch.path" :key="index">
        {{ index === 0 ? '' : '.' }}{{ item }}
      </div>
    </div>
    <template v-if="patch.op !== 'remove'">
      <div inline>
        =
      </div>
      <div title="value" op75 inline>
        {{ patch.value === undefined ? 'undefined' : patch.value }}
      </div>
    </template>
  </div>
</template>
