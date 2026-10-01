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
const { t, locale, formatNumber } = useMemiBoardI18n()
const reasonItems = computed(() =>
  REPORT_REASONS.map(item => ({ ...item, label: reportReasonLabel(item.value, locale.value) })),
)
const { hasReported, pending, submitReport } = useMemiBoardReports(props.boardId, props.postId)

const open = ref(false)
const reason = ref<BoardReportReason>('spam')
const detail = ref('')
const error = ref('')
const done = ref(false)

const isOwnPost = computed(() => !!user.value && user.value.uid === props.authorUid)
const canReport = computed(() => isSignedIn.value && !isOwnPost.value)

function openModal() {
  if (hasReported.value || pending.value) return
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
      :label="hasReported ? t('reportButton.reported') : t('common.action.report')"
      :disabled="hasReported"
      @click="openModal"
    />
    <UModal v-model:open="open" :title="t('reportButton.title')">
      <template #body>
        <div v-if="done" class="py-4 text-sm text-muted">
          {{ t('reportButton.done') }}
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
          <UTextarea
            v-model="detail"
            :rows="3"
            :maxlength="REPORT_DETAIL_MAX_LENGTH"
            :placeholder="t('reportButton.detailPlaceholder')"
          />
          <p class="text-right text-xs text-dimmed">
            {{ formatNumber(detail.length) }} / {{ formatNumber(REPORT_DETAIL_MAX_LENGTH) }}
          </p>
          <p v-if="error" class="text-xs text-error">
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
