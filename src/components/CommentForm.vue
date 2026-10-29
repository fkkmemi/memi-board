<script setup lang="ts">
import { imeSafeSubmitClick, imeSafeSubmitPointerDown } from 'memi-board/runtime'
import { computed, onUnmounted, ref } from 'vue'
import { canWriteCommentByRole, useMemiBoardAuth } from 'memi-board/runtime'
import { COMMENT_BODY_MAX_LENGTH, useMemiBoardComments } from 'memi-board/runtime'
import { useMemiBoardModeration } from 'memi-board/runtime'
import { useMemiBoardSettings } from 'memi-board/runtime'
import { useMemiBoardI18n } from 'memi-board/runtime'
import type { Attachment, CommentModel } from 'memi-board/runtime'
import { useMemiBoardStorage } from 'memi-board/storage'
import MemiBoardCommentImageField from './CommentImageField.vue'

const props = defineProps<{ boardId: string, postId: string, parent?: CommentModel | null }>()
const emit = defineEmits<{ saved: [], cancel: [] }>()

const { user, isSignedIn, isAdmin, isStaff, isWriteRestricted, restrictedMessage } = useMemiBoardAuth()
// 목록 컴포넌트만 실시간 구독한다. 작성 폼은 mutation API만 사용한다.
const { addComment, addReply, newCommentId } = useMemiBoardComments(
  props.boardId,
  props.postId,
  { subscribe: false },
)
const { deleteAttachment } = useMemiBoardStorage()
const { checkText } = useMemiBoardModeration()
const { t, formatNumber } = useMemiBoardI18n()
const { getBoard } = useMemiBoardSettings()

const board = computed(() => getBoard(props.boardId))
const isHiddenBoard = computed(() => board.value?.visibility === 'hidden')
const canComment = computed(() => {
  if (!isSignedIn.value || !user.value?.uid) return false
  return canWriteCommentByRole(user.value.uid, isAdmin.value, isStaff.value, board.value)
})
const deniedMessage = computed(() => {
  if (isHiddenBoard.value) return t('commentForm.hiddenBoardDenied')
  return t('commentForm.denied')
})

const body = ref('')
const draftId = ref(newCommentId())
const image = ref<Attachment | null>(null)
const imageBusy = ref(false)
const submitting = ref(false)
const error = ref('')

async function discardDraftImage() {
  const pending = image.value
  image.value = null
  if (pending) await deleteAttachment(pending)
}

async function handleCancel() {
  await discardDraftImage()
  emit('cancel')
}

async function handleSubmit() {
  if (submitting.value || imageBusy.value) return
  error.value = ''
  if (!body.value.trim()) return
  if (!user.value) {
    error.value = t('commentForm.signInRequired')
    return
  }
  if (!canComment.value) {
    error.value = deniedMessage.value
    return
  }
  if (isWriteRestricted.value) {
    error.value = restrictedMessage.value
      || t('commentForm.writeRestricted')
    return
  }

  submitting.value = true
  try {
    const moderation = await checkText(body.value)
    if (moderation.flagged) {
      error.value = moderation.reason || t('commentForm.moderationBlocked')
      return
    }
    const input = {
      id: draftId.value,
      body: body.value,
      images: image.value ? [image.value] : [],
      authorUid: user.value.uid,
      authorName: user.value.displayName,
      authorPhoto: user.value.photoURL,
    }
    if (props.parent) await addReply({ ...input, parent: props.parent })
    else await addComment(input)
    image.value = null
    body.value = ''
    draftId.value = newCommentId()
    emit('saved')
  }
  catch (e) {
    error.value = (e as Error).message
  }
  finally {
    submitting.value = false
  }
}

onUnmounted(() => {
  if (submitting.value || !image.value) return
  void deleteAttachment(image.value)
})
</script>

<template>
  <form
    v-if="isSignedIn && canComment"
    class="flex flex-col gap-2"
    @submit.prevent="handleSubmit"
  >
    <UTextarea
      v-model="body"
      :placeholder="parent ? t('commentForm.replyTo', { name: parent.authorName || t('common.label.user') }) : t('commentForm.placeholder')"
      :rows="2"
      :maxlength="COMMENT_BODY_MAX_LENGTH"
    />
    <MemiBoardCommentImageField
      v-model="image"
      :post-id="postId"
      :comment-id="draftId"
      :disabled="submitting || isWriteRestricted"
      @busy="imageBusy = $event"
    />
    <p
      v-if="isWriteRestricted && restrictedMessage"
      class="text-xs text-warning"
    >
      {{ restrictedMessage }}
    </p>
    <div class="flex justify-between items-center">
      <span class="text-xs text-dimmed">{{ formatNumber(body.length) }} / {{ formatNumber(COMMENT_BODY_MAX_LENGTH) }}</span>
      <p
        v-if="error"
        class="text-xs text-error"
      >
        {{ error }}
      </p>
      <div class="flex-1" />
      <UButton
        v-if="parent"
        type="button"
        size="sm"
        :label="t('common.action.cancel')"
        color="neutral"
        variant="ghost"
        :disabled="imageBusy"
        @click="handleCancel"
      />
      <UButton
        type="submit"
        @pointerdown="imeSafeSubmitPointerDown"
        @click="imeSafeSubmitClick"
        size="sm"
        :label="parent ? t('commentForm.submitReply') : t('commentForm.submit')"
        :loading="submitting"
        :disabled="!body.trim() || isWriteRestricted || imageBusy"
      />
    </div>
  </form>
  <p
    v-else-if="!isSignedIn"
    class="text-sm text-muted"
  >
    {{ t('commentForm.signInToComment') }}
  </p>
  <p
    v-else
    class="text-sm text-muted"
  >
    {{ deniedMessage }}
  </p>
</template>
