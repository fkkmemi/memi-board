<script setup lang="ts">
import { ref, resolveComponent } from 'vue'
import { formatRelativeDate, useMemiBoardUserComments } from 'memi-board/runtime'
import type { CommentModel } from 'memi-board/runtime'

const NuxtLink = resolveComponent('NuxtLink')

const props = withDefaults(defineProps<{
  /** 댓글 목록을 모을 작성자 uid */
  uid: string
  pageSize?: number
  /** 댓글이 달린 글로 이동하는 링크 생성 — comment.boardId/postId로 만든다. */
  getPostLink?: (comment: CommentModel) => string | undefined
}>(), {
  pageSize: 10,
})

const emit = defineEmits<{ select: [comment: CommentModel] }>()

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
      목록을 불러오지 못했습니다: {{ loadError }}
    </p>

    <p
      v-else-if="!comments.length"
      class="text-sm text-muted text-center py-8"
    >
      작성한 댓글이 없습니다.
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
            관리자에 의해 블라인드된 댓글입니다.
          </p>
          <p
            v-else
            class="text-sm text-highlighted line-clamp-3 whitespace-pre-wrap"
          >
            {{ comment.body }}
          </p>
          <p class="mt-1 text-xs text-muted">
            {{ formatRelativeDate(comment.createdAt, now) }}
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
