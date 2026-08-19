<script setup lang="ts">
import { computed } from 'vue'
import type { BoardSection, PostModel } from 'memi-board/runtime'
import { miniPostsView, miniViewGroup, useMemiBoardMiniPicked, useMemiBoardSettings } from 'memi-board/runtime'
import MemiBoardMiniCard from './MiniCard.vue'
import MemiBoardMiniPosts from './MiniPosts.vue'

const props = defineProps<{
  section: BoardSection
  getPostLink?: (post: PostModel) => string | undefined
}>()

const { posts, pending } = useMemiBoardMiniPicked(() => props.section.postIds)
const { getBoard } = useMemiBoardSettings()
const view = computed(() => miniPostsView(posts.value, getBoard))
const useCarousel = computed(() =>
  miniViewGroup(view.value) === 'list' && posts.value.length >= 2 && posts.value.length !== 4,
)
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div v-if="pending" class="grid grid-cols-2 gap-2 p-2">
      <USkeleton v-for="i in Math.min(section.count, 4)" :key="i" class="aspect-[4/3] w-full" />
    </div>
    <p
      v-else-if="!posts.length"
      class="flex flex-1 items-center justify-center px-3 py-6 text-sm text-muted"
    >
      고른 게시물이 없습니다.
    </p>
    <UCarousel
      v-else-if="useCarousel"
      v-slot="{ item }"
      :items="posts"
      arrows
      dots
      loop
      :ui="{ item: 'basis-full ps-0' }"
      class="min-w-0 p-2"
    >
      <MemiBoardMiniCard :post="item" :get-post-link="getPostLink" />
    </UCarousel>
    <MemiBoardMiniPosts
      v-else
      :posts="posts"
      :view="view"
      show-board
      :get-post-link="getPostLink"
    />
  </div>
</template>
