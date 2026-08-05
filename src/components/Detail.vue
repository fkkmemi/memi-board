<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import Youtube from '@tiptap/extension-youtube'
import type { PostDetail, PostModel } from 'memi-board/runtime'
import { formatDate, renderMarkdownToHtml } from 'memi-board/runtime'
import { useMemiBoardPosts } from 'memi-board/runtime'
import { useMemiBoardAuth } from 'memi-board/runtime'
import { useMemiBoardSettings } from 'memi-board/runtime'
import MemiBoardAttachments from './Attachments.vue'
import MemiBoardCommentForm from './CommentForm.vue'
import MemiBoardCommentList from './CommentList.vue'

const props = defineProps<{ postId: string }>()

const emit = defineEmits<{
  deleted: []
  edit: [postId: string]
  list: []
  navigate: [post: PostModel]
}>()

const { getPost, getAdjacentPosts, deletePost } = useMemiBoardPosts()
const { canEdit, canDelete } = useMemiBoardAuth()
const { categoryLabel } = useMemiBoardSettings()

const post = ref<PostDetail | null>(null)
const loading = ref(true)
const deleting = ref(false)
const notFound = ref(false)
const previousPost = ref<PostModel | null>(null)
const nextPost = ref<PostModel | null>(null)
const viewerExtensions = [
  Youtube.configure({
    nocookie: true,
    controls: true,
    width: 640,
    height: 360,
  }),
]

async function load() {
  loading.value = true
  notFound.value = false
  const result = await getPost(props.postId)
  if (!result) {
    notFound.value = true
  }
  post.value = result
  if (result) {
    const adjacent = await getAdjacentPosts(result)
    previousPost.value = adjacent.previous
    nextPost.value = adjacent.next
  }
  else {
    previousPost.value = null
    nextPost.value = null
  }
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

/**
 * 본문 표시: HTML(UEditor 저장)이면 그대로, 아니면 마크다운/플레인 변환.
 * (상세에 UEditor 쓰면 목록 이동 시 TipTap plugin 충돌)
 */
const contentHtml = computed(() => {
  const raw = post.value?.content || ''
  if (!raw.trim()) return ''
  // 저장된 HTML (에디터 content-type=html)
  if (/<[a-z][\s\S]*>/i.test(raw)) return raw
  return renderMarkdownToHtml(raw)
})
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

    <!-- 작성 화면과 동일한 TipTap 스타일을 사용하는 읽기 전용 뷰어 -->
    <UEditor
      class="board-content prose dark:prose-invert max-w-none break-words"
      :model-value="contentHtml"
      content-type="html"
      :editable="false"
      :extensions="viewerExtensions"
      :starter-kit="{ link: { openOnClick: true } }"
    />

    <MemiBoardAttachments
      v-if="post.attachments?.length"
      :model-value="post.attachments"
      :post-id="postId"
    />

    <div class="flex flex-col items-end gap-2">
      <div class="flex items-center justify-end gap-3 text-sm text-muted">
        <UAvatar
          :src="post.authorPhoto ?? undefined"
          :alt="post.authorName ?? '익명'"
          size="xs"
        />
        <span>{{ post.authorName ?? '익명' }}</span>
        <span>{{ formatDate(post.createdAt) }}</span>
      </div>
      <div v-if="canEdit(post) || canDelete(post)" class="flex gap-2">
        <UButton
          v-if="canEdit(post)"
          icon="i-lucide-pencil"
          size="sm"
          variant="ghost"
          color="neutral"
          label="수정"
          @click="emit('edit', postId)"
        />
        <UButton
          v-if="canDelete(post)"
          icon="i-lucide-trash-2"
          size="sm"
          variant="ghost"
          color="error"
          label="삭제"
          :loading="deleting"
          @click="handleDelete"
        />
      </div>
    </div>

    <nav class="grid grid-cols-3 items-center py-3" aria-label="게시글 이동">
      <UButton
        variant="ghost"
        color="neutral"
        icon="i-lucide-chevron-left"
        label="이전"
        class="justify-self-start"
        :disabled="!previousPost?.id"
        @click="previousPost?.id && emit('navigate', previousPost)"
      />
      <UButton
        variant="ghost"
        color="neutral"
        icon="i-lucide-list"
        label="목록"
        class="justify-self-center"
        @click="emit('list')"
      />
      <UButton
        variant="ghost"
        color="neutral"
        trailing-icon="i-lucide-chevron-right"
        label="다음"
        class="justify-self-end"
        :disabled="!nextPost?.id"
        @click="nextPost?.id && emit('navigate', nextPost)"
      />
    </nav>

    <section class="flex flex-col gap-4 border-t border-default pt-4">
      <h2 class="text-sm font-medium text-muted">
        댓글
      </h2>
      <MemiBoardCommentList :post-id="postId" />
      <MemiBoardCommentForm :post-id="postId" />
    </section>
  </div>
</template>

<style scoped>
.board-content :deep(iframe[src*="youtube.com"], iframe[src*="youtube-nocookie.com"], iframe[src*="youtu.be"]) {
  width: 100%;
  max-width: 640px;
  aspect-ratio: 16 / 9;
  height: auto;
  border: 0;
  border-radius: 0.75rem;
}
</style>
