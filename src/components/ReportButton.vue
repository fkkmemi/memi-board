<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  useMemiBoardAuth,
  useMemiBoardI18n,
  useMemiBoardReports,
} from 'memi-board/runtime'
import type { BoardReportReason } from 'memi-board/runtime'
import MemiBoardReportModalBody from './ReportModalBody.vue'

const props = defineProps<{
  boardId: string
  postId: string
  authorUid: string
  authorName?: string | null
  postTitle?: string | null
}>()

const { isSignedIn, user } = useMemiBoardAuth()
const { t } = useMemiBoardI18n()
const { hasReported, report, reportPending, reportError, pending, submitReport } = useMemiBoardReports(props.boardId, props.postId)

const open = ref(false)
const error = ref('')
const done = ref(false)

const isOwnPost = computed(() => !!user.value && user.value.uid === props.authorUid)
const canReport = computed(() => isSignedIn.value && !isOwnPost.value)
const statusLabel = computed(() => t(`reportButton.status.${report.value?.status ?? 'open'}`))

function openModal() {
  if (reportPending.value || reportError.value || pending.value) return
  error.value = ''
  done.value = false
  open.value = true
}

async function submit(input: { reason: BoardReportReason, detail: string }) {
  if (pending.value) return
  error.value = ''
  try {
    await submitReport({
      ...input,
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
        <MemiBoardReportModalBody
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
