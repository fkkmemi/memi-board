<script setup lang="ts">
import { resolveComponent } from 'vue'
import type { PostModel } from 'memi-board/runtime'

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
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
    <component
      :is="postTo(post) ? NuxtLink : 'button'"
      v-for="post in posts"
      :key="post.id"
      :to="postTo(post)"
      class="group relative aspect-[4/3] overflow-hidden rounded-xl border border-default bg-elevated text-left"
      @click="!postTo(post) && emit('select', post)"
    >
      <img
        v-if="image(post)"
        :src="image(post)"
        :alt="post.title?.trim() || post.summary || '이미지'"
        class="size-full object-cover transition duration-300 group-hover:scale-105"
      >
      <div
        v-else
        class="flex size-full items-center justify-center text-muted"
      >
        <UIcon name="i-lucide-image" class="size-10" />
      </div>

      <!-- 가독성용 상단 그라데이션 -->
      <div
        class="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/55 to-transparent"
      />

      <!-- 좌측 상단: 초안 표시 + 제목(있을 때만) + 댓글수. 이미지 보드는 제목 없이 썸네일 중심 -->
      <div
        v-if="post.isPublished === false || post.title?.trim() || (post.commentCount ?? 0) > 0"
        class="absolute left-2.5 top-2.5 right-14 flex min-w-0 items-start gap-1.5 sm:left-3 sm:top-3"
      >
        <UBadge
          v-if="post.isPublished === false"
          label="초안"
          color="warning"
          variant="subtle"
          size="sm"
          class="shrink-0"
        />
        <h3
          v-if="post.title?.trim()"
          class="min-w-0 line-clamp-2 text-sm font-medium leading-snug text-white drop-shadow-sm"
        >
          {{ post.title }}
        </h3>
        <span
          v-if="(post.commentCount ?? 0) > 0"
          class="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-white/20 px-1.5 py-px text-[11px] font-semibold tabular-nums text-white backdrop-blur-sm"
        >
          {{ post.commentCount }}
        </span>
      </div>

      <!-- 우측 상단: 좋아요 개수만 -->
      <span class="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-xs tabular-nums text-white sm:right-3 sm:top-3">
        <UIcon name="i-lucide-heart" class="size-3" />
        {{ post.likeCount ?? 0 }}
      </span>
    </component>
  </div>
</template>
