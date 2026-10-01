<script setup lang="ts">
import { ref, resolveComponent } from 'vue'
import { useMemiBoardI18n, useMemiBoardUserComments } from 'memi-board/runtime'
import type { CommentModel } from 'memi-board/runtime'

const NuxtLink = resolveComponent('NuxtLink')

const props = withDefaults(defineProps<{
  /** 댓글 목록을 모을 작성자 uid */
  uid: string
  pageSize?: number
  /** 댓글이 달린 글로 이동하는 링크 생성 — comment.boardId/postId로 만든다. */
  getPostLink?: (comment: CommentModel) => string | undefined
  /** 프로필의 미리보기처럼 더 보기 버튼 없이 pageSize만큼만 딱 보여줄 때 true. */
  hideLoadMore?: boolean
}>(), {
  pageSize: 10,
  hideLoadMore: false,
})

const emit = defineEmits<{ select: [comment: CommentModel] }>()

const { t, formatRelativeDate } = useMemiBoardI18n()

const { comments, commentsPending, hasMore, loadingMore, loadError, loadMore } = useMemiBoardUserComments(
  () => props.uid,
  { pageSize: props.pageSize },
)

const now = ref(Date.now())

function commentLink(comment: CommentModel): string | undefined {
  return props.getPostLink?.(comment)
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <template v-if="commentsPending">
      <USkeleton
        v-for="i in 3"
        :key="i"
        class="h-16 w-full"
      />
    </template>

    <p
      v-else-if="loadError"
      class="text-sm text-error text-center py-8"
    >
      {{ t('userCommentList.loadFailed', { error: String(loadError) }) }}
    </p>

    <p
      v-else-if="!comments.length"
      class="text-sm text-muted text-center py-8"
    >
      {{ t('userCommentList.empty') }}
    </p>

    <ul
      v-else
      class="flex flex-col gap-2"
    >
      <li
        v-for="comment in comments"
        :key="comment.id"
      >
        <component
          :is="commentLink(comment) ? NuxtLink : 'button'"
          :to="commentLink(comment)"
          class="block w-full rounded-lg border border-default p-3 text-left transition-colors"
          :class="commentLink(comment) ? 'hover:bg-elevated/60' : ''"
          @click="!commentLink(comment) && emit('select', comment)"
        >
          <p
            v-if="comment.isBlinded"
            class="text-sm text-muted italic"
          >
            {{ t('userCommentList.blinded') }}
          </p>
          <p
            v-else
            class="text-sm text-highlighted line-clamp-3 whitespace-pre-wrap"
          >
            {{ comment.body }}
          </p>
          <p class="mt-1 text-xs text-muted">
            {{ formatRelativeDate(comment.createdAt, now) }}
            <template v-if="(comment.likeCount ?? 0) > 0">
              · {{ t('userCommentList.likes', { count: comment.likeCount ?? 0 }) }}
            </template>
          </p>
        </component>
      </li>
    </ul>

    <div
      v-if="!commentsPending && hasMore && !hideLoadMore"
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
