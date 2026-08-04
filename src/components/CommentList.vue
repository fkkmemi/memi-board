<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useMemiBoardComments } from 'memi-board'
import MemiBoardCommentItem from './CommentItem.vue'
import MemiBoardCommentSkeleton from './CommentSkeleton.vue'

const props = defineProps<{ postId: string }>()

const { comments, commentsPending, hasMore, loadingMore, loadMore, deleteComment } = useMemiBoardComments(props.postId)

const deletingId = ref<string | null>(null)
const now = ref(Date.now())
let relativeTimeTimer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  relativeTimeTimer = setInterval(() => { now.value = Date.now() }, 60_000)
})
onUnmounted(() => clearInterval(relativeTimeTimer))

async function handleDelete(commentId: string) {
  if (!window.confirm('이 댓글을 삭제하시겠습니까?')) return
  deletingId.value = commentId
  try {
    await deleteComment(commentId)
  }
  finally {
    deletingId.value = null
  }
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div v-if="commentsPending" class="flex flex-col gap-3" aria-label="댓글을 불러오고 있습니다">
      <MemiBoardCommentSkeleton v-for="index in 5" :key="`initial-${index}`" />
    </div>
    <p
      v-else-if="!comments.length"
      class="text-sm text-muted"
    >
      아직 댓글이 없습니다.
    </p>

    <UButton
      v-if="!commentsPending && hasMore"
      label="이전 댓글 더보기"
      icon="i-lucide-chevron-up"
      color="neutral"
      variant="soft"
      block
      :loading="loadingMore"
      @click="loadMore"
    />

    <div v-if="loadingMore" class="flex flex-col gap-3" aria-label="이전 댓글을 불러오고 있습니다">
      <MemiBoardCommentSkeleton v-for="index in 5" :key="`more-${index}`" />
    </div>

    <MemiBoardCommentItem
      v-for="comment in comments"
      :key="comment.id"
      :comment="comment"
      :now="now"
      :deleting="deletingId === comment.id"
      @delete="handleDelete"
    />
  </div>
</template>
