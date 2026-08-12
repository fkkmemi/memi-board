<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { AUTHOR_MEMO_MAX_LENGTH, useMemiBoardAuth, useMemiBoardAuthorMemo } from 'memi-board/runtime'

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

const authorProfileLink = computed(() => props.authorProfileTo?.(props.authorUid))
const authorPostsLink = computed(() => props.authorPostsTo?.(props.authorUid))
const authorCommentsLink = computed(() => props.authorCommentsTo?.(props.authorUid))

const items = computed(() => [[
  { label: '프로필 보기', icon: 'i-lucide-user-round', to: authorProfileLink.value, disabled: !authorProfileLink.value },
  { label: '작성글 보기', icon: 'i-lucide-notebook-text', to: authorPostsLink.value, disabled: !authorPostsLink.value },
  { label: '작성한 댓글 보기', icon: 'i-lucide-message-square-text', to: authorCommentsLink.value, disabled: !authorCommentsLink.value },
]])

// 다른 작성자에 대해 나만 보는 메모 — 로그인 안 했거나 내 카드면 아이콘 자체를 숨긴다.
const { user } = useMemiBoardAuth()
const showMemo = computed(() => !!user.value?.uid && user.value.uid !== props.authorUid)
const { text: memoText, sentiment: memoSentiment, loaded: memoLoaded, saving: memoSaving, error: memoError, load: loadMemo, save: saveMemo, remove: removeMemo } = useMemiBoardAuthorMemo(() => props.authorUid)
const memoOpen = ref(false)
const memoPendingSentiment = ref<'good' | 'bad' | null>(null)

// 아이콘 색으로 평가(좋음/나쁨)를 바로 보여줘야 해서, 열기 전에 미리 불러온다.
watch(showMemo, (show) => {
  if (show && !memoLoaded.value) void loadMemo()
}, { immediate: true })

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
    class="flex max-w-full items-center gap-1"
    :class="truncate ? 'w-full min-w-0' : 'inline-flex'"
  >
    <UDropdownMenu :items="items" :content="{ align: 'start' }">
      <UButton
        :avatar="showAvatar ? { src: authorPhoto ?? undefined, alt: authorName ?? '익명' } : undefined"
        :label="authorName ?? '익명'"
        variant="ghost"
        color="neutral"
        size="xs"
        class="max-w-full"
        :class="truncate ? 'min-w-0 flex-1' : ''"
        :ui="truncate
          ? { base: 'max-w-full', label: 'min-w-0 flex-1 basis-0 text-left' }
          : { base: 'max-w-full', label: 'whitespace-normal overflow-visible text-clip' }"
      />
    </UDropdownMenu>

    <UPopover
      v-if="showMemo"
      v-model:open="memoOpen"
      :content="{ side: 'top' }"
      :ui="{ content: 'w-64' }"
    >
      <button
        type="button"
        class="shrink-0 rounded-md p-1 transition-colors hover:bg-elevated/60"
        :class="memoSentiment === 'good' ? 'text-primary' : memoSentiment === 'bad' ? 'text-error' : 'text-muted'"
        aria-label="이 작성자에 대한 메모"
      >
        <UIcon name="i-lucide-notebook-pen" class="size-3.5" />
      </button>
      <template #content>
        <div class="flex flex-col gap-2 p-3">
          <p class="text-xs text-muted">
            나만 보는 메모
          </p>
          <UTextarea
            v-model="memoText"
            :rows="3"
            :maxlength="AUTHOR_MEMO_MAX_LENGTH"
            placeholder="이 작성자에 대해 적어두기…"
            class="w-full"
          />
          <div class="flex items-center justify-between gap-2">
            <p
              v-if="memoError"
              class="text-xs text-error"
            >
              {{ memoError }}
            </p>
            <div class="ml-auto flex gap-2">
              <UButton
                v-if="memoText || memoSentiment"
                size="xs"
                label="삭제"
                color="neutral"
                variant="ghost"
                :disabled="memoSaving"
                @click="onDeleteMemo"
              />
              <UButton
                size="xs"
                label="나쁨"
                color="error"
                :loading="memoPendingSentiment === 'bad'"
                :disabled="memoSaving"
                @click="onSaveMemo('bad')"
              />
              <UButton
                size="xs"
                label="좋음"
                color="primary"
                :loading="memoPendingSentiment === 'good'"
                :disabled="memoSaving"
                @click="onSaveMemo('good')"
              />
            </div>
          </div>
        </div>
      </template>
    </UPopover>
  </div>
</template>
