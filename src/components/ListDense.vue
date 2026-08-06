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

function thumb(post: PostModel): string | undefined {
  return post.previewImage || post.attachments?.find(item => item.type.startsWith('image/'))?.url
}
</script>

<template>
  <!--
    조밀 = 타임라인 스트림.
    레일 위 원형 노드 자리에 썸네일, 제목 한 줄 + 메타.
  -->
  <div class="relative">
    <!-- 세로 레일 (썸네일 중심 기준) -->
    <div
      class="pointer-events-none absolute bottom-4 left-5 top-4 w-px bg-gradient-to-b from-primary/40 via-default to-primary/20"
      aria-hidden="true"
    />

    <ul class="flex flex-col gap-0.5">
      <li v-for="post in posts" :key="post.id">
        <component
          :is="postTo(post) ? NuxtLink : 'button'"
          :to="postTo(post)"
          class="group relative flex w-full items-center gap-3 rounded-lg py-1.5 pr-2 pl-0 text-left transition-colors hover:bg-elevated/60"
          @click="!postTo(post) && emit('select', post)"
        >
          <!-- 레일 위 원형 썸네일 (이미지 없으면 플레이스홀더) -->
          <div
            class="relative z-10 size-10 shrink-0 overflow-hidden rounded-full bg-elevated ring-2 ring-default shadow-sm transition duration-300 group-hover:ring-primary/50"
          >
            <img
              v-if="thumb(post)"
              :src="thumb(post)"
              :alt="post.title"
              class="size-full object-cover transition duration-300 group-hover:scale-110"
            >
            <div
              v-else
              class="flex size-full items-center justify-center text-muted"
            >
              <UIcon name="i-lucide-file-text" class="size-4" />
            </div>
          </div>

          <!-- 본문 -->
          <div class="min-w-0 flex-1">
            <div class="flex min-w-0 items-center gap-1.5">
              <h3 class="min-w-0 truncate text-sm font-medium leading-snug text-highlighted transition-colors group-hover:text-primary">
                {{ post.title }}
              </h3>
              <span
                v-if="(post.commentCount ?? 0) > 0"
                class="inline-flex shrink-0 items-center rounded-full bg-primary/10 px-1.5 py-px text-[11px] font-semibold tabular-nums text-primary"
              >
                {{ post.commentCount }}
              </span>
            </div>

            <div class="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] leading-none text-muted">
              <span class="max-w-[7rem] truncate font-medium text-toned">
                {{ post.authorName ?? '익명' }}
              </span>
              <span class="text-default/40" aria-hidden="true">·</span>
              <UTooltip
                :delay-duration="0"
                :text="formatTimestampDetails(post.createdAt, post.updatedAt).join('\n')"
                :ui="{ content: 'h-auto w-max py-2', text: 'whitespace-pre-line overflow-visible' }"
              >
                <time
                  :datetime="post.createdAt?.toDate?.().toISOString()"
                  class="cursor-help tabular-nums"
                >
                  {{ formatRelativeDate(post.createdAt, now) }}
                </time>
              </UTooltip>
              <span class="text-default/40" aria-hidden="true">·</span>
              <span class="inline-flex items-center gap-0.5 tabular-nums">
                <UIcon name="i-lucide-eye" class="size-3" />
                {{ post.viewCount ?? 0 }}
              </span>
              <template v-if="(post.likeCount ?? 0) > 0">
                <span class="text-default/40" aria-hidden="true">·</span>
                <span class="inline-flex items-center gap-0.5 tabular-nums">
                  <UIcon name="i-lucide-heart" class="size-3 text-primary/80" />
                  {{ post.likeCount }}
                </span>
              </template>
              <template v-if="post.category && showCategory">
                <span class="text-default/40" aria-hidden="true">·</span>
                <span class="truncate text-muted">{{ categoryLabel(post.category) }}</span>
              </template>
            </div>
          </div>
        </component>
      </li>
    </ul>
  </div>
</template>
