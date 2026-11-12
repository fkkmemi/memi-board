<script setup lang="ts">
import { imeSafeSubmitClick, imeSafeSubmitPointerDown } from 'memi-board/runtime'
import { computed, inject, ref, watch } from 'vue'
import { Timestamp } from 'firebase/firestore'
import type { Attachment, CommentModel, CommentTranslationSet } from 'memi-board/runtime'
import { useMemiBoardStorage } from 'memi-board/storage'
import {
  COMMENT_BODY_MAX_LENGTH,
  COMMENT_EDIT_LIMIT,
  displayCommentBody,
  memiBoardCommentLikesKey,
  useMemiBoardAuth,
  useMemiBoardComments,
  useMemiBoardI18n,
  useMemiBoardModeration,
} from 'memi-board/runtime'
import MemiBoardAuthorMenu from './AuthorMenu.vue'
import MemiBoardCommentAi from './CommentAi.vue'
import MemiBoardCommentImageField from './CommentImageField.vue'
import MemiBoardCommentReportButton from './CommentReportButton.vue'
import MemiBoardImageLightbox from './ImageLightbox.vue'
import MemiBoardCommentRevisions from './CommentRevisions.vue'

const props = defineProps<{
  comment: CommentModel
  boardId: string
  postId: string
  now: number
  deleting?: boolean
  authorProfileTo?: (authorUid: string) => string | undefined
  authorPostsTo?: (authorUid: string) => string | undefined
  authorCommentsTo?: (authorUid: string) => string | undefined
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
const { deleteAttachment } = useMemiBoardStorage()
const { t, locale, formatRelativeDate, formatTimestampDetails, formatFullDate } = useMemiBoardI18n()
const commentLikes = inject(memiBoardCommentLikesKey, null)

const editing = ref(false)
const translations = ref<CommentTranslationSet>()
const aiBusy = ref(false)
const localTranslations = ref<CommentTranslationSet>()
const displayedBody = computed(() => displayCommentBody({ ...props.comment, ...localTranslations.value, body: localBody.value }, locale.value))
const editBody = ref(props.comment.body)
const localBody = ref(props.comment.body)
const localImage = ref<Attachment | null>(props.comment.images?.[0] ?? null)
const imageOpen = ref(false)
const editImage = ref<Attachment | null>(localImage.value)
const imageField = ref<InstanceType<typeof MemiBoardCommentImageField> | null>(null)
const imageBusy = ref(false)
const localUpdatedAt = ref(props.comment.updatedAt)
const localBlinded = ref(props.comment.isBlinded ?? false)
// 본문·이미지 수정 횟수. 기존 댓글은 필드가 없어 0이다.
const localRevision = ref(props.comment.revision ?? 0)
const localEditedAt = ref(props.comment.editedAt)
const revisionsOpen = ref(false)
const editLimitOpen = ref(false)
const saving = ref(false)
const blindSaving = ref(false)
const likeError = ref('')
const editError = ref('')
const localLikeCount = ref(props.comment.likeCount ?? 0)
const isLiked = computed(() => commentLikes?.isLiked(props.comment.id) ?? false)
const likePending = computed(() => commentLikes?.isPending(props.comment.id) ?? false)

const imageChanged = computed(() => (editImage.value?.path ?? '') !== (localImage.value?.path ?? ''))

watch(() => props.comment.body, (body) => {
  localTranslations.value = undefined
  localBody.value = body
  if (!editing.value) editBody.value = body
})
watch(() => props.comment.images, (images) => {
  if (editing.value) return
  localImage.value = images?.[0] ?? null
  editImage.value = localImage.value
})
watch(() => props.comment.updatedAt, (updatedAt) => { localUpdatedAt.value = updatedAt })
watch(() => props.comment.isBlinded, (isBlinded) => { localBlinded.value = isBlinded ?? false })
watch(() => props.comment.revision, (revision) => { localRevision.value = revision ?? 0 })
watch(() => props.comment.editedAt, (editedAt) => { localEditedAt.value = editedAt })
watch(() => props.comment.likeCount, (likeCount) => {
  if (likeCount != null) localLikeCount.value = likeCount
})

const date = computed(() => props.comment.createdAt?.toDate?.())
const relativeDate = computed(() => formatRelativeDate(props.comment.createdAt, props.now))
const timestampDetails = computed(() => formatTimestampDetails(props.comment.createdAt, localUpdatedAt.value).join('\n'))
const blindLines = computed(() => Math.min(3, Math.max(1, Math.ceil(localBody.value.length / 45))))

function startEdit() {
  // 작성자는 COMMENT_EDIT_LIMIT 번까지만 고칠 수 있다. 매니저는 제한 없음. rules 도 같은 숫자로 막는다.
  if (localRevision.value >= COMMENT_EDIT_LIMIT && !canManageBoard(props.comment.boardId)) {
    editLimitOpen.value = true
    return
  }
  editBody.value = localBody.value
  editImage.value = localImage.value
  editError.value = ''
  translations.value = undefined
  editing.value = true
}

async function cancelEdit() {
  const draft = editImage.value
  const original = localImage.value
  editBody.value = localBody.value
  editImage.value = original
  editError.value = ''
  editing.value = false
  if (draft?.path && draft.path !== original?.path) await deleteAttachment(draft)
}

async function saveEdit() {
  if (saving.value || imageBusy.value || aiBusy.value) return
  const body = editBody.value.trim()
  if (!props.comment.id || !body) return
  if (body === localBody.value && !imageChanged.value && !translations.value) {
    editing.value = false
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
    const previous = localImage.value
    const next = editImage.value
    await updateComment(props.comment.id, body, next ? [next] : [], translations.value)
    if (body !== localBody.value || (previous?.path ?? '') !== (next?.path ?? '')) {
      localRevision.value += 1
      localEditedAt.value = Timestamp.now()
    }
    localTranslations.value = translations.value
    localBody.value = body
    localImage.value = next
    localUpdatedAt.value = Timestamp.now()
    editing.value = false
    // 바뀌기 전 이미지는 수정 기록이 가리키므로 Storage에서 지우지 않는다.
  }
  catch (cause) {
    editError.value = cause instanceof Error ? cause.message : t('commentItem.editFailed')
  }
  finally {
    saving.value = false
  }
}

const blindConfirmOpen = ref(false)
const blindTarget = ref(false)
function toggleBlind() {
  if (!props.comment.id || !user.value || !canManageBoard(props.comment.boardId) || blindSaving.value) return
  editError.value = ''
  blindTarget.value = !localBlinded.value
  blindConfirmOpen.value = true
}
async function confirmBlind() {
  if (!props.comment.id || !user.value || !canManageBoard(props.comment.boardId) || blindSaving.value) return
  const next = blindTarget.value
  blindSaving.value = true
  editError.value = ''
  try {
    await setCommentBlinded(props.comment.id, next, user.value.uid)
    localBlinded.value = next
    blindConfirmOpen.value = false
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
  <div :id="comment.id ? `memi-comment-${comment.id}` : undefined" class="flex items-start gap-3 scroll-mt-20">
    <UAvatar
      :src="comment.authorPhoto ?? undefined"
      :alt="comment.authorName ?? t('common.label.anonymous')"
      size="sm"
    />
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-2">
        <MemiBoardAuthorMenu
          v-if="comment.authorUid"
          :author-uid="comment.authorUid"
          :author-name="comment.authorName"
          :author-photo="comment.authorPhoto"
          :show-avatar="false"
          :author-profile-to="authorProfileTo"
          :author-posts-to="authorPostsTo"
          :author-comments-to="authorCommentsTo"
        />
        <span v-else class="text-sm font-medium">{{ comment.authorName ?? t('common.label.anonymous') }}</span>
        <UTooltip :delay-duration="200" :content="{ side: 'top' }" :ui="{ content: 'h-auto px-3 py-2' }">
          <time
            :datetime="date?.toISOString()"
            class="text-xs text-muted"
          >
            {{ relativeDate }}
          </time>
          <template #content>
            <span class="whitespace-pre-line">{{ timestampDetails }}</span>
          </template>
        </UTooltip>
        <UTooltip
          v-if="localRevision > 0"
          :text="t('commentItem.editedTooltip', { count: localRevision, time: localEditedAt ? formatFullDate(localEditedAt) : '' })"
          :delay-duration="200"
          :content="{ side: 'top' }"
        >
          <UBadge variant="subtle" color="neutral" size="sm">
            {{ t('commentItem.edited') }}
          </UBadge>
        </UTooltip>
      </div>
      <form
        v-if="editing"
        class="mt-2 flex flex-col gap-2"
        @submit.prevent="saveEdit"
      >
        <UTextarea
          v-model="editBody"
          @paste="imageField?.handlePaste($event)"
          :rows="2"
          autoresize
          :maxrows="10"
          :maxlength="COMMENT_BODY_MAX_LENGTH"
          :disabled="saving || aiBusy"
          autofocus
        />
        <MemiBoardCommentAi v-model="editBody" v-model:translations="translations" :board-id="boardId"
          :disabled="saving || imageBusy || isWriteRestricted" @busy="aiBusy = $event" />
        <MemiBoardCommentImageField
          ref="imageField"
          v-if="comment.id"
          v-model="editImage"
          :post-id="postId"
          :comment-id="comment.id"
          :disabled="saving"
          @busy="imageBusy = $event"
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
            :disabled="saving || imageBusy || aiBusy"
            @click="cancelEdit"
          />
          <UButton
            type="submit"
            @pointerdown="imeSafeSubmitPointerDown"
            @click="imeSafeSubmitClick"
            :label="t('common.action.save')"
            size="xs"
            :loading="saving"
            :disabled="!editBody.trim() || imageBusy || aiBusy || (editBody.trim() === localBody && !imageChanged && !translations)"
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
      <div v-else>
        <p class="whitespace-pre-wrap break-words text-sm">
          <span v-if="comment.parentId && comment.replyToName" class="mr-1 text-primary">@{{ comment.replyToName }}</span><span v-text="displayedBody" />
        </p>
        <button
          v-if="localImage"
          type="button"
          class="mt-2 inline-block cursor-zoom-in bg-transparent p-0"
          :aria-label="t('commentItem.attachedImage')"
          @click="imageOpen = true"
        >
          <img
            :src="localImage.url"
            :alt="t('commentItem.attachedImage')"
            class="max-h-60 max-w-full rounded-md border border-default object-contain"
          >
        </button>
        <MemiBoardImageLightbox
          v-if="localImage"
          v-model:open="imageOpen"
          :images="[localImage.url]"
        />
      </div>
      <p v-if="likeError" class="mt-1 text-xs text-error">
        {{ likeError }}
      </p>
    </div>
    <div class="flex shrink-0 items-center gap-1">
      <UTooltip v-if="isSignedIn && commentLikes && comment.id" :text="isLiked ? t('common.action.unlike') : t('common.action.like')" :delay-duration="200">
        <UButton
          icon="i-lucide-heart"
          size="xs"
          variant="ghost"
          :color="isLiked ? 'error' : 'neutral'"
          :label="String(localLikeCount)"
          :loading="likePending"
          :aria-label="isLiked ? t('common.action.unlike') : t('common.action.like')"
          @click="toggleLike"
        />
      </UTooltip>
      <UTooltip v-else :text="t('list.likeCount', { count: localLikeCount })" :delay-duration="200" :content="{ side: 'top' }">
        <span
          class="flex items-center gap-0.5 px-1 text-xs text-muted"
          :aria-label="t('list.likeCount', { count: localLikeCount })"
        >
          <UIcon name="i-lucide-heart" class="size-3.5" />
          {{ localLikeCount }}
        </span>
      </UTooltip>
      <UTooltip v-if="canEditComment(comment) && comment.id && !localBlinded" :text="t('commentItem.edit')" :delay-duration="200">
        <UButton
          icon="i-lucide-pencil"
          size="xs"
          color="neutral"
          variant="ghost"
          :aria-label="t('commentItem.edit')"
          :disabled="editing"
          @click="startEdit"
        />
      </UTooltip>
      <UTooltip v-if="canManageBoard(comment.boardId) && comment.id" :text="localBlinded ? t('commentItem.unblind') : t('commentItem.blind')" :delay-duration="200">
        <UButton
          :icon="localBlinded ? 'i-lucide-eye' : 'i-lucide-eye-off'"
          size="xs"
          :color="localBlinded ? 'neutral' : 'warning'"
          variant="ghost"
          :loading="blindSaving"
          :aria-label="localBlinded ? t('commentItem.unblind') : t('commentItem.blind')"
          @click="toggleBlind"
        />
      </UTooltip>
      <UTooltip v-if="localRevision > 0 && canManageBoard(comment.boardId) && comment.id" :text="t('commentItem.history')" :delay-duration="200">
        <UButton
          icon="i-lucide-history"
          size="xs"
          color="neutral"
          variant="ghost"
          :aria-label="t('commentItem.history')"
          @click="revisionsOpen = true"
        />
      </UTooltip>
      <UTooltip :text="t('common.action.reply')" :delay-duration="200">
        <UButton
          icon="i-lucide-reply"
          size="xs"
          color="neutral"
          variant="ghost"
          :aria-label="t('common.action.reply')"
          @click="emit('reply', comment)"
        />
      </UTooltip>
      <MemiBoardCommentReportButton
        v-if="comment.id"
        :board-id="boardId"
        :post-id="postId"
        :comment-id="comment.id"
        :author-uid="comment.authorUid"
        :author-name="comment.authorName"
        :comment-body="localBody"
      />
      <UTooltip v-if="canDeleteComment(comment) && comment.id" :text="t('commentItem.delete')" :delay-duration="200">
        <UButton
          icon="i-lucide-trash-2"
          size="xs"
          variant="ghost"
          color="error"
          :loading="deleting"
          :aria-label="t('commentItem.delete')"
          @click="emit('delete', comment.id)"
        />
      </UTooltip>
    </div>
    <UModal v-model:open="editLimitOpen" :title="t('commentItem.editLimitTitle')">
      <template #body>
        <div class="space-y-4">
          <UAlert
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            :description="t('comments.editLimitReached', { max: COMMENT_EDIT_LIMIT })"
          />
          <div class="flex justify-end">
            <UButton :label="t('common.action.confirm')" @click="editLimitOpen = false" />
          </div>
        </div>
      </template>
    </UModal>
    <MemiBoardCommentRevisions
      v-if="localRevision > 0 && canManageBoard(comment.boardId) && comment.id"
      v-model:open="revisionsOpen"
      :board-id="comment.boardId"
      :comment-id="comment.id"
    />
    <UModal v-model:open="blindConfirmOpen" :title="t(blindTarget ? 'commentItem.blind' : 'commentItem.unblind')" :dismissible="!blindSaving" :close="blindSaving ? false : undefined">
      <template #body>
        <div class="space-y-4">
          <p class="text-sm text-muted">{{ t(blindTarget ? 'commentItem.blindConfirm' : 'commentItem.unblindConfirm') }}</p>
          <p v-if="editError" role="alert" class="text-sm text-error">{{ editError }}</p>
          <div class="flex flex-wrap justify-end gap-2">
            <UButton color="neutral" variant="outline" :label="t('common.action.cancel')" :disabled="blindSaving" @click="blindConfirmOpen = false" />
            <UButton :label="t('common.action.confirm')" :loading="blindSaving" @click="confirmBlind" />
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
