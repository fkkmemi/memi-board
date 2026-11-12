<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  useMemiBoardAuth,
  useMemiBoardCommentReport,
  useMemiBoardI18n,
} from 'memi-board/runtime'
import type { BoardReportReason } from 'memi-board/runtime'
import MemiBoardReportModalBody from './ReportModalBody.vue'

const props = defineProps<{
  boardId: string
  postId: string
  commentId: string
  authorUid: string
  authorName?: string | null
  commentBody: string
}>()

const { isSignedIn, user } = useMemiBoardAuth()
const { t } = useMemiBoardI18n()
const { hasReported, report, reportPending, reportError, pending, loadReport, submitReport } = useMemiBoardCommentReport(props.boardId, props.postId, props.commentId)

const open = ref(false)
const error = ref('')
const done = ref(false)

const canReport = computed(() => isSignedIn.value && !!user.value && user.value.uid !== props.authorUid)
const label = computed(() => hasReported.value
  ? t(`reportButton.status.${report.value?.status ?? 'open'}`)
  : t('reportButton.commentTitle'))

function openModal() {
  if (pending.value) return
  error.value = ''
  done.value = false
  open.value = true
  // Status is read on demand so a long comment list does not open one listener per comment.
  void loadReport()
}

async function submit(input: { reason: BoardReportReason, detail: string }) {
  if (pending.value) return
  error.value = ''
  try {
    await submitReport({
      ...input,
      commentBody: props.commentBody,
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
    <UTooltip :text="label" :delay-duration="200">
      <UButton
        icon="i-lucide-flag"
        size="xs"
        variant="ghost"
        :color="hasReported ? 'warning' : 'neutral'"
        :aria-label="label"
        @click="openModal"
      />
    </UTooltip>
    <UModal v-model:open="open" :title="hasReported && !done ? t('reportButton.resultTitle') : t('reportButton.commentTitle')">
      <template #body>
        <div v-if="reportPending" class="space-y-3">
          <USkeleton class="h-4 w-1/2" />
          <USkeleton class="h-24 w-full" />
        </div>
        <p v-else-if="reportError" role="alert" class="py-4 text-sm text-error">{{ reportError }}</p>
        <MemiBoardReportModalBody
          v-else
          :report="hasReported && !done ? report : null"
          :done="done"
          :pending="pending"
          :error="error"
          @submit="submit"
          @close="open = false"
        />
      </template>
    </UModal>
  </template>
</template>
