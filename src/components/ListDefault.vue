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
}>(), { showCategory: true })
const emit = defineEmits<{ select: [post: PostModel] }>()
const { categoryLabel } = useMemiBoardSettings()
const NuxtLink = resolveComponent('NuxtLink')

function image(post: PostModel): string | undefined {
  return post.previewImage || post.attachments?.find(item => item.type.startsWith('image/'))?.url
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <UCard
      v-for="post in posts"
      :key="post.id"
      class="overflow-hidden"
      :ui="{ body: 'p-0 sm:p-0' }"
    >
      <div class="flex min-h-[4.5rem]">
        <!-- 썸네일+제목만 클릭 시 글로 이동 — 작성자 메뉴는 별도 인터랙션이라 링크 밖에 둔다 -->
        <component
          :is="postTo(post) ? NuxtLink : 'button'"
          :to="postTo(post)"
          class="flex min-w-0 flex-1 text-left transition-colors hover:bg-elevated/50"
          @click="!postTo(post) && emit('select', post)"
        >
          <!-- 카드 좌·상·하 밀착, 가로는 고정 / 세로는 행 높이 전체 -->
          <div class="w-[4.5rem] shrink-0 self-stretch bg-elevated">
            <img
              v-if="image(post)"
              :src="image(post)"
              :alt="post.title"
              class="h-full w-full object-cover"
            >
            <div
              v-else
              class="flex h-full min-h-[4.5rem] w-full items-center justify-center text-muted"
            >
              <UIcon name="i-lucide-image" class="size-6" />
            </div>
          </div>

          <div class="min-w-0 flex-1 flex flex-col justify-center gap-1 overflow-hidden py-2 pl-3 pr-2">
            <div class="flex min-w-0 items-start gap-2">
              <UBadge
                v-if="post.category && showCategory"
                class="shrink-0"
                :label="categoryLabel(post.category)"
                variant="subtle"
                size="sm"
              />
              <div class="flex min-w-0 flex-1 items-start gap-1.5">
                <UBadge
                  v-if="post.isPublished === false"
                  label="초안"
                  color="warning"
                  variant="subtle"
                  size="sm"
                  class="mt-0.5 shrink-0"
                />
                <h3 class="min-w-0 line-clamp-2 break-words text-sm font-medium leading-snug sm:text-base">
                  {{ post.title?.trim() || post.summary || '사진' }}
                </h3>
                <span
                  v-if="(post.commentCount ?? 0) > 0"
                  class="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-primary/10 px-1.5 py-px text-[11px] font-semibold tabular-nums text-primary"
                >
                  {{ post.commentCount }}
                </span>
              </div>
            </div>
            <p
              v-if="post.summary"
              class="min-w-0 line-clamp-2 break-words text-sm leading-snug text-muted"
            >
              {{ post.summary }}
            </p>
            <div v-if="post.attachments?.length" class="flex items-center gap-1 text-xs text-muted">
              <UIcon name="i-lucide-paperclip" class="size-3" />{{ post.attachments.length }}
            </div>
          </div>
        </component>

        <div class="flex w-[5.5rem] shrink-0 flex-col items-end justify-center gap-1 py-2 pr-3 text-right text-xs leading-snug text-muted sm:w-24">
          <MemiBoardAuthorMenu
            :author-uid="post.authorUid"
            :author-name="post.authorName"
            :author-photo="post.authorPhoto"
            :author-posts-to="authorPostsTo"
            :show-avatar="false"
            truncate
            class="max-w-full"
          />
          <UTooltip
            :delay-duration="0"
            :text="formatTimestampDetails(post.createdAt, post.updatedAt).join('\n')"
            :ui="{ content: 'h-auto w-max py-2', text: 'whitespace-pre-line overflow-visible' }"
          >
            <time
              :datetime="post.createdAt?.toDate?.().toISOString()"
              class="cursor-help text-xs leading-snug text-muted"
            >
              {{ formatRelativeDate(post.createdAt, now) }}
            </time>
          </UTooltip>
          <div class="flex flex-wrap items-center justify-end gap-x-2 gap-y-0.5 text-xs leading-snug text-muted">
            <span class="inline-flex items-center gap-0.5 tabular-nums">
              <UIcon name="i-lucide-eye" class="size-3 shrink-0" />{{ post.viewCount ?? 0 }}
            </span>
            <span class="inline-flex items-center gap-0.5 tabular-nums">
              <UIcon name="i-lucide-heart" class="size-3 shrink-0" />{{ post.likeCount ?? 0 }}
            </span>
          </div>
        </div>
      </div>
    </UCard>
  </div>
</template>
