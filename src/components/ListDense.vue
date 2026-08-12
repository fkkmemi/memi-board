<script setup lang="ts">
import { resolveComponent } from 'vue'
import type { PostModel } from 'memi-board/runtime'
import { formatRelativeDate, formatTimestampDetails, useMemiBoardSettings } from 'memi-board/runtime'
import MemiBoardAuthorMenu from './AuthorMenu.vue'

withDefaults(defineProps<{
  posts: PostModel[]
  postTo: (post: PostModel) => string | undefined
  now: number
  showCategory?: boolean
  authorPostsTo?: (authorUid: string) => string | undefined
  authorCommentsTo?: (authorUid: string) => string | undefined
}>(), { showCategory: true })
const emit = defineEmits<{ select: [post: PostModel] }>()
const { categoryLabel } = useMemiBoardSettings()
const NuxtLink = resolveComponent('NuxtLink')

function thumb(post: PostModel): string | undefined {
  return post.previewImage || post.attachments?.find(item => item.type.startsWith('image/'))?.url
}
</script>

<template>
  <!-- 조밀 = 커뮤니티 게시판 스타일 한 줄 목록. 우측에 작은 사각 썸네일(있을 때만). -->
  <ul class="flex flex-col divide-y divide-default">
    <li v-for="post in posts" :key="post.id" class="px-2 py-1.5">
      <component
        :is="postTo(post) ? NuxtLink : 'button'"
        :to="postTo(post)"
        class="group relative flex w-full items-center gap-2 rounded-lg text-left transition-colors hover:bg-elevated/60"
        @click="!postTo(post) && emit('select', post)"
      >
        <div class="flex min-w-0 flex-1 flex-col gap-0.5">
          <div class="flex min-w-0 items-baseline gap-1.5">
            <UBadge
              v-if="post.isPublished === false"
              label="초안"
              color="warning"
              variant="subtle"
              size="sm"
              class="shrink-0"
            />
            <h3 class="min-w-0 truncate text-sm font-medium leading-snug text-highlighted transition-colors group-hover:text-primary">
              {{ post.title?.trim() || post.summary || '사진' }}
            </h3>
            <span
              v-if="(post.commentCount ?? 0) > 0"
              class="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-primary/10 px-1.5 py-px text-[11px] font-semibold tabular-nums text-primary"
            >
              {{ post.commentCount }}
            </span>
          </div>

          <div class="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] leading-none text-muted">
            <UPopover :content="{ side: 'top' }" :ui="{ content: 'h-auto w-max' }">
              <time
                :datetime="post.createdAt?.toDate?.().toISOString()"
                class="cursor-pointer tabular-nums"
              >
                {{ formatRelativeDate(post.createdAt, now) }}
              </time>
              <template #content>
                <p class="whitespace-pre-line px-3 py-2 text-xs">
                  {{ formatTimestampDetails(post.createdAt, post.updatedAt).join('\n') }}
                </p>
              </template>
            </UPopover>
            <span class="text-default/40" aria-hidden="true">|</span>
            <span class="font-medium text-toned">
              <MemiBoardAuthorMenu
                :author-uid="post.authorUid"
                :author-name="post.authorName"
                :author-photo="post.authorPhoto"
                :author-posts-to="authorPostsTo"
                :author-comments-to="authorCommentsTo"
                :show-avatar="false"
              />
            </span>
            <span class="text-default/40" aria-hidden="true">|</span>
            <span
              v-if="post.attachments?.length"
              class="inline-flex items-center gap-0.5 tabular-nums"
            >
              <UIcon name="i-lucide-paperclip" class="size-3 shrink-0" />{{ post.attachments.length }}
            </span>
            <span class="inline-flex items-center gap-0.5 tabular-nums">
              <UIcon name="i-lucide-eye" class="size-3 shrink-0" />{{ post.viewCount ?? 0 }}
            </span>
            <template v-if="(post.likeCount ?? 0) > 0">
              <span class="text-default/40" aria-hidden="true">|</span>
              <span class="inline-flex items-center gap-0.5 tabular-nums">
                추천 {{ post.likeCount }}
              </span>
            </template>
            <template v-if="post.category && showCategory">
              <span class="text-default/40" aria-hidden="true">|</span>
              <span class="truncate text-muted">[{{ categoryLabel(post.category) }}]</span>
            </template>
          </div>
        </div>

        <div
          v-if="thumb(post)"
          class="size-12 shrink-0 overflow-hidden rounded-md bg-elevated"
        >
          <img
            :src="thumb(post)"
            :alt="post.title?.trim() || post.summary || '사진'"
            class="size-full object-cover"
          >
        </div>
      </component>
    </li>
  </ul>
</template>
