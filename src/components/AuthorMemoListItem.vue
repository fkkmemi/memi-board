<script setup lang="ts">
import { computed } from 'vue'
import { useMemiBoardI18n, useMemiBoardUserProfile } from 'memi-board/runtime'
import type { MyAuthorMemo } from 'memi-board/runtime'
import MemiBoardAuthorMenu from './AuthorMenu.vue'

const props = defineProps<{
  memo: MyAuthorMemo
  authorProfileTo?: (authorUid: string) => string | undefined
  authorPostsTo?: (authorUid: string) => string | undefined
  authorCommentsTo?: (authorUid: string) => string | undefined
}>()

const { t } = useMemiBoardI18n()
const { profile } = useMemiBoardUserProfile(() => props.memo.targetUid)
const name = computed(() => profile.value?.displayName ?? t('common.label.anonymous'))
</script>

<template>
  <div class="flex items-start gap-3 py-3">
    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <MemiBoardAuthorMenu
        :author-uid="memo.targetUid"
        :author-name="name"
        :author-photo="profile?.photoURL"
        :author-profile-to="authorProfileTo"
        :author-posts-to="authorPostsTo"
        :author-comments-to="authorCommentsTo"
        class="-ms-2 self-start"
      />
      <p
        v-if="memo.text"
        class="break-words whitespace-pre-line text-sm text-toned"
      >
        {{ memo.text }}
      </p>
    </div>
    <UBadge
      v-if="memo.sentiment"
      :label="memo.sentiment === 'good' ? t('authorMenu.good') : t('authorMenu.bad')"
      :color="memo.sentiment === 'good' ? 'primary' : 'error'"
      variant="subtle"
      size="sm"
      class="mt-1 shrink-0"
    />
  </div>
</template>
