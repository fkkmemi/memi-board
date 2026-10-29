<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { AUTHOR_MEMO_MAX_LENGTH, useMemiBoardAuth, useMemiBoardAuthorMemo, useMemiBoardI18n } from 'memi-board/runtime'

const props = withDefaults(defineProps<{
  authorUid: string
  authorName?: string | null
  authorPhoto?: string | null
  /** "프로필 보기" 링크. 없으면 항목이 비활성 상태로만 보인다. */
  authorProfileTo?: (authorUid: string) => string | undefined
  /** "작성글 보기" 링크. 없으면 항목이 비활성 상태로만 보인다. */
  authorPostsTo?: (authorUid: string) => string | undefined
  /** "작성한 댓글 보기" 링크. 없으면 항목이 비활성 상태로만 보인다. */
  authorCommentsTo?: (authorUid: string) => string | undefined
  showAvatar?: boolean
  /** 좁은 고정폭 칸에 넣을 때만 true로 — 기본은 줄이지 않고 이름을 그대로 보여준다. */
  truncate?: boolean
}>(), {
  showAvatar: true,
  truncate: false,
})

const { t } = useMemiBoardI18n()

const authorProfileLink = computed(() => props.authorProfileTo?.(props.authorUid))
const authorPostsLink = computed(() => props.authorPostsTo?.(props.authorUid))
const authorCommentsLink = computed(() => props.authorCommentsTo?.(props.authorUid))

// 다른 작성자에 대해 나만 보는 메모 — 로그인 안 했거나 내 글이면 메뉴 항목 자체를 숨긴다.
const { user } = useMemiBoardAuth()
const showMemo = computed(() => !!user.value?.uid && user.value.uid !== props.authorUid)
const { text: memoText, sentiment: memoSentiment, loaded: memoLoaded, saving: memoSaving, error: memoError, load: loadMemo, save: saveMemo, remove: removeMemo } = useMemiBoardAuthorMemo(() => props.authorUid)
const menuOpen = ref(false)
const memoOpen = ref(false)
const memoPendingSentiment = ref<'good' | 'bad' | null>(null)

// 메뉴를 열 때 불러와 메모 항목 색으로 평가(좋음/나쁨)를 보여준다.
watch(menuOpen, (open) => {
  if (open && showMemo.value && !memoLoaded.value) void loadMemo()
})

const items = computed(() => [
  [
    { label: t('authorMenu.viewProfile'), icon: 'i-lucide-user-round', to: authorProfileLink.value, disabled: !authorProfileLink.value },
    { label: t('authorMenu.viewPosts'), icon: 'i-lucide-notebook-text', to: authorPostsLink.value, disabled: !authorPostsLink.value },
    { label: t('authorMenu.viewComments'), icon: 'i-lucide-message-square-text', to: authorCommentsLink.value, disabled: !authorCommentsLink.value },
  ],
  ...(showMemo.value
    ? [[{
        label: t('authorMenu.memoTitle'),
        icon: 'i-lucide-notebook-pen',
        color: memoSentiment.value === 'good' ? 'primary' as const : memoSentiment.value === 'bad' ? 'error' as const : undefined,
        onSelect: () => { memoOpen.value = true },
      }]]
    : []),
])

async function onSaveMemo(sentiment: 'good' | 'bad') {
  memoPendingSentiment.value = sentiment
  try {
    await saveMemo(memoText.value, sentiment)
    memoOpen.value = false
  }
  catch {
    // memoError 에 이미 반영됨 — 팝오버는 열어둔 채로 사용자가 다시 시도하게 둔다.
  }
  finally {
    memoPendingSentiment.value = null
  }
}

async function onDeleteMemo() {
  try {
    await removeMemo()
    memoOpen.value = false
  }
  catch {
    // memoError 에 이미 반영됨 — 팝오버는 열어둔 채로 사용자가 다시 시도하게 둔다.
  }
}
</script>

<template>
  <div
    class="flex max-w-full items-center"
    :class="truncate ? 'w-full min-w-0 justify-end' : 'inline-flex'"
  >
    <UDropdownMenu v-model:open="menuOpen" :items="items" :content="{ align: 'start' }">
      <UButton
        :avatar="showAvatar ? { src: authorPhoto ?? undefined, alt: authorName ?? t('common.label.anonymous') } : undefined"
        :label="authorName ?? t('common.label.anonymous')"
        variant="ghost"
        color="neutral"
        size="xs"
        class="max-w-full"
        :ui="truncate
          ? { base: 'max-w-full' }
          : { base: 'max-w-full', label: 'whitespace-normal overflow-visible text-clip' }"
      />
    </UDropdownMenu>

    <UModal
      v-if="showMemo"
      v-model:open="memoOpen"
      :title="t('authorMenu.memoTitle')"
      :description="authorName ?? t('common.label.anonymous')"
    >
      <template #body>
        <UTextarea
          v-model="memoText"
          :rows="3"
          :maxlength="AUTHOR_MEMO_MAX_LENGTH"
          :placeholder="t('authorMenu.memoPlaceholder')"
          class="w-full"
        />
        <UAlert
          v-if="memoError"
          color="error"
          variant="subtle"
          :description="memoError"
          class="mt-3"
        />
      </template>
      <template #footer>
        <UButton
          v-if="memoText || memoSentiment"
          :label="t('common.action.delete')"
          color="neutral"
          variant="ghost"
          :disabled="memoSaving"
          @click="onDeleteMemo"
        />
        <UButton
          :label="t('authorMenu.bad')"
          color="error"
          class="ms-auto"
          :loading="memoPendingSentiment === 'bad'"
          :disabled="memoSaving"
          @click="onSaveMemo('bad')"
        />
        <UButton
          :label="t('authorMenu.good')"
          color="primary"
          :loading="memoPendingSentiment === 'good'"
          :disabled="memoSaving"
          @click="onSaveMemo('good')"
        />
      </template>
    </UModal>
  </div>
</template>
