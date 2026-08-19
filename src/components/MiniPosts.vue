<script setup lang="ts">
import { computed, ref, resolveComponent } from 'vue'
import type { BoardListView, PostModel } from 'memi-board/runtime'
import {
  formatRelativeDate,
  miniPostImage,
  miniPostLink,
  miniPostTitle,
  miniViewGroup,
  useMemiBoardSettings,
  videoListCoverUrl,
} from 'memi-board/runtime'

const props = defineProps<{
  posts: PostModel[]
  view: BoardListView
  showBoard?: boolean
  getPostLink?: (post: PostModel) => string | undefined
}>()

const NuxtLink = resolveComponent('NuxtLink')
const now = ref(Date.now())
const { categoryLabel } = useMemiBoardSettings()
const group = computed(() => miniViewGroup(props.view))

function cover(post: PostModel) {
  return videoListCoverUrl(post) || miniPostImage(post)
}

function isVideo(post: PostModel) {
  return props.view === 'video' || Boolean(post.videoUrl)
}

function postTo(post: PostModel) {
  return props.getPostLink?.(post) ?? miniPostLink(post)
}
</script>

<template>
  <div
    v-if="group === 'media'"
    class="grid grid-cols-2 gap-1.5 p-1.5"
  >
    <component
      :is="postTo(post) ? NuxtLink : 'div'"
      v-for="post in posts"
      :key="post.id"
      :to="postTo(post)"
      class="group relative aspect-[4/3] overflow-hidden rounded-lg bg-elevated"
    >
      <img
        v-if="cover(post)"
        :src="cover(post)"
        :alt="miniPostTitle(post)"
        class="size-full object-cover transition duration-300 group-hover:scale-105"
      >
      <div v-else class="flex size-full items-center justify-center text-muted">
        <UIcon :name="isVideo(post) ? 'i-lucide-video' : 'i-lucide-image'" class="size-7" />
      </div>
      <span
        v-if="isVideo(post)"
        class="absolute inset-0 flex items-center justify-center bg-black/10"
      >
        <span class="flex size-9 items-center justify-center rounded-full bg-black/70 text-white">
          <UIcon name="i-lucide-play" class="ml-0.5 size-4 fill-current" />
        </span>
      </span>
      <span class="absolute right-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full bg-black/55 px-1.5 py-px text-[11px] tabular-nums text-white">
        <UIcon name="i-lucide-message-square" class="size-3" />
        {{ post.commentCount ?? 0 }}
      </span>
    </component>
  </div>

  <ul
    v-else
    class="flex min-h-0 flex-1 flex-col divide-y divide-default"
  >
    <li v-for="post in posts" :key="post.id">
      <component
        :is="postTo(post) ? NuxtLink : 'div'"
        :to="postTo(post)"
        class="flex items-center gap-2 px-3 py-2 transition-colors hover:bg-elevated/60"
      >
        <div class="min-w-0 flex-1">
          <div class="flex min-w-0 items-start gap-1.5">
            <p class="min-w-0 flex-1 truncate text-sm font-medium text-highlighted">
              {{ miniPostTitle(post) }}
            </p>
            <span class="mt-0.5 inline-flex shrink-0 items-center gap-0.5 text-[11px] tabular-nums text-muted">
              <UIcon name="i-lucide-message-square" class="size-3" />
              {{ post.commentCount ?? 0 }}
            </span>
          </div>
          <p class="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted">
            <span v-if="showBoard && (post.boardId || post.category)">
              {{ categoryLabel(post.category || post.boardId) }}
            </span>
            <time>{{ formatRelativeDate(post.createdAt, now) }}</time>
          </p>
        </div>
        <div
          v-if="miniPostImage(post)"
          class="size-11 shrink-0 overflow-hidden rounded-md bg-elevated"
        >
          <img
            :src="miniPostImage(post)!"
            :alt="miniPostTitle(post)"
            class="size-full object-cover"
          >
        </div>
      </component>
    </li>
  </ul>
</template>
