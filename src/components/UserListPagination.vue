<script setup lang="ts">
import { useMemiBoardI18n } from 'memi-board/runtime'

defineProps<{ page: number; count: number; hasNext: boolean; pending: boolean }>()
defineEmits<{ previous: []; next: [] }>()
const { t, formatNumber } = useMemiBoardI18n()
</script>

<template>
  <nav class="flex flex-wrap items-center justify-between gap-3" :aria-label="t('users.pagination.label')">
    <p aria-live="polite" class="text-sm text-muted">{{ t('users.pagination.status', { page: formatNumber(page), count: formatNumber(count) }) }}</p>
    <div class="flex items-center gap-2">
      <UButton icon="i-lucide-chevron-left" color="neutral" variant="outline" :label="t('common.action.prev')" :disabled="pending || page <= 1" @click="$emit('previous')" />
      <UButton trailing-icon="i-lucide-chevron-right" color="neutral" variant="outline" :label="t('common.action.next')" :disabled="pending || !hasNext" @click="$emit('next')" />
    </div>
  </nav>
</template>
