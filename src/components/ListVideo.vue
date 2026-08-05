<script setup lang="ts">
import { resolveComponent } from 'vue'
import type { PostModel } from 'memi-board/runtime'
import { formatRelativeDate, formatTimestampDetails } from 'memi-board/runtime'

defineProps<{
  posts: PostModel[]
  postTo: (post: PostModel) => string | undefined
  now: number
}>()
const emit = defineEmits<{ select: [post: PostModel] }>()
const NuxtLink = resolveComponent('NuxtLink')

function image(post: PostModel): string | undefined {
  return post.previewImage || post.attachments?.find(item => item.type.startsWith('image/'))?.url
}
</script>

<template>
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
    <component
      :is="postTo(post) ? NuxtLink : 'button'"
      v-for="post in posts"
      :key="post.id"
      :to="postTo(post)"
      class="overflow-hidden rounded-xl border border-default bg-default text-left transition hover:bg-elevated/50"
      @click="!postTo(post) && emit('select', post)"
    >
      <div class="relative aspect-video overflow-hidden bg-elevated">
        <img v-if="image(post)" :src="image(post)" :alt="post.title" class="size-full object-cover">
        <div v-else class="flex size-full items-center justify-center text-muted"><UIcon name="i-lucide-video" class="size-10" /></div>
        <span class="absolute inset-0 flex items-center justify-center bg-black/10">
          <span class="flex size-12 items-center justify-center rounded-full bg-black/70 text-white shadow"><UIcon name="i-lucide-play" class="ml-0.5 size-6 fill-current" /></span>
        </span>
      </div>
      <div class="p-4">
        <h3 class="font-medium line-clamp-2">{{ post.title }}</h3>
        <p v-if="post.summary" class="mt-2 line-clamp-2 text-sm text-muted">{{ post.summary }}</p>
        <div class="mt-3 flex items-center justify-between gap-2 text-xs text-muted">
          <span class="truncate">{{ post.authorName ?? '익명' }}</span>
          <UTooltip
            :text="formatTimestampDetails(post.createdAt, post.updatedAt).join('\n')"
            :ui="{ content: 'h-auto w-max py-2', text: 'whitespace-pre-line overflow-visible' }"
          >
            <time
              :datetime="post.createdAt?.toDate?.().toISOString()"
              class="shrink-0 cursor-help"
            >
              {{ formatRelativeDate(post.createdAt, now) }}
            </time>
          </UTooltip>
        </div>
      </div>
    </component>
  </div>
</template>
