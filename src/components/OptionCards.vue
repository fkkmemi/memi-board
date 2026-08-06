<script setup lang="ts" generic="T extends string">
defineProps<{
  modelValue: T | undefined
  options: Array<{ label: string, value: T, description?: string }>
}>()
const emit = defineEmits<{ 'update:modelValue': [value: T] }>()
</script>

<template>
  <div role="radiogroup" class="flex flex-wrap gap-2">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      :aria-checked="modelValue === option.value"
      class="flex-1 min-w-[7rem] rounded-lg border px-3 py-2.5 text-left transition-colors"
      :class="modelValue === option.value
        ? 'border-primary bg-primary/10 text-primary'
        : 'border-default text-default hover:border-primary/50 hover:bg-elevated/50'"
      @click="emit('update:modelValue', option.value)"
    >
      <span class="flex items-center justify-between gap-2">
        <span class="text-sm font-medium">{{ option.label }}</span>
        <UIcon v-if="modelValue === option.value" name="i-lucide-check" class="size-4 shrink-0" />
      </span>
      <span v-if="option.description" class="mt-0.5 block text-xs text-muted">{{ option.description }}</span>
    </button>
  </div>
</template>
