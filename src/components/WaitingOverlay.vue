<script setup lang="ts">
import { ref, watch } from 'vue'
import { useMemiBoardI18n } from 'memi-board/runtime'
import MemiBoardWaitingGames from './WaitingGames.vue'
import MemiBoardAiThinking from './AiThinking.vue'

/**
 * 오래 걸리는 작업(글 번역, AI 작업 등) 동안 화면 모서리에 작은 카드로 진행 상황과 미니게임을 보여준다.
 * 화면 전체를 덮지 않아 뒤의 흐름을 보면서 기다릴 수 있고, 접어서 상태 줄만 남길 수도 있다.
 * 작업이 끝나면 호스트가 `open`을 false로 바꾸면 되고, 사용자가 직접 닫게 하려면 `closable`.
 * 작업 중에 뒤 화면을 건드리면 안 되는 경우(글 저장)는 `block`으로 보이지 않는 막을 친다.
 */
const props = defineProps<{
  open: boolean
  title?: string
  subtitle?: string
  closable?: boolean
  /** 작업이 끝난 상태. 자동으로 닫지 않고 사용자가 "계속하기"를 누를 때까지 게임을 그대로 둔다. */
  done?: boolean
  /** 작업 중에는 뒤 화면 클릭을 막는다(투명). 기본은 막지 않는다. */
  block?: boolean
  /** 진행 중 아이콘. 기본은 번역 아이콘 */
  icon?: string
}>()
const emit = defineEmits<{ close: [], continue: [] }>()

const { t, dir } = useMemiBoardI18n()

// 새 작업이 시작될 때마다 펼친 상태로 시작한다.
const collapsed = ref(false)
watch(() => props.open, (open) => {
  if (open) collapsed.value = false
})
</script>

<template>
  <Teleport to="body">
    <template v-if="open">
      <div
        v-if="block"
        class="fixed inset-0 z-[99] cursor-progress"
        aria-hidden="true"
      />
      <div
        class="memi-waiting-card pointer-events-auto fixed end-3 top-16 z-[100] flex w-[min(21rem,calc(100vw-1.5rem))] max-h-[calc(100dvh-5rem)] flex-col overflow-y-auto rounded-2xl border border-default bg-default/95 shadow-xl backdrop-blur-sm"
        :dir="dir"
        role="status"
        aria-live="polite"
      >
        <div class="flex items-center gap-3 px-3 py-2.5">
          <span class="flex size-8 shrink-0 items-center justify-center rounded-xl" :class="done ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'">
            <UIcon :name="done ? 'i-lucide-check' : (icon ?? 'i-lucide-languages')" class="size-4" :class="done ? '' : 'animate-pulse'" />
          </span>
          <div class="min-w-0 flex-1">
            <h2 class="truncate text-sm font-semibold text-highlighted">{{ done ? t('waiting.doneTitle') : (title ?? t('waiting.title')) }}</h2>
            <div v-if="!done" class="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-elevated">
              <div class="h-full w-1/3 animate-[waiting-slide_1.2s_ease-in-out_infinite] rounded-full bg-primary" />
            </div>
          </div>
          <UButton
            :icon="collapsed ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'"
            color="neutral"
            variant="ghost"
            size="xs"
            class="rounded-full"
            :aria-label="t(collapsed ? 'waiting.expand' : 'waiting.collapse')"
            :aria-expanded="!collapsed"
            @click="collapsed = !collapsed"
          />
          <UButton
            v-if="closable || done"
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="xs"
            class="rounded-full"
            :aria-label="t('waiting.close')"
            @click="done ? emit('continue') : emit('close')"
          />
        </div>
        <div v-show="!collapsed" class="flex flex-col gap-3 border-t border-default px-3 pb-3 pt-3">
          <MemiBoardAiThinking :done="done" :label="t(done ? 'waiting.thinkingDone' : 'waiting.thinking')" />
          <!-- 끝나도 자리는 그대로 둔다. 없애면 아래 게임이 위로 튀어 오른다. -->
          <p class="text-xs text-muted" :class="{ invisible: done }" :aria-hidden="done">{{ subtitle ?? t('waiting.subtitle') }}</p>
          <slot>
            <MemiBoardWaitingGames />
          </slot>
        </div>
      </div>
    </template>
  </Teleport>
</template>

<style>
/* 좁은 화면(폰)에서는 오른쪽에 붙이지 않고 가운데에 둔다. 좌우로 24px 이상 여백을 둬서 답답하지 않게 한다. */
@media (max-width: 639px) {
  .memi-waiting-card {
    inset-inline-start: 50%;
    inset-inline-end: auto;
    width: min(21rem, calc(100vw - 3rem));
    transform: translateX(-50%);
  }
  [dir='rtl'] .memi-waiting-card {
    transform: translateX(50%);
  }
}

@keyframes waiting-slide {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(300%); }
}
</style>
