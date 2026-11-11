<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useMemiBoardI18n } from 'memi-board/runtime'

const open = defineModel<boolean>('open', { default: false })
const index = defineModel<number>('index', { default: 0 })

const props = defineProps<{
  images: string[]
}>()

const { t, dir, formatNumber } = useMemiBoardI18n()
const closeButton = ref<HTMLButtonElement | null>(null)
const src = computed(() => props.images[index.value] ?? '')
const multiple = computed(() => props.images.length > 1)

const stage = ref<HTMLElement | null>(null)
const natural = ref({ width: 0, height: 0 })
const viewport = ref({ width: 0, height: 0 })
const zoom = ref(1)
const mode = ref<'fit' | 'manual'>('fit')
const fitScale = computed(() => natural.value.width && viewport.value.width
  ? Math.min(8, Math.max(1, viewport.value.width - 32) / natural.value.width, Math.max(1, viewport.value.height - 32) / natural.value.height)
  : 1)
const minScale = computed(() => Math.min(0.1, fitScale.value))
const scale = computed(() => mode.value === 'fit' ? fitScale.value : zoom.value)
const imageWidth = computed(() => Math.max(1, Math.round(natural.value.width * scale.value)))
const imageHeight = computed(() => Math.max(1, Math.round(natural.value.height * scale.value)))
const zoomLabel = computed(() => `${formatNumber(Math.round(scale.value * 100))}%`)
let resizeObserver: ResizeObserver | undefined
let pan: { x: number, y: number, left: number, top: number } | null = null
let dragged = false

watch(stage, (element) => {
  resizeObserver?.disconnect()
  if (!element) return
  const measure = () => { viewport.value = { width: element.clientWidth, height: element.clientHeight } }
  measure()
  resizeObserver = new ResizeObserver(measure)
  resizeObserver.observe(element)
}, { flush: 'post' })

function imageLoaded(event: Event) {
  const image = event.target as HTMLImageElement
  natural.value = { width: image.naturalWidth, height: image.naturalHeight }
}
async function setZoom(value: number) {
  const element = stage.value
  const centerX = element ? (element.scrollLeft + element.clientWidth / 2) / element.scrollWidth : 0.5
  const centerY = element ? (element.scrollTop + element.clientHeight / 2) / element.scrollHeight : 0.5
  zoom.value = Math.max(minScale.value, Math.min(8, value))
  mode.value = 'manual'
  await nextTick()
  if (element) {
    element.scrollLeft = centerX * element.scrollWidth - element.clientWidth / 2
    element.scrollTop = centerY * element.scrollHeight - element.clientHeight / 2
  }
}
function fitImage() {
  mode.value = 'fit'
  if (stage.value) { stage.value.scrollLeft = 0; stage.value.scrollTop = 0 }
}
function panStart(event: PointerEvent) {
  if (event.pointerType !== 'mouse' || event.button !== 0 || !stage.value || scale.value <= fitScale.value) return
  pan = { x: event.clientX, y: event.clientY, left: stage.value.scrollLeft, top: stage.value.scrollTop }
  dragged = false
  event.preventDefault()
}
function panMove(event: PointerEvent) {
  if (!pan || !stage.value) return
  const dx = event.clientX - pan.x, dy = event.clientY - pan.y
  if (Math.abs(dx) + Math.abs(dy) > 5) {
    dragged = true
    if (!stage.value.hasPointerCapture(event.pointerId)) stage.value.setPointerCapture(event.pointerId)
  }
  stage.value.scrollLeft = pan.left - dx
  stage.value.scrollTop = pan.top - dy
}
function panEnd() { pan = null }
watch(src, () => { natural.value = { width: 0, height: 0 }; fitImage() })

let returnFocus: HTMLElement | null = null
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
  if (event.key === 'Tab') {
    const dialog = closeButton.value?.closest('[role="dialog"]')
    const buttons = dialog ? Array.from(dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')) : []
    const first = buttons[0], last = buttons.at(-1)
    if (first && last && event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (first && last && !event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    return
  }
  const forward = dir.value === 'rtl' ? 'ArrowLeft' : 'ArrowRight'
  const back = dir.value === 'rtl' ? 'ArrowRight' : 'ArrowLeft'
  if (event.key === '+' || event.key === '=') { event.preventDefault(); void setZoom(scale.value * 1.25) }
  else if (event.key === '-') { event.preventDefault(); void setZoom(scale.value / 1.25) }
  else if (event.key === '0') { event.preventDefault(); void setZoom(1) }
  else if (event.key.toLowerCase() === 'f') { event.preventDefault(); fitImage() }
  else if (event.key === 'Escape') {
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
  if (event.touches.length !== 1 || scale.value > fitScale.value * 1.01) {
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
  if (dragged) { dragged = false; return }
  if (swiped) {
    swiped = false
    return
  }
  if (event.target === event.currentTarget || (event.target as HTMLElement).dataset.imageCanvas != null) close()
}

watch(open, (value) => {
  setLocked(value)
  if (value) { returnFocus = document.activeElement as HTMLElement | null; natural.value = { width: 0, height: 0 }; fitImage() }
  if (value) void nextTick(() => closeButton.value?.focus())
  else void nextTick(() => { if (returnFocus?.isConnected) returnFocus.focus() })
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
  resizeObserver?.disconnect()
  window.removeEventListener('keydown', onKeydown)
  setLocked(false)
})
</script>

<template>
  <Teleport to="body">
    <div v-if="open && src" role="dialog" aria-modal="true" :aria-label="t('common.label.image')"
      class="fixed inset-0 z-[80] flex flex-col bg-black/90 text-white outline-none">
      <div class="flex shrink-0 items-start gap-1 p-2">
      <div class="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-1" role="toolbar" :aria-label="t('common.label.imageControls')">
        <UTooltip :text="t('common.action.zoomOut')" :ui="{ content: 'z-[90]' }">
          <button type="button" :aria-label="t('common.action.zoomOut')" :disabled="!natural.width || scale <= minScale" class="flex size-10 items-center justify-center rounded-full hover:bg-white/15 disabled:opacity-30" @click="setZoom(scale / 1.25)"><UIcon name="i-lucide-minus" class="size-5" /></button>
        </UTooltip>
        <output class="min-w-14 text-center text-sm tabular-nums" aria-live="polite">{{ zoomLabel }}</output>
        <UTooltip :text="t('common.action.zoomIn')" :ui="{ content: 'z-[90]' }">
          <button type="button" :aria-label="t('common.action.zoomIn')" :disabled="!natural.width || scale >= 8" class="flex size-10 items-center justify-center rounded-full hover:bg-white/15 disabled:opacity-30" @click="setZoom(scale * 1.25)"><UIcon name="i-lucide-plus" class="size-5" /></button>
        </UTooltip>
        <UTooltip :text="t('common.action.fitImage')" :ui="{ content: 'z-[90]' }">
          <button type="button" :aria-label="t('common.action.fitImage')" :aria-pressed="mode === 'fit'" class="flex size-10 items-center justify-center rounded-full hover:bg-white/15" @click="fitImage"><UIcon name="i-lucide-scan" class="size-5" /></button>
        </UTooltip>
        <UTooltip :text="t('common.action.originalImage')" :ui="{ content: 'z-[90]' }">
          <button type="button" :aria-label="t('common.action.originalImage')" class="h-10 rounded-full px-3 text-sm hover:bg-white/15" @click="setZoom(1)">100%</button>
        </UTooltip>
      </div>
      <UTooltip :text="t('common.action.close')" :ui="{ content: 'z-[90]' }">
        <button ref="closeButton" type="button" class="flex size-10 shrink-0 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80" :aria-label="t('common.action.close')" @click="close"><UIcon name="i-lucide-x" class="size-5" /></button>
      </UTooltip>
      </div>
      <div ref="stage" role="region" tabindex="0" :aria-label="t('common.label.image')" class="min-h-0 flex-1 overflow-auto overscroll-contain outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70" dir="ltr"
        :class="scale > fitScale ? 'cursor-grab active:cursor-grabbing' : ''"
        @click="onBackdropClick" @pointerdown="panStart" @pointermove="panMove" @pointerup="panEnd" @pointercancel="panEnd"
        @touchstart.passive="onTouchStart" @touchend.passive="onTouchEnd">
        <div data-image-canvas class="flex min-h-full min-w-full items-center justify-center p-4"
          :style="{ width: `${imageWidth + 32}px`, height: `${imageHeight + 32}px` }">
          <img :key="src" :src="src" :alt="t('common.label.image')" draggable="false"
            class="shrink-0 select-none" :class="natural.width ? '' : 'invisible'"
            :style="{ width: `${imageWidth}px`, height: `${imageHeight}px`, maxWidth: 'none', maxHeight: 'none' }" @load="imageLoaded">
        </div>
      </div>
      <UTooltip v-if="multiple" :text="t('common.action.prev')" :ui="{ content: 'z-[90]' }">
        <button type="button" class="absolute start-3 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80" :aria-label="t('common.action.prev')" @click="step(-1)"><UIcon name="i-lucide-chevron-left" class="size-5 rtl:rotate-180" /></button>
      </UTooltip>
      <UTooltip v-if="multiple" :text="t('common.action.next')" :ui="{ content: 'z-[90]' }">
        <button type="button" class="absolute end-3 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80" :aria-label="t('common.action.next')" @click="step(1)"><UIcon name="i-lucide-chevron-right" class="size-5 rtl:rotate-180" /></button>
      </UTooltip>
      <p v-if="multiple" class="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-sm tabular-nums text-white">{{ index + 1 }} / {{ images.length }}</p>
    </div>
  </Teleport>
</template>
