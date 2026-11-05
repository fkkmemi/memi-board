<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useMemiBoardI18n } from 'memi-board/runtime'

const open = defineModel<boolean>('open', { default: false })
const index = defineModel<number>('index', { default: 0 })

const props = defineProps<{
  images: string[]
}>()

const { t, dir } = useMemiBoardI18n()
const closeButton = ref<HTMLButtonElement | null>(null)
const src = computed(() => props.images[index.value] ?? '')
const multiple = computed(() => props.images.length > 1)

let locked = false
let touchX = 0
let touchTracking = false
let swiped = false

function setLocked(value: boolean) {
  if (typeof document === 'undefined') return
  if (value && !locked) {
    document.documentElement.style.overflow = 'hidden'
    locked = true
  }
  else if (!value && locked) {
    document.documentElement.style.overflow = ''
    locked = false
  }
}

function step(delta: number) {
  const total = props.images.length
  if (total < 2) return
  index.value = (index.value + delta + total) % total
}

function close() {
  open.value = false
}

function onKeydown(event: KeyboardEvent) {
  if (!open.value) return
  const forward = dir.value === 'rtl' ? 'ArrowLeft' : 'ArrowRight'
  const back = dir.value === 'rtl' ? 'ArrowRight' : 'ArrowLeft'
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
  }
  else if (event.key === forward) {
    event.preventDefault()
    step(1)
  }
  else if (event.key === back) {
    event.preventDefault()
    step(-1)
  }
}

function onTouchStart(event: TouchEvent) {
  if (event.touches.length !== 1) {
    touchTracking = false
    return
  }
  touchTracking = true
  touchX = event.touches[0]?.clientX ?? 0
}

function onTouchEnd(event: TouchEvent) {
  if (!touchTracking) return
  touchTracking = false
  const x = event.changedTouches[0]?.clientX
  if (x == null) return
  const dx = x - touchX
  if (Math.abs(dx) < 70) return
  swiped = true
  const forward = dir.value === 'rtl' ? dx > 0 : dx < 0
  step(forward ? 1 : -1)
}

function onBackdropClick(event: MouseEvent) {
  if (swiped) {
    swiped = false
    return
  }
  if (event.target === event.currentTarget) close()
}

watch(open, (value) => {
  setLocked(value)
  if (value) void nextTick(() => closeButton.value?.focus())
})

watch(() => props.images.length, (length) => {
  if (!open.value) return
  if (!length) {
    close()
    return
  }
  if (index.value >= length) index.value = length - 1
  if (index.value < 0) index.value = 0
})

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  setLocked(false)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open && src"
      role="dialog"
      aria-modal="true"
      :aria-label="t('common.label.image')"
      class="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-3 outline-none sm:p-6"
      @click="onBackdropClick"
      @touchstart.passive="onTouchStart"
      @touchend.passive="onTouchEnd"
    >
      <button
        ref="closeButton"
        type="button"
        class="absolute end-3 top-3 z-10 flex size-10 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
        :aria-label="t('common.action.close')"
        @click="close"
      >
        <UIcon name="i-lucide-x" class="size-5" />
      </button>

      <button
        v-if="multiple"
        type="button"
        class="absolute start-3 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
        :aria-label="t('common.action.prev')"
        @click="step(-1)"
      >
        <UIcon name="i-lucide-chevron-left" class="size-5 rtl:rotate-180" />
      </button>

      <img
        :key="src"
        :src="src"
        :alt="t('common.label.image')"
        class="max-h-full max-w-full object-contain select-none"
        draggable="false"
      >

      <button
        v-if="multiple"
        type="button"
        class="absolute end-3 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
        :aria-label="t('common.action.next')"
        @click="step(1)"
      >
        <UIcon name="i-lucide-chevron-right" class="size-5 rtl:rotate-180" />
      </button>

      <p
        v-if="multiple"
        class="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-sm tabular-nums text-white"
      >
        {{ index + 1 }} / {{ images.length }}
      </p>
    </div>
  </Teleport>
</template>
