<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore'
import { useMemiBoardPosts } from 'memi-board'
import { useMemiBoardSettings } from 'memi-board'
import type { PostModel } from 'memi-board'
import MemiBoardListDefault from './ListDefault.vue'
import MemiBoardListImage from './ListImage.vue'
import MemiBoardListVideo from './ListVideo.vue'

const props = withDefaults(defineProps<{
  pageSize?: number
  /**
   * 글 상세 링크 생성.
   * 예: (p) => `/board/${p.category}/${p.id}`
   * 없으면 postLinkBase / linkBase / select 순.
   */
  getPostLink?: (post: PostModel) => string | undefined
  /**
   * 글 상세 링크 prefix.
   * 예: `/board/post` → `/board/post/{id}`
   */
  postLinkBase?: string
  /** 지정 시 해당 카테고리 글만 조회 */
  category?: string
  /** @deprecated postLinkBase / getPostLink 사용 */
  linkBase?: string
}>(), {
  pageSize: 20,
})

const emit = defineEmits<{ select: [post: PostModel] }>()

const { getPosts } = useMemiBoardPosts()
const { categories } = useMemiBoardSettings()

const posts = ref<PostModel[]>([])
const cursor = ref<QueryDocumentSnapshot<DocumentData> | undefined>(undefined)
const hasMore = ref(false)
const loading = ref(false)
const initialLoading = ref(true)
const loadError = ref('')
const listView = computed(() =>
  categories.value.find(item => item.id === props.category)?.listView ?? 'default',
)
const listComponent = computed(() => ({
  default: MemiBoardListDefault,
  image: MemiBoardListImage,
  video: MemiBoardListVideo,
})[listView.value])

function postTo(post: PostModel): string | undefined {
  if (props.getPostLink) return props.getPostLink(post)
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
      :is="listComponent"
      v-else-if="posts.length"
      :posts="posts"
      :post-to="postTo"
      @select="emit('select', $event)"
    />

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
