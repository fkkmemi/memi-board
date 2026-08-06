<script setup lang="ts">
import { useMemiBoardAuth } from 'memi-board/runtime'
import { useMemiBoardLikes } from 'memi-board/runtime'

const props = defineProps<{
  boardId: string
  postId: string
  likeCount: number
}>()

const { isSignedIn } = useMemiBoardAuth()
const { isLiked, likePending, toggleLike } = useMemiBoardLikes(props.boardId, props.postId)
</script>

<template>
  <UButton
    v-if="isSignedIn"
    icon="i-lucide-heart"
    size="sm"
    variant="ghost"
    :color="isLiked ? 'error' : 'neutral'"
    :label="String(likeCount ?? 0)"
    :loading="likePending"
    @click="toggleLike"
  />
  <span
    v-else
    class="flex items-center gap-1 text-sm text-muted"
  >
    <UIcon
      name="i-lucide-heart"
      class="size-4"
    />
    {{ likeCount ?? 0 }}
  </span>
</template>
