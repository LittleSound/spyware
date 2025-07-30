<script setup lang="ts">
import { useDark } from '@vueuse/core'

useDark().value = true
</script>

<template>
  <main font-sans text="gray-700 dark:gray-200">
    <RouterView />
  </main>
</template>
