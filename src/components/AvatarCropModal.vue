<script setup lang="ts">
import { ref } from 'vue'
import { Cropper } from 'vue-advanced-cropper'
import 'vue-advanced-cropper/dist/style.css'

const open = defineModel<boolean>('open', { default: false })

const props = withDefaults(defineProps<{
  /** object URL 또는 data URL */
  src: string
  /** 출력 한 변 (px) — 1:1 */
  outputSize?: number
  loading?: boolean
}>(), {
  outputSize: 256,
  loading: false,
})

const emit = defineEmits<{
  confirm: [file: File]
  cancel: []
}>()

const cropperRef = ref<InstanceType<typeof Cropper> | null>(null)

function close() {
  open.value = false
  emit('cancel')
}

async function confirm() {
  const cropper = cropperRef.value
  if (!cropper) return

  const { canvas } = cropper.getResult()
  if (!canvas) return

  // 1:1 고정 크기로 다시 그려 업로드 용량·표시 비율 통일
  const size = props.outputSize
  const out = document.createElement('canvas')
  out.width = size
  out.height = size
  const ctx = out.getContext('2d')
  if (!ctx) return
  ctx.drawImage(canvas, 0, 0, size, size)

  const blob = await new Promise<Blob | null>((resolve) => {
    out.toBlob(resolve, 'image/jpeg', 0.9)
  })
  if (!blob) return

  emit('confirm', new File([blob], 'avatar.jpg', { type: 'image/jpeg' }))
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="프로필 사진 자르기"
    description="정사각형(1:1)으로 보여집니다. 영역을 맞춰 주세요."
    :ui="{ content: 'sm:max-w-lg' }"
  >
    <template #body>
      <ClientOnly>
        <div class="overflow-hidden rounded-xl bg-muted">
          <Cropper
            v-if="src && open"
            ref="cropperRef"
            class="h-72 w-full sm:h-80"
            :src="src"
            :stencil-props="{ aspectRatio: 1 }"
            image-restriction="stencil"
          />
        </div>
      </ClientOnly>
      <p class="mt-3 text-xs text-muted">
        드래그로 위치·확대 조절 · {{ outputSize }}×{{ outputSize }} 정사각 JPEG로 저장됩니다
      </p>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          color="neutral"
          variant="ghost"
          :disabled="loading"
          @click="close"
        >
          취소
        </UButton>
        <UButton
          icon="i-lucide-check"
          :loading="loading"
          @click="confirm"
        >
          자르고 업로드
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
:deep(.vue-advanced-cropper) {
  max-height: 20rem;
  background: transparent;
}
</style>
