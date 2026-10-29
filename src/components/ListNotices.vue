<script setup lang="ts">
import { resolveComponent } from 'vue'
import type { PostModel } from 'memi-board/runtime'
import { displayPostSummary, displayPostTitle, useMemiBoardI18n } from 'memi-board/runtime'

defineProps<{
  posts: PostModel[]
  postTo: (post: PostModel) => string | undefined
  now: number
}>()
const emit = defineEmits<{ select: [post: PostModel] }>()
const { t, locale, formatRelativeDate } = useMemiBoardI18n()

function titleOf(post: PostModel) {
  return displayPostTitle(post, locale.value).trim() || displayPostSummary(post, locale.value).trim() || t('list.photo')
}
const NuxtLink = resolveComponent('NuxtLink')
</script>

<template>
  <!-- 공지 = 목록 뷰 종류와 상관없이 맨 위에 한 줄씩. -->
  <ul class="flex flex-col divide-y divide-default rounded-lg border border-primary/20 bg-primary/5">
    <li v-for="post in posts" :key="post.id">
      <component
        :is="postTo(post) ? NuxtLink : 'button'"
        :to="postTo(post)"
        class="memi-board-post-link group flex w-full min-w-0 items-center gap-2 px-3 py-2 text-left text-highlighted transition-colors hover:bg-primary/10"
        @click="!postTo(post) && emit('select', post)"
      >
        <UBadge
          :label="t('list.notice')"
          icon="i-lucide-pin"
          variant="subtle"
          size="sm"
          class="shrink-0"
        />
        <span class="min-w-0 flex-1 truncate text-sm font-medium transition-colors group-hover:text-primary">
          {{ titleOf(post) }}
        </span>
        <span
          v-if="(post.commentCount ?? 0) > 0"
          class="inline-flex shrink-0 items-center rounded-full bg-primary/10 px-1.5 py-px text-[11px] font-semibold tabular-nums text-primary"
        >
          {{ post.commentCount }}
        </span>
        <time
          :datetime="post.createdAt?.toDate?.().toISOString()"
          class="shrink-0 text-[11px] tabular-nums text-muted"
        >
          {{ formatRelativeDate(post.createdAt, now) }}
        </time>
      </component>
    </li>
  </ul>
</template>
