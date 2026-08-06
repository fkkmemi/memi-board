<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { CommentModel } from 'memi-board/runtime'
import { useMemiBoardComments, useMemiBoardReplies } from 'memi-board/runtime'
import MemiBoardCommentForm from './CommentForm.vue'
import MemiBoardCommentItem from './CommentItem.vue'
import MemiBoardCommentSkeleton from './CommentSkeleton.vue'

const props = defineProps<{ boardId: string, postId: string, root: CommentModel, now: number }>()

const { deleteComment } = useMemiBoardComments(
  props.boardId,
  props.postId,
  { subscribe: false },
)
const { replies, loading, loaded, hasMore, loadMore, refresh } = useMemiBoardReplies(
  props.boardId,
  props.postId,
  props.root.id!,
)
const expanded = ref((props.root.replyCount ?? 0) > 0)
const replyingTo = ref<CommentModel | null>(null)
const deletingId = ref<string | null>(null)
const error = ref('')
const needsMoreReplies = computed(() =>
  hasMore.value
  && loaded.value
  && replies.value.length < (props.root.replyCount ?? Number.POSITIVE_INFINITY),
)

onMounted(() => {
  if (expanded.value && !loaded.value) void loadMore()
})

watch(() => props.root.replyCount, (count) => {
  if ((count ?? 0) <= 0) return
  expanded.value = true
  if (!loaded.value) void loadMore()
})

async function toggleReplies() {
  expanded.value = !expanded.value
  if (expanded.value && !loaded.value) await loadMore()
}

function startReply(comment: CommentModel) {
  replyingTo.value = comment
}

async function handleSaved() {
  expanded.value = true
  replyingTo.value = null
  // 이미 펼쳐진 스레드는 onSnapshot이 새 답글을 누적한다. refresh()하면
  // 작성 브라우저만 첫 5개 상태로 되돌아가므로 최초 조회 전일 때만 읽는다.
  if (!loaded.value) await refresh()
}

async function handleDelete(comment: CommentModel) {
  if (!window.confirm('이 댓글을 삭제하시겠습니까?')) return
  deletingId.value = comment.id ?? null
  error.value = ''
  try {
    await deleteComment(comment)
    if (comment.parentId) await refresh()
  }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : '댓글을 삭제하지 못했습니다.'
  }
  finally {
    deletingId.value = null
  }
}
</script>

<template>
  <article class="flex flex-col gap-3">
    <MemiBoardCommentItem
      :comment="root"
      :board-id="boardId"
      :post-id="postId"
      :now="now"
      :deleting="deletingId === root.id"
      @reply="startReply"
      @delete="handleDelete(root)"
    />

    <UButton
      v-if="(root.replyCount ?? 0) > 0"
      :label="expanded ? '답글 숨기기' : `답글 ${root.replyCount}개`"
      :icon="expanded ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
      color="neutral"
      variant="link"
      size="sm"
      class="w-fit px-0"
      @click="toggleReplies"
    />

    <div v-if="expanded" class="flex flex-col gap-3 border-l border-default pl-4 sm:pl-6">
      <MemiBoardCommentSkeleton v-for="index in (loading && !loaded) ? 5 : 0" :key="index" />
      <MemiBoardCommentItem
        v-for="reply in replies"
        :key="reply.id"
        :comment="reply"
        :board-id="boardId"
      :post-id="postId"
        :now="now"
        :deleting="deletingId === reply.id"
        :class="(reply.depth ?? 1) >= 2 ? 'ml-4 sm:ml-8' : ''"
        @reply="startReply"
        @delete="handleDelete(reply)"
      />
      <UButton
        v-if="needsMoreReplies"
        label="답글 더보기"
        color="neutral"
        variant="soft"
        size="sm"
        :loading="loading"
        @click="loadMore"
      />
    </div>

    <MemiBoardCommentForm
      v-if="replyingTo"
      :board-id="boardId"
      :post-id="postId"
      
      :parent="replyingTo"
      class="ml-10"
      @saved="handleSaved"
      @cancel="replyingTo = null"
    />
    <p v-if="error" class="text-xs text-error">{{ error }}</p>
  </article>
</template>
