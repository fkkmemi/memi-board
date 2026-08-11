<script setup lang="ts">
/**
 * 글 상세 하단: 스와이프로 이전/다음 이동 가능 안내 (모바일만).
 * 닫으면 localStorage에 타임스탬프 저장 → 24시간 지나면 다시 표시.
 */
import { onMounted, ref } from 'vue'

const STORAGE_KEY = 'memi-board-post-swipe-hint-dismissed-at'
const DAY_MS = 24 * 60 * 60 * 1000

const allowed = ref(false)

onMounted(() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      allowed.value = true
      return
    }
    const dismissedAt = Number(raw)
    if (!Number.isFinite(dismissedAt) || Date.now() - dismissedAt >= DAY_MS) {
      allowed.value = true
    }
  }
  catch {
    allowed.value = true
  }
})

function dismiss() {
  allowed.value = false
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()))
  }
  catch {
    // private mode 등
  }
}
</script>

<template>
  <Transition
    enter-active-class="transition duration-250 ease-out"
    enter-from-class="translate-y-full opacity-0"
    enter-to-class="translate-y-0 opacity-100"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="translate-y-0 opacity-100"
    leave-to-class="translate-y-full opacity-0"
  >
    <!-- sm(640px) 미만 모바일만 — 데스크톱은 스와이프 안내 불필요 -->
    <div
      v-if="allowed"
      class="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden"
    >
      <div
        class="pointer-events-auto flex w-full max-w-lg items-start gap-3 rounded-xl border border-default bg-elevated/95 px-3 py-3 shadow-lg backdrop-blur-md"
        role="status"
      >
        <div class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-500/10 text-primary-500">
          <UIcon name="i-lucide-move-horizontal" class="size-5" />
        </div>
        <div class="min-w-0 flex-1 pt-0.5">
          <p class="text-sm font-medium text-highlighted">
            좌우로 스와이프해 보세요
          </p>
          <p class="mt-0.5 text-xs leading-relaxed text-muted">
            왼쪽으로 밀면 다음 글, 오른쪽으로 밀면 이전 글로 이동해요.
          </p>
        </div>
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          size="sm"
          square
          class="shrink-0"
          aria-label="닫기"
          @click="dismiss"
        />
      </div>
    </div>
  </Transition>
</template>
