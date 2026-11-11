<script setup lang="ts">
import MemiBoardSurface from './BoardSurface.vue'
import { computed, ref, resolveComponent, watch } from 'vue'
import {
  imeSafeSubmitClick,
  imeSafeSubmitPointerDown,
  REPORT_REVIEW_NOTE_MAX_LENGTH,
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
const selectedStatus = ref<'open' | 'processed'>('open')
const { reports, pending, loadingMore, hasMore, loadError, loadMore, dismissReport, actionReport } = useMemiBoardReportQueue({
  boardId: () => props.boardId || '', status: selectedStatus,
})
const now = ref(Date.now())
const actingId = ref<string | null>(null)
const selectedReport = ref<BoardReportModel | null>(null)
const selectedAction = ref<'dismiss' | 'action'>('dismiss')
const reviewNote = ref('')
const actionError = ref('')
const modalOpen = ref(false)
const modalTitle = computed(() => t(selectedAction.value === 'dismiss' ? 'reportList.dismissTitle' : 'reportList.resolveTitle'))

function postLink(report: BoardReportModel) { return props.getPostLink?.(report) }
function openReview(report: BoardReportModel, action: 'dismiss' | 'action') {
  selectedReport.value = report
  selectedAction.value = action
  reviewNote.value = ''
  actionError.value = ''
  modalOpen.value = true
}
watch(() => props.boardId, () => { if (!actingId.value) modalOpen.value = false })
async function handle() {
  const report = selectedReport.value
  if (!report?.id || actingId.value) return
  if (!reviewNote.value.trim()) { actionError.value = t('reports.reviewNoteRequired'); return }
  actingId.value = report.id
  actionError.value = ''
  try {
    if (selectedAction.value === 'dismiss') await dismissReport(report, reviewNote.value)
    else await actionReport(report, reviewNote.value)
    modalOpen.value = false
  }
  catch (cause) {
    actionError.value = cause instanceof Error ? cause.message : t('reportList.actionFailed')
  }
  finally { actingId.value = null }
}
</script>

<template>
  <MemiBoardSurface>
    <div class="flex flex-col gap-3">
      <p v-if="!canManageContent" class="py-8 text-center text-sm text-muted">{{ t('reportList.staffOnly') }}</p>
      <template v-else>
        <div class="flex flex-wrap gap-2" role="group" :aria-label="t('reportList.filterLabel')">
          <UButton v-for="status in (['open', 'processed'] as const)" :key="status" :variant="selectedStatus === status ? 'solid' : 'outline'" :aria-pressed="selectedStatus === status" :label="t(`reportList.tabs.${status}`)" @click="selectedStatus = status" />
        </div>
        <p class="text-xs text-muted">{{ t('reportList.orderHint') }}</p>
        <template v-if="pending"><USkeleton v-for="i in 4" :key="i" class="h-16 w-full" /></template>
        <p v-else-if="loadError" role="alert" class="py-8 text-center text-sm text-error">{{ t('reportList.loadFailed', { error: String(loadError) }) }}</p>
        <p v-else-if="!reports.length" class="py-8 text-center text-sm text-muted">{{ t(selectedStatus === 'open' ? 'reportList.empty' : 'reportList.historyEmpty') }}</p>
        <ul v-else class="flex flex-col divide-y divide-default overflow-hidden rounded-lg border border-default">
          <li v-for="report in reports" :key="report.id" class="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-start sm:justify-between">
            <div class="min-w-0 flex-1 space-y-2">
              <component :is="postLink(report) ? NuxtLink : 'p'" :to="postLink(report)" class="block break-words text-sm font-medium text-highlighted" :class="postLink(report) ? 'hover:underline' : ''">{{ report.postTitle || t('reportList.untitled') }}</component>
              <p class="text-xs text-muted">{{ reportReasonLabel(report.reason, locale) }}<span v-if="report.authorName"> · {{ t('reportList.author', { name: report.authorName }) }}</span> · {{ formatRelativeDate(report.createdAt, now) }}</p>
              <p v-if="report.detail" class="whitespace-pre-wrap break-words text-sm text-toned">{{ report.detail }}</p>
              <template v-if="report.status !== 'open'">
                <UBadge :color="report.status === 'dismissed' ? 'neutral' : 'success'" variant="subtle" :label="t(`reportButton.status.${report.status}`)" />
                <p class="text-xs text-muted">{{ t('reportList.reviewer') }}: <span :title="report.reviewedBy">{{ report.reviewedByName || report.reviewedBy || t('reportList.unknownReviewer') }}</span><span v-if="report.reviewedAt"> · {{ formatRelativeDate(report.reviewedAt, now) }}</span></p>
                <p class="whitespace-pre-wrap break-words text-sm text-toned">{{ t('reportList.reviewNote') }}: {{ report.reviewNote || t('reportButton.noNote') }}</p>
              </template>
            </div>
            <div v-if="report.status === 'open'" class="flex shrink-0 flex-wrap items-center gap-2">
              <UButton size="sm" color="neutral" variant="soft" :label="t('reportList.dismiss')" :disabled="!!actingId" @click="openReview(report, 'dismiss')" />
              <UButton size="sm" color="warning" variant="soft" :label="t('reportList.confirm')" :disabled="!!actingId" @click="openReview(report, 'action')" />
            </div>
          </li>
        </ul>
        <UButton v-if="!pending && !loadError && hasMore" color="neutral" variant="outline" :label="t('common.action.more')" block :loading="loadingMore" @click="loadMore" />
      </template>
    </div>
    <UModal v-model:open="modalOpen" :title="modalTitle" :dismissible="!actingId" :close="actingId ? false : undefined">
      <template #body>
        <form class="space-y-4" @submit.prevent="handle">
          <p class="break-words text-sm font-medium text-highlighted">{{ selectedReport?.postTitle || t('reportList.untitled') }}</p>
          <p class="text-sm text-muted">{{ t('reportList.actionHint') }}</p>
          <UFormField :label="t('reportList.reviewNote')" :description="t('reportList.publicNote')" required>
            <UTextarea v-model="reviewNote" required :maxlength="REPORT_REVIEW_NOTE_MAX_LENGTH" :rows="3" :disabled="!!actingId" class="w-full" />
          </UFormField>
          <p v-if="actionError" role="alert" class="text-sm text-error">{{ actionError }}</p>
          <div class="flex flex-wrap justify-end gap-2">
            <UButton type="button" color="neutral" variant="outline" :disabled="!!actingId" :label="t('common.action.cancel')" @click="modalOpen = false" />
            <UButton type="submit" :loading="!!actingId" :label="modalTitle" @pointerdown="imeSafeSubmitPointerDown" @click="imeSafeSubmitClick" />
          </div>
        </form>
      </template>
    </UModal>
  </MemiBoardSurface>
</template>
