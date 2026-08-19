<script setup lang="ts">
import { computed, ref, resolveComponent } from 'vue'
import type { BoardSection, CommentModel } from 'memi-board/runtime'
import { formatRelativeDate, miniCommentLink, useMemiBoardCommentFeed } from 'memi-board/runtime'

const props = defineProps<{
  section: BoardSection
  getCommentLink?: (comment: CommentModel) => string | undefined
}>()

const NuxtLink = resolveComponent('NuxtLink')
const now = ref(Date.now())
const sort = computed(() => props.section.sort === 'likes' ? 'likes' : 'latest')
const { comments, commentsPending } = useMemiBoardCommentFeed(sort, {
  pageSize: () => props.section.count,
})

function commentTo(comment: CommentModel) {
  return props.getCommentLink?.(comment) ?? miniCommentLink(comment)
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div v-if="commentsPending" class="flex flex-col gap-2 p-3">
      <USkeleton v-for="i in Math.min(section.count, 4)" :key="i" class="h-10 w-full" />
    </div>
    <p
      v-else-if="!comments.length"
      class="flex flex-1 items-center justify-center px-3 py-6 text-sm text-muted"
    >
      아직 댓글이 없습니다.
    </p>
    <ul
      v-else
      class="flex min-h-0 flex-1 flex-col divide-y divide-default"
    >
      <li v-for="comment in comments" :key="comment.id">
        <component
          :is="commentTo(comment) ? NuxtLink : 'div'"
          :to="commentTo(comment)"
          class="flex flex-col gap-0.5 px-3 py-2 transition-colors hover:bg-elevated/60"
        >
          <p
            v-if="comment.isBlinded"
            class="truncate text-sm text-muted italic"
          >
            관리자에 의해 블라인드된 댓글입니다.
          </p>
          <p
            v-else
            class="line-clamp-2 text-sm text-highlighted"
          >
            <span
              v-if="comment.replyToName"
              class="mr-1 text-primary"
            >@{{ comment.replyToName }}</span>
            {{ comment.body }}
          </p>
          <p class="flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted">
            <span>{{ comment.authorName || '익명' }}</span>
            <time>{{ formatRelativeDate(comment.createdAt, now) }}</time>
            <span
              v-if="(comment.likeCount ?? 0) > 0"
              class="inline-flex items-center gap-0.5"
            >
              <UIcon name="i-lucide-heart" class="size-3" />
              {{ comment.likeCount }}
            </span>
          </p>
        </component>
      </li>
    </ul>
  </div>
</template>
