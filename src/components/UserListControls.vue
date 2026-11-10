<script setup lang="ts">
import { computed } from 'vue'
import { useMemiBoardI18n } from 'memi-board/runtime'
import type { UserDirectorySort, UserDirectoryDirection } from 'memi-board/runtime'

const sort = defineModel<UserDirectorySort>('sort', { required: true })
const direction = defineModel<UserDirectoryDirection>('direction', { required: true })
const pageSize = defineModel<number>('pageSize', { required: true })
defineProps<{ disabled?: boolean }>()
const { t, formatNumber } = useMemiBoardI18n()
const sortItems = computed(() => [
  { label: t('users.sort.name'), value: 'name' },
  { label: t('users.sort.role'), value: 'role' },
])
const directionItems = computed(() => [
  { label: t('users.sort.asc'), value: 'asc' },
  { label: t('users.sort.desc'), value: 'desc' },
])
const sizeItems = computed(() => [10, 25, 50].map(value => ({ label: t('users.pagination.perPage', { count: formatNumber(value) }), value })))
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <UIcon name="i-lucide-arrow-up-down" class="size-4 shrink-0 text-muted" />
    <USelect v-model="sort" :items="sortItems" :aria-label="t('users.sort.label')" :disabled="disabled" class="min-w-28" />
    <USelect v-model="direction" :items="directionItems" :aria-label="t('users.sort.direction')" :disabled="disabled" class="min-w-28" />
    <USelect v-model="pageSize" :items="sizeItems" :aria-label="t('users.pagination.pageSize')" :disabled="disabled" class="min-w-32 sm:ml-auto" />
  </div>
</template>
