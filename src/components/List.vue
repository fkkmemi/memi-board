<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, onUnmounted, ref, watch } from 'vue'
import { useMemiBoardPostList } from 'memi-board/runtime'
import { useMemiBoardSettings } from 'memi-board/runtime'
import type { BoardListView, PostModel } from 'memi-board/runtime'
import MemiBoardListDefault from './ListDefault.vue'
import MemiBoardListImage from './ListImage.vue'
import MemiBoardListVideo from './ListVideo.vue'
import MemiBoardListViewSwitch from './ListViewSwitch.vue'

const props = withDefaults(defineProps<{
  pageSize?: number
  /** 정보창의 '이 게시판은' 탭에 표시할 소개 */
  introduction?: string
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
  /** 흔치 않게 뷰 전환을 바깥에서 직접 제어해야 할 때만 v-model:view로 넘긴다. */
  view?: BoardListView
  /** 목록 위 헤더에 표시할 제목(예: 카테고리 이름). 지정하면 헤더 행(제목 + 버튼들)을 보여준다. */
  title?: string
  /** '게시판 설정' 버튼 링크. 지정하면(그리고 canManageSettings가 true면) 헤더에 버튼을 보여준다. */
  settingsTo?: string
  /** '게시판 설정' 버튼 노출 여부 — 호스트가 권한을 계산해 넘긴다. */
  canManageSettings?: boolean
  /** '새 글쓰기' 버튼 링크. 지정하면(그리고 canWrite가 true면) 헤더에 버튼을 보여준다. */
  writeTo?: string
  /** '새 글쓰기' 버튼 노출 여부 — 호스트가 권한을 계산해 넘긴다. */
  canWrite?: boolean
}>(), {
  pageSize: 10,
  introduction: '이 게시판은 Nuxt 4와 Vue 3, TypeScript를 바탕으로 만들었어요. Nuxt UI와 Tailwind CSS로 편안한 화면을 구성하고, Firebase Firestore·Auth·Storage와 nuxt-vuefire로 글과 댓글을 자연스럽게 이어갑니다.',
  canManageSettings: true,
  canWrite: true,
})

const emit = defineEmits<{ select: [post: PostModel], 'update:view': [view: BoardListView] }>()

const { categories } = useMemiBoardSettings()
const { posts, postsPending, hasMore, loadingMore, loadError, loadMore } = useMemiBoardPostList(
  computed(() => props.category),
  { pageSize: props.pageSize },
)

const loadMoreTrigger = ref<HTMLElement | null>(null)
let loadMoreDelayTimer: ReturnType<typeof setTimeout> | undefined
let loadMoreObserver: IntersectionObserver | undefined
const waitingToLoad = ref(false)
const morePending = computed(() => waitingToLoad.value || loadingMore.value)
let triggerVisible = false
let automaticRequest = false

function cancelAutomaticLoad() {
  if (!automaticRequest || !loadMoreDelayTimer) return
  clearTimeout(loadMoreDelayTimer)
  loadMoreDelayTimer = undefined
  automaticRequest = false
  waitingToLoad.value = false
}

// 옵저버가 트리거를 보자마자 바로 불러오면 스크롤 중 살짝만 걸쳐도 계속 재요청된다 —
// 500ms 뒤에도 여전히 보이는 경우에만(자동 요청) 실제로 더 불러온다. 버튼 클릭은 즉시 실행.
function scheduleLoadMore(automatic = false) {
  if (loadMoreDelayTimer || loadingMore.value || !hasMore.value) return
  automaticRequest = automatic
  waitingToLoad.value = true
  loadMoreDelayTimer = setTimeout(() => {
    loadMoreDelayTimer = undefined
    if (automaticRequest && !triggerVisible) {
      automaticRequest = false
      waitingToLoad.value = false
      return
    }
    automaticRequest = false
    waitingToLoad.value = false
    if (hasMore.value && !loadingMore.value) void loadMore()
  }, 500)
}

onMounted(() => {
  loadMoreObserver = new IntersectionObserver((entries) => {
    triggerVisible = entries.some(entry => entry.isIntersecting)
    if (triggerVisible) scheduleLoadMore(true)
    else cancelAutomaticLoad()
  })
  if (loadMoreTrigger.value) loadMoreObserver.observe(loadMoreTrigger.value)
})

watch(loadMoreTrigger, (element, previous) => {
  if (previous) loadMoreObserver?.unobserve(previous)
  if (element) loadMoreObserver?.observe(element)
}, { flush: 'post' })

onUnmounted(() => {
  clearTimeout(loadMoreDelayTimer)
  waitingToLoad.value = false
  loadMoreObserver?.disconnect()
})

const infoOpen = ref(false)
const infoTab = ref<'about' | 'history'>('about')
const now = ref(Date.now())
let clock: ReturnType<typeof setInterval> | undefined
const boardStacks = [
  {
    category: '프레임워크 & 언어',
    icon: 'i-lucide-layers',
    color: 'text-blue-500',
    panelClass: 'border-blue-100 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/30',
    items: [
      { name: 'Nuxt 4', desc: 'Vue 기반 SSR 프레임워크', url: 'https://nuxt.com', icon: 'i-simple-icons-nuxtdotjs', color: '#00DC82' },
      { name: 'Vue 3', desc: 'Composition API · script setup', url: 'https://vuejs.org', icon: 'i-simple-icons-vuedotjs', color: '#4FC08D' },
      { name: 'TypeScript', desc: '안전한 데이터와 컴포넌트 타입', url: 'https://www.typescriptlang.org', icon: 'i-simple-icons-typescript', color: '#3178C6' },
    ],
  },
  {
    category: 'UI & 스타일',
    icon: 'i-lucide-palette',
    color: 'text-purple-500',
    panelClass: 'border-purple-100 bg-purple-50 dark:border-purple-900/50 dark:bg-purple-950/30',
    items: [
      { name: 'Nuxt UI v4', desc: '게시판·폼·모달 UI', url: 'https://ui.nuxt.com', icon: 'i-simple-icons-nuxtdotjs', color: '#00DC82' },
      { name: 'Tailwind CSS v4', desc: '반응형 · 라이트/다크 스타일', url: 'https://tailwindcss.com', icon: 'i-simple-icons-tailwindcss', color: '#06B6D4' },
      { name: 'Lucide Icons', desc: '가볍고 일관된 아이콘', url: 'https://lucide.dev', icon: 'i-lucide-box', color: '#F97316' },
      { name: 'dayjs', desc: '읽기 편한 날짜와 상대 시각', url: 'https://day.js.org', icon: 'i-lucide-clock', color: '#FF5F4C' },
    ],
  },
  {
    category: '백엔드 & 데이터',
    icon: 'i-lucide-database',
    color: 'text-orange-500',
    panelClass: 'border-orange-100 bg-orange-50 dark:border-orange-900/50 dark:bg-orange-950/30',
    items: [
      { name: 'Firebase Firestore', desc: '게시글과 댓글을 위한 실시간 DB', url: 'https://firebase.google.com', icon: 'i-simple-icons-firebase', color: '#FFCA28' },
      { name: 'Firebase Auth', desc: '안전한 사용자 로그인과 권한', url: 'https://firebase.google.com', icon: 'i-simple-icons-firebase', color: '#FFCA28' },
      { name: 'Firebase Storage', desc: '이미지와 첨부파일 보관', url: 'https://firebase.google.com', icon: 'i-simple-icons-firebase', color: '#FFCA28' },
      { name: 'nuxt-vuefire', desc: 'Nuxt와 Firebase 실시간 연결', url: 'https://vuefire.vuejs.org', icon: 'i-simple-icons-firebase', color: '#FFCA28' },
    ],
  },
]

onMounted(() => {
  clock = setInterval(() => { now.value = Date.now() }, 60_000)
})

onBeforeUnmount(() => {
  if (clock) clearInterval(clock)
})
// 카테고리 설정값은 게시판을 처음 열 때 보여줄 방식일 뿐 — 화면에서 자유롭게 바꿔 볼 수 있다.
// props.view가 오면(호스트가 전환 버튼을 직접 배치) 그 값을 그대로 따르고, 없으면 내부에서 관리한다.
const categoryListView = computed(() =>
  categories.value.find(item => item.id === props.category)?.listView ?? 'default',
)
const internalViewMode = ref<BoardListView>(props.view ?? categoryListView.value)
watch(categoryListView, (value) => { if (props.view === undefined) internalViewMode.value = value })
const viewMode = computed(() => props.view ?? internalViewMode.value)
function setViewMode(value: BoardListView) {
  if (props.view === undefined) internalViewMode.value = value
  emit('update:view', value)
}
const listComponent = computed(() => ({
  default: MemiBoardListDefault,
  image: MemiBoardListImage,
  video: MemiBoardListVideo,
})[viewMode.value])
const hasHeader = computed(() => !!(props.title || (props.settingsTo && props.canManageSettings) || (props.writeTo && props.canWrite)))

function postTo(post: PostModel): string | undefined {
  if (props.getPostLink) return props.getPostLink(post)
  const base = props.postLinkBase || props.linkBase
  if (!base || !post.id) return undefined
  return `${base.replace(/\/$/, '')}/${post.id}`
}

</script>

<template>
  <div class="flex flex-col gap-2">
    <div v-if="hasHeader" class="flex items-center justify-between gap-4">
      <h1 v-if="title" class="min-w-0 truncate text-2xl font-bold tracking-tight text-highlighted">{{ title }}</h1>
      <div class="flex shrink-0 items-center gap-2">
        <UButton
          v-if="settingsTo && canManageSettings"
          :to="settingsTo"
          label="게시판 설정"
          icon="i-lucide-settings"
          color="neutral"
          variant="outline"
        />
        <MemiBoardListViewSwitch :model-value="viewMode" @update:model-value="setViewMode" />
        <UButton
          v-if="writeTo && canWrite"
          :to="writeTo"
          label="새 글쓰기"
          icon="i-lucide-pencil"
        />
      </div>
    </div>
    <div v-else-if="view === undefined" class="flex justify-end">
      <MemiBoardListViewSwitch :model-value="viewMode" @update:model-value="setViewMode" />
    </div>

    <template v-if="postsPending">
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
      :now="now"
      :show-category="!category"
      @select="emit('select', $event)"
    />

    <div
      v-if="!postsPending && hasMore"
      ref="loadMoreTrigger"
      class="flex justify-center py-1"
    >
      <UButton
        variant="outline"
        color="neutral"
        label="더 보기"
        block
        class="w-full"
        :loading="morePending"
        :disabled="morePending"
        @click="scheduleLoadMore()"
      />
    </div>

    <template v-if="morePending">
      <USkeleton
        v-for="i in 3"
        :key="`more-${i}`"
        class="h-20 w-full"
      />
    </template>

    <UModal
      v-model:open="infoOpen"
      title="게시판 정보"
      :ui="{ content: 'sm:max-w-2xl' }"
    >
      <template #body>
        <div class="flex flex-col gap-4">
          <div class="flex gap-1 rounded-lg bg-muted p-1">
            <UButton
              size="sm"
              class="flex-1 justify-center"
              :color="infoTab === 'about' ? 'primary' : 'neutral'"
              :variant="infoTab === 'about' ? 'solid' : 'ghost'"
              @click="infoTab = 'about'"
            >
              이 게시판은
            </UButton>
            <UButton
              size="sm"
              class="flex-1 justify-center"
              :color="infoTab === 'history' ? 'primary' : 'neutral'"
              :variant="infoTab === 'history' ? 'solid' : 'ghost'"
              @click="infoTab = 'history'"
            >
              버전 히스토리
            </UButton>
          </div>

          <div
            v-if="infoTab === 'about'"
            class="max-h-[min(60vh,36rem)] space-y-4 overflow-y-auto px-1"
          >
            <div class="flex items-start gap-3 px-1">
              <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-500/10">
                <UIcon
                  name="i-lucide-code-2"
                  class="size-5 text-primary-500"
                />
              </div>
              <div>
                <h3 class="font-bold text-highlighted">
                  이 게시판은
                </h3>
                <p class="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted">
                  {{ introduction }}
                </p>
              </div>
            </div>

            <section
              v-for="group in boardStacks"
              :key="group.category"
              class="rounded-2xl border p-4"
              :class="group.panelClass"
            >
              <div class="mb-3 flex items-center gap-2">
                <UIcon
                  :name="group.icon"
                  class="size-4"
                  :class="group.color"
                />
                <h4 class="text-sm font-bold text-highlighted">
                  {{ group.category }}
                </h4>
              </div>
              <div class="grid gap-2 sm:grid-cols-2">
                <a
                  v-for="item in group.items"
                  :key="item.name"
                  :href="item.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="group flex items-center gap-3 rounded-xl border border-default bg-default/70 p-3 transition-colors hover:border-accented"
                >
                  <span
                    class="flex size-9 shrink-0 items-center justify-center rounded-lg"
                    :style="{ backgroundColor: `${item.color}20` }"
                  >
                    <UIcon
                      :name="item.icon"
                      class="size-4"
                      :style="{ color: item.color }"
                    />
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block text-sm font-bold text-highlighted">{{ item.name }}</span>
                    <span class="block truncate text-xs text-muted">{{ item.desc }}</span>
                  </span>
                  <UIcon
                    name="i-lucide-arrow-up-right"
                    class="size-3.5 shrink-0 text-dimmed transition-colors group-hover:text-muted"
                  />
                </a>
              </div>
            </section>
          </div>
          <div
            v-else
            class="max-h-[min(55vh,30rem)] overflow-y-auto px-1"
          >
            <MemiBoardVersionHistory />
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
