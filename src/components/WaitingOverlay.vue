<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useMemiBoardI18n } from 'memi-board/runtime'
import MemiBoardWaitingGames from './WaitingGames.vue'
import MemiBoardAiThinking from './AiThinking.vue'

/**
 * 오래 걸리는 작업(글 번역, AI 작업 등) 동안 화면 모서리에 작은 카드로 진행 상황과 미니게임을 보여준다.
 * 화면 전체를 덮지 않아 뒤의 흐름을 보면서 기다릴 수 있고, 접어서 상태 줄만 남길 수도 있다.
 * 작업이 끝나면 호스트가 `open`을 false로 바꾸면 되고, 사용자가 직접 닫게 하려면 `closable`.
 * 닫기는 그냥 닫을 뿐이다(`close`). 닫는다고 다른 화면으로 넘어가지 않는다.
 * 작업 중에 뒤 화면을 건드리면 안 되는 경우(글 저장)는 `block`으로 보이지 않는 막을 친다.
 * 카드는 열린 모달과 함께 쓸 수 있다. 카드를 눌러도 모달이 "바깥 클릭"으로 닫히지 않게 pointerdown·focusin 을 여기서 멈춘다.
 */
const props = defineProps<{
  open: boolean
  title?: string
  subtitle?: string
  closable?: boolean
  /** 작업이 끝난 상태. 자동으로 닫지 않고 사용자가 닫을 때까지 게임을 그대로 둔다. */
  done?: boolean
  /** 작업 중에는 뒤 화면 클릭을 막는다(투명). 기본은 막지 않는다. */
  block?: boolean
  /** 진행 중 아이콘. 기본은 번역 아이콘 */
  icon?: string
}>()
const emit = defineEmits<{ close: [] }>()

const { t, dir } = useMemiBoardI18n()

// 새 작업이 시작될 때마다 펼친 상태로 시작한다.
const collapsed = ref(false)

// 모달이 열려 있으면 카드를 아래쪽 시작 모서리로 옮긴다. 모달은 가운데에 뜨고 닫기(X)는 위 끝, 버튼은 아래 끝에
// 있어서 아래 시작 모서리가 가장 덜 가린다. 카드가 떠 있는 동안 모달이 새로 열리면(AI 결과 확인, 배너 자르기 등)
// 카드를 접어 작은 아이콘 줄만 남긴다. 게임은 그대로 두고, 사용자가 다시 펼칠 수 있다.
const dialogOpen = ref(false)
const compact = computed(() => dialogOpen.value && collapsed.value)
let dialogObserver: MutationObserver | undefined
function hasDialog(node: Node) {
  return node instanceof Element && (node.matches('[role="dialog"]') || !!node.querySelector('[role="dialog"]'))
}
function anyDialog() {
  return !!document.querySelector('[role="dialog"]')
}
watch(() => props.open, (open) => {
  dialogObserver?.disconnect()
  dialogObserver = undefined
  if (!open) return
  collapsed.value = false
  if (typeof MutationObserver === 'undefined') return
  dialogOpen.value = anyDialog()
  dialogObserver = new MutationObserver((mutations) => {
    const added = mutations.some(m => Array.from(m.addedNodes).some(hasDialog))
    const removed = mutations.some(m => Array.from(m.removedNodes).some(hasDialog))
    if (!added && !removed) return
    dialogOpen.value = anyDialog()
    if (added) collapsed.value = true
  })
  dialogObserver.observe(document.body, { childList: true, subtree: true })
}, { immediate: true })
onBeforeUnmount(() => dialogObserver?.disconnect())
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
        class="memi-waiting-card pointer-events-auto fixed z-[100] flex max-h-[calc(100dvh-5rem)] flex-col overflow-y-auto rounded-2xl border border-default bg-default/95 shadow-xl backdrop-blur-sm"
        :class="[
          dialogOpen ? 'memi-waiting-card--docked bottom-3 start-3' : 'end-3 top-16',
          compact ? 'w-auto' : 'w-[min(21rem,calc(100vw-1.5rem))]',
        ]"
        :dir="dir"
        role="status"
        aria-live="polite"
        @pointerdown.stop
        @focusin.stop
      >
        <div class="flex items-center gap-3 px-3 py-2.5">
          <span class="flex size-8 shrink-0 items-center justify-center rounded-xl" :class="done ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'">
            <UIcon :name="done ? 'i-lucide-check' : (icon ?? 'i-lucide-languages')" class="size-4" :class="done ? '' : 'animate-pulse'" />
          </span>
          <div class="min-w-0 flex-1" :class="{ 'sr-only': compact }">
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
            @click="emit('close')"
          />
        </div>
        <div v-show="!collapsed" class="flex flex-col gap-3 border-t border-default px-3 pb-3 pt-3">
          <MemiBoardAiThinking :done="done" :label="t(done ? 'waiting.thinkingDone' : 'waiting.thinking')" />
          <!-- 끝나도 자리는 그대로 둔다. 없애면 아래 게임이 위로 튀어 오른다. -->
          <p class="text-xs text-muted" :class="{ invisible: done }" :aria-hidden="done">{{ subtitle ?? t('waiting.subtitle') }}</p>
          <slot>
            <MemiBoardWaitingGames />
          </slot>
          <UButton
            v-if="closable || done"
            :label="t('waiting.close')"
            color="neutral"
            variant="soft"
            block
            @click="emit('close')"
          />
        </div>
      </div>
    </template>
  </Teleport>
</template>

<style>
/* 좁은 화면(폰)에서는 오른쪽에 붙이지 않고 가운데에 둔다. 좌우로 24px 이상 여백을 둬서 답답하지 않게 한다.
   모달이 열려 아래 시작 모서리로 옮긴 카드(--docked)는 가운데로 보내지 않는다. */
@media (max-width: 639px) {
  .memi-waiting-card:not(.memi-waiting-card--docked) {
    inset-inline-start: 50%;
    inset-inline-end: auto;
    width: min(21rem, calc(100vw - 3rem));
    transform: translateX(-50%);
  }
  [dir='rtl'] .memi-waiting-card:not(.memi-waiting-card--docked) {
    transform: translateX(50%);
  }
}

@keyframes waiting-slide {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(300%); }
}
</style>
