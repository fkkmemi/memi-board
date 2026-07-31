<script setup lang="ts">
import { ref, onMounted, resolveComponent } from 'vue'
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore'
import { useMemiBoardPosts } from '../composables/useMemiBoardPosts'
import { useMemiBoardSettings } from '../composables/useMemiBoardSettings'
import type { PostModel } from '../types'
import { formatDate } from '../utils/formatDate'

const props = withDefaults(defineProps<{
  pageSize?: number
  /** 지정하면 각 글이 `${linkBase}/${id}`로 이동하는 링크가 된다. 지정하지 않으면 select 이벤트만 emit. */
  linkBase?: string
}>(), {
  pageSize: 20,
})

const emit = defineEmits<{ select: [post: PostModel] }>()

// 정적 import 대신 런타임에 이름으로 찾는다 — Nuxt 앱 안에서는 전역 등록된 NuxtLink를 그대로 쓰고,
// 라이브러리 자체는 Nuxt 빌드 컨텍스트 밖에서도(플레인 Vite) 빌드 가능하게 유지한다.
const NuxtLink = resolveComponent('NuxtLink')

const { getPosts } = useMemiBoardPosts()
const { categoryLabel } = useMemiBoardSettings()

const posts = ref<PostModel[]>([])
const cursor = ref<QueryDocumentSnapshot<DocumentData> | undefined>(undefined)
const hasMore = ref(false)
const loading = ref(false)
const initialLoading = ref(true)

async function loadMore() {
  loading.value = true
  try {
    const result = await getPosts({ pageSize: props.pageSize, cursor: cursor.value })
    posts.value.push(...result.posts)
    cursor.value = result.cursor
    hasMore.value = result.hasMore
  }
  finally {
    loading.value = false
    initialLoading.value = false
  }
}

onMounted(loadMore)

function handleClick(post: PostModel) {
  if (!props.linkBase) emit('select', post)
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
      v-else-if="!posts.length"
      class="text-sm text-muted text-center py-8"
    >
      아직 게시글이 없습니다.
    </p>

    <component
      :is="linkBase ? NuxtLink : 'button'"
      v-for="post in posts"
      :key="post.id"
      :to="linkBase ? `${linkBase}/${post.id}` : undefined"
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
      @click="loadMore"
    />
  </div>
</template>
