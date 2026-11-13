<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useMemiBoardI18n } from 'memi-board/runtime'

const { t } = useMemiBoardI18n()

const SIZE = 15
const CELL = 20
const TICK_MS = 140

type Point = { x: number, y: number }
const DIRS = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } } as const
type Dir = keyof typeof DIRS

const canvas = ref<HTMLCanvasElement | null>(null)
const score = ref(0)
const best = ref(0)
const running = ref(false)
const over = ref(false)

let snake: Point[] = []
let food: Point = { x: 0, y: 0 }
let dir: Dir = 'right'
let queued: Dir | null = null
let timer: ReturnType<typeof setInterval> | undefined

function placeFood() {
  do food = { x: Math.floor(Math.random() * SIZE), y: Math.floor(Math.random() * SIZE) }
  while (snake.some(p => p.x === food.x && p.y === food.y))
}

function reset() {
  clearInterval(timer)
  snake = [{ x: 4, y: 7 }, { x: 3, y: 7 }, { x: 2, y: 7 }]
  dir = 'right'
  queued = null
  score.value = 0
  running.value = false
  over.value = false
  placeFood()
  draw()
}

function color(name: string, fallback: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

function draw() {
  const ctx = canvas.value?.getContext('2d')
  if (!ctx) return
  ctx.fillStyle = color('--ui-bg-elevated', '#f3f4f6')
  ctx.fillRect(0, 0, SIZE * CELL, SIZE * CELL)
  ctx.fillStyle = color('--ui-error', '#ef4444')
  ctx.beginPath()
  ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, CELL / 2 - 3, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = color('--ui-primary', '#22c55e')
  snake.forEach((p, i) => {
    ctx.globalAlpha = i === 0 ? 1 : 0.75
    ctx.fillRect(p.x * CELL + 1, p.y * CELL + 1, CELL - 2, CELL - 2)
  })
  ctx.globalAlpha = 1
}

function step() {
  if (queued) { dir = queued; queued = null }
  const d = DIRS[dir]
  const head = { x: snake[0]!.x + d.x, y: snake[0]!.y + d.y }
  const hitsSelf = snake.slice(0, -1).some(p => p.x === head.x && p.y === head.y)
  if (head.x < 0 || head.y < 0 || head.x >= SIZE || head.y >= SIZE || hitsSelf) {
    clearInterval(timer)
    running.value = false
    over.value = true
    return
  }
  snake.unshift(head)
  if (head.x === food.x && head.y === food.y) {
    score.value++
    best.value = Math.max(best.value, score.value)
    placeFood()
  }
  else snake.pop()
  draw()
}

function turn(next: Dir) {
  if (over.value) return
  const current = queued ?? dir
  // 정반대 방향으로는 꺾을 수 없다.
  if (DIRS[next].x === -DIRS[current].x && DIRS[next].y === -DIRS[current].y) return
  queued = next
  if (!running.value) {
    running.value = true
    timer = setInterval(step, TICK_MS)
  }
}

const KEYS: Record<string, Dir> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right',
}
function onKey(event: KeyboardEvent) {
  const next = KEYS[event.key]
  if (!next) return
  event.preventDefault()
  turn(next)
}

let touch: Point | null = null
function onTouchStart(event: TouchEvent) {
  const p = event.touches[0]
  if (p) touch = { x: p.clientX, y: p.clientY }
}
function onTouchEnd(event: TouchEvent) {
  const p = event.changedTouches[0]
  if (!touch || !p) return
  const dx = p.clientX - touch.x
  const dy = p.clientY - touch.y
  touch = null
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return
  turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'))
}

onMounted(() => {
  reset()
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  clearInterval(timer)
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div class="mx-auto flex w-full max-w-xs flex-col gap-3">
    <div class="flex items-center justify-between text-sm">
      <span class="text-muted">{{ t('waiting.snake.score', { score }) }} · {{ t('waiting.snake.best', { best }) }}</span>
      <UButton :label="t('waiting.restart')" icon="i-lucide-rotate-ccw" size="xs" color="neutral" variant="ghost" @click="reset" />
    </div>
    <div class="relative">
      <canvas
        ref="canvas"
        :width="SIZE * CELL"
        :height="SIZE * CELL"
        class="block w-full touch-none rounded-lg border border-default"
        @touchstart.passive="onTouchStart"
        @touchend.passive="onTouchEnd"
      />
      <div v-if="over || !running" class="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-default/60 text-sm font-medium text-highlighted">
        {{ over ? t('waiting.snake.gameOver') : t('waiting.snake.start') }}
      </div>
    </div>
    <div class="mx-auto grid grid-cols-3 gap-1.5">
      <span />
      <UButton icon="i-lucide-chevron-up" color="neutral" variant="outline" :aria-label="t('waiting.snake.up')" @click="turn('up')" />
      <span />
      <UButton icon="i-lucide-chevron-left" color="neutral" variant="outline" :aria-label="t('waiting.snake.left')" @click="turn('left')" />
      <UButton icon="i-lucide-chevron-down" color="neutral" variant="outline" :aria-label="t('waiting.snake.down')" @click="turn('down')" />
      <UButton icon="i-lucide-chevron-right" color="neutral" variant="outline" :aria-label="t('waiting.snake.right')" @click="turn('right')" />
    </div>
  </div>
</template>
