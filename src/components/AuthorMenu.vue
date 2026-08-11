<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  authorUid: string
  authorName?: string | null
  authorPhoto?: string | null
  /** "작성글 보기" 링크. 없으면 항목이 비활성 상태로만 보인다. */
  authorPostsTo?: (authorUid: string) => string | undefined
  showAvatar?: boolean
  avatarSize?: 'xs' | 'sm' | 'md'
}>(), {
  showAvatar: true,
  avatarSize: 'xs',
})

const authorPostsLink = computed(() => props.authorPostsTo?.(props.authorUid))

/** 프로필·작성한 댓글 보기는 아직 갈 곳이 없어 비활성 — 작성글 보기만 우선 연결. */
const items = computed(() => [[
  { label: '프로필 보기', icon: 'i-lucide-user-round', disabled: true },
  { label: '작성글 보기', icon: 'i-lucide-notebook-text', to: authorPostsLink.value, disabled: !authorPostsLink.value },
  { label: '작성한 댓글 보기', icon: 'i-lucide-message-square-text', disabled: true },
]])
</script>

<template>
  <UDropdownMenu :items="items" :content="{ align: 'start' }">
    <button
      type="button"
      class="-mx-1 flex min-w-0 max-w-full items-center gap-1.5 rounded-md px-1 transition-colors hover:bg-elevated/60"
    >
      <UAvatar
        v-if="showAvatar"
        :src="authorPhoto ?? undefined"
        :alt="authorName ?? '익명'"
        :size="avatarSize"
        class="shrink-0"
      />
      <span class="min-w-0 truncate">{{ authorName ?? '익명' }}</span>
    </button>
  </UDropdownMenu>
</template>
