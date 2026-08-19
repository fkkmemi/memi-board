<script setup lang="ts">
import { resolveComponent } from 'vue'
import type { PostModel } from 'memi-board/runtime'
import { formatRelativeDate, formatTimestampDetails, videoListCoverUrl } from 'memi-board/runtime'
import MemiBoardAuthorMenu from './AuthorMenu.vue'

defineProps<{
  posts: PostModel[]
  postTo: (post: PostModel) => string | undefined
  now: number
  authorProfileTo?: (authorUid: string) => string | undefined
  authorPostsTo?: (authorUid: string) => string | undefined
  authorCommentsTo?: (authorUid: string) => string | undefined
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
    <div
      v-for="post in posts"
      :key="post.id"
      class="overflow-hidden rounded-xl border border-default bg-default"
    >
      <!-- 커버+제목+요약만 클릭 시 글로 이동 — 작성자 메뉴는 별도 인터랙션이라 링크 밖에 둔다 -->
      <component
        :is="postTo(post) ? NuxtLink : 'button'"
        :to="postTo(post)"
        class="memi-board-post-link block w-full text-left text-highlighted transition hover:bg-elevated/50"
        @click="!postTo(post) && emit('select', post)"
      >
        <div class="relative aspect-video overflow-hidden bg-elevated">
          <img v-if="cover(post)" :src="cover(post)" :alt="post.title" class="size-full object-cover">
          <div v-else class="flex size-full items-center justify-center text-muted"><UIcon name="i-lucide-video" class="size-10" /></div>
          <span class="absolute inset-0 flex items-center justify-center bg-black/10">
            <span class="flex size-12 items-center justify-center rounded-full bg-black/70 text-white shadow"><UIcon name="i-lucide-play" class="ml-0.5 size-6 fill-current" /></span>
          </span>
        </div>
        <div class="p-4 pb-0">
          <div class="flex min-w-0 items-start gap-1.5">
            <UBadge
              v-if="post.isPublished === false"
              label="초안"
              color="warning"
              variant="subtle"
              size="sm"
              class="mt-0.5 shrink-0"
            />
            <h3 class="min-w-0 line-clamp-2 font-medium text-inherit">{{ post.title }}</h3>
            <span
              v-if="(post.commentCount ?? 0) > 0"
              class="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-primary/10 px-1.5 py-px text-[11px] font-semibold tabular-nums text-primary"
            >
              {{ post.commentCount }}
            </span>
          </div>
          <p v-if="post.summary" class="mt-2 line-clamp-2 whitespace-pre-line text-sm text-muted">{{ post.summary }}</p>
        </div>
      </component>

      <div class="flex items-center justify-between gap-2 px-4 pb-4 pt-3 text-xs text-muted">
        <MemiBoardAuthorMenu
          :author-uid="post.authorUid"
          :author-name="post.authorName"
          :author-photo="post.authorPhoto"
          :author-posts-to="authorPostsTo"
          :author-profile-to="authorProfileTo"
          :author-comments-to="authorCommentsTo"
          :show-avatar="false"
        />
        <div class="flex shrink-0 items-center gap-2">
          <span class="inline-flex items-center gap-1 tabular-nums">
            <UIcon name="i-lucide-eye" class="size-3" />
            {{ post.viewCount ?? 0 }}
          </span>
          <UPopover :content="{ side: 'top' }" :ui="{ content: 'h-auto w-max' }">
            <time
              :datetime="post.createdAt?.toDate?.().toISOString()"
              class="cursor-pointer"
            >
              {{ formatRelativeDate(post.createdAt, now) }}
            </time>
            <template #content>
              <p class="whitespace-pre-line px-3 py-2 text-xs">
                {{ formatTimestampDetails(post.createdAt, post.updatedAt).join('\n') }}
              </p>
            </template>
          </UPopover>
        </div>
      </div>
    </div>
  </div>
</template>
