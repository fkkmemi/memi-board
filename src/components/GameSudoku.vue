<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useMemiBoardI18n } from 'memi-board/runtime'

const { t } = useMemiBoardI18n()

const REMOVED = 40

function shuffled<T>(items: T[]): T[] {
  const list = [...items]
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[list[i], list[j]] = [list[j]!, list[i]!]
  }
  return list
}

// 기본 패턴을 행·열 블록과 숫자 순서로 섞으면 항상 유효한 완성판이 나온다.
function generate(): { puzzle: number[], given: boolean[] } {
  const groups = [0, 1, 2]
  const order = () => shuffled(groups).flatMap(g => shuffled(groups).map(r => g * 3 + r))
  const rows = order()
  const cols = order()
  const digits = shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9])
  const solved = rows.flatMap(r => cols.map(c => digits[(3 * (r % 3) + Math.floor(r / 3) + c) % 9]!))
  const puzzle = [...solved]
  shuffled(Array.from({ length: 81 }, (_, i) => i)).slice(0, REMOVED).forEach((i) => { puzzle[i] = 0 })
  return { puzzle, given: puzzle.map(v => v !== 0) }
}

const initial = generate()
const cells = ref<number[]>(initial.puzzle)
const given = ref<boolean[]>(initial.given)
const selected = ref<number | null>(null)

const conflicts = computed(() => {
  const bad = new Set<number>()
  const v = cells.value
  for (let i = 0; i < 81; i++) {
    if (!v[i]) continue
    for (let j = i + 1; j < 81; j++) {
      if (v[j] !== v[i]) continue
      const sameRow = Math.floor(i / 9) === Math.floor(j / 9)
      const sameCol = i % 9 === j % 9
      const sameBox = Math.floor(i / 27) === Math.floor(j / 27) && Math.floor((i % 9) / 3) === Math.floor((j % 9) / 3)
      if (sameRow || sameCol || sameBox) { bad.add(i); bad.add(j) }
    }
  }
  return bad
})
const solved = computed(() => cells.value.every(v => v !== 0) && conflicts.value.size === 0)

function select(index: number) { selected.value = index }

function fill(value: number) {
  const index = selected.value
  if (index === null || given.value[index] || solved.value) return
  cells.value[index] = value
}

function restart() {
  const next = generate()
  cells.value = next.puzzle
  given.value = next.given
  selected.value = null
}

function onKey(event: KeyboardEvent) {
  if (/^[1-9]$/.test(event.key)) fill(Number(event.key))
  else if (event.key === 'Backspace' || event.key === 'Delete' || event.key === '0') fill(0)
  else if (selected.value !== null) {
    const i = selected.value
    const move: Record<string, number> = { ArrowUp: i >= 9 ? -9 : 0, ArrowDown: i < 72 ? 9 : 0, ArrowLeft: i % 9 ? -1 : 0, ArrowRight: i % 9 < 8 ? 1 : 0 }
    if (event.key in move) { event.preventDefault(); selected.value = i + move[event.key]! }
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

function related(index: number): boolean {
  const s = selected.value
  if (s === null) return false
  return Math.floor(s / 9) === Math.floor(index / 9) || s % 9 === index % 9
}
function cellClass(index: number) {
  const row = Math.floor(index / 9)
  const col = index % 9
  return [
    col % 3 === 0 && col ? 'border-s-2 border-s-accented' : '',
    row % 3 === 0 && row ? 'border-t-2 border-t-accented' : '',
    selected.value === index ? 'bg-primary/25' : related(index) ? 'bg-elevated' : '',
    conflicts.value.has(index) ? 'text-error' : given.value[index] ? 'font-semibold text-highlighted' : 'text-primary',
  ]
}
</script>

<template>
  <div class="mx-auto flex w-full flex-col gap-2" style="max-width: 16rem">
    <div class="flex items-center justify-between text-sm">
      <span class="text-muted">{{ solved ? t('waiting.sudoku.solved') : t('waiting.sudoku.hint') }}</span>
      <UButton :label="t('waiting.restart')" icon="i-lucide-rotate-ccw" size="xs" color="neutral" variant="ghost" @click="restart" />
    </div>
    <div class="grid overflow-hidden rounded-lg border-2 border-accented" style="grid-template-columns: repeat(9, minmax(0, 1fr))">
      <button
        v-for="(value, index) in cells"
        :key="index"
        type="button"
        class="flex aspect-square cursor-pointer items-center justify-center border border-default text-sm focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
        :class="cellClass(index)"
        @click="select(index)"
      >{{ value || '' }}</button>
    </div>
    <div class="grid gap-1" style="grid-template-columns: repeat(10, minmax(0, 1fr))">
      <UButton v-for="n in 9" :key="n" :label="String(n)" size="xs" color="neutral" variant="outline" class="justify-center px-0" @click="fill(n)" />
      <UButton icon="i-lucide-delete" size="xs" color="neutral" variant="outline" class="justify-center px-0" :aria-label="t('waiting.sudoku.erase')" @click="fill(0)" />
    </div>
  </div>
</template>
