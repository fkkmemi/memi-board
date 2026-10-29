<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMemiBoardCleanup, useMemiBoardI18n } from 'memi-board/runtime'

const { t } = useMemiBoardI18n()
const { items, busy, scanned, error, result, scan, remove } = useMemiBoardCleanup()
const selected = ref<string[]>([])
const allSelected = computed(() => items.value.length > 0 && items.value.every(item => selected.value.includes(item.path)))
async function refresh() {
  selected.value = []
  await scan()
}
function toggleAll() {
  selected.value = allSelected.value ? [] : items.value.map(item => item.path)
}
async function deleteSelected() {
  const paths = selected.value.filter(path => items.value.some(item => item.path === path))
  if (!paths.length || !window.confirm(t('settings.cleanup.confirm', { count: paths.length }))) return
  await remove(paths)
  selected.value = selected.value.filter(path => items.value.some(item => item.path === path))
}
</script>

<template>
  <section class="flex flex-col gap-3 rounded-lg border border-default p-4" :aria-busy="busy">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="font-semibold">{{ t('settings.cleanup.title') }}</h2>
        <p class="mt-1 text-sm text-muted">{{ t('settings.cleanup.description') }}</p>
      </div>
      <UButton :label="t('settings.cleanup.scan')" icon="i-lucide-scan-search" color="neutral" variant="outline" :loading="busy" :disabled="busy" @click="refresh" />
    </div>
    <UAlert v-if="error" color="error" variant="subtle" :description="error" />
    <p v-if="scanned && !items.length" class="text-sm text-muted" role="status">{{ t('settings.cleanup.empty') }}</p>
    <template v-if="items.length">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <label class="flex items-center gap-2 text-sm">
          <input type="checkbox" :checked="allSelected" :disabled="busy" @change="toggleAll">
          {{ t('settings.cleanup.selectAll', { count: items.length }) }}
        </label>
        <UButton :label="t('settings.cleanup.delete', { count: selected.length })" icon="i-lucide-trash-2" color="error" variant="outline" :disabled="busy || !selected.length" @click="deleteSelected" />
      </div>
      <ul class="max-h-80 divide-y divide-default overflow-auto rounded-lg border border-default">
        <li v-for="item in items" :key="item.path" class="px-3 py-2">
          <label class="flex items-start gap-2 text-sm">
            <input v-model="selected" type="checkbox" :value="item.path" :disabled="busy" class="mt-1">
            <span class="min-w-0">
              <span class="font-medium">{{ t(`settings.cleanup.kinds.${item.kind}`) }}</span>
              <span v-if="item.size !== undefined" class="ml-2 text-xs text-muted">{{ (item.size / 1024).toFixed(1) }} KB</span>
              <code class="block break-all text-xs text-muted">{{ item.path }}</code>
            </span>
          </label>
        </li>
      </ul>
    </template>
    <p v-if="result" role="status" class="text-sm">{{ result }}</p>
  </section>
</template>
