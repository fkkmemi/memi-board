<script setup lang="ts">
import { resolveComponent } from 'vue'
import type { PostModel } from 'memi-board/runtime'
import { formatRelativeDate, formatTimestampDetails, useMemiBoardSettings } from 'memi-board/runtime'

withDefaults(defineProps<{
  posts: PostModel[]
  postTo: (post: PostModel) => string | undefined
  now: number
  showCategory?: boolean
}>(), { showCategory: true })
const emit = defineEmits<{ select: [post: PostModel] }>()
const { categoryLabel } = useMemiBoardSettings()
const NuxtLink = resolveComponent('NuxtLink')

function hasImage(post: PostModel): boolean {
  return !!(post.previewImage || post.attachments?.some(item => item.type.startsWith('image/')))
}
</script>

<template>
  <!-- DC식 조밀 행: 카드 간격 없이 한 줄 행 + 구분선 -->
  <div class="divide-y divide-default overflow-hidden rounded-lg border border-default">
    <component
      :is="postTo(post) ? NuxtLink : 'button'"
      v-for="post in posts"
      :key="post.id"
      :to="postTo(post)"
      class="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm transition-colors hover:bg-elevated/50 sm:gap-3 sm:px-3"
      @click="!postTo(post) && emit('select', post)"
    >
      <!-- 좋아요 -->
      <span
        class="flex w-7 shrink-0 items-center justify-center text-xs tabular-nums"
        :class="(post.likeCount ?? 0) > 0 ? 'text-primary font-medium' : 'text-muted'"
      >
        {{ post.likeCount ?? 0 }}
      </span>

      <!-- 카테고리 -->
      <UBadge
        v-if="post.category && showCategory"
        class="shrink-0"
        :label="categoryLabel(post.category)"
        variant="subtle"
        size="sm"
      />

      <!-- 제목 + 이미지/댓글 표시 -->
      <div class="flex min-w-0 flex-1 items-center gap-1">
        <span class="min-w-0 truncate font-medium text-highlighted">
          {{ post.title }}
        </span>
        <UIcon
          v-if="hasImage(post)"
          name="i-lucide-image"
          class="size-3.5 shrink-0 text-muted"
        />
        <span
          v-if="post.commentCount > 0"
          class="shrink-0 text-xs font-medium tabular-nums text-primary"
        >
          {{ post.commentCount }}
        </span>
      </div>

      <!-- 작성자 -->
      <span class="hidden w-20 shrink-0 truncate text-right text-xs text-muted sm:block">
        {{ post.authorName ?? '익명' }}
      </span>

      <!-- 시간 -->
      <UTooltip
        :delay-duration="0"
        :text="formatTimestampDetails(post.createdAt, post.updatedAt).join('\n')"
        :ui="{ content: 'h-auto w-max py-2', text: 'whitespace-pre-line overflow-visible' }"
      >
        <time
          :datetime="post.createdAt?.toDate?.().toISOString()"
          class="w-12 shrink-0 cursor-help text-right text-xs tabular-nums text-muted sm:w-14"
        >
          {{ formatRelativeDate(post.createdAt, now) }}
        </time>
      </UTooltip>
    </component>
  </div>
</template>
