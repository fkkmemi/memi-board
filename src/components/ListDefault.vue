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
      <UCard class="hover:bg-elevated/50 transition-colors" :ui="{ body: 'p-0 sm:p-0' }">
        <div class="flex gap-3">
          <div class="size-16 shrink-0 overflow-hidden rounded-l-lg bg-elevated">
            <img v-if="image(post)" :src="image(post)" :alt="post.title" class="size-full object-cover">
            <div v-else class="flex size-full items-center justify-center text-muted"><UIcon name="i-lucide-image" class="size-6" /></div>
          </div>

          <div class="min-w-0 flex-1 py-2">
            <div class="flex min-w-0 items-center gap-2">
              <UBadge v-if="post.category && showCategory" :label="categoryLabel(post.category)" variant="subtle" size="sm" />
              <h3 class="truncate font-medium">{{ post.title }}</h3>
            </div>
            <p v-if="post.summary" class="mt-2 line-clamp-2 text-sm text-muted">{{ post.summary }}</p>
            <div v-if="post.attachments?.length" class="mt-2 flex items-center gap-1 text-xs text-muted">
              <UIcon name="i-lucide-paperclip" class="size-3" />{{ post.attachments.length }}
            </div>
          </div>

          <div class="flex w-20 shrink-0 flex-col items-end gap-1.5 py-2 pr-4 text-right">
            <span class="w-full truncate text-xs text-muted">{{ post.authorName ?? '익명' }}</span>
            <UTooltip
              :text="formatTimestampDetails(post.createdAt, post.updatedAt).join('\n')"
              :ui="{ content: 'h-auto w-max py-2', text: 'whitespace-pre-line overflow-visible' }"
            >
              <time
                :datetime="post.createdAt?.toDate?.().toISOString()"
                class="cursor-help text-xs text-muted"
              >
                {{ formatRelativeDate(post.createdAt, now) }}
              </time>
            </UTooltip>
            <div class="flex items-center gap-2 text-xs text-muted">
              <span class="flex items-center gap-1"><UIcon name="i-lucide-heart" class="size-3" />{{ post.likeCount ?? 0 }}</span>
              <span class="flex items-center gap-1"><UIcon name="i-lucide-message-circle" class="size-3" />{{ post.commentCount }}</span>
            </div>
          </div>
        </div>
      </UCard>
    </component>
  </div>
</template>
