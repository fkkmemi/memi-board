<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useMemiBoardI18n } from 'memi-board/runtime'

/**
 * 15×15 오목. 이용자가 흑이고 간단한 상대가 백이다.
 * 돌은 칸 안이 아니라 선이 만나는 교차점에 둔다.
 * 가로·세로·대각선으로 다섯 칸 이상이면 이긴다. 렌주 금지(쌍삼·장목)는 없다.
 * 마우스로만 둔다. 대기 카드 뒤에서 글을 쓰는 중에도 키 입력을 가져가지 않는다.
 */
const { t } = useMemiBoardI18n()
const props = defineProps<{ level: 'low' | 'mid' | 'high' }>()

const SIZE = 15
const CELLS = SIZE * SIZE
const EMPTY = 0
const USER = 1
const AI = 2
const WIN = 5
const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]] as const
const STARS = new Set([3, 7, 11].flatMap(row => [3, 7, 11].map(col => row * SIZE + col)))

function inBounds(row: number, col: number) {
  return row >= 0 && row < SIZE && col >= 0 && col < SIZE
}

/** 그 칸에 둔 돌이 포함된, 다섯 칸 이상인 줄. 없으면 빈 배열. */
function winningLine(board: number[], index: number, player: number): number[] {
  const row = Math.floor(index / SIZE)
  const col = index % SIZE
  for (const [dr, dc] of DIRS) {
    const cells = [index]
    for (const sign of [1, -1] as const) {
      let r = row + dr * sign
      let c = col + dc * sign
      while (inBounds(r, c) && board[r * SIZE + c] === player) {
        cells.push(r * SIZE + c)
        r += dr * sign
        c += dc * sign
      }
    }
    if (cells.length >= WIN) return cells
  }
  return []
}

/** 돌 근처의 빈칸. 멀리 빈 판만 남으면 그 빈칸을 쓴다. */
function candidates(board: number[]): number[] {
  const near = new Set<number>()
  let stones = 0
  for (let i = 0; i < CELLS; i++) {
    if (!board[i]) continue
    stones++
    const row = Math.floor(i / SIZE)
    const col = i % SIZE
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const r = row + dr
        const c = col + dc
        if (!inBounds(r, c)) continue
        const j = r * SIZE + c
        if (!board[j]) near.add(j)
      }
    }
  }
  if (near.size) return [...near]
  if (!stones) return [Math.floor(CELLS / 2)]
  const empty: number[] = []
  for (let i = 0; i < CELLS; i++) if (!board[i]) empty.push(i)
  return empty
}

/** 그 빈칸에 둔다고 가정한 연결 점수. 판은 바꾸지 않는다. */
function directionScore(board: number[], index: number, player: number) {
  const row = Math.floor(index / SIZE)
  const col = index % SIZE
  let score = 0
  for (const [dr, dc] of DIRS) {
    let count = 1
    let open = 0
    for (const sign of [1, -1] as const) {
      let r = row + dr * sign
      let c = col + dc * sign
      while (inBounds(r, c) && board[r * SIZE + c] === player) {
        count++
        r += dr * sign
        c += dc * sign
      }
      if (inBounds(r, c) && board[r * SIZE + c] === EMPTY) open++
    }
    if (count >= 5) score += 100_000
    else if (count === 4 && open === 2) score += 12_000
    else if (count === 4 && open === 1) score += 1_500
    else if (count === 3 && open === 2) score += 800
    else if (count === 3 && open === 1) score += 120
    else if (count === 2 && open === 2) score += 40
    else if (count === 2 && open === 1) score += 8
    else score += open
  }
  return score
}

function chooseAi(source: number[], level: 'low' | 'mid' | 'high'): number {
  const board = source.slice()
  const spots = candidates(board)
  for (const index of spots) {
    board[index] = AI
    const win = winningLine(board, index, AI).length > 0
    board[index] = EMPTY
    if (win) return index
  }
  const blocks: number[] = []
  for (const index of spots) {
    board[index] = USER
    if (winningLine(board, index, USER).length) blocks.push(index)
    board[index] = EMPTY
  }
  // 하는 다섯 칸을 자주 놓친다. 중은 그 수만 막고, 상은 모양까지 읽는다.
  if (level === 'low') {
    if (blocks.length && Math.random() < 0.4) return blocks[Math.floor(Math.random() * blocks.length)]!
    return spots[Math.floor(Math.random() * spots.length)] ?? -1
  }
  if (level === 'mid' && blocks.length) return blocks[Math.floor(Math.random() * blocks.length)]!
  const pool = level === 'high' && blocks.length ? blocks : spots
  let best = pool[0] ?? -1
  let bestScore = -Infinity
  const center = (SIZE - 1) / 2
  const defenseWeight = level === 'high' ? 1.15 : 0.35
  const noise = level === 'high' ? 0.25 : 400
  for (const index of pool) {
    const row = Math.floor(index / SIZE)
    const col = index % SIZE
    const attack = directionScore(board, index, AI)
    const defense = directionScore(board, index, USER)
    const dist = Math.abs(row - center) + Math.abs(col - center)
    const score = attack + defense * defenseWeight - dist * 0.35 + Math.random() * noise
    if (score > bestScore) {
      bestScore = score
      best = index
    }
  }
  return best
}

const board = ref<number[]>(Array.from({ length: CELLS }, () => EMPTY))
const winner = ref<0 | typeof USER | typeof AI>(0)
const draw = ref(false)
const thinking = ref(false)
const last = ref<number | null>(null)
const winCells = ref<number[]>([])
const hover = ref<number | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined
let round = 0

const over = computed(() => winner.value !== 0 || draw.value)
const status = computed(() => {
  if (winner.value === USER) return t('waiting.gomoku.youWin')
  if (winner.value === AI) return t('waiting.gomoku.aiWin')
  if (draw.value) return t('waiting.gomoku.draw')
  if (thinking.value) return t('waiting.gomoku.thinking')
  return t('waiting.gomoku.hint')
})

function canPlay(index: number) {
  return !over.value && !thinking.value && !board.value[index]
}

function finish(index: number, player: typeof USER | typeof AI) {
  const line = winningLine(board.value, index, player)
  if (line.length) {
    winner.value = player
    winCells.value = line
    return true
  }
  if (board.value.every(Boolean)) {
    draw.value = true
    return true
  }
  return false
}

function playAi() {
  const index = chooseAi(board.value, props.level)
  if (index < 0 || board.value[index]) {
    thinking.value = false
    draw.value = true
    return
  }
  const next = board.value.slice()
  next[index] = AI
  board.value = next
  last.value = index
  thinking.value = false
  finish(index, AI)
}

function place(index: number) {
  if (!canPlay(index)) return
  const ticket = ++round
  const next = board.value.slice()
  next[index] = USER
  board.value = next
  last.value = index
  hover.value = null
  if (finish(index, USER)) return
  thinking.value = true
  timer = setTimeout(() => {
    if (ticket !== round) return
    playAi()
  }, 280)
}

function restart() {
  round++
  clearTimeout(timer)
  board.value = Array.from({ length: CELLS }, () => EMPTY)
  winner.value = 0
  draw.value = false
  thinking.value = false
  last.value = null
  winCells.value = []
  hover.value = null
}

const LINE = '#6b4423'
/** 칸 가운데를 지나는 15개의 가로·세로선. 돌은 그 교차점에 올린다. */
const linesStyle = {
  backgroundColor: '#f3d7a4',
  backgroundImage: [
    `linear-gradient(to right, transparent calc(50% - 0.5px), ${LINE} calc(50% - 0.5px), ${LINE} calc(50% + 0.5px), transparent calc(50% + 0.5px))`,
    `linear-gradient(to bottom, transparent calc(50% - 0.5px), ${LINE} calc(50% - 0.5px), ${LINE} calc(50% + 0.5px), transparent calc(50% + 0.5px))`,
  ].join(', '),
  backgroundSize: `calc(100% / ${SIZE}) 100%, 100% calc(100% / ${SIZE})`,
}

/** 교차점을 가운데로 하는 클릭 영역. */
function pointBox(index: number) {
  const row = Math.floor(index / SIZE)
  const col = index % SIZE
  const unit = 100 / SIZE
  return {
    left: `${(col + 0.5) * unit}%`,
    top: `${(row + 0.5) * unit}%`,
    width: `${unit}%`,
    height: `${unit}%`,
    transform: 'translate(-50%, -50%)',
    padding: '0',
    border: '0',
    background: 'transparent',
    minWidth: '0',
    minHeight: '0',
  }
}

function stoneStyle(index: number) {
  const preview = hover.value === index && canPlay(index)
  const player = preview ? USER : board.value[index]
  const white = player !== USER
  return {
    width: '86%',
    height: '86%',
    background: white ? '#fff' : '#171717',
    boxShadow: white ? '0 0 0 1px rgba(0,0,0,.35), 0 1px 1px rgba(0,0,0,.25)' : '0 1px 1px rgba(0,0,0,.45)',
    opacity: preview ? '0.45' : '1',
    outline: winCells.value.includes(index) ? '2px solid var(--ui-primary)' : 'none',
    outlineOffset: '1px',
  }
}

onBeforeUnmount(() => {
  round++
  clearTimeout(timer)
})
</script>

<template>
  <div class="mx-auto flex w-full flex-col gap-3">
    <div
      class="relative w-full select-none overflow-hidden rounded-md"
      style="aspect-ratio: 1 / 1"
      role="grid"
      :aria-label="t('waiting.games.gomoku')"
    >
      <div class="absolute inset-0" :style="linesStyle" />
      <button
        v-for="(cell, index) in board"
        :key="index"
        type="button"
        role="gridcell"
        tabindex="-1"
        class="absolute touch-manipulation p-0 focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-primary"
        :class="canPlay(index) ? 'cursor-pointer' : 'cursor-default'"
        :style="pointBox(index)"
        :aria-label="`${Math.floor(index / SIZE) + 1}-${(index % SIZE) + 1}`"
        @pointerenter="hover = canPlay(index) ? index : null"
        @pointerleave="hover = null"
        @click="place(index)"
      >
        <span
          v-if="!cell && hover !== index && STARS.has(index)"
          class="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style="width: 22%; height: 22%; background: #6b4423"
        />
        <span
          v-if="cell || (hover === index && canPlay(index))"
          class="pointer-events-none absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full"
          :style="stoneStyle(index)"
        />
        <span
          v-if="cell && last === index"
          class="pointer-events-none absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary"
          style="width: 22%; height: 22%"
        />
      </button>
    </div>
    <div class="flex items-center justify-between gap-2 text-sm">
      <span class="min-w-0 text-muted">{{ status }}</span>
      <UButton :label="t('waiting.restart')" icon="i-lucide-rotate-ccw" size="xs" color="neutral" variant="ghost" class="shrink-0" @click="restart" />
    </div>
  </div>
</template>
