<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { AUTHOR_MEMO_MAX_COUNT, useMemiBoardI18n, useMemiBoardMyAuthorMemos } from 'memi-board/runtime'
import MemiBoardAuthorMemoListItem from './AuthorMemoListItem.vue'

defineProps<{
  authorProfileTo?: (authorUid: string) => string | undefined
  authorPostsTo?: (authorUid: string) => string | undefined
  authorCommentsTo?: (authorUid: string) => string | undefined
}>()

const { t } = useMemiBoardI18n()
const { memos, pending, error, load } = useMemiBoardMyAuthorMemos()

// 기본은 접어둔다. 개수 배지 때문에 마운트 시 불러온다(게시판 닷과 같은 쿼리 1회·캐시 공유).
const open = ref(false)
onMounted(() => { void load() })
</script>

<template>
  <UCollapsible v-model:open="open" class="flex flex-col gap-2">
    <UButton
      icon="i-lucide-notebook-pen"
      color="neutral"
      variant="ghost"
      block
      class="justify-start font-semibold text-highlighted"
      :trailing-icon="open ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
      :ui="{ trailingIcon: 'ms-auto' }"
    >
      <template #default>
        {{ t('authorMenu.myMemosTitle') }}
        <UBadge
          v-if="memos.length"
          :label="`${memos.length} / ${AUTHOR_MEMO_MAX_COUNT}`"
          :color="memos.length >= AUTHOR_MEMO_MAX_COUNT ? 'warning' : 'neutral'"
          variant="subtle"
          size="sm"
        />
      </template>
    </UButton>

    <template #content>
      <div class="flex flex-col gap-2">
        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          :description="error"
        />

        <div
          v-else-if="pending && !memos.length"
          class="flex flex-col gap-2"
        >
          <USkeleton class="h-10 w-full" />
          <USkeleton class="h-10 w-full" />
        </div>

        <p
          v-else-if="!memos.length"
          class="text-sm text-muted"
        >
          {{ t('authorMenu.myMemosEmpty') }}
        </p>

        <div
          v-else
          class="divide-y divide-default"
        >
          <MemiBoardAuthorMemoListItem
            v-for="memo in memos"
            :key="memo.targetUid"
            :memo="memo"
            :author-profile-to="authorProfileTo"
            :author-posts-to="authorPostsTo"
            :author-comments-to="authorCommentsTo"
          />
        </div>
      </div>
    </template>
  </UCollapsible>
</template>
