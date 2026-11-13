<script setup lang="ts">
import MemiBoardSurface from './BoardSurface.vue'
import { resolveComponent } from 'vue'
import type { PostModel } from 'memi-board/runtime'
import { displayPostSummary, displayPostTitle, extendEntries, useMemiBoardI18n, useMemiBoardSettings } from 'memi-board/runtime'
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
const { getBoard } = useMemiBoardSettings()

/** 목록에서는 필드를 이만큼만 보여 주고 나머지는 +N 으로 줄인다. */
const EXTEND_SHOWN = 3
function extendOf(post: PostModel) {
  const entries = extendEntries(post.extend, getBoard(post.boardId || post.category || '')?.customFields)
  return { shown: entries.slice(0, EXTEND_SHOWN), more: Math.max(0, entries.length - EXTEND_SHOWN), all: entries }
}

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
        <!-- line-clamp 는 overflow 를 padding 바깥 경계에서 자른다 — 패딩이 h3 자신한테 있으면
             그 패딩 높이만큼 다음 줄이 살짝 비어져 나와 보인다. 패딩은 래퍼로 옮긴다. -->
        <div class="px-4 pb-3 pt-4">
          <h3 class="line-clamp-2 break-words text-base font-bold leading-snug text-inherit">
            <UBadge v-if="post.isPublished === false" :label="t('common.label.draft')" color="warning" variant="subtle" size="sm" class="me-1 align-middle" />
            <UIcon v-if="post.pinned" name="i-lucide-pin" class="me-1 align-[-0.125em] text-primary" :aria-label="t('list.notice')" />
            {{ titleOf(post) }}
          </h3>
        </div>
        <div v-if="image(post)" class="aspect-video w-full overflow-hidden bg-elevated">
          <img :src="image(post)" :alt="titleOf(post)" class="size-full object-cover transition-transform duration-300 hover:scale-105">
        </div>
        <div class="flex flex-1 flex-col gap-2 px-4 pb-4" :class="image(post) ? 'pt-3' : 'pt-0'">
          <p v-if="summaryOf(post)" class="line-clamp-3 break-words whitespace-pre-line text-sm leading-relaxed text-muted">
            {{ summaryOf(post) }}
          </p>
          <dl v-if="extendOf(post).shown.length" class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-lg bg-elevated/50 px-3 py-2 text-xs">
            <template v-for="field in extendOf(post).shown" :key="field.key">
              <dt class="max-w-28 truncate text-muted">{{ field.label }}</dt>
              <dd class="truncate font-medium text-default" :title="field.value">{{ field.value }}</dd>
            </template>
            <dd
              v-if="extendOf(post).more"
              class="col-span-2 text-dimmed"
              :title="extendOf(post).all.slice(3).map(field => `${field.label}: ${field.value}`).join('\n')"
            >
              +{{ extendOf(post).more }}
            </dd>
          </dl>
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
          <div class="flex shrink-0 items-center gap-3">
            <UTooltip :text="t('common.label.viewCount', { count: post.viewCount ?? 0 })" :delay-duration="200" :content="{ side: 'top' }">
              <span class="inline-flex items-center gap-1 tabular-nums">
                <UIcon name="i-lucide-eye" class="size-3.5" />{{ post.viewCount ?? 0 }}
              </span>
            </UTooltip>
            <UTooltip :text="t('list.likeCount', { count: post.likeCount ?? 0 })" :delay-duration="200" :content="{ side: 'top' }">
              <span class="inline-flex items-center gap-1 tabular-nums">
                <UIcon name="i-lucide-heart" class="size-3.5" />{{ post.likeCount ?? 0 }}
              </span>
            </UTooltip>
          </div>
        </div>
      </template>
    </UCard>
  </div>
  </MemiBoardSurface>
</template>
