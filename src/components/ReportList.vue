<script setup lang="ts">
import { ref, resolveComponent } from 'vue'
import {
  reportReasonLabel,
  useMemiBoardAuth,
  useMemiBoardI18n,
  useMemiBoardReportQueue,
} from 'memi-board/runtime'
import type { BoardReportModel } from 'memi-board/runtime'

const props = defineProps<{
  boardId?: string
  getPostLink?: (report: BoardReportModel) => string | undefined
}>()

const NuxtLink = resolveComponent('NuxtLink')
const { t, locale, formatRelativeDate } = useMemiBoardI18n()
const { canManageContent } = useMemiBoardAuth()
const { reports, pending, loadingMore, hasMore, loadError, loadMore, dismissReport, actionReport } = useMemiBoardReportQueue({
  boardId: () => props.boardId || '',
})
const now = ref(Date.now())
const actingId = ref<string | null>(null)

function postLink(report: BoardReportModel) {
  return props.getPostLink?.(report)
}

async function handle(report: BoardReportModel, action: 'dismiss' | 'action') {
  if (!report.id) return
  actingId.value = report.id
  try {
    if (action === 'dismiss') await dismissReport(report)
    else await actionReport(report)
  }
  finally {
    actingId.value = null
  }
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <p
      v-if="!canManageContent"
      class="py-8 text-center text-sm text-muted"
    >
      {{ t('reportList.staffOnly') }}
    </p>
    <template v-else-if="pending">
      <USkeleton v-for="i in 4" :key="i" class="h-16 w-full" />
    </template>
    <p
      v-else-if="loadError"
      class="py-8 text-center text-sm text-error"
    >
      {{ t('reportList.loadFailed', { error: String(loadError) }) }}
    </p>
    <p
      v-else-if="!reports.length"
      class="py-8 text-center text-sm text-muted"
    >
      {{ t('reportList.empty') }}
    </p>
    <ul
      v-else
      class="flex flex-col divide-y divide-default overflow-hidden rounded-lg border border-default"
    >
      <li
        v-for="report in reports"
        :key="report.id"
        class="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-start sm:justify-between"
      >
        <div class="min-w-0 flex-1">
          <component
            :is="postLink(report) ? NuxtLink : 'p'"
            :to="postLink(report)"
            class="truncate text-sm font-medium text-highlighted"
            :class="postLink(report) ? 'hover:underline' : ''"
          >
            {{ report.postTitle || t('reportList.untitled') }}
          </component>
          <p class="mt-0.5 text-xs text-muted">
            {{ reportReasonLabel(report.reason, locale.value) }}
            <span v-if="report.authorName"> · {{ t('reportList.author', { name: report.authorName }) }}</span>
            · {{ formatRelativeDate(report.createdAt, now) }}
          </p>
          <p
            v-if="report.detail"
            class="mt-1 line-clamp-3 text-sm text-toned"
          >
            {{ report.detail }}
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-1">
          <UButton
            size="xs"
            color="neutral"
            variant="soft"
            :label="t('reportList.dismiss')"
            :loading="actingId === report.id"
            @click="handle(report, 'dismiss')"
          />
          <UButton
            size="xs"
            color="warning"
            variant="soft"
            :label="t('reportList.confirm')"
            :loading="actingId === report.id"
            @click="handle(report, 'action')"
          />
        </div>
      </li>
    </ul>
    <UButton
      v-if="canManageContent && !pending && hasMore"
      variant="outline"
      color="neutral"
      :label="t('common.action.more')"
      block
      :loading="loadingMore"
      @click="loadMore"
    />
  </div>
</template>
