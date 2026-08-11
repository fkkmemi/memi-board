<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Timestamp } from 'firebase/firestore'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/ko'
import type { CommentModel } from 'memi-board/runtime'
import { COMMENT_BODY_MAX_LENGTH, formatTimestampDetails, useMemiBoardAuth, useMemiBoardComments, useMemiBoardModeration } from 'memi-board/runtime'

dayjs.extend(relativeTime)
dayjs.locale('ko')

const props = defineProps<{
  comment: CommentModel
  boardId: string
  postId: string
  now: number
  deleting?: boolean
}>()

const emit = defineEmits<{
  delete: [commentId: string]
  reply: [comment: CommentModel]
}>()

const { user, canEditComment, canDeleteComment, canManageContent, isWriteRestricted, restrictedMessage } = useMemiBoardAuth()
const { updateComment, setCommentBlinded } = useMemiBoardComments(
  props.boardId,
  props.postId,
  { subscribe: false },
)
const { checkText } = useMemiBoardModeration()

const editing = ref(false)
const editBody = ref(props.comment.body)
const localBody = ref(props.comment.body)
const localUpdatedAt = ref(props.comment.updatedAt)
const localBlinded = ref(props.comment.isBlinded ?? false)
const saving = ref(false)
const blindSaving = ref(false)
const editError = ref('')

watch(() => props.comment.body, (body) => {
  localBody.value = body
  if (!editing.value) editBody.value = body
})
watch(() => props.comment.updatedAt, (updatedAt) => { localUpdatedAt.value = updatedAt })
watch(() => props.comment.isBlinded, (isBlinded) => { localBlinded.value = isBlinded ?? false })

const date = computed(() => props.comment.createdAt?.toDate?.())
const relativeDate = computed(() => date.value ? dayjs(date.value).from(dayjs(props.now)) : '방금 전')
const timestampDetails = computed(() => formatTimestampDetails(props.comment.createdAt, localUpdatedAt.value).join('\n'))
const blindLines = computed(() => Math.min(3, Math.max(1, Math.ceil(localBody.value.length / 45))))

function startEdit() {
  editBody.value = localBody.value
  editError.value = ''
  editing.value = true
}

function cancelEdit() {
  editBody.value = localBody.value
  editError.value = ''
  editing.value = false
}

async function saveEdit() {
  const body = editBody.value.trim()
  if (!props.comment.id || !body || body === localBody.value) {
    if (body === localBody.value) editing.value = false
    return
  }
  if (isWriteRestricted.value) {
    editError.value = restrictedMessage.value || '댓글 수정이 잠시 제한됐어요.'
    return
  }

  saving.value = true
  editError.value = ''
  try {
    const moderation = await checkText(body)
    if (moderation.flagged) {
      editError.value = moderation.reason || '작성할 수 없는 내용이 포함되어 있습니다.'
      return
    }
    await updateComment(props.comment.id, body)
    localBody.value = body
    localUpdatedAt.value = Timestamp.now()
    editing.value = false
  }
  catch (cause) {
    editError.value = cause instanceof Error ? cause.message : '댓글을 수정하지 못했습니다.'
  }
  finally {
    saving.value = false
  }
}

async function toggleBlind() {
  if (!props.comment.id || !user.value || !canManageContent.value) return
  const next = !localBlinded.value
  const confirmed = window.confirm(next
    ? '이 댓글을 블라인드하면 모든 사용자에게 본문 대신 블라인드 안내가 표시됩니다. 원문은 삭제되지 않으며 나중에 다시 해제할 수 있습니다.\n\n블라인드하시겠습니까?'
    : '블라인드를 해제하면 댓글 원문이 모든 사용자에게 다시 표시됩니다.\n\n블라인드를 해제하시겠습니까?')
  if (!confirmed) return

  blindSaving.value = true
  editError.value = ''
  try {
    await setCommentBlinded(props.comment.id, next, user.value.uid)
    localBlinded.value = next
    if (next) cancelEdit()
  }
  catch (cause) {
    editError.value = cause instanceof Error ? cause.message : '블라인드 상태를 변경하지 못했습니다.'
  }
  finally {
    blindSaving.value = false
  }
}
</script>

<template>
  <div class="flex items-start gap-3">
    <UAvatar
      :src="comment.authorPhoto ?? undefined"
      :alt="comment.authorName ?? '익명'"
      size="sm"
    />
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium">{{ comment.authorName ?? '익명' }}</span>
        <UPopover :content="{ side: 'top' }" :ui="{ content: 'h-auto w-max' }">
          <time
            :datetime="date?.toISOString()"
            class="cursor-pointer text-xs text-muted"
          >
            {{ relativeDate }}
          </time>
          <template #content>
            <p class="whitespace-pre-line px-3 py-2 text-xs">
              {{ timestampDetails }}
            </p>
          </template>
        </UPopover>
      </div>
      <form
        v-if="editing"
        class="mt-2 flex flex-col gap-2"
        @submit.prevent="saveEdit"
      >
        <UTextarea
          v-model="editBody"
          :rows="2"
          :maxlength="COMMENT_BODY_MAX_LENGTH"
          autofocus
        />
        <p class="text-right text-xs text-dimmed">
          {{ editBody.length.toLocaleString() }} / {{ COMMENT_BODY_MAX_LENGTH.toLocaleString() }}
        </p>
        <p v-if="editError" class="text-xs text-error">
          {{ editError }}
        </p>
        <div class="flex justify-end gap-1">
          <UButton
            type="button"
            label="취소"
            size="xs"
            color="neutral"
            variant="ghost"
            :disabled="saving"
            @click="cancelEdit"
          />
          <UButton
            type="submit"
            label="저장"
            size="xs"
            :loading="saving"
            :disabled="!editBody.trim() || editBody.trim() === localBody"
          />
        </div>
      </form>
      <div
        v-else-if="localBlinded"
        class="relative min-h-10 overflow-hidden rounded-md py-1"
      >
        <div class="flex flex-col items-center gap-1.5 opacity-50 blur-[1px]" aria-hidden="true">
          <USkeleton
            v-for="line in blindLines"
            :key="line"
            class="h-3"
            :class="line === blindLines ? 'w-1/2' : 'w-5/6'"
          />
        </div>
        <div class="absolute inset-0 flex items-center justify-center px-3 text-center text-xs font-medium text-muted">
          관리자에 의해 블라인드된 댓글입니다.
        </div>
      </div>
      <p v-else class="whitespace-pre-wrap break-words text-sm">
          <span v-if="comment.parentId && comment.replyToName" class="mr-1 text-primary">@{{ comment.replyToName }}</span>
          {{ localBody }}
      </p>
    </div>
    <div class="flex shrink-0 items-center gap-1">
      <UButton
        v-if="canEditComment(comment) && comment.id && !localBlinded"
        icon="i-lucide-pencil"
        size="xs"
        color="neutral"
        variant="ghost"
        aria-label="댓글 수정"
        :disabled="editing"
        @click="startEdit"
      />
      <UButton
        v-if="canManageContent && comment.id"
        :icon="localBlinded ? 'i-lucide-eye' : 'i-lucide-eye-off'"
        size="xs"
        :color="localBlinded ? 'neutral' : 'warning'"
        variant="ghost"
        :loading="blindSaving"
        :aria-label="localBlinded ? '댓글 블라인드 해제' : '댓글 블라인드'"
        @click="toggleBlind"
      />
      <UButton
        icon="i-lucide-reply"
        size="xs"
        color="neutral"
        variant="ghost"
        aria-label="답글"
        @click="emit('reply', comment)"
      />
      <UButton
        v-if="canDeleteComment(comment) && comment.id"
        icon="i-lucide-trash-2"
        size="xs"
        variant="ghost"
        color="error"
        :loading="deleting"
        aria-label="댓글 삭제"
        @click="emit('delete', comment.id)"
      />
    </div>
  </div>
</template>
