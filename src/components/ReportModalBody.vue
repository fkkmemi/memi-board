<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  imeSafeSubmitClick,
  imeSafeSubmitPointerDown,
  REPORT_DETAIL_MAX_LENGTH,
  REPORT_REASONS,
  reportReasonLabel,
  useMemiBoardI18n,
} from 'memi-board/runtime'
import type { BoardReportModel, BoardReportReason } from 'memi-board/runtime'

/** 글·댓글 신고 모달 본문: 접수 완료 / 처리 결과 / 신고 폼. 모달이 열릴 때마다 새로 마운트된다. */
const props = defineProps<{
  report: BoardReportModel | null
  done: boolean
  pending: boolean
  error: string
}>()

const emit = defineEmits<{
  submit: [input: { reason: BoardReportReason, detail: string }]
  close: []
}>()

const { t, locale, formatNumber, formatRelativeDate } = useMemiBoardI18n()
const reasonItems = computed(() =>
  REPORT_REASONS.map(item => ({ ...item, label: reportReasonLabel(item.value, locale.value) })),
)
const reason = ref<BoardReportReason>('spam')
const detail = ref('')
const statusLabel = computed(() => t(`reportButton.status.${props.report?.status ?? 'open'}`))
</script>

<template>
  <div v-if="done" class="py-4 text-sm text-muted">
    {{ t('reportButton.done') }}
  </div>
  <div v-else-if="report" class="space-y-3 text-sm" role="status">
    <p class="font-semibold text-highlighted">{{ statusLabel }}</p>
    <p class="text-muted">{{ t(`reportButton.result.${report.status}`) }}</p>
    <p v-if="report.reviewedAt" class="text-xs text-muted">{{ t('reportButton.reviewedAt') }}: {{ formatRelativeDate(report.reviewedAt, Date.now()) }}</p>
    <div v-if="report.status !== 'open'" class="rounded-lg bg-muted p-3">
      <p class="font-medium text-highlighted">{{ t('reportButton.reviewNote') }}</p>
      <p class="mt-1 whitespace-pre-wrap break-words text-toned">{{ report.reviewNote || t('reportButton.noNote') }}</p>
    </div>
    <UButton color="neutral" variant="outline" :label="t('common.action.close')" @click="emit('close')" />
  </div>
  <form
    v-else
    class="flex flex-col gap-3"
    @submit.prevent="emit('submit', { reason, detail })"
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
        @click="emit('close')"
      />
      <UButton
        type="submit"
        color="warning"
        :label="t('reportButton.submit')"
        :loading="pending"
        @pointerdown="imeSafeSubmitPointerDown"
        @click="imeSafeSubmitClick"
      />
    </div>
  </form>
</template>
