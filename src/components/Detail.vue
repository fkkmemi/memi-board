<script setup lang="ts">
import { ref, computed, onBeforeUnmount, onMounted, watch } from 'vue'
import Youtube from '@tiptap/extension-youtube'
import type { PostModel } from 'memi-board/runtime'
import { renderMarkdownToHtml, useMemiBoardI18n } from 'memi-board/runtime'
import { useMemiBoardPost, useMemiBoardPosts } from 'memi-board/runtime'
import { useMemiBoardAuth } from 'memi-board/runtime'
import { useMemiBoardSettings } from 'memi-board/runtime'
import { useMemiBoardViews } from 'memi-board/runtime'
import MemiBoardAttachments from './Attachments.vue'
import MemiBoardCommentForm from './CommentForm.vue'
import MemiBoardCommentList from './CommentList.vue'
import MemiBoardLikeButton from './LikeButton.vue'
import MemiBoardReportButton from './ReportButton.vue'
import MemiBoardShareButton from './ShareButton.vue'
import MemiBoardSwipeHint from './SwipeHint.vue'
import MemiBoardAuthorMenu from './AuthorMenu.vue'

const props = defineProps<{
  boardId: string
  postId: string
  /** 작성자 메뉴의 "프로필 보기" 링크. 없으면 해당 항목이 비활성 상태로만 보인다. */
  authorProfileTo?: (authorUid: string) => string | undefined
  /** 작성자 메뉴의 "작성글 보기" 링크. 없으면 해당 항목이 비활성 상태로만 보인다. */
  authorPostsTo?: (authorUid: string) => string | undefined
  /** 작성자 메뉴의 "작성한 댓글 보기" 링크. 없으면 해당 항목이 비활성 상태로만 보인다. */
  authorCommentsTo?: (authorUid: string) => string | undefined
}>()

const emit = defineEmits<{
  deleted: []
  edit: [postId: string]
  list: []
  navigate: [post: PostModel]
}>()

const { getAdjacentPosts, deletePost, publishPost } = useMemiBoardPosts(() => props.boardId)
const { canEdit, canDelete } = useMemiBoardAuth()
const { boardLabel, getBoard } = useMemiBoardSettings()
// 보드 설정 언어 → 호스트 언어 순. 댓글 등 자식 컴포넌트도 이 언어를 따른다.
const { t, dir, formatRelativeDate, formatTimestampDetails } = useMemiBoardI18n({ boardLocale: () => getBoard(props.boardId)?.locale })
const { recordView } = useMemiBoardViews()

// 실시간 구독 — 다른 사람의 좋아요·댓글 수 변경이 화면에 바로 반영된다.
// 좋아요 토글도 이 구독이 그대로 비춰주므로 별도 로컬 낙관적 갱신이 필요 없다.
const { post, pending: loading } = useMemiBoardPost(() => props.boardId, computed(() => props.postId))
const notFound = computed(() => !loading.value && !post.value)
const isDraft = computed(() => post.value?.isPublished === false)
const deleting = ref(false)
const publishing = ref(false)
const previousPost = ref<PostModel | null>(null)
const nextPost = ref<PostModel | null>(null)
const now = ref(Date.now())
let clock: ReturnType<typeof setInterval> | undefined
const viewerExtensions = [
  Youtube.configure({
    nocookie: true,
    controls: true,
    width: 640,
    height: 360,
  }),
]

// 인접 글은 처음 로드될 때 한 번만 조회한다 — post는 좋아요·댓글 수 변경으로도
// 계속 갱신되므로, 매번 다시 조회하면 그때마다 불필요한 쿼리가 발생한다.
let adjacentLoadedForId: string | null = null
watch(post, async (current) => {
  if (!current?.id) return
  if (adjacentLoadedForId === current.id) return
  adjacentLoadedForId = current.id
  const adjacent = await getAdjacentPosts(current)
  previousPost.value = adjacent.previous
  nextPost.value = adjacent.next
}, { immediate: true })

// 상세 진입 시 조회수 +1 (로그인 불필요, 세션당 1회)
watch(
  () => [props.boardId, props.postId] as const,
  ([boardId, id]) => {
    if (boardId && id) void recordView(boardId, id)
  },
  { immediate: true },
)

onMounted(() => {
  clock = setInterval(() => { now.value = Date.now() }, 60_000)
})
onBeforeUnmount(() => {
  if (clock) clearInterval(clock)
})

/** 모바일 터치 스와이프: 왼쪽→다음 글, 오른쪽→이전 글. */
const touchStartX = ref(0)
const touchStartY = ref(0)
const SWIPE_MIN_PX = 70

function onTouchStart(e: TouchEvent) {
  const t = e.changedTouches[0]
  if (!t) return
  touchStartX.value = t.clientX
  touchStartY.value = t.clientY
}

function onTouchEnd(e: TouchEvent) {
  const t = e.changedTouches[0]
  if (!t) return
  const dx = t.clientX - touchStartX.value
  const dy = t.clientY - touchStartY.value
  if (Math.abs(dx) < SWIPE_MIN_PX) return
  if (Math.abs(dy) > Math.abs(dx) * 0.65) return

  if (dx < 0 && nextPost.value) emit('navigate', nextPost.value)
  else if (dx > 0 && previousPost.value) emit('navigate', previousPost.value)
}

async function handlePublish() {
  if (!post.value) return
  publishing.value = true
  try {
    await publishPost(props.postId)
  }
  finally {
    publishing.value = false
  }
}

async function handleDelete() {
  if (!post.value) return
  if (!window.confirm(t('detail.deleteConfirm'))) return
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
    :dir="dir"
    class="flex flex-col gap-3"
  >
    <USkeleton class="h-8 w-2/3" />
    <USkeleton class="h-32 w-full" />
  </div>

  <p
    v-else-if="notFound"
    :dir="dir"
    class="text-sm text-muted"
  >
    {{ t('detail.notFound') }}
  </p>

  <div
    v-else-if="post"
    :dir="dir"
    class="flex flex-col gap-6 touch-pan-y"
    @touchstart.passive="onTouchStart"
    @touchend.passive="onTouchEnd"
  >
    <div v-if="isDraft" class="flex flex-col gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex items-start gap-2">
        <UIcon name="i-lucide-eye-off" class="mt-0.5 size-4 shrink-0 text-warning" />
        <div>
          <p class="text-sm font-medium text-highlighted">{{ t('detail.draftPreview') }}</p>
          <p class="text-xs text-muted">{{ t('detail.draftNotice') }}</p>
        </div>
      </div>
      <UButton
        v-if="canEdit(post)"
        :label="t('detail.publish')"
        icon="i-lucide-send"
        size="sm"
        class="shrink-0"
        :loading="publishing"
        @click="handlePublish"
      />
    </div>

    <header class="flex flex-col gap-2">
      <div class="flex items-start justify-between gap-4">
        <div class="flex items-center gap-2 min-w-0">
          <UBadge
            v-if="post.category"
            :label="boardLabel(boardId)"
            variant="subtle"
          />
          <h1
            v-if="post.title?.trim()"
            class="text-2xl font-semibold"
          >
            {{ post.title }}
          </h1>
        </div>
        <UButton
          icon="i-lucide-arrow-left"
          :aria-label="t('detail.backToList')"
          color="neutral"
          variant="ghost"
          size="sm"
          class="shrink-0"
          @click="emit('list')"
        />
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
      :board-id="boardId"
      :post-id="postId"
    />

    <div class="flex flex-col items-end gap-2">
      <div class="flex items-center justify-end gap-3 text-sm text-muted">
        <MemiBoardAuthorMenu
          :author-uid="post.authorUid"
          :author-name="post.authorName"
          :author-photo="post.authorPhoto"
          :author-posts-to="authorPostsTo"
          :author-profile-to="authorProfileTo"
          :author-comments-to="authorCommentsTo"
        />
        <span class="inline-flex items-center gap-1 tabular-nums">
          <UIcon name="i-lucide-eye" class="size-3.5" />
          {{ post.viewCount ?? 0 }}
        </span>
        <UPopover :content="{ side: 'top' }" :ui="{ content: 'h-auto w-max' }">
          <time
            :datetime="post.createdAt?.toDate?.().toISOString()"
            class="cursor-pointer"
          >
            {{ formatRelativeDate(post.createdAt, now) }}
          </time>
          <template #content>
            <p class="whitespace-pre-line px-3 py-2 text-xs">
              {{ formatTimestampDetails(post.createdAt, post.updatedAt).join('\n') }}
            </p>
          </template>
        </UPopover>
      </div>
      <div v-if="canEdit(post) || canDelete(post)" class="flex gap-2">
        <UButton
          v-if="canEdit(post)"
          icon="i-lucide-pencil"
          size="sm"
          variant="ghost"
          color="neutral"
          :label="t('common.action.edit')"
          @click="emit('edit', postId)"
        />
        <UButton
          v-if="canDelete(post)"
          icon="i-lucide-trash-2"
          size="sm"
          variant="ghost"
          color="error"
          :label="t('common.action.delete')"
          :loading="deleting"
          @click="handleDelete"
        />
      </div>
    </div>

    <div v-if="!isDraft" class="flex items-center justify-center gap-2">
      <MemiBoardLikeButton
        :board-id="boardId"
        :post-id="postId"
        :like-count="post.likeCount ?? 0"
      />
      <MemiBoardShareButton :title="post.title" />
      <MemiBoardReportButton
        :board-id="boardId"
        :post-id="postId"
        :author-uid="post.authorUid"
        :author-name="post.authorName"
        :post-title="post.title"
      />
    </div>

    <nav class="grid grid-cols-3 items-center py-3" :aria-label="t('detail.postNav')">
      <UButton
        variant="ghost"
        color="neutral"
        icon="i-lucide-chevron-left"
        :label="t('common.action.prev')"
        class="justify-self-start"
        :disabled="!previousPost?.id"
        @click="previousPost?.id && emit('navigate', previousPost)"
      />
      <UButton
        variant="ghost"
        color="neutral"
        icon="i-lucide-list"
        :label="t('detail.list')"
        class="justify-self-center"
        @click="emit('list')"
      />
      <UButton
        variant="ghost"
        color="neutral"
        trailing-icon="i-lucide-chevron-right"
        :label="t('common.action.next')"
        class="justify-self-end"
        :disabled="!nextPost?.id"
        @click="nextPost?.id && emit('navigate', nextPost)"
      />
    </nav>

    <MemiBoardSwipeHint v-if="previousPost || nextPost" />

    <section v-if="!isDraft" class="flex flex-col gap-4 border-t border-default pt-4">
      <h2 class="text-sm font-medium text-muted">
        {{ t('detail.comments') }}
      </h2>
      <MemiBoardCommentList :board-id="boardId" :post-id="postId" />
      <MemiBoardCommentForm :board-id="boardId" :post-id="postId" />
    </section>
  </div>
</template>

<style scoped>
.board-content :deep(iframe[src*="youtube.com"]),
.board-content :deep(iframe[src*="youtube-nocookie.com"]),
.board-content :deep(iframe[src*="youtu.be"]) {
  width: 100%;
  max-width: 640px;
  aspect-ratio: 16 / 9;
  height: auto;
  border: 0;
  border-radius: 0.75rem;
}
</style>
