<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import { useMemiBoardI18n } from 'memi-board/runtime'
import MemiBoardWaitingGames from './WaitingGames.vue'

/**
 * 오래 걸리는 작업(글 번역 등) 동안 화면 전체를 덮고 미니게임을 보여준다.
 * 작업이 끝나면 호스트가 `open`을 false로 바꾸면 되고, 시험용 등으로 사용자가 직접 닫게 하려면 `closable`.
 */
const props = defineProps<{
  open: boolean
  title?: string
  subtitle?: string
  closable?: boolean
  /** 작업이 끝난 상태. 자동으로 닫지 않고 사용자가 "계속하기"를 누를 때까지 게임을 그대로 둔다. */
  done?: boolean
  /** 저장된 글이 아직 미게시(초안)다. 끝난 안내를 "올라갔다" 대신 "미리보기에서 게시하라"로 바꾼다. */
  draft?: boolean
}>()
const emit = defineEmits<{ close: [], continue: [] }>()

const { t, dir } = useMemiBoardI18n()

// 오버레이가 떠 있는 동안 뒤 페이지 스크롤을 잠근다.
watch(() => props.open, (open) => {
  if (typeof document === 'undefined') return
  document.body.style.overflow = open ? 'hidden' : ''
})
onBeforeUnmount(() => {
  if (typeof document !== 'undefined') document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[100] flex flex-col overflow-y-auto bg-default/95 backdrop-blur-sm"
      :dir="dir"
      role="alertdialog"
      aria-modal="true"
      aria-live="polite"
    >
      <div class="relative mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-5 py-10">
        <UButton
          v-if="closable"
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          class="absolute end-3 top-3 rounded-full"
          :aria-label="t('waiting.close')"
          @click="emit('close')"
        />
        <header class="flex flex-col items-center gap-3 pt-6 text-center">
          <span class="flex size-12 items-center justify-center rounded-2xl" :class="done ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'">
            <UIcon :name="done ? 'i-lucide-check' : 'i-lucide-languages'" class="size-6" :class="done ? '' : 'animate-pulse'" />
          </span>
          <h2 class="text-xl font-semibold tracking-tight text-highlighted">{{ done ? t(draft ? 'waiting.draftDoneTitle' : 'waiting.doneTitle') : (title ?? t('waiting.title')) }}</h2>
          <p class="text-sm text-muted">{{ done ? t(draft ? 'waiting.draftDoneSubtitle' : 'waiting.doneSubtitle') : (subtitle ?? t('waiting.subtitle')) }}</p>
          <UButton v-if="done" :label="t(draft ? 'waiting.draftContinue' : 'waiting.continue')" trailing-icon="i-lucide-arrow-right" size="lg" @click="emit('continue')" />
          <div v-else class="h-1 w-40 overflow-hidden rounded-full bg-elevated">
            <div class="h-full w-1/3 animate-[waiting-slide_1.2s_ease-in-out_infinite] rounded-full bg-primary" />
          </div>
        </header>
        <slot>
          <MemiBoardWaitingGames />
        </slot>
      </div>
    </div>
  </Teleport>
</template>

<style>
@keyframes waiting-slide {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(300%); }
}
</style>
