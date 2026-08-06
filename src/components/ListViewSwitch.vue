<script setup lang="ts">
import type { BoardListView } from 'memi-board/runtime'

defineProps<{
  modelValue: BoardListView
}>()
const emit = defineEmits<{ 'update:modelValue': [value: BoardListView] }>()

const options: Array<{ label: string, value: BoardListView, icon: string }> = [
  { label: '일반', value: 'default', icon: 'i-lucide-list' },
  { label: '조밀', value: 'dense', icon: 'i-lucide-rows-3' },
  { label: '이미지', value: 'image', icon: 'i-lucide-image' },
  { label: '영상', value: 'video', icon: 'i-lucide-play-circle' },
]
</script>

<template>
  <UFieldGroup>
    <UButton
      v-for="option in options"
      :key="option.value"
      :icon="option.icon"
      :aria-label="option.label"
      size="sm"
      :color="modelValue === option.value ? 'primary' : 'neutral'"
      :variant="modelValue === option.value ? 'solid' : 'outline'"
      @click="emit('update:modelValue', option.value)"
    />
  </UFieldGroup>
</template>
