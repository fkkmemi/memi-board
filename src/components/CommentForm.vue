<script setup lang="ts">
import { imeSafeSubmitClick, imeSafeSubmitPointerDown } from 'memi-board/runtime'
import { computed, onUnmounted, ref, resolveComponent } from 'vue'
import { useRoute } from 'vue-router'
import { canWriteCommentByRole, useMemiBoardAuth, useMemiBoardConfig } from 'memi-board/runtime'
import { COMMENT_BODY_MAX_LENGTH, useMemiBoardComments } from 'memi-board/runtime'
import { useMemiBoardModeration } from 'memi-board/runtime'
import { useMemiBoardSettings } from 'memi-board/runtime'
import { useMemiBoardI18n } from 'memi-board/runtime'
import type { Attachment, CommentModel, CommentTranslationSet } from 'memi-board/runtime'
import { useMemiBoardStorage } from 'memi-board/storage'
import MemiBoardCommentAi from './CommentAi.vue'
import MemiBoardCommentImageField from './CommentImageField.vue'
import { useUnsavedChangesGuard } from './useUnsavedChangesGuard'

const props = defineProps<{ boardId: string, postId: string, parent?: CommentModel | null }>()
const emit = defineEmits<{ saved: [], cancel: [] }>()
const route = useRoute()
const config = useMemiBoardConfig()
const NuxtLink = resolveComponent('NuxtLink')
const loginTo = computed(() => ({ path: config.auth.loginPath || '/auth/login', query: { next: route.fullPath } }))

const { user, isSignedIn, isAdmin, isStaff, isWriteRestricted, restrictedMessage } = useMemiBoardAuth()
// 목록 컴포넌트만 실시간 구독한다. 작성 폼은 mutation API만 사용한다.
const { addComment, addReply, newCommentId, translationSkipped } = useMemiBoardComments(
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
const translations = ref<CommentTranslationSet>()
const aiBusy = ref(false)
const draftId = ref(newCommentId())
const image = ref<Attachment | null>(null)
const imageField = ref<InstanceType<typeof MemiBoardCommentImageField> | null>(null)
const imageBusy = ref(false)
const submitting = ref(false)
const error = ref('')
const notice = ref('')
const { markSaved, confirmLeave } = useUnsavedChangesGuard(
  () => JSON.stringify({ body: body.value.trim(), image: image.value, translations: translations.value }),
  () => submitting.value || imageBusy.value || aiBusy.value,
  () => t('commentForm.confirmLeave'),
)

async function discardDraftImage() {
  const pending = image.value
  image.value = null
  if (pending) await deleteAttachment(pending)
}

async function handleCancel() {
  if (!confirmLeave()) return
  await discardDraftImage()
  emit('cancel')
}

async function handleSubmit() {
  if (submitting.value || imageBusy.value || aiBusy.value) return
  error.value = ''
  notice.value = ''
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
      translations: translations.value,
      images: image.value ? [image.value] : [],
      authorUid: user.value.uid,
      authorName: user.value.displayName,
      authorPhoto: user.value.photoURL,
    }
    if (props.parent) await addReply({ ...input, parent: props.parent })
    else await addComment(input)
    if (translationSkipped.value) notice.value = t('commentForm.translationSkipped')
    image.value = null
    body.value = ''
    translations.value = undefined
    draftId.value = newCommentId()
    submitting.value = false
    markSaved()
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
    class="overflow-hidden rounded-xl border border-default bg-default"
    @submit.prevent="handleSubmit"
  >
    <div class="flex flex-col gap-3 p-3 sm:p-4">
      <UTextarea
        v-model="body"
        @paste="imageField?.handlePaste($event)"
        :placeholder="parent ? t('commentForm.replyTo', { name: parent.authorName || t('common.label.user') }) : t('commentForm.placeholder')"
        :rows="3"
        autoresize
        :maxrows="10"
        :disabled="submitting || aiBusy || isWriteRestricted"
        :maxlength="COMMENT_BODY_MAX_LENGTH"
        class="w-full"
      />
      <p v-if="isWriteRestricted && restrictedMessage" class="text-xs text-warning">
        {{ restrictedMessage }}
      </p>
      <p v-if="error" class="text-xs text-error" role="alert">
        {{ error }}
      </p>
      <p v-else-if="notice" class="text-xs text-warning" role="status">
        {{ notice }}
      </p>
    </div>
    <div class="flex flex-col gap-3 border-t border-default bg-muted/30 px-3 py-2.5 sm:flex-row sm:items-center sm:px-4">
      <MemiBoardCommentImageField
        ref="imageField"
        v-model="image"
        :post-id="postId"
        :comment-id="draftId"
        :disabled="submitting || isWriteRestricted"
        compact
        class="min-w-0 flex-1"
        @busy="imageBusy = $event"
      />
      <div class="ms-auto flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
        <MemiBoardCommentAi
          v-model="body"
          v-model:translations="translations"
          :board-id="boardId"
          :disabled="submitting || imageBusy || isWriteRestricted"
          @busy="aiBusy = $event"
        />
        <span class="text-xs text-dimmed tabular-nums">{{ formatNumber(body.length) }} / {{ formatNumber(COMMENT_BODY_MAX_LENGTH) }}</span>
        <UButton
          v-if="parent"
          type="button"
          size="sm"
          :label="t('common.action.cancel')"
          color="neutral"
          variant="ghost"
          :disabled="imageBusy || submitting || aiBusy"
          @click="handleCancel"
        />
        <UButton
          type="submit"
          @pointerdown="imeSafeSubmitPointerDown"
          @click="imeSafeSubmitClick"
          size="sm"
          :label="parent ? t('commentForm.submitReply') : t('commentForm.submit')"
          :loading="submitting"
          :disabled="!body.trim() || isWriteRestricted || imageBusy || aiBusy"
        />
      </div>
    </div>
  </form>
  <component
    :is="NuxtLink"
    v-else-if="!isSignedIn"
    :to="loginTo"
    class="block min-h-16 w-full rounded-md bg-default px-3 py-2 text-sm text-muted ring ring-inset ring-accented transition-colors hover:ring-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
  >
    {{ t('commentForm.signInToComment') }}
  </component>
  <p
    v-else
    class="text-sm text-muted"
  >
    {{ deniedMessage }}
  </p>
</template>
