<script setup lang="ts">
import { computed, ref, resolveComponent, toRef } from 'vue'
import { useMemiBoardCommentFeed, useMemiBoardI18n } from 'memi-board/runtime'
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

const { t, formatRelativeDate } = useMemiBoardI18n()

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
  props.sort === 'likes' ? t('commentFeed.emptyLiked') : t('commentFeed.empty'),
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
      {{ t('commentFeed.loadFailed', { error: String(loadError) }) }}
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
            {{ comment.authorName || t('common.label.anonymous') }}
          </component>
          <span v-if="boardName(comment)">· {{ boardName(comment) }}</span>
          <span>· {{ formatRelativeDate(comment.createdAt, now) }}</span>
          <span v-if="comment.parentId || comment.isReply">· {{ t('common.action.reply') }}</span>
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
            {{ t('commentFeed.blinded') }}
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
        :label="t('common.action.more')"
        block
        class="w-full"
        :loading="loadingMore"
        :disabled="loadingMore"
        @click="loadMore"
      />
    </div>
  </div>
</template>
