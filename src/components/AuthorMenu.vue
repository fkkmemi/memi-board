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
  /** 좁은 고정폭 칸에 넣을 때만 true로 — 기본은 줄이지 않고 이름을 그대로 보여준다. */
  truncate?: boolean
}>(), {
  showAvatar: true,
  avatarSize: 'xs',
  truncate: false,
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
      class="-mx-1 flex max-w-full items-center gap-1.5 rounded-md px-1 transition-colors hover:bg-elevated/60"
      :class="truncate ? 'min-w-0' : ''"
    >
      <UAvatar
        v-if="showAvatar"
        :src="authorPhoto ?? undefined"
        :alt="authorName ?? '익명'"
        :size="avatarSize"
        class="shrink-0"
      />
      <span :class="truncate ? 'min-w-0 truncate whitespace-nowrap' : 'whitespace-nowrap'">{{ authorName ?? '익명' }}</span>
    </button>
  </UDropdownMenu>
</template>
