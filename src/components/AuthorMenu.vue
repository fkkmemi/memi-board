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
  /** 이름을 한 줄로 줄이고 넘치면 …로 자른다. 이름 옆에 다른 요소가 같이 있는 줄(댓글 머리 등)에서 쓴다. */
  ellipsis?: boolean
}>(), {
  showAvatar: true,
  truncate: false,
  ellipsis: false,
})

const { t } = useMemiBoardI18n()

const authorProfileLink = computed(() => props.authorUid ? props.authorProfileTo?.(props.authorUid) : undefined)
const authorPostsLink = computed(() => props.authorUid ? props.authorPostsTo?.(props.authorUid) : undefined)
const authorCommentsLink = computed(() => props.authorUid ? props.authorCommentsTo?.(props.authorUid) : undefined)

// 다른 작성자에 대해 나만 보는 메모 — 로그인 안 했거나 내 글이면 메뉴 항목 자체를 숨긴다.
const { user } = useMemiBoardAuth()
const showMemo = computed(() => !!props.authorUid && !!user.value?.uid && user.value.uid !== props.authorUid)
const { text: memoText, sentiment: memoSentiment, loaded: memoLoaded, saving: memoSaving, error: memoError, load: loadMemo, save: saveMemo, remove: removeMemo } = useMemiBoardAuthorMemo(() => props.authorUid)
const memoOpen = ref(false)
const memoPendingSentiment = ref<'good' | 'bad' | null>(null)
// 모달에서 고치는 중인 텍스트 — 저장 전에는 이름 옆 표시·툴팁에 새지 않게 따로 둔다.
const memoDraft = ref('')

// 이름 옆 아이콘·툴팁으로 메모를 바로 보여줘야 해서 마운트 시 불러온다.
// 뷰어의 메모 전체를 쿼리 한 번으로 읽고 모든 인스턴스가 공유하므로 작성자 수만큼 읽지 않는다.
watch(showMemo, (show) => {
  if (show && !memoLoaded.value) void loadMemo()
}, { immediate: true })

watch(memoOpen, (open) => {
  if (open) memoDraft.value = memoText.value
})

const hasMemo = computed(() => showMemo.value && (!!memoText.value || !!memoSentiment.value))
// 메모가 있으면 아바타(없으면 버튼) 모서리에 평가 색 닷을 찍는다 — 좋음 primary, 나쁨 error, 평가 없음 neutral.
const memoChipColor = computed(() => memoSentiment.value === 'good' ? 'primary' as const : memoSentiment.value === 'bad' ? 'error' as const : 'neutral' as const)
const avatar = computed(() => props.showAvatar
  ? { src: props.authorPhoto ?? undefined, alt: props.authorName ?? t('common.label.anonymous'), chip: hasMemo.value ? { color: memoChipColor.value } : undefined }
  : undefined)
const tooltipText = computed(() => hasMemo.value && memoText.value ? memoText.value : t('authorMenu.menu'))

const fullName = computed(() => props.authorName?.trim() || t('common.label.anonymous'))

const items = computed(() => [
  // 이름이 줄어 보이는 자리가 많아서 메뉴 맨 위에 풀네임을 줄바꿈해 보여 준다.
  [{ type: 'label' as const, label: fullName.value, class: 'whitespace-normal break-words font-semibold text-highlighted' }],
  [
    { label: t('authorMenu.viewProfile'), icon: 'i-lucide-user-round', to: authorProfileLink.value, disabled: !authorProfileLink.value },
    { label: t('authorMenu.viewPosts'), icon: 'i-lucide-notebook-text', to: authorPostsLink.value, disabled: !authorPostsLink.value },
    { label: t('authorMenu.viewComments'), icon: 'i-lucide-message-square-text', to: authorCommentsLink.value, disabled: !authorCommentsLink.value },
  ],
  ...(showMemo.value
    ? [[{
        label: t('authorMenu.memoTitle'),
        icon: 'i-lucide-notebook-pen',
        slot: 'memo' as const,
        description: memoText.value || undefined,
        // 메모의 줄바꿈이 그대로 보이게 한다. 기본 설명은 한 줄로 말줄임된다.
        ui: { itemDescription: 'whitespace-pre-line break-words line-clamp-4 text-clip' },
        color: memoSentiment.value === 'good' ? 'primary' as const : memoSentiment.value === 'bad' ? 'error' as const : undefined,
        onSelect: () => { memoOpen.value = true },
      }]]
    : []),
])

async function onSaveMemo(sentiment: 'good' | 'bad') {
  memoPendingSentiment.value = sentiment
  try {
    await saveMemo(memoDraft.value, sentiment)
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
    class="flex items-center"
    :class="truncate ? 'w-full min-w-0 max-w-full justify-end' : ellipsis ? 'inline-flex min-w-0 max-w-full shrink' : 'inline-flex max-w-full'"
  >
    <UTooltip
      :text="tooltipText"
      :delay-duration="200"
      :content="{ side: 'top' }"
      :ui="{ text: 'block max-w-xs whitespace-pre-line break-words' }"
    >
      <span class="inline-flex max-w-full" :class="ellipsis && 'min-w-0'">
        <UChip
          :show="hasMemo && !showAvatar"
          :color="memoChipColor"
          class="max-w-full"
          :class="ellipsis && 'min-w-0 shrink'"
        >
          <UDropdownMenu :items="items" :content="{ align: 'start' }" :ui="{ content: 'max-w-xs' }">
            <UButton
              :avatar="avatar"
              :label="authorName ?? t('common.label.anonymous')"
              variant="ghost"
              color="neutral"
              size="xs"
              class="max-w-full"
              :aria-label="hasMemo ? `${authorName ?? t('common.label.anonymous')} — ${t('authorMenu.memoAriaLabel')}` : undefined"
              :ui="truncate || ellipsis
                ? { base: 'max-w-full' }
                : { base: 'max-w-full', label: 'whitespace-normal overflow-visible text-clip' }"
            />
            <template #memo-trailing>
              <UBadge
                v-if="memoSentiment"
                :label="memoSentiment === 'good' ? t('authorMenu.good') : t('authorMenu.bad')"
                :color="memoSentiment === 'good' ? 'primary' : 'error'"
                variant="subtle"
                size="sm"
                class="ms-auto shrink-0"
              />
            </template>
          </UDropdownMenu>
        </UChip>
      </span>
    </UTooltip>

    <UModal
      v-if="showMemo"
      v-model:open="memoOpen"
      :title="t('authorMenu.memoTitle')"
      :description="authorName ?? t('common.label.anonymous')"
    >
      <template #body>
        <UTextarea
          v-model="memoDraft"
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
          v-if="hasMemo"
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
