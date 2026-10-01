<script setup lang="ts">
import { imeSafeSubmitClick, imeSafeSubmitPointerDown } from 'memi-board/runtime'
import { computed, inject, ref, watch } from 'vue'
import { Timestamp } from 'firebase/firestore'
import type { CommentModel } from 'memi-board/runtime'
import {
  COMMENT_BODY_MAX_LENGTH,
  memiBoardCommentLikesKey,
  useMemiBoardAuth,
  useMemiBoardComments,
  useMemiBoardI18n,
  useMemiBoardModeration,
} from 'memi-board/runtime'

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

const { user, isSignedIn, canEditComment, canDeleteComment, canManageBoard, isWriteRestricted, restrictedMessage } = useMemiBoardAuth()
const { updateComment, setCommentBlinded } = useMemiBoardComments(
  props.boardId,
  props.postId,
  { subscribe: false },
)
const { checkText } = useMemiBoardModeration()
const { t, formatRelativeDate, formatTimestampDetails } = useMemiBoardI18n()
const commentLikes = inject(memiBoardCommentLikesKey, null)

const editing = ref(false)
const editBody = ref(props.comment.body)
const localBody = ref(props.comment.body)
const localUpdatedAt = ref(props.comment.updatedAt)
const localBlinded = ref(props.comment.isBlinded ?? false)
const saving = ref(false)
const blindSaving = ref(false)
const likeError = ref('')
const editError = ref('')
const localLikeCount = ref(props.comment.likeCount ?? 0)
const isLiked = computed(() => commentLikes?.isLiked(props.comment.id) ?? false)
const likePending = computed(() => commentLikes?.isPending(props.comment.id) ?? false)

watch(() => props.comment.body, (body) => {
  localBody.value = body
  if (!editing.value) editBody.value = body
})
watch(() => props.comment.updatedAt, (updatedAt) => { localUpdatedAt.value = updatedAt })
watch(() => props.comment.isBlinded, (isBlinded) => { localBlinded.value = isBlinded ?? false })
watch(() => props.comment.likeCount, (likeCount) => {
  if (likeCount != null) localLikeCount.value = likeCount
})

const date = computed(() => props.comment.createdAt?.toDate?.())
const relativeDate = computed(() => formatRelativeDate(props.comment.createdAt, props.now))
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
  if (saving.value) return
  const body = editBody.value.trim()
  if (!props.comment.id || !body || body === localBody.value) {
    if (body === localBody.value) editing.value = false
    return
  }
  if (isWriteRestricted.value) {
    editError.value = restrictedMessage.value || t('commentItem.editRestricted')
    return
  }

  saving.value = true
  editError.value = ''
  try {
    const moderation = await checkText(body)
    if (moderation.flagged) {
      editError.value = moderation.reason || t('commentItem.moderationBlocked')
      return
    }
    await updateComment(props.comment.id, body)
    localBody.value = body
    localUpdatedAt.value = Timestamp.now()
    editing.value = false
  }
  catch (cause) {
    editError.value = cause instanceof Error ? cause.message : t('commentItem.editFailed')
  }
  finally {
    saving.value = false
  }
}

async function toggleBlind() {
  if (!props.comment.id || !user.value || !canManageBoard(props.comment.boardId)) return
  const next = !localBlinded.value
  const confirmed = window.confirm(next
    ? t('commentItem.blindConfirm')
    : t('commentItem.unblindConfirm'))
  if (!confirmed) return

  blindSaving.value = true
  editError.value = ''
  try {
    await setCommentBlinded(props.comment.id, next, user.value.uid)
    localBlinded.value = next
    if (next) cancelEdit()
  }
  catch (cause) {
    editError.value = cause instanceof Error ? cause.message : t('commentItem.blindFailed')
  }
  finally {
    blindSaving.value = false
  }
}

async function toggleLike() {
  if (!props.comment.id || !commentLikes || !isSignedIn.value) return
  likeError.value = ''
  const wasLiked = isLiked.value
  try {
    const next = await commentLikes.toggleLike(props.comment.id)
    if (next !== wasLiked) localLikeCount.value = Math.max(0, localLikeCount.value + (next ? 1 : -1))
  }
  catch (cause) {
    likeError.value = cause instanceof Error ? cause.message : t('commentItem.likeFailed')
  }
}
</script>

<template>
  <div class="flex items-start gap-3">
    <UAvatar
      :src="comment.authorPhoto ?? undefined"
      :alt="comment.authorName ?? t('common.label.anonymous')"
      size="sm"
    />
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium">{{ comment.authorName ?? t('common.label.anonymous') }}</span>
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
            :label="t('common.action.cancel')"
            size="xs"
            color="neutral"
            variant="ghost"
            :disabled="saving"
            @click="cancelEdit"
          />
          <UButton
            type="submit"
            @pointerdown="imeSafeSubmitPointerDown"
            @click="imeSafeSubmitClick"
            :label="t('common.action.save')"
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
          {{ t('commentItem.blinded') }}
        </div>
      </div>
      <p v-else class="whitespace-pre-wrap break-words text-sm">
          <span v-if="comment.parentId && comment.replyToName" class="mr-1 text-primary">@{{ comment.replyToName }}</span>
          {{ localBody }}
      </p>
      <p v-if="likeError" class="mt-1 text-xs text-error">
        {{ likeError }}
      </p>
    </div>
    <div class="flex shrink-0 items-center gap-1">
      <UButton
        v-if="isSignedIn && commentLikes && comment.id"
        icon="i-lucide-heart"
        size="xs"
        variant="ghost"
        :color="isLiked ? 'error' : 'neutral'"
        :label="String(localLikeCount)"
        :loading="likePending"
        :aria-label="isLiked ? t('common.action.unlike') : t('common.action.like')"
        @click="toggleLike"
      />
      <span
        v-else
        class="flex items-center gap-0.5 px-1 text-xs text-muted"
        :aria-label="t('common.action.like')"
      >
        <UIcon name="i-lucide-heart" class="size-3.5" />
        {{ localLikeCount }}
      </span>
      <UButton
        v-if="canEditComment(comment) && comment.id && !localBlinded"
        icon="i-lucide-pencil"
        size="xs"
        color="neutral"
        variant="ghost"
        :aria-label="t('commentItem.edit')"
        :disabled="editing"
        @click="startEdit"
      />
      <UButton
        v-if="canManageBoard(comment.boardId) && comment.id"
        :icon="localBlinded ? 'i-lucide-eye' : 'i-lucide-eye-off'"
        size="xs"
        :color="localBlinded ? 'neutral' : 'warning'"
        variant="ghost"
        :loading="blindSaving"
        :aria-label="localBlinded ? t('commentItem.unblind') : t('commentItem.blind')"
        @click="toggleBlind"
      />
      <UButton
        icon="i-lucide-reply"
        size="xs"
        color="neutral"
        variant="ghost"
        :aria-label="t('common.action.reply')"
        @click="emit('reply', comment)"
      />
      <UButton
        v-if="canDeleteComment(comment) && comment.id"
        icon="i-lucide-trash-2"
        size="xs"
        variant="ghost"
        color="error"
        :loading="deleting"
        :aria-label="t('commentItem.delete')"
        @click="emit('delete', comment.id)"
      />
    </div>
  </div>
</template>
