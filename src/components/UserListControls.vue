<script setup lang="ts">
import { computed, watch } from 'vue'
import { useMemiBoardI18n } from 'memi-board/runtime'
import { isUserDirectoryDateSort } from 'memi-board/runtime'
import type { UserDirectorySort, UserDirectoryDirection } from 'memi-board/runtime'

const sort = defineModel<UserDirectorySort>('sort', { required: true })
const direction = defineModel<UserDirectoryDirection>('direction', { required: true })
const pageSize = defineModel<number>('pageSize', { required: true })
defineProps<{ disabled?: boolean }>()
const { t, formatNumber } = useMemiBoardI18n()
const sortItems = computed(() => [
  { label: t('users.sort.name'), value: 'name' },
  { label: t('users.sort.role'), value: 'role' },
  { label: t('users.sort.joined'), value: 'joined' },
  { label: t('users.sort.visited'), value: 'visited' },
  { label: t('users.sort.updated'), value: 'updated' },
])
// 날짜 기준은 최신이 먼저, 이름·역할 기준은 오름차순이 자연스러워 기준을 바꾸면 방향도 맞춘다.
watch(sort, (next, previous) => {
  if (next === previous) return
  direction.value = isUserDirectoryDateSort(next) ? 'desc' : 'asc'
})
const dateSortNote = computed(() => isUserDirectoryDateSort(sort.value))
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
    <p v-if="dateSortNote" class="w-full text-xs text-dimmed">{{ t('users.sort.dateNote') }}</p>
  </div>
</template>
