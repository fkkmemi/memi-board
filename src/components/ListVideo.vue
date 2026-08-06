<script setup lang="ts">
import { resolveComponent } from 'vue'
import type { PostModel } from 'memi-board/runtime'
import { formatRelativeDate, formatTimestampDetails, videoListCoverUrl } from 'memi-board/runtime'

defineProps<{
  posts: PostModel[]
  postTo: (post: PostModel) => string | undefined
  now: number
}>()
const emit = defineEmits<{ select: [post: PostModel] }>()
const NuxtLink = resolveComponent('NuxtLink')

/** 영상 목록: YouTube URL 이 있으면 썸네일 우선, 그다음 본문/첨부 이미지. */
function cover(post: PostModel): string | undefined {
  return videoListCoverUrl(post)
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
        <img v-if="cover(post)" :src="cover(post)" :alt="post.title" class="size-full object-cover">
        <div v-else class="flex size-full items-center justify-center text-muted"><UIcon name="i-lucide-video" class="size-10" /></div>
        <span class="absolute inset-0 flex items-center justify-center bg-black/10">
          <span class="flex size-12 items-center justify-center rounded-full bg-black/70 text-white shadow"><UIcon name="i-lucide-play" class="ml-0.5 size-6 fill-current" /></span>
        </span>
      </div>
      <div class="p-4">
        <div class="flex min-w-0 items-start gap-1.5">
          <h3 class="min-w-0 line-clamp-2 font-medium">{{ post.title }}</h3>
          <span
            v-if="(post.commentCount ?? 0) > 0"
            class="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-primary/10 px-1.5 py-px text-[11px] font-semibold tabular-nums text-primary"
          >
            {{ post.commentCount }}
          </span>
        </div>
        <p v-if="post.summary" class="mt-2 line-clamp-2 text-sm text-muted">{{ post.summary }}</p>
        <div class="mt-3 flex items-center justify-between gap-2 text-xs text-muted">
          <span class="truncate">{{ post.authorName ?? '익명' }}</span>
          <div class="flex shrink-0 items-center gap-2">
            <span class="inline-flex items-center gap-1 tabular-nums">
              <UIcon name="i-lucide-eye" class="size-3" />
              {{ post.viewCount ?? 0 }}
            </span>
            <UTooltip
              :delay-duration="0"
              :text="formatTimestampDetails(post.createdAt, post.updatedAt).join('\n')"
              :ui="{ content: 'h-auto w-max py-2', text: 'whitespace-pre-line overflow-visible' }"
            >
              <time
                :datetime="post.createdAt?.toDate?.().toISOString()"
                class="cursor-help"
              >
                {{ formatRelativeDate(post.createdAt, now) }}
              </time>
            </UTooltip>
          </div>
        </div>
      </div>
    </component>
  </div>
</template>
