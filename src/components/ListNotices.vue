<script setup lang="ts">
import { computed } from 'vue'
import type { NavigationMenuItem } from '@nuxt/ui'
import type { PostModel } from 'memi-board/runtime'
import { displayPostSummary, displayPostTitle, useMemiBoardI18n } from 'memi-board/runtime'

const props = defineProps<{
  posts: PostModel[]
  postTo: (post: PostModel) => string | undefined
}>()
const emit = defineEmits<{ select: [post: PostModel] }>()
const { t, locale } = useMemiBoardI18n()

function titleOf(post: PostModel) {
  return displayPostTitle(post, locale.value).trim() || displayPostSummary(post, locale.value).trim() || t('list.photo')
}

// 공지 = 목록 뷰 종류와 상관없이 맨 위에 한 줄씩.
const items = computed<NavigationMenuItem[]>(() => props.posts.map((post) => {
  const to = props.postTo(post)
  return {
    label: titleOf(post),
    icon: 'i-lucide-pin',
    to,
    badge: (post.commentCount ?? 0) > 0 ? post.commentCount : undefined,
    onSelect: to ? undefined : () => emit('select', post),
  }
}))
</script>

<template>
  <UNavigationMenu
    :items="items"
    orientation="vertical"
    :aria-label="t('list.notice')"
  />
</template>
