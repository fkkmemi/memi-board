<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { PostModel } from 'memi-board'
import { formatDate, useMemiBoardSettings } from 'memi-board'

defineProps<{
  posts: PostModel[]
  postTo: (post: PostModel) => string | undefined
}>()
const emit = defineEmits<{ select: [post: PostModel] }>()
const { categoryLabel } = useMemiBoardSettings()
</script>

<template>
  <div class="flex flex-col gap-2">
    <component
      :is="postTo(post) ? RouterLink : 'button'"
      v-for="post in posts"
      :key="post.id"
      :to="postTo(post)"
      class="text-left"
      @click="!postTo(post) && emit('select', post)"
    >
      <UCard class="hover:bg-elevated/50 transition-colors">
        <div class="flex items-center justify-between gap-4">
          <div class="flex items-center gap-2 min-w-0">
            <UBadge v-if="post.category" :label="categoryLabel(post.category)" variant="subtle" size="sm" />
            <h3 class="font-medium truncate">{{ post.title }}</h3>
          </div>
          <span class="text-xs text-muted shrink-0">{{ formatDate(post.createdAt) }}</span>
        </div>
        <p v-if="post.summary" class="mt-2 line-clamp-2 text-sm text-muted">{{ post.summary }}</p>
        <div class="flex items-center gap-3 text-xs text-muted mt-2">
          <span>{{ post.authorName ?? '익명' }}</span>
          <span class="flex items-center gap-1"><UIcon name="i-lucide-message-circle" class="size-3" />{{ post.commentCount }}</span>
          <span v-if="post.attachments?.length" class="flex items-center gap-1"><UIcon name="i-lucide-paperclip" class="size-3" />{{ post.attachments.length }}</span>
        </div>
      </UCard>
    </component>
  </div>
</template>
