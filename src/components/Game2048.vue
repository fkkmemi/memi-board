<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMemiBoardI18n } from 'memi-board/runtime'

/**
 * 2048. 같은 숫자를 밀어 합친다.
 * 방향키는 받지 않는다. 대기 카드 뒤에서 글을 쓰는 중에도 입력을 가져가지 않도록 버튼과 밀기로만 움직인다.
 * 난이도는 목표 숫자만 바꾼다. 하는 128, 중은 512, 상은 2048.
 */
const { t } = useMemiBoardI18n()
const props = defineProps<{ level: 'low' | 'mid' | 'high' }>()

const SIZE = 4
const CELLS = SIZE * SIZE
const GOAL = props.level === 'low' ? 128 : props.level === 'high' ? 2048 : 512
type Dir = 'left' | 'right' | 'up' | 'down'

function indexAt(dir: Dir, line: number, pos: number) {
  if (dir === 'left') return line * SIZE + pos
  if (dir === 'right') return line * SIZE + (SIZE - 1 - pos)
  if (dir === 'up') return pos * SIZE + line
  return (SIZE - 1 - pos) * SIZE + line
}

/** 한 줄은 벽 쪽으로 붙고, 같은 값끼리 한 번만 합쳐진다. */
function collapse(values: number[]) {
  const tiles = values.filter(Boolean)
  const merged: number[] = []
  let gained = 0
  for (let i = 0; i < tiles.length; i++) {
    if (i + 1 < tiles.length && tiles[i] === tiles[i + 1]) {
      const sum = tiles[i]! * 2
      merged.push(sum)
      gained += sum
      i++
    }
    else merged.push(tiles[i]!)
  }
  while (merged.length < SIZE) merged.push(0)
  return { merged, gained }
}

function emptyBoard() {
  return Array.from({ length: CELLS }, () => 0)
}

const board = ref<number[]>(emptyBoard())
const score = ref(0)
const won = ref(false)
const lost = ref(false)
let originX = 0
let originY = 0
let tracking = false

const over = computed(() => won.value || lost.value)
const status = computed(() => {
  if (won.value) return t('waiting.twenty48.won', { goal: GOAL, score: score.value })
  if (lost.value) return t('waiting.twenty48.lost', { score: score.value })
  return t('waiting.twenty48.hint', { goal: GOAL, score: score.value })
})

function spawn(into: number[]) {
  const empty: number[] = []
  into.forEach((value, index) => { if (!value) empty.push(index) })
  if (!empty.length) return
  into[empty[Math.floor(Math.random() * empty.length)]!] = Math.random() < 0.9 ? 2 : 4
}

function canMove(values: number[]) {
  if (values.some(value => !value)) return true
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const value = values[row * SIZE + col]!
      if (col + 1 < SIZE && value === values[row * SIZE + col + 1]) return true
      if (row + 1 < SIZE && value === values[(row + 1) * SIZE + col]) return true
    }
  }
  return false
}

function slide(dir: Dir) {
  if (over.value) return
  const next = board.value.slice()
  let gained = 0
  let changed = false
  for (let line = 0; line < SIZE; line++) {
    const values = Array.from({ length: SIZE }, (_, pos) => next[indexAt(dir, line, pos)]!)
    const { merged, gained: lineScore } = collapse(values)
    gained += lineScore
    merged.forEach((value, pos) => {
      const index = indexAt(dir, line, pos)
      if (next[index] !== value) changed = true
      next[index] = value
    })
  }
  if (!changed) return
  spawn(next)
  board.value = next
  score.value += gained
  if (next.some(value => value >= GOAL)) won.value = true
  else if (!canMove(next)) lost.value = true
}

function deal() {
  const next = emptyBoard()
  spawn(next)
  spawn(next)
  board.value = next
  score.value = 0
  won.value = false
  lost.value = false
}

deal()

function pointerDown(event: PointerEvent) {
  tracking = true
  originX = event.clientX
  originY = event.clientY
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function pointerUp(event: PointerEvent) {
  if (!tracking) return
  tracking = false
  const dx = event.clientX - originX
  const dy = event.clientY - originY
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return
  slide(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'))
}

function tileStyle(value: number) {
  const palette: Record<number, [string, string]> = {
    2: ['#eee4da', '#776e65'],
    4: ['#ede0c8', '#776e65'],
    8: ['#f2b179', '#f9f6f2'],
    16: ['#f59563', '#f9f6f2'],
    32: ['#f67c5f', '#f9f6f2'],
    64: ['#f65e3b', '#f9f6f2'],
    128: ['#edcf72', '#f9f6f2'],
    256: ['#edcc61', '#f9f6f2'],
    512: ['#edc850', '#f9f6f2'],
    1024: ['#edc53f', '#f9f6f2'],
    2048: ['#edc22e', '#f9f6f2'],
  }
  const colors = palette[value] ?? (value ? ['#3c3a32', '#f9f6f2'] : ['#cdc1b4', 'transparent'])
  return { background: colors[0], color: colors[1], fontSize: value >= 1024 ? '0.85rem' : value >= 128 ? '1rem' : '1.25rem' }
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-xs flex-col gap-3">
    <div
      class="grid touch-none gap-1.5 rounded-lg p-1.5 select-none"
      :style="{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))`, background: '#bbada0' }"
      role="grid"
      :aria-label="t('waiting.games.twenty48')"
      @pointerdown="pointerDown"
      @pointerup="pointerUp"
    >
      <div
        v-for="(value, index) in board"
        :key="index"
        role="gridcell"
        class="flex aspect-square items-center justify-center rounded-md font-bold tabular-nums"
        :style="tileStyle(value)"
      >{{ value || '' }}</div>
    </div>
    <div class="mx-auto grid w-36 grid-cols-3 gap-1">
      <span />
      <UButton icon="i-lucide-arrow-up" size="sm" color="neutral" variant="soft" class="justify-center" :aria-label="t('waiting.twenty48.up')" :disabled="over" @click="slide('up')" />
      <span />
      <UButton icon="i-lucide-arrow-left" size="sm" color="neutral" variant="soft" class="justify-center" :aria-label="t('waiting.twenty48.left')" :disabled="over" @click="slide('left')" />
      <UButton icon="i-lucide-arrow-down" size="sm" color="neutral" variant="soft" class="justify-center" :aria-label="t('waiting.twenty48.down')" :disabled="over" @click="slide('down')" />
      <UButton icon="i-lucide-arrow-right" size="sm" color="neutral" variant="soft" class="justify-center" :aria-label="t('waiting.twenty48.right')" :disabled="over" @click="slide('right')" />
    </div>
    <div class="flex items-center justify-between gap-2 text-sm">
      <span class="min-w-0 text-muted">{{ status }}</span>
      <UButton :label="t('waiting.restart')" icon="i-lucide-rotate-ccw" size="xs" color="neutral" variant="ghost" class="shrink-0" @click="deal" />
    </div>
  </div>
</template>
