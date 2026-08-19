<script setup lang="ts">
import { computed } from 'vue'
import type { BoardSection, PostModel } from 'memi-board/runtime'
import { miniBoardView, useMemiBoardMiniLatest, useMemiBoardSettings } from 'memi-board/runtime'
import MemiBoardMiniPosts from './MiniPosts.vue'

const props = defineProps<{
  section: BoardSection
  getPostLink?: (post: PostModel) => string | undefined
}>()

const { posts, pending } = useMemiBoardMiniLatest(() => props.section.boardId, () => props.section.count)
const { getBoard } = useMemiBoardSettings()
const view = computed(() => miniBoardView(props.section.boardId, getBoard))
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div v-if="pending" class="flex flex-col gap-2 p-3">
      <USkeleton v-for="i in Math.min(section.count, 5)" :key="i" class="h-7 w-full" />
    </div>
    <p
      v-else-if="!posts.length"
      class="flex flex-1 items-center justify-center px-3 py-6 text-sm text-muted"
    >
      아직 글이 없습니다.
    </p>
    <MemiBoardMiniPosts
      v-else
      :posts="posts"
      :view="view"
      :show-board="!section.boardId"
      :get-post-link="getPostLink"
    />
  </div>
</template>
