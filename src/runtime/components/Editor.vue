<script setup lang="ts">
import type { Attachment } from '../types'

const props = defineProps<{
  /** 지정하면 수정 모드, 지정하지 않으면 새 글 작성 모드. */
  postId?: string
}>()

const emit = defineEmits<{ saved: [id: string], cancel: [] }>()

const { user } = useMemiBoardAuth()
const { getPost, createPost, updatePost } = useMemiBoardPosts()
const { checkText } = useMemiBoardModeration()

const title = ref('')
const content = ref('')
const tagsInput = ref('')
const attachments = ref<Attachment[]>([])

const loading = ref(!!props.postId)
const saving = ref(false)
const error = ref('')

/** 새 글은 아직 slug가 없으므로 첨부파일 Storage 경로용 임시 네임스페이스를 쓴다. */
const attachmentNamespace = ref(props.postId ?? `new-${Date.now()}`)

onMounted(async () => {
  if (!props.postId) return
  try {
    const post = await getPost(props.postId)
    if (!post) {
      error.value = '게시글을 찾을 수 없습니다.'
      return
    }
    title.value = post.title
    content.value = post.content
    tagsInput.value = (post.tags ?? []).join(', ')
    attachments.value = post.attachments ?? []
  }
  finally {
    loading.value = false
  }
})

async function handleSubmit() {
  error.value = ''
  if (!title.value.trim() || !content.value.trim()) {
    error.value = '제목과 내용을 입력해 주세요.'
    return
  }
  if (!user.value) {
    error.value = '로그인이 필요합니다.'
    return
  }

  saving.value = true
  try {
    const moderation = await checkText(`${title.value}\n${content.value}`)
    if (moderation.flagged) {
      error.value = moderation.reason || '게시할 수 없는 내용이 포함되어 있습니다.'
      return
    }

    const tags = tagsInput.value.split(',').map(t => t.trim()).filter(Boolean)

    if (props.postId) {
      await updatePost(props.postId, { title: title.value, content: content.value, tags, attachments: attachments.value })
      emit('saved', props.postId)
    }
    else {
      const id = await createPost({
        title: title.value,
        content: content.value,
        tags,
        attachments: attachments.value,
        authorUid: user.value.uid,
        authorName: user.value.displayName,
        authorPhoto: user.value.photoURL,
      })
      emit('saved', id)
    }
  }
  catch (e) {
    error.value = (e as Error).message
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div
    v-if="loading"
    class="flex flex-col gap-3"
  >
    <USkeleton class="h-10 w-full" />
    <USkeleton class="h-40 w-full" />
  </div>

  <form
    v-else
    class="flex flex-col gap-4"
    @submit.prevent="handleSubmit"
  >
    <UInput
      v-model="title"
      placeholder="제목"
      size="lg"
      required
    />
    <UTextarea
      v-model="content"
      placeholder="내용을 입력하세요"
      :rows="12"
      required
    />
    <UInput
      v-model="tagsInput"
      placeholder="태그 (쉼표로 구분)"
    />

    <MemiBoardAttachments
      v-model="attachments"
      :post-id="attachmentNamespace"
      editable
    />

    <p
      v-if="error"
      class="text-sm text-error"
    >
      {{ error }}
    </p>

    <div class="flex gap-2">
      <UButton
        type="submit"
        :loading="saving"
        :label="postId ? '수정 완료' : '게시하기'"
      />
      <UButton
        variant="ghost"
        color="neutral"
        label="취소"
        @click="emit('cancel')"
      />
    </div>
  </form>
</template>
