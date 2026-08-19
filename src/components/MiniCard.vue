<script setup lang="ts">
import { computed, resolveComponent } from 'vue'
import type { PostModel } from 'memi-board/runtime'
import { miniPostImage, miniPostLink, miniPostTitle } from 'memi-board/runtime'

const props = defineProps<{
  post: PostModel
  compact?: boolean
  getPostLink?: (post: PostModel) => string | undefined
}>()

const NuxtLink = resolveComponent('NuxtLink')
const image = computed(() => miniPostImage(props.post))
const title = computed(() => miniPostTitle(props.post))
const to = computed(() => props.getPostLink?.(props.post) ?? miniPostLink(props.post))
</script>

<template>
  <component
    :is="to ? NuxtLink : 'div'"
    :to="to"
    class="memi-board-post-link group flex h-full min-w-0 flex-col overflow-hidden rounded-lg bg-elevated/40 text-left text-highlighted"
  >
    <div
      class="overflow-hidden bg-muted"
      :class="compact ? 'aspect-[16/10]' : 'aspect-[4/3]'"
    >
      <img
        v-if="image"
        :src="image"
        :alt="title"
        class="size-full object-cover transition duration-300 group-hover:scale-105"
      >
      <div
        v-else
        class="flex size-full items-center justify-center text-muted"
      >
        <UIcon name="i-lucide-image" class="size-8" />
      </div>
    </div>
    <div class="flex flex-1 flex-col gap-0.5 p-2.5">
      <p class="line-clamp-2 text-sm font-medium leading-snug text-inherit group-hover:text-primary">
        {{ title }}
      </p>
      <span class="mt-1 inline-flex items-center gap-0.5 text-[11px] tabular-nums text-muted">
        <UIcon name="i-lucide-message-square" class="size-3" />
        {{ post.commentCount ?? 0 }}
      </span>
    </div>
  </component>
</template>
