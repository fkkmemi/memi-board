<script setup lang="ts">
import { computed, ref, resolveComponent, toRef } from 'vue'
import { formatRelativeDate, useMemiBoardCommentFeed } from 'memi-board/runtime'
import type { CommentFeedSort, CommentModel } from 'memi-board/runtime'

const NuxtLink = resolveComponent('NuxtLink')

const props = withDefaults(defineProps<{
  sort?: CommentFeedSort
  pageSize?: number
  getPostLink?: (comment: CommentModel) => string | undefined
  getAuthorLink?: (uid: string) => string | undefined
  boardLabel?: (boardId: string) => string | undefined
}>(), {
  sort: 'latest',
  pageSize: 10,
})

const emit = defineEmits<{ select: [comment: CommentModel] }>()

const { comments, commentsPending, hasMore, loadingMore, loadError, loadMore } = useMemiBoardCommentFeed(
  toRef(props, 'sort'),
  { pageSize: props.pageSize },
)

const now = ref(Date.now())

function commentLink(comment: CommentModel): string | undefined {
  return props.getPostLink?.(comment)
}

function authorLink(comment: CommentModel): string | undefined {
  return comment.authorUid ? props.getAuthorLink?.(comment.authorUid) : undefined
}

function boardName(comment: CommentModel): string {
  if (!comment.boardId) return ''
  return props.boardLabel?.(comment.boardId) || comment.boardId
}

const emptyMessage = computed(() =>
  props.sort === 'likes' ? '좋아요를 받은 댓글이 아직 없습니다.' : '아직 댓글이 없습니다.',
)
</script>

<template>
  <div class="flex flex-col gap-2">
    <template v-if="commentsPending">
      <USkeleton
        v-for="i in 5"
        :key="i"
        class="h-24 w-full"
      />
    </template>

    <p
      v-else-if="loadError"
      class="py-8 text-center text-sm text-error"
    >
      목록을 불러오지 못했습니다: {{ loadError }}
    </p>

    <p
      v-else-if="!comments.length"
      class="py-8 text-center text-sm text-muted"
    >
      {{ emptyMessage }}
    </p>

    <ul
      v-else
      class="flex flex-col gap-2"
    >
      <li
        v-for="comment in comments"
        :key="comment.id"
        class="rounded-lg border border-default p-3 transition-colors hover:bg-elevated/60"
      >
        <div class="flex items-center gap-2 text-xs text-muted">
          <component
            :is="authorLink(comment) ? NuxtLink : 'span'"
            :to="authorLink(comment)"
            class="truncate font-medium text-highlighted"
            :class="authorLink(comment) ? 'hover:underline' : ''"
          >
            {{ comment.authorName || '익명' }}
          </component>
          <span v-if="boardName(comment)">· {{ boardName(comment) }}</span>
          <span>· {{ formatRelativeDate(comment.createdAt, now) }}</span>
          <span v-if="comment.parentId || comment.isReply">· 답글</span>
        </div>
        <component
          :is="commentLink(comment) ? NuxtLink : 'button'"
          :to="commentLink(comment)"
          class="mt-1 block w-full text-left"
          @click="!commentLink(comment) && emit('select', comment)"
        >
          <p
            v-if="comment.isBlinded"
            class="text-sm text-muted italic"
          >
            관리자에 의해 블라인드된 댓글입니다.
          </p>
          <p
            v-else
            class="text-sm text-highlighted line-clamp-3 whitespace-pre-wrap"
          >
            <span
              v-if="comment.replyToName"
              class="mr-1 text-primary"
            >@{{ comment.replyToName }}</span>
            {{ comment.body }}
          </p>
          <p
            v-if="(comment.likeCount ?? 0) > 0"
            class="mt-1 flex items-center gap-1 text-xs text-muted"
          >
            <UIcon name="i-lucide-heart" class="size-3" />
            {{ comment.likeCount }}
          </p>
        </component>
      </li>
    </ul>

    <div
      v-if="!commentsPending && hasMore"
      class="flex justify-center py-1"
    >
      <UButton
        variant="outline"
        color="neutral"
        label="더 보기"
        block
        class="w-full"
        :loading="loadingMore"
        :disabled="loadingMore"
        @click="loadMore"
      />
    </div>
  </div>
</template>
