<script setup lang="ts">
import { useMemiBoardI18n, useMemiBoardAuth } from 'memi-board/runtime'
import { useMemiBoardLikes } from 'memi-board/runtime'

const props = defineProps<{
  boardId: string
  postId: string
  likeCount: number
}>()

const { t } = useMemiBoardI18n()
const { isSignedIn } = useMemiBoardAuth()
const { isLiked, likePending, toggleLike } = useMemiBoardLikes(props.boardId, props.postId)
</script>

<template>
  <UTooltip v-if="isSignedIn" :text="isLiked ? t('common.action.unlike') : t('common.action.like')" :delay-duration="200">
    <UButton
      icon="i-lucide-heart"
      size="sm"
      variant="ghost"
      :color="isLiked ? 'error' : 'neutral'"
      :label="String(likeCount ?? 0)"
      :loading="likePending"
      :aria-label="isLiked ? t('common.action.unlike') : t('common.action.like')"
      @click="toggleLike"
    />
  </UTooltip>
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
