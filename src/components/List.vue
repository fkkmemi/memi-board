<script setup lang="ts">
import { ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore'
import { useMemiBoardPosts } from 'memi-board'
import { useMemiBoardSettings } from 'memi-board'
import type { PostModel } from 'memi-board'
import { formatDate } from 'memi-board'

const props = withDefaults(defineProps<{
  pageSize?: number
  /**
   * 글 상세 링크 prefix.
   * 예: `/board/post` → 각 행이 `/board/post/{id}` 로 이동.
   * 없으면 select 이벤트만 emit.
   */
  postLinkBase?: string
  /** 지정 시 해당 카테고리 글만 조회 */
  category?: string
  /** @deprecated postLinkBase 사용. 하위 호환: `${linkBase}/${id}` */
  linkBase?: string
}>(), {
  pageSize: 20,
})

const emit = defineEmits<{ select: [post: PostModel] }>()

const { getPosts } = useMemiBoardPosts()
const { categoryLabel } = useMemiBoardSettings()

const posts = ref<PostModel[]>([])
const cursor = ref<QueryDocumentSnapshot<DocumentData> | undefined>(undefined)
const hasMore = ref(false)
const loading = ref(false)
const initialLoading = ref(true)
const loadError = ref('')

function postTo(post: PostModel): string | undefined {
  const base = props.postLinkBase || props.linkBase
  if (!base || !post.id) return undefined
  return `${base.replace(/\/$/, '')}/${post.id}`
}

async function loadMore(reset = false) {
  loading.value = true
  loadError.value = ''
  if (reset) {
    posts.value = []
    cursor.value = undefined
    hasMore.value = false
    initialLoading.value = true
  }
  try {
    const result = await getPosts({
      pageSize: props.pageSize,
      cursor: reset ? undefined : cursor.value,
      category: props.category || undefined,
    })
    posts.value.push(...result.posts)
    cursor.value = result.cursor
    hasMore.value = result.hasMore
  }
  catch (e) {
    loadError.value = (e as Error).message || String(e)
    console.error('[memi-board] getPosts failed', e)
  }
  finally {
    loading.value = false
    initialLoading.value = false
  }
}

watch(
  () => props.category,
  () => { void loadMore(true) },
  { immediate: true },
)

function handleClick(post: PostModel) {
  if (!postTo(post)) emit('select', post)
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <template v-if="initialLoading">
      <USkeleton
        v-for="i in 3"
        :key="i"
        class="h-20 w-full"
      />
    </template>

    <p
      v-else-if="loadError"
      class="text-sm text-error text-center py-8"
    >
      목록을 불러오지 못했습니다: {{ loadError }}
    </p>

    <p
      v-else-if="!posts.length"
      class="text-sm text-muted text-center py-8"
    >
      아직 게시글이 없습니다.
    </p>

    <component
      :is="postTo(post) ? RouterLink : 'button'"
      v-for="post in posts"
      :key="post.id"
      :to="postTo(post)"
      class="text-left"
      @click="handleClick(post)"
    >
      <UCard class="hover:bg-elevated/50 transition-colors">
        <div class="flex items-center justify-between gap-4">
          <div class="flex items-center gap-2 min-w-0">
            <UBadge
              v-if="post.category"
              :label="categoryLabel(post.category)"
              variant="subtle"
              size="sm"
            />
            <h3 class="font-medium truncate">
              {{ post.title }}
            </h3>
          </div>
          <span class="text-xs text-muted shrink-0">{{ formatDate(post.createdAt) }}</span>
        </div>
        <div class="flex items-center gap-3 text-xs text-muted mt-2">
          <span>{{ post.authorName ?? '익명' }}</span>
          <span class="flex items-center gap-1">
            <UIcon
              name="i-lucide-message-circle"
              class="size-3"
            />{{ post.commentCount }}
          </span>
          <span
            v-if="post.attachments?.length"
            class="flex items-center gap-1"
          >
            <UIcon
              name="i-lucide-paperclip"
              class="size-3"
            />{{ post.attachments.length }}
          </span>
        </div>
      </UCard>
    </component>

    <UButton
      v-if="hasMore"
      variant="outline"
      color="neutral"
      label="더 보기"
      block
      :loading="loading"
      @click="loadMore(false)"
    />
  </div>
</template>
