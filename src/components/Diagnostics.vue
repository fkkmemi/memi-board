<script setup lang="ts">
import { AUTHOR_MEMO_MAX_COUNT, useMemiBoardI18n } from 'memi-board/runtime'

const { t } = useMemiBoardI18n()

// Each check maps to a CLIENT-only row of the Spec sheet. Scanning other users' memos needs an admin
// read rule on memiBoardUsers/{uid}/memos or a server-side job — neither exists yet.
const checks = [
  { key: 'authorMemoCount', spec: '1.6', params: { max: AUTHOR_MEMO_MAX_COUNT } },
] as const
</script>

<template>
  <section class="flex flex-col gap-3 rounded-lg border border-default p-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="flex items-center gap-2 font-semibold">
          {{ t('settings.diagnostics.title') }}
          <UBadge :label="t('settings.diagnostics.comingSoon')" color="neutral" variant="subtle" size="sm" />
        </h2>
        <p class="mt-1 text-sm text-muted">{{ t('settings.diagnostics.description') }}</p>
      </div>
      <UButton :label="t('settings.diagnostics.scan')" icon="i-lucide-stethoscope" color="neutral" variant="outline" disabled />
    </div>
    <ul class="divide-y divide-default rounded-lg border border-default">
      <li v-for="check in checks" :key="check.key" class="flex items-start gap-3 px-3 py-2 text-sm">
        <span class="shrink-0 font-mono text-xs text-muted">{{ check.spec }}</span>
        <span>{{ t(`settings.diagnostics.checks.${check.key}`, check.params) }}</span>
      </li>
    </ul>
  </section>
</template>
