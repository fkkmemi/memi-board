<script setup lang="ts">
import type { PostDetail } from '../types'
import { formatDate } from '../utils/formatDate'

const props = defineProps<{ postId: string }>()

const emit = defineEmits<{ deleted: [], edit: [postId: string] }>()

const { getPost, deletePost } = useMemiBoardPosts()
const { canEdit, canDelete } = useMemiBoardAuth()
const { categoryLabel } = useMemiBoardSettings()
// post.commentCount는 상세 진입 시점의 스냅샷이라 새 댓글이 즉시 반영되지 않는다 — 실시간 댓글 목록 길이로 표시한다.
const { comments } = useMemiBoardComments(props.postId)

const post = ref<PostDetail | null>(null)
const loading = ref(true)
const deleting = ref(false)
const notFound = ref(false)

async function load() {
  loading.value = true
  notFound.value = false
  const result = await getPost(props.postId)
  if (!result) {
    notFound.value = true
  }
  post.value = result
  loading.value = false
}

onMounted(load)
watch(() => props.postId, load)

async function handleDelete() {
  if (!post.value) return
  if (!window.confirm('이 게시글을 삭제하시겠습니까? 되돌릴 수 없습니다.')) return
  deleting.value = true
  try {
    await deletePost(props.postId)
    emit('deleted')
  }
  finally {
    deleting.value = false
  }
}
</script>

<template>
  <div
    v-if="loading"
    class="flex flex-col gap-3"
  >
    <USkeleton class="h-8 w-2/3" />
    <USkeleton class="h-32 w-full" />
  </div>

  <p
    v-else-if="notFound"
    class="text-sm text-muted"
  >
    게시글을 찾을 수 없습니다.
  </p>

  <div
    v-else-if="post"
    class="flex flex-col gap-6"
  >
    <header class="flex flex-col gap-2">
      <div class="flex items-start justify-between gap-4">
        <div class="flex items-center gap-2 min-w-0">
          <UBadge
            v-if="post.category"
            :label="categoryLabel(post.category)"
            variant="subtle"
          />
          <h1 class="text-2xl font-semibold">
            {{ post.title }}
          </h1>
        </div>
        <div
          v-if="canEdit(post) || canDelete(post)"
          class="flex gap-2 shrink-0"
        >
          <UButton
            v-if="canEdit(post)"
            icon="i-lucide-pencil"
            size="sm"
            variant="outline"
            color="neutral"
            label="수정"
            @click="emit('edit', postId)"
          />
          <UButton
            v-if="canDelete(post)"
            icon="i-lucide-trash-2"
            size="sm"
            variant="outline"
            color="error"
            label="삭제"
            :loading="deleting"
            @click="handleDelete"
          />
        </div>
      </div>
      <div class="flex items-center gap-3 text-sm text-muted">
        <UAvatar
          :src="post.authorPhoto ?? undefined"
          :alt="post.authorName ?? '익명'"
          size="xs"
        />
        <span>{{ post.authorName ?? '익명' }}</span>
        <span>{{ formatDate(post.createdAt) }}</span>
      </div>
      <div
        v-if="post.tags?.length"
        class="flex gap-1"
      >
        <UBadge
          v-for="tag in post.tags"
          :key="tag"
          variant="subtle"
          color="neutral"
          size="sm"
        >
          {{ tag }}
        </UBadge>
      </div>
    </header>

    <p class="whitespace-pre-wrap break-words leading-relaxed">
      {{ post.content }}
    </p>

    <MemiBoardAttachments
      v-if="post.attachments?.length"
      :model-value="post.attachments"
      :post-id="postId"
    />

    <section class="flex flex-col gap-4 border-t border-default pt-4">
      <h2 class="text-sm font-medium text-muted">
        댓글 {{ comments.length }}
      </h2>
      <MemiBoardCommentForm :post-id="postId" />
      <MemiBoardCommentList :post-id="postId" />
    </section>
  </div>
</template>
