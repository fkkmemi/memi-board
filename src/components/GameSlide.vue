<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMemiBoardI18n } from 'memi-board/runtime'

const { t } = useMemiBoardI18n()

const SIZE = 3
const CELLS = SIZE * SIZE
/** 0 은 빈칸. */
const SOLVED = Array.from({ length: CELLS }, (_, i) => (i + 1) % CELLS)

function neighbours(index: number): number[] {
  const row = Math.floor(index / SIZE)
  const col = index % SIZE
  const result: number[] = []
  if (row > 0) result.push(index - SIZE)
  if (row < SIZE - 1) result.push(index + SIZE)
  if (col > 0) result.push(index - 1)
  if (col < SIZE - 1) result.push(index + 1)
  return result
}

// 완성된 판에서 빈칸을 무작위로 움직여 섞으면 항상 풀 수 있다. 직전 자리로 되돌아가지는 않는다.
function shuffled(): number[] {
  for (;;) {
    const board = [...SOLVED]
    let blank = board.indexOf(0)
    let previous = -1
    for (let step = 0; step < 80; step++) {
      const options = neighbours(blank).filter(index => index !== previous)
      const next = options[Math.floor(Math.random() * options.length)]!
      board[blank] = board[next]!
      board[next] = 0
      previous = blank
      blank = next
    }
    if (board.some((value, index) => value !== SOLVED[index])) return board
  }
}

const board = ref<number[]>(shuffled())
const moves = ref(0)
const solved = computed(() => board.value.every((value, index) => value === SOLVED[index]))

function move(index: number) {
  if (solved.value) return
  const blank = board.value.indexOf(0)
  if (!neighbours(blank).includes(index)) return
  const next = [...board.value]
  next[blank] = next[index]!
  next[index] = 0
  board.value = next
  moves.value++
}

function restart() {
  board.value = shuffled()
  moves.value = 0
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-xs flex-col gap-3">
    <div class="flex items-center justify-between text-sm">
      <span class="text-muted">{{ solved ? t('waiting.slide.solved', { count: moves }) : t('waiting.slide.hint', { count: moves }) }}</span>
      <UButton :label="t(solved ? 'waiting.restart' : 'waiting.slide.shuffle')" icon="i-lucide-rotate-ccw" size="xs" color="neutral" variant="ghost" @click="restart" />
    </div>
    <div class="grid" :style="{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))`, gap: '0.375rem' }" role="grid" :aria-label="t('waiting.games.slide')">
      <template v-for="(value, index) in board" :key="index">
        <button
          v-if="value"
          type="button"
          role="gridcell"
          class="aspect-square cursor-pointer rounded-lg border text-xl font-semibold tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          :class="value === SOLVED[index] ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/20' : 'border-default bg-elevated text-highlighted hover:bg-accented'"
          :aria-label="String(value)"
          @click="move(index)"
        >
          {{ value }}
        </button>
        <div v-else class="aspect-square rounded-lg border border-dashed border-default" role="gridcell" aria-hidden="true" />
      </template>
    </div>
  </div>
</template>
