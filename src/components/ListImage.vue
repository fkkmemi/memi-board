<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { PostModel } from 'memi-board'
import { formatDate } from 'memi-board'

defineProps<{
  posts: PostModel[]
  postTo: (post: PostModel) => string | undefined
}>()
const emit = defineEmits<{ select: [post: PostModel] }>()

function image(post: PostModel): string | undefined {
  return post.previewImage || post.attachments?.find(item => item.type.startsWith('image/'))?.url
}
</script>

<template>
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
    <component
      :is="postTo(post) ? RouterLink : 'button'"
      v-for="post in posts"
      :key="post.id"
      :to="postTo(post)"
      class="overflow-hidden rounded-xl border border-default bg-default text-left transition hover:bg-elevated/50"
      @click="!postTo(post) && emit('select', post)"
    >
      <div class="aspect-[4/3] overflow-hidden bg-elevated">
        <img v-if="image(post)" :src="image(post)" :alt="post.title" class="size-full object-cover transition duration-300 hover:scale-105">
        <div v-else class="flex size-full items-center justify-center text-muted"><UIcon name="i-lucide-image" class="size-10" /></div>
      </div>
      <div class="p-4">
        <h3 class="font-medium line-clamp-2">{{ post.title }}</h3>
        <p v-if="post.summary" class="mt-2 line-clamp-2 text-sm text-muted">{{ post.summary }}</p>
        <div class="mt-3 flex items-center justify-between gap-2 text-xs text-muted">
          <span class="truncate">{{ post.authorName ?? '익명' }}</span>
          <span class="shrink-0">{{ formatDate(post.createdAt) }}</span>
        </div>
      </div>
    </component>
  </div>
</template>
