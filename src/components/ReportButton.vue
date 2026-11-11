<script setup lang="ts">
import { imeSafeSubmitClick, imeSafeSubmitPointerDown } from 'memi-board/runtime'
import { computed, ref } from 'vue'
import {
  REPORT_DETAIL_MAX_LENGTH,
  REPORT_REASONS,
  reportReasonLabel,
  useMemiBoardAuth,
  useMemiBoardI18n,
  useMemiBoardReports,
} from 'memi-board/runtime'
import type { BoardReportReason } from 'memi-board/runtime'

const props = defineProps<{
  boardId: string
  postId: string
  authorUid: string
  authorName?: string | null
  postTitle?: string | null
}>()

const { isSignedIn, user } = useMemiBoardAuth()
const { t, locale, formatNumber, formatRelativeDate } = useMemiBoardI18n()
const reasonItems = computed(() =>
  REPORT_REASONS.map(item => ({ ...item, label: reportReasonLabel(item.value, locale.value) })),
)
const { hasReported, report, reportPending, reportError, pending, submitReport } = useMemiBoardReports(props.boardId, props.postId)

const open = ref(false)
const reason = ref<BoardReportReason>('spam')
const detail = ref('')
const error = ref('')
const done = ref(false)

const isOwnPost = computed(() => !!user.value && user.value.uid === props.authorUid)
const canReport = computed(() => isSignedIn.value && !isOwnPost.value)
const statusLabel = computed(() => t(`reportButton.status.${report.value?.status ?? 'open'}`))

function openModal() {
  if (reportPending.value || reportError.value || pending.value) return
  reason.value = 'spam'
  detail.value = ''
  error.value = ''
  done.value = false
  open.value = true
}

async function submit() {
  if (pending.value) return
  error.value = ''
  try {
    await submitReport({
      reason: reason.value,
      detail: detail.value,
      postTitle: props.postTitle || '',
      authorUid: props.authorUid,
      authorName: props.authorName ?? null,
    })
    done.value = true
  }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : t('reportButton.failed')
  }
}
</script>

<template>
  <template v-if="canReport">
    <UButton
      icon="i-lucide-flag"
      size="sm"
      variant="ghost"
      :color="hasReported ? 'warning' : 'neutral'"
      :label="hasReported ? statusLabel : t('common.action.report')"
      :disabled="reportPending || !!reportError || pending"
      @click="openModal"
    />
    <p v-if="reportError" role="alert" class="text-xs text-error">{{ reportError }}</p>
    <UModal v-model:open="open" :title="hasReported && !done ? t('reportButton.resultTitle') : t('reportButton.title')">
      <template #body>
        <div v-if="done" class="py-4 text-sm text-muted">
          {{ t('reportButton.done') }}
        </div>
        <div v-else-if="hasReported && report" class="space-y-3 text-sm" role="status">
          <p class="font-semibold text-highlighted">{{ statusLabel }}</p>
          <p class="text-muted">{{ t(`reportButton.result.${report.status}`) }}</p>
          <p v-if="report.reviewedAt" class="text-xs text-muted">{{ t('reportButton.reviewedAt') }}: {{ formatRelativeDate(report.reviewedAt, Date.now()) }}</p>
          <div v-if="report.status !== 'open'" class="rounded-lg bg-muted p-3">
            <p class="font-medium text-highlighted">{{ t('reportButton.reviewNote') }}</p>
            <p class="mt-1 whitespace-pre-wrap break-words text-toned">{{ report.reviewNote || t('reportButton.noNote') }}</p>
          </div>
          <UButton color="neutral" variant="outline" :label="t('common.action.close')" @click="open = false" />
        </div>
        <form
          v-else
          class="flex flex-col gap-3"
          @submit.prevent="submit"
        >
          <URadioGroup
            v-model="reason"
            :items="reasonItems"
            value-key="value"
            :legend="t('reportButton.reason')"
          />
          <UFormField :label="reason === 'other' ? t('reportButton.detailRequired') : t('reportButton.detailPlaceholder')" :required="reason === 'other'">
            <UTextarea v-model="detail" :rows="3" :maxlength="REPORT_DETAIL_MAX_LENGTH" :required="reason === 'other'" class="w-full" />
          </UFormField>
          <p class="text-right text-xs text-dimmed">
            {{ formatNumber(detail.length) }} / {{ formatNumber(REPORT_DETAIL_MAX_LENGTH) }}
          </p>
          <p v-if="error" role="alert" class="text-xs text-error">
            {{ error }}
          </p>
          <div class="flex justify-end gap-2">
            <UButton
              type="button"
              color="neutral"
              variant="ghost"
              :label="t('common.action.cancel')"
              :disabled="pending"
              @click="open = false"
            />
            <UButton
              type="submit"
              @pointerdown="imeSafeSubmitPointerDown"
              @click="imeSafeSubmitClick"
              color="warning"
              :label="t('reportButton.submit')"
              :loading="pending"
            />
          </div>
        </form>
      </template>
    </UModal>
  </template>
</template>
