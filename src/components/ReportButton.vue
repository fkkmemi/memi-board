<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  REPORT_DETAIL_MAX_LENGTH,
  REPORT_REASONS,
  useMemiBoardAuth,
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
    error.value = cause instanceof Error ? cause.message : '신고하지 못했습니다.'
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
      :label="hasReported ? '신고함' : '신고'"
      :disabled="hasReported"
      @click="openModal"
    />
    <UModal v-model:open="open" title="게시물 신고">
      <template #body>
        <div v-if="done" class="py-4 text-sm text-muted">
          신고를 접수했습니다. 스태프가 내용을 확인합니다.
        </div>
        <form
          v-else
          class="flex flex-col gap-3"
          @submit.prevent="submit"
        >
          <URadioGroup
            v-model="reason"
            :items="REPORT_REASONS"
            value-key="value"
            legend="사유"
          />
          <UTextarea
            v-model="detail"
            :rows="3"
            :maxlength="REPORT_DETAIL_MAX_LENGTH"
            placeholder="자세한 내용 (선택)"
          />
          <p class="text-right text-xs text-dimmed">
            {{ detail.length.toLocaleString() }} / {{ REPORT_DETAIL_MAX_LENGTH.toLocaleString() }}
          </p>
          <p v-if="error" class="text-xs text-error">
            {{ error }}
          </p>
          <div class="flex justify-end gap-2">
            <UButton
              type="button"
              color="neutral"
              variant="ghost"
              label="취소"
              :disabled="pending"
              @click="open = false"
            />
            <UButton
              type="submit"
              color="warning"
              label="신고하기"
              :loading="pending"
            />
          </div>
        </form>
      </template>
    </UModal>
  </template>
</template>
