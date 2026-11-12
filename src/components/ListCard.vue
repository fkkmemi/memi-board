<script setup lang="ts">
import MemiBoardSurface from './BoardSurface.vue'
import { resolveComponent } from 'vue'
import type { PostModel } from 'memi-board/runtime'
import { displayPostSummary, displayPostTitle, useMemiBoardI18n } from 'memi-board/runtime'
import MemiBoardAuthorMenu from './AuthorMenu.vue'

defineProps<{
  posts: PostModel[]
  postTo: (post: PostModel) => string | undefined
  now: number
  showCategory?: boolean
  authorProfileTo?: (authorUid: string) => string | undefined
  authorPostsTo?: (authorUid: string) => string | undefined
  authorCommentsTo?: (authorUid: string) => string | undefined
}>()
const emit = defineEmits<{ select: [post: PostModel] }>()
const NuxtLink = resolveComponent('NuxtLink')
const { t, locale, formatRelativeDate } = useMemiBoardI18n()

function titleOf(post: PostModel) {
  return displayPostTitle(post, locale.value).trim() || displayPostSummary(post, locale.value).trim() || t('list.photo')
}
function summaryOf(post: PostModel) {
  const summary = displayPostSummary(post, locale.value).trim()
  const title = displayPostTitle(post, locale.value).trim()
  return !summary || summary === title ? '' : summary
}
function image(post: PostModel): string | undefined {
  return post.previewImage || post.attachments?.find(item => item.type.startsWith('image/'))?.url
}
</script>

<template>
  <MemiBoardSurface>
  <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
    <UCard
      v-for="post in posts"
      :key="post.id"
      class="overflow-hidden transition-shadow hover:shadow-md"
      :class="post.pinned && 'shadow-sm ring-primary'"
      :ui="{ root: 'flex flex-col', body: 'flex flex-1 flex-col p-0 sm:p-0', footer: 'px-4 py-3 sm:px-4' }"
    >
      <!-- 썸네일·제목·요약·날짜만 링크 — 작성자 메뉴는 별도 인터랙션이라 링크 밖에 둔다 -->
      <component
        :is="postTo(post) ? NuxtLink : 'button'"
        :to="postTo(post)"
        class="memi-board-post-link flex flex-1 flex-col text-left text-highlighted"
        @click="!postTo(post) && emit('select', post)"
      >
        <div v-if="image(post)" class="aspect-video w-full overflow-hidden bg-elevated">
          <img :src="image(post)" :alt="titleOf(post)" class="size-full object-cover transition-transform duration-300 hover:scale-105">
        </div>
        <div class="flex flex-1 flex-col gap-2 p-4">
          <h3 class="line-clamp-2 break-words text-base font-bold leading-snug text-inherit">
            <UBadge v-if="post.isPublished === false" :label="t('common.label.draft')" color="warning" variant="subtle" size="sm" class="me-1 align-middle" />
            <UIcon v-if="post.pinned" name="i-lucide-pin" class="me-1 align-[-0.125em] text-primary" :aria-label="t('list.notice')" />
            {{ titleOf(post) }}
          </h3>
          <p v-if="summaryOf(post)" class="line-clamp-3 break-words whitespace-pre-line text-sm leading-relaxed text-muted">
            {{ summaryOf(post) }}
          </p>
          <p class="mt-auto pt-1 text-xs text-dimmed">
            <time :datetime="post.createdAt?.toDate?.().toISOString()">{{ formatRelativeDate(post.createdAt, now) }}</time>
            <template v-if="(post.commentCount ?? 0) > 0"> · {{ t('list.commentCount', { count: post.commentCount }) }}</template>
          </p>
        </div>
      </component>

      <template #footer>
        <div class="flex items-center justify-between gap-2 text-xs text-muted">
          <MemiBoardAuthorMenu
            :author-uid="post.authorUid"
            :author-name="post.authorName"
            :author-photo="post.authorPhoto"
            :author-posts-to="authorPostsTo"
            :author-profile-to="authorProfileTo"
            :author-comments-to="authorCommentsTo"
            :show-avatar="true"
            truncate
            class="min-w-0"
          />
          <UTooltip :text="t('list.likeCount', { count: post.likeCount ?? 0 })" :delay-duration="200" :content="{ side: 'top' }">
            <span class="inline-flex shrink-0 items-center gap-1 tabular-nums">
              <UIcon name="i-lucide-heart" class="size-3.5" />{{ post.likeCount ?? 0 }}
            </span>
          </UTooltip>
        </div>
      </template>
    </UCard>
  </div>
  </MemiBoardSurface>
</template>
