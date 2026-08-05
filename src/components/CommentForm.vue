<script setup lang="ts">
import { ref } from 'vue'
import { useMemiBoardAuth } from 'memi-board/runtime'
import { useMemiBoardComments } from 'memi-board/runtime'
import { useMemiBoardModeration } from 'memi-board/runtime'
import type { CommentModel } from 'memi-board/runtime'

const props = defineProps<{ postId: string, parent?: CommentModel | null }>()
const emit = defineEmits<{ saved: [], cancel: [] }>()

const { user, isSignedIn, isWriteRestricted, restrictedMessage } = useMemiBoardAuth()
// 목록 컴포넌트만 실시간 구독한다. 작성 폼은 mutation API만 사용한다.
const { addComment, addReply } = useMemiBoardComments(props.postId, { subscribe: false })
const { checkText } = useMemiBoardModeration()

const body = ref('')
const submitting = ref(false)
const error = ref('')

async function handleSubmit() {
  error.value = ''
  if (!body.value.trim()) return
  if (!user.value) {
    error.value = '로그인이 필요합니다.'
    return
  }
  if (isWriteRestricted.value) {
    error.value = restrictedMessage.value
      || '콘텐츠 경고가 누적되어 글·댓글 작성이 잠시 제한됐어요.'
    return
  }

  submitting.value = true
  try {
    const moderation = await checkText(body.value)
    if (moderation.flagged) {
      error.value = moderation.reason || '작성할 수 없는 내용이 포함되어 있습니다.'
      return
    }
    const input = {
      body: body.value,
      authorUid: user.value.uid,
      authorName: user.value.displayName,
      authorPhoto: user.value.photoURL,
    }
    if (props.parent) await addReply({ ...input, parent: props.parent })
    else await addComment(input)
    body.value = ''
    emit('saved')
  }
  catch (e) {
    error.value = (e as Error).message
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <form
    v-if="isSignedIn"
    class="flex flex-col gap-2"
    @submit.prevent="handleSubmit"
  >
    <UTextarea
      v-model="body"
      :placeholder="parent ? `${parent.authorName || '사용자'}님에게 답글` : '댓글을 입력하세요'"
      :rows="2"
    />
    <p
      v-if="isWriteRestricted && restrictedMessage"
      class="text-xs text-warning"
    >
      {{ restrictedMessage }}
    </p>
    <div class="flex justify-between items-center">
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
        label="취소"
        color="neutral"
        variant="ghost"
        @click="emit('cancel')"
      />
      <UButton
        type="submit"
        size="sm"
        :label="parent ? '답글 작성' : '댓글 작성'"
        :loading="submitting"
        :disabled="!body.trim() || isWriteRestricted"
      />
    </div>
  </form>
  <p
    v-else
    class="text-sm text-muted"
  >
    댓글을 작성하려면 로그인이 필요합니다.
  </p>
</template>
