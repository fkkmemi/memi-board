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

function image(post: PostModel): string | undefined {
  return post.previewImage || post.attachments?.find(item => item.type.startsWith('image/'))?.url
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <component
      :is="postTo(post) ? NuxtLink : 'button'"
      v-for="post in posts"
      :key="post.id"
      :to="postTo(post)"
      class="text-left"
      @click="!postTo(post) && emit('select', post)"
    >
      <UCard
        class="hover:bg-elevated/50 transition-colors overflow-hidden"
        :ui="{ body: 'p-0 sm:p-0' }"
      >
        <div class="flex min-h-[4.5rem]">
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
                <h3 class="min-w-0 line-clamp-2 break-words text-sm font-medium leading-snug sm:text-base">
                  {{ post.title }}
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

          <div class="flex w-[5.5rem] shrink-0 flex-col items-end justify-center gap-1 py-2 pr-3 text-right sm:w-24">
            <span class="w-full truncate text-xs leading-snug text-muted">{{ post.authorName ?? '익명' }}</span>
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
    </component>
  </div>
</template>
