<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMemiBoardI18n } from 'memi-board/runtime'

const { t } = useMemiBoardI18n()

const SIZE = 5
const CELLS = SIZE * SIZE

/** 칸 하나를 누르면 그 칸과 위·아래·좌·우 칸이 뒤집힌다. */
function press(board: boolean[], index: number) {
  const row = Math.floor(index / SIZE)
  const col = index % SIZE
  for (const [r, c] of [[row, col], [row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]] as const) {
    if (r >= 0 && r < SIZE && c >= 0 && c < SIZE) board[r * SIZE + c] = !board[r * SIZE + c]
  }
}

// 모두 꺼진 판에서 무작위로 눌러 만들면 항상 풀 수 있다. 이미 다 꺼진 판이 나오면 다시 만든다.
function newBoard(): boolean[] {
  for (;;) {
    const board = Array.from({ length: CELLS }, () => false)
    for (let i = 0; i < CELLS; i++) if (Math.random() < 0.4) press(board, i)
    if (board.some(Boolean)) return board
  }
}

const board = ref<boolean[]>(newBoard())
const moves = ref(0)
const solved = computed(() => !board.value.some(Boolean))

function toggle(index: number) {
  if (solved.value) return
  const next = [...board.value]
  press(next, index)
  board.value = next
  moves.value++
}

function restart() {
  board.value = newBoard()
  moves.value = 0
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-xs flex-col gap-3">
    <div class="flex items-center justify-between text-sm">
      <span class="text-muted">{{ solved ? t('waiting.lights.solved', { count: moves }) : t('waiting.lights.hint', { count: moves }) }}</span>
      <UButton :label="t(solved ? 'waiting.restart' : 'waiting.lights.shuffle')" icon="i-lucide-rotate-ccw" size="xs" color="neutral" variant="ghost" @click="restart" />
    </div>
    <div class="grid" :style="{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))`, gap: '0.375rem' }" role="grid" :aria-label="t('waiting.games.lights')">
      <button
        v-for="(on, index) in board"
        :key="index"
        type="button"
        role="gridcell"
        :aria-pressed="on"
        :aria-label="`${Math.floor(index / SIZE) + 1}-${(index % SIZE) + 1}`"
        class="aspect-square cursor-pointer rounded-lg border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        :class="on ? 'border-primary bg-primary text-inverted shadow-sm hover:bg-primary/90' : 'border-default bg-elevated hover:bg-accented'"
        @click="toggle(index)"
      />
    </div>
  </div>
</template>
