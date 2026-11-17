<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useMemiBoardI18n } from 'memi-board/runtime'

const { t } = useMemiBoardI18n()
const props = defineProps<{ level: 'low' | 'mid' | 'high' }>()

const ICONS = [
  'i-lucide-cat', 'i-lucide-dog', 'i-lucide-fish', 'i-lucide-bird',
  'i-lucide-apple', 'i-lucide-cherry', 'i-lucide-pizza', 'i-lucide-coffee',
  'i-lucide-sun', 'i-lucide-moon',
]
const pairs = props.level === 'low' ? 6 : props.level === 'high' ? 10 : 8
const columns = props.level === 'low' ? 3 : 4

interface Card { id: number, icon: string, flipped: boolean, matched: boolean }

function deal(): Card[] {
  const icons = ICONS.slice(0, pairs)
  const deck = [...icons, ...icons].map((icon, id) => ({ id, icon, flipped: false, matched: false }))
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j]!, deck[i]!]
  }
  return deck
}

const cards = ref<Card[]>(deal())
const moves = ref(0)
const picked = ref<number[]>([])
let timer: ReturnType<typeof setTimeout> | undefined
const cleared = computed(() => cards.value.every(card => card.matched))

function flip(index: number) {
  const card = cards.value[index]!
  if (card.flipped || card.matched || picked.value.length >= 2) return
  card.flipped = true
  picked.value.push(index)
  if (picked.value.length < 2) return
  moves.value++
  const [a, b] = picked.value.map(i => cards.value[i]!) as [Card, Card]
  if (a.icon === b.icon) {
    a.matched = b.matched = true
    picked.value = []
    return
  }
  timer = setTimeout(() => {
    a.flipped = b.flipped = false
    picked.value = []
  }, 700)
}

function restart() {
  clearTimeout(timer)
  cards.value = deal()
  moves.value = 0
  picked.value = []
}

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div class="mx-auto flex w-full max-w-xs flex-col gap-3">
    <div class="flex items-center justify-between text-sm">
      <span class="text-muted">{{ cleared ? t('waiting.memory.cleared', { count: moves }) : t('waiting.memory.moves', { count: moves }) }}</span>
      <UButton :label="t('waiting.restart')" icon="i-lucide-rotate-ccw" size="xs" color="neutral" variant="ghost" @click="restart" />
    </div>
    <div class="grid gap-2" :class="columns === 3 ? 'grid-cols-3' : 'grid-cols-4'">
      <button
        v-for="(card, index) in cards"
        :key="card.id"
        type="button"
        class="flex aspect-square cursor-pointer items-center justify-center rounded-lg border text-2xl transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        :class="card.matched ? 'border-primary/30 bg-primary/10 text-primary' : card.flipped ? 'border-primary bg-default text-primary' : 'border-default bg-elevated text-transparent hover:bg-accented'"
        :aria-label="card.flipped || card.matched ? card.icon.replace('i-lucide-', '') : '?'"
        @click="flip(index)"
      >
        <UIcon v-if="card.flipped || card.matched" :name="card.icon" class="size-6" />
      </button>
    </div>
  </div>
</template>
