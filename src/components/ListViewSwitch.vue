<script setup lang="ts">
import { computed } from 'vue'
import type { BoardListView } from 'memi-board/runtime'
import { useMemiBoardI18n } from 'memi-board/runtime'

defineProps<{
  modelValue: BoardListView
}>()
const emit = defineEmits<{ 'update:modelValue': [value: BoardListView] }>()

const { t } = useMemiBoardI18n()

const options = computed<Array<{ label: string, value: BoardListView, icon: string }>>(() => [
  { label: t('listViewSwitch.default'), value: 'default', icon: 'i-lucide-list' },
  { label: t('listViewSwitch.dense'), value: 'dense', icon: 'i-lucide-rows-3' },
  { label: t('common.label.image'), value: 'image', icon: 'i-lucide-image' },
  { label: t('listViewSwitch.video'), value: 'video', icon: 'i-lucide-play-circle' },
])
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
