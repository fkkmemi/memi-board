<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Cropper } from 'vue-advanced-cropper'
import 'vue-advanced-cropper/dist/style.css'
import { useMemiBoardBannerGeneration, useMemiBoardI18n } from 'memi-board/runtime'
import type { BoardBanner } from 'memi-board/runtime'

const props = defineProps<{ banner?: BoardBanner | null, disabled?: boolean, boardId: string, title: string, description?: string }>()
const emit = defineEmits<{ change: [file: File | null], busy: [value: boolean] }>()
const { t, aiEnabled } = useMemiBoardI18n()
const { generateBanner } = useMemiBoardBannerGeneration()
const generating = ref(false)
const additionalRequest = ref('')
let disposed = false
const busy = computed(() => props.disabled || generating.value)
const input = ref<HTMLInputElement | null>(null)
const cropper = ref<InstanceType<typeof Cropper> | null>(null)
const open = ref(false)
const source = ref('')
const localPreview = ref<string | null>(null)
const cropPreview = ref('')
const processing = ref(false)
const error = ref('')
const preview = computed(() => localPreview.value ?? props.banner?.url ?? '')

function releaseSource() {
  if (source.value) URL.revokeObjectURL(source.value)
  source.value = ''
  cropPreview.value = ''
}
function releasePreview() {
  if (localPreview.value) URL.revokeObjectURL(localPreview.value)
  localPreview.value = null
}
watch(() => props.banner, releasePreview)
watch(open, value => { if (!value) releaseSource() })
onBeforeUnmount(() => {
  disposed = true
  if (generating.value) emit('busy', false)
  releaseSource()
  releasePreview()
})

async function generate() {
  if (busy.value || !aiEnabled.value) return
  error.value = ''
  if (!props.title.trim()) {
    error.value = t('settings.banner.titleRequired')
    return
  }
  const context = { boardId: props.boardId, title: props.title, description: props.description ?? '', additionalRequest: additionalRequest.value }
  generating.value = true
  emit('busy', true)
  try {
    const blob = await generateBanner(context)
    if (disposed) return
    if (props.boardId !== context.boardId || props.title !== context.title || (props.description ?? '') !== context.description || additionalRequest.value !== context.additionalRequest) {
      throw new Error(t('settings.banner.contextChanged'))
    }
    releaseSource()
    source.value = URL.createObjectURL(blob)
    open.value = true
  }
  catch (cause) {
    if (!disposed) {
      console.warn('[memi-board] banner generation failed', cause)
      error.value = cause instanceof Error && [t('settings.banner.noImage'), t('settings.banner.contextChanged')].includes(cause.message)
        ? cause.message : t('settings.banner.generateFailed')
    }
  }
  finally {
    generating.value = false
    if (!disposed) emit('busy', false)
  }
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
  releaseSource()
  source.value = URL.createObjectURL(file)
  open.value = true
}

function updatePreview({ canvas }: { canvas?: HTMLCanvasElement | null }) {
  if (!canvas) return
  const thumbnail = document.createElement('canvas')
  thumbnail.width = 960
  thumbnail.height = 120
  thumbnail.getContext('2d')?.drawImage(canvas, 0, 0, 960, 120)
  cropPreview.value = thumbnail.toDataURL('image/jpeg', 0.8)
}

async function confirm() {
  if (processing.value || props.disabled) return
  const { canvas } = cropper.value?.getResult() ?? {}
  if (!canvas) return
  processing.value = true
  error.value = ''
  try {
    const output = document.createElement('canvas')
    output.width = 2400
    output.height = 300
    const ctx = output.getContext('2d')
    if (!ctx) throw new Error('Canvas unavailable')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, output.width, output.height)
    ctx.drawImage(canvas, 0, 0, output.width, output.height)
    const blob = await new Promise<Blob | null>(resolve => output.toBlob(resolve, 'image/jpeg', 0.9))
    if (!blob) throw new Error('Image encoding failed')
    const file = new File([blob], 'banner.jpg', { type: 'image/jpeg' })
    releasePreview()
    localPreview.value = URL.createObjectURL(file)
    emit('change', file)
    open.value = false
  }
  catch {
    error.value = t('settings.banner.failed')
  }
  finally { processing.value = false }
}

function remove() {
  releasePreview()
  localPreview.value = ''
  emit('change', null)
}
</script>

<template>
  <section class="flex flex-col gap-3">
    <div>
      <p class="text-sm font-medium">{{ t('settings.banner.label') }}</p>
      <p class="mt-1 text-xs leading-relaxed text-muted">{{ t('settings.banner.help') }}</p>
    </div>
    <img v-if="preview" :src="preview" :alt="t('settings.banner.preview')" width="2400" height="300" class="aspect-[8/1] w-full rounded-xl border border-default object-cover">
    <div v-else class="flex aspect-[8/1] items-center justify-center rounded-xl border border-dashed border-default bg-elevated/40" aria-hidden="true">
      <UIcon name="i-lucide-image" class="size-6 text-dimmed" />
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
    <div class="flex flex-wrap gap-2">
      <input ref="input" type="file" accept="image/jpeg,image/png,image/webp" class="hidden" :disabled="busy" :aria-label="t('settings.banner.select')" @change="select">
      <UButton icon="i-lucide-image-plus" color="neutral" variant="outline" size="sm" :disabled="busy" :label="t('settings.banner.select')" @click="input?.click()" />
      <UButton v-if="aiEnabled" icon="i-lucide-sparkles" color="primary" variant="soft" size="sm" :loading="generating" :disabled="busy || !title.trim()" :label="t('settings.banner.generate')" @click="generate" />
      <UButton v-if="preview" icon="i-lucide-trash-2" color="neutral" variant="ghost" size="sm" :disabled="busy" :label="t('settings.banner.remove')" @click="remove" />
    </div>
    <p v-if="aiEnabled" class="text-xs text-muted">{{ generating ? t('settings.banner.generating') : t('settings.banner.generateHelp') }}</p>
    <p v-if="error" role="alert" class="text-sm text-error">{{ error }}</p>
    <UModal v-model:open="open" :title="t('settings.banner.crop')" :description="t('settings.banner.help')" :dismissible="!processing" :ui="{ content: 'sm:max-w-3xl' }">
      <template #body>
        <ClientOnly>
          <Cropper
            v-if="source && open"
            ref="cropper"
            :src="source"
            class="h-72 w-full overflow-hidden rounded-xl bg-muted sm:h-96"
            :stencil-props="{ aspectRatio: 8 }"
            :canvas="{ maxWidth: 2400, maxHeight: 300 }"
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
        <img v-if="cropPreview" :src="cropPreview" :alt="t('settings.banner.preview')" class="aspect-[8/1] w-full rounded-lg object-cover">
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
