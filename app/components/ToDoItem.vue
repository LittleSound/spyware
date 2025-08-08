<script setup lang="ts">
const props = defineProps<{
  id: string
  isSelected: boolean
}>()

const emit = defineEmits<{
  (e: 'select', id: string): void
  (e: 'remove', id: string): void
}>()

const title = defineModel<string>('title', { required: true })
const completed = defineModel<boolean>('completed', { required: true })

function onSelect() {
  emit('select', props.id)
}

function onRemove() {
  emit('remove', props.id)
}
</script>

<template>
  <div flex="~ items-start">
    <div
      flex="~ gap-4"
      p2
      rounded-md
      bg-gray-600
      cursor-pointer
      :class="{ '!outline-2 outline-blue-400': props.isSelected }"
      @click="onSelect"
    >
      <div size-8 flex="~ items-center justify-center">
        <input v-model="completed" type="checkbox" size-4 cursor-pointer click-feedback>
      </div>
      <div flex="~ items-center">
        <input v-model="title" outline-none>
      </div>
      <button btn @click="onRemove">
        Remove
      </button>
    </div>
  </div>
</template>
