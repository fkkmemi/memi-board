<script setup lang="ts">
import { ref } from 'vue'
import { useMemiBoardAuth } from 'memi-board'
import { useMemiBoardComments } from 'memi-board'
import { useMemiBoardModeration } from 'memi-board'

const props = defineProps<{ postId: string }>()

const { user, isSignedIn } = useMemiBoardAuth()
const { addComment } = useMemiBoardComments(props.postId)
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

  submitting.value = true
  try {
    const moderation = await checkText(body.value)
    if (moderation.flagged) {
      error.value = moderation.reason || '작성할 수 없는 내용이 포함되어 있습니다.'
      return
    }
    await addComment({
      body: body.value,
      authorUid: user.value.uid,
      authorName: user.value.displayName,
      authorPhoto: user.value.photoURL,
    })
    body.value = ''
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
      placeholder="댓글을 입력하세요"
      :rows="2"
    />
    <div class="flex justify-between items-center">
      <p
        v-if="error"
        class="text-xs text-error"
      >
        {{ error }}
      </p>
      <div class="flex-1" />
      <UButton
        type="submit"
        size="sm"
        label="댓글 작성"
        :loading="submitting"
        :disabled="!body.trim()"
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
