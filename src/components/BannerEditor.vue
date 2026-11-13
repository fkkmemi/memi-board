<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { Cropper } from 'vue-advanced-cropper'
import 'vue-advanced-cropper/dist/style.css'
import { useMemiBoardBannerGeneration, useMemiBoardI18n } from 'memi-board/runtime'
import type { BoardBanner, BoardBannerKind } from 'memi-board/runtime'

const props = defineProps<{
  banner?: BoardBanner | null
  mobileBanner?: BoardBanner | null
  disabled?: boolean
  boardId: string
  title: string
  description?: string
}>()
const emit = defineEmits<{ change: [kind: BoardBannerKind, file: File | null], busy: [value: boolean] }>()
const { t, aiEnabled } = useMemiBoardI18n()
const { generateBanner } = useMemiBoardBannerGeneration()

/** Output size and crop ratio for each banner slot. */
const SLOTS: Record<BoardBannerKind, { width: number, height: number, aspect: string }> = {
  desktop: { width: 2400, height: 300, aspect: 'aspect-[8/1]' },
  mobile: { width: 1200, height: 400, aspect: 'aspect-[3/1]' },
}
const KINDS: BoardBannerKind[] = ['desktop', 'mobile']

const generating = ref<BoardBannerKind | null>(null)
const additionalRequest = ref('')
let disposed = false
const busy = computed(() => props.disabled || generating.value !== null)
const input = ref<HTMLInputElement | null>(null)
const cropper = ref<InstanceType<typeof Cropper> | null>(null)
const open = ref(false)
const activeKind = ref<BoardBannerKind>('desktop')
const source = ref('')
/** undefined = saved image, '' = removed, blob URL = staged image. */
const localPreview = reactive<Record<BoardBannerKind, string | undefined>>({ desktop: undefined, mobile: undefined })
const cropPreview = ref('')
const processing = ref(false)
const error = ref('')
const activeSlot = computed(() => SLOTS[activeKind.value])

function savedUrl(kind: BoardBannerKind) {
  return (kind === 'desktop' ? props.banner : props.mobileBanner)?.url ?? ''
}
function previewOf(kind: BoardBannerKind) {
  return localPreview[kind] ?? savedUrl(kind)
}

function releaseSource() {
  if (source.value) URL.revokeObjectURL(source.value)
  source.value = ''
  cropPreview.value = ''
}
function releasePreview(kind: BoardBannerKind) {
  const url = localPreview[kind]
  if (url) URL.revokeObjectURL(url)
  localPreview[kind] = undefined
}
watch(() => props.banner, () => releasePreview('desktop'))
watch(() => props.mobileBanner, () => releasePreview('mobile'))
watch(open, value => { if (!value) releaseSource() })
onBeforeUnmount(() => {
  disposed = true
  if (generating.value) emit('busy', false)
  releaseSource()
  KINDS.forEach(releasePreview)
})

function openCrop(kind: BoardBannerKind, blob: Blob) {
  releaseSource()
  activeKind.value = kind
  source.value = URL.createObjectURL(blob)
  open.value = true
}

async function generate(kind: BoardBannerKind) {
  if (busy.value || !aiEnabled.value) return
  error.value = ''
  if (!props.title.trim()) {
    error.value = t('settings.banner.titleRequired')
    return
  }
  const context = { boardId: props.boardId, title: props.title, description: props.description ?? '', additionalRequest: additionalRequest.value }
  generating.value = kind
  emit('busy', true)
  try {
    const blob = await generateBanner({ ...context, kind })
    if (disposed) return
    if (props.boardId !== context.boardId || props.title !== context.title || (props.description ?? '') !== context.description || additionalRequest.value !== context.additionalRequest) {
      throw new Error(t('settings.banner.contextChanged'))
    }
    openCrop(kind, blob)
  }
  catch (cause) {
    if (!disposed) {
      console.warn('[memi-board] banner generation failed', cause)
      error.value = cause instanceof Error && [t('settings.banner.noImage'), t('settings.banner.contextChanged')].includes(cause.message)
        ? cause.message : t('settings.banner.generateFailed')
    }
  }
  finally {
    generating.value = null
    if (!disposed) emit('busy', false)
  }
}

function pick(kind: BoardBannerKind) {
  activeKind.value = kind
  input.value?.click()
}

function select(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  target.value = ''
  if (!file) return
  error.value = ''
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 25 * 1024 * 1024) {
    error.value = t('settings.banner.invalid')
    return
  }
  openCrop(activeKind.value, file)
}

function updatePreview({ canvas }: { canvas?: HTMLCanvasElement | null }) {
  if (!canvas) return
  const { width, height } = activeSlot.value
  const thumbnail = document.createElement('canvas')
  thumbnail.width = width / 2.5
  thumbnail.height = height / 2.5
  thumbnail.getContext('2d')?.drawImage(canvas, 0, 0, thumbnail.width, thumbnail.height)
  cropPreview.value = thumbnail.toDataURL('image/jpeg', 0.8)
}

async function confirm() {
  if (processing.value || props.disabled) return
  const { canvas } = cropper.value?.getResult() ?? {}
  if (!canvas) return
  const kind = activeKind.value
  const { width, height } = SLOTS[kind]
  processing.value = true
  error.value = ''
  try {
    const output = document.createElement('canvas')
    output.width = width
    output.height = height
    const ctx = output.getContext('2d')
    if (!ctx) throw new Error('Canvas unavailable')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(canvas, 0, 0, width, height)
    const blob = await new Promise<Blob | null>(resolve => output.toBlob(resolve, 'image/jpeg', 0.9))
    if (!blob) throw new Error('Image encoding failed')
    const file = new File([blob], `banner-${kind}.jpg`, { type: 'image/jpeg' })
    releasePreview(kind)
    localPreview[kind] = URL.createObjectURL(file)
    emit('change', kind, file)
    open.value = false
  }
  catch {
    error.value = t('settings.banner.failed')
  }
  finally { processing.value = false }
}

function remove(kind: BoardBannerKind) {
  releasePreview(kind)
  localPreview[kind] = ''
  emit('change', kind, null)
}
</script>

<template>
  <section class="flex flex-col gap-4">
    <div>
      <p class="text-sm font-medium">{{ t('settings.banner.label') }}</p>
      <p class="mt-1 text-xs leading-relaxed text-muted">{{ t('settings.banner.help') }}</p>
    </div>
    <UFormField v-if="aiEnabled" :label="t('settings.banner.requestLabel')" :description="t('settings.banner.requestHelp')">
      <UTextarea
        v-model="additionalRequest"
        class="w-full"
        :placeholder="t('settings.banner.requestPlaceholder')"
        :disabled="busy"
        :maxlength="1000"
        :rows="3"
        :maxrows="5"
        autoresize
      />
    </UFormField>
    <input ref="input" type="file" accept="image/jpeg,image/png,image/webp" class="hidden" :disabled="busy" :aria-label="t('settings.banner.select')" @change="select">
    <div v-for="kind in KINDS" :key="kind" class="flex flex-col gap-2">
      <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <p class="text-sm font-medium">{{ t(`settings.banner.${kind}`) }}</p>
        <p class="text-xs text-muted">{{ t(`settings.banner.${kind}Help`) }}</p>
      </div>
      <div :class="kind === 'mobile' ? 'w-full max-w-sm' : 'w-full'">
        <img
          v-if="previewOf(kind)"
          :src="previewOf(kind)"
          :alt="t('settings.banner.preview')"
          :width="SLOTS[kind].width"
          :height="SLOTS[kind].height"
          class="w-full rounded-xl border border-default object-cover"
          :class="SLOTS[kind].aspect"
        >
        <div v-else class="flex items-center justify-center rounded-xl border border-dashed border-default bg-elevated/40" :class="SLOTS[kind].aspect" aria-hidden="true">
          <UIcon :name="kind === 'mobile' ? 'i-lucide-smartphone' : 'i-lucide-monitor'" class="size-6 text-dimmed" />
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <UButton icon="i-lucide-image-plus" color="neutral" variant="outline" size="sm" :disabled="busy" :label="t('settings.banner.select')" @click="pick(kind)" />
        <UButton v-if="aiEnabled" icon="i-lucide-sparkles" color="primary" variant="soft" size="sm" :loading="generating === kind" :disabled="busy || !title.trim()" :label="t('settings.banner.generate')" @click="generate(kind)" />
        <UButton v-if="previewOf(kind)" icon="i-lucide-trash-2" color="neutral" variant="ghost" size="sm" :disabled="busy" :label="t('settings.banner.remove')" @click="remove(kind)" />
      </div>
    </div>
    <p v-if="aiEnabled" class="text-xs text-muted">{{ generating ? t('settings.banner.generating') : t('settings.banner.generateHelp') }}</p>
    <p v-if="error" role="alert" class="text-sm text-error">{{ error }}</p>
    <UModal v-model:open="open" :title="`${t('settings.banner.crop')} · ${t(`settings.banner.${activeKind}`)}`" :description="t(`settings.banner.${activeKind}Help`)" :dismissible="!processing" :ui="{ content: 'sm:max-w-3xl' }">
      <template #body>
        <ClientOnly>
          <Cropper
            v-if="source && open"
            ref="cropper"
            :src="source"
            class="h-72 w-full overflow-hidden rounded-xl bg-muted sm:h-96"
            :stencil-props="{ aspectRatio: activeSlot.width / activeSlot.height }"
            :canvas="{ maxWidth: activeSlot.width, maxHeight: activeSlot.height }"
            image-restriction="stencil"
            @change="updatePreview"
            @error="error = t('settings.banner.failed')"
          />
        </ClientOnly>
        <div class="mt-3 flex justify-end gap-2">
          <UButton icon="i-lucide-zoom-out" color="neutral" variant="outline" :aria-label="t('settings.banner.zoomOut')" @click="cropper?.zoom(0.8)" />
          <UButton icon="i-lucide-zoom-in" color="neutral" variant="outline" :aria-label="t('settings.banner.zoomIn')" @click="cropper?.zoom(1.2)" />
        </div>
        <p v-if="error" role="alert" class="mt-3 text-sm text-error">{{ error }}</p>
        <p class="mb-2 mt-4 text-xs font-medium text-muted">{{ t('settings.banner.preview') }}</p>
        <img v-if="cropPreview" :src="cropPreview" :alt="t('settings.banner.preview')" class="w-full rounded-lg object-cover" :class="[activeSlot.aspect, activeKind === 'mobile' ? 'max-w-sm' : '']">
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" :disabled="processing" :label="t('common.action.cancel')" @click="open = false" />
          <UButton icon="i-lucide-check" :loading="processing" :disabled="!cropPreview || disabled" :label="t('settings.banner.confirm')" @click="confirm" />
        </div>
      </template>
    </UModal>
  </section>
</template>
