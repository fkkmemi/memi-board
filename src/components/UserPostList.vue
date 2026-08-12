<script setup lang="ts">
import { ref } from 'vue'
import { useMemiBoardUserPosts } from 'memi-board/runtime'
import type { PostModel, UserPostModel } from 'memi-board/runtime'
import MemiBoardListDefault from './ListDefault.vue'

const props = withDefaults(defineProps<{
  /** 글 목록을 모을 작성자 uid */
  uid: string
  pageSize?: number
  /** 글 상세 링크 생성 — post.boardId로 보드를 구분해야 한다. */
  getPostLink?: (post: UserPostModel) => string | undefined
  /** 카드의 작성자 메뉴 중 "프로필 보기" 링크. */
  authorProfileTo?: (authorUid: string) => string | undefined
  /** 카드의 작성자 메뉴 중 "작성글 보기" 링크. */
  authorPostsTo?: (authorUid: string) => string | undefined
  /** 카드의 작성자 메뉴 중 "작성한 댓글 보기" 링크. */
  authorCommentsTo?: (authorUid: string) => string | undefined
  /** 프로필의 미리보기처럼 더 보기 버튼 없이 pageSize만큼만 딱 보여줄 때 true. */
  hideLoadMore?: boolean
}>(), {
  pageSize: 10,
  hideLoadMore: false,
})

const emit = defineEmits<{ select: [post: UserPostModel] }>()

const { posts, postsPending, hasMore, loadingMore, loadError, loadMore } = useMemiBoardUserPosts(
  () => props.uid,
  { pageSize: props.pageSize },
)

const now = ref(Date.now())

function postTo(post: PostModel): string | undefined {
  return props.getPostLink?.(post as UserPostModel)
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <template v-if="postsPending">
      <USkeleton
        v-for="i in 3"
        :key="i"
        class="h-20 w-full"
      />
    </template>

    <p
      v-else-if="loadError"
      class="text-sm text-error text-center py-8"
    >
      목록을 불러오지 못했습니다: {{ loadError }}
    </p>

    <p
      v-else-if="!posts.length"
      class="text-sm text-muted text-center py-8"
    >
      작성한 글이 없습니다.
    </p>

    <MemiBoardListDefault
      v-else
      :posts="posts"
      :post-to="postTo"
      :now="now"
      :show-category="false"
      :author-posts-to="authorPostsTo"
      :author-profile-to="authorProfileTo"
      :author-comments-to="authorCommentsTo"
      @select="(post: PostModel) => emit('select', post as UserPostModel)"
    />

    <div
      v-if="!postsPending && hasMore && !hideLoadMore"
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
