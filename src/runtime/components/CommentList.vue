<script setup lang="ts">
import { formatDate } from '../utils/formatDate'

const props = defineProps<{ postId: string }>()

const { comments, deleteComment } = useMemiBoardComments(props.postId)
const { canDeleteComment } = useMemiBoardAuth()

const deletingId = ref<string | null>(null)

async function handleDelete(commentId: string) {
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
    <p
      v-if="!comments.length"
      class="text-sm text-muted"
    >
      아직 댓글이 없습니다.
    </p>

    <div
      v-for="comment in comments"
      :key="comment.id"
      class="flex items-start gap-3"
    >
      <UAvatar
        :src="comment.authorPhoto ?? undefined"
        :alt="comment.authorName ?? '익명'"
        size="sm"
      />
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium">{{ comment.authorName ?? '익명' }}</span>
          <span class="text-xs text-muted">{{ formatDate(comment.createdAt) }}</span>
        </div>
        <p class="text-sm whitespace-pre-wrap break-words">
          {{ comment.body }}
        </p>
      </div>
      <UButton
        v-if="canDeleteComment(comment)"
        icon="i-lucide-trash-2"
        size="xs"
        variant="ghost"
        color="error"
        :loading="deletingId === comment.id"
        @click="handleDelete(comment.id!)"
      />
    </div>
  </div>
</template>
