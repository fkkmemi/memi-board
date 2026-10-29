<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import type { Attachment } from 'memi-board/runtime'
import { isCommentImageFile, useMemiBoardStorage } from 'memi-board/storage'
import { useMemiBoardI18n, useMemiBoardModeration } from 'memi-board/runtime'

const props = defineProps<{
  postId: string
  commentId: string
  modelValue: Attachment | null
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Attachment | null]
  busy: [value: boolean]
}>()

const { uploadCommentImage, deleteAttachment } = useMemiBoardStorage()
const { checkImage } = useMemiBoardModeration()
const { t } = useMemiBoardI18n()

const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const progress = ref(0)
const dragOver = ref(false)
const error = ref('')
const sessionPaths = new Set<string>()
let cancelUpload: (() => void) | undefined
let uploadEpoch = 0

function setBusy(value: boolean) {
  uploading.value = value
  emit('busy', value)
}

function openPicker() {
  if (props.disabled || uploading.value) return
  fileInput.value?.click()
}

function onDragLeave(event: DragEvent) {
  const next = event.relatedTarget
  if (next instanceof Node && event.currentTarget instanceof Node && event.currentTarget.contains(next)) return
  dragOver.value = false
}

async function remove() {
  const current = props.modelValue
  emit('update:modelValue', null)
  error.value = ''
  if (current && sessionPaths.has(current.path)) {
    sessionPaths.delete(current.path)
    await deleteAttachment(current)
  }
}

async function useFile(file: File) {
  if (props.disabled) return
  error.value = ''
  if (!isCommentImageFile(file)) {
    error.value = t('commentForm.imageOnly')
    return
  }

  const epoch = ++uploadEpoch
  cancelUpload?.()
  cancelUpload = undefined
  setBusy(true)
  progress.value = 0
  try {
    const moderation = await checkImage(file)
    if (epoch !== uploadEpoch) return
    if (moderation.flagged) {
      error.value = moderation.reason || t('commentForm.moderationBlocked')
      return
    }

    const upload = uploadCommentImage(file, props.postId, props.commentId, (ratio) => {
      if (epoch === uploadEpoch) progress.value = ratio
    })
    cancelUpload = upload.cancel
    const uploaded = await upload.promise
    if (epoch !== uploadEpoch) {
      await deleteAttachment(uploaded)
      return
    }

    const previous = props.modelValue
    sessionPaths.add(uploaded.path)
    emit('update:modelValue', uploaded)
    if (previous && previous.path !== uploaded.path && sessionPaths.has(previous.path)) {
      sessionPaths.delete(previous.path)
      await deleteAttachment(previous)
    }
  }
  catch (cause) {
    if (epoch !== uploadEpoch) return
    const code = (cause as { code?: string }).code
    if (code === 'storage/canceled') return
    error.value = cause instanceof Error ? cause.message : t('commentForm.uploadFailed')
  }
  finally {
    if (epoch === uploadEpoch) {
      cancelUpload = undefined
      setBusy(false)
    }
  }
}

function handlePaste(event: ClipboardEvent) {
  if (props.disabled || uploading.value) return
  const clipboard = event.clipboardData
  if (!clipboard) return
  const file = Array.from(clipboard.items)
    .filter(item => item.kind === 'file')
    .map(item => item.getAsFile())
    .find((item): item is File => !!item && isCommentImageFile(item))
    ?? Array.from(clipboard.files).find(isCommentImageFile)
  if (!file) return
  event.preventDefault()
  void useFile(file)
}

defineExpose({ handlePaste })

function onInput(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) void useFile(file)
}

function onDrop(event: DragEvent) {
  dragOver.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) void useFile(file)
}

onUnmounted(() => {
  uploadEpoch++
  cancelUpload?.()
})
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div
      v-if="modelValue"
      class="flex items-start gap-2"
      @dragenter.prevent="dragOver = true"
      @dragover.prevent="dragOver = true"
      @dragleave="onDragLeave"
      @drop.prevent="onDrop"
    >
      <button
        type="button"
        class="rounded-md disabled:cursor-not-allowed disabled:opacity-60"
        :class="dragOver ? 'ring-2 ring-primary' : ''"
        :disabled="disabled || uploading"
        @click="openPicker"
      >
        <img
          :src="modelValue.url"
          :alt="t('commentItem.attachedImage')"
          class="max-h-40 max-w-full rounded-md border border-default object-contain"
        >
      </button>
      <UButton
        type="button"
        icon="i-lucide-x"
        size="xs"
        color="neutral"
        variant="ghost"
        :aria-label="t('commentForm.removeImage')"
        :disabled="disabled || uploading"
        @click="remove"
      />
    </div>
    <button
      v-else
      type="button"
      class="rounded-md border border-dashed px-3 py-4 text-left text-xs text-muted transition-colors disabled:cursor-not-allowed disabled:opacity-60"
      :class="dragOver ? 'border-primary bg-elevated/60' : 'border-default hover:bg-elevated/40'"
      :disabled="disabled || uploading"
      @click="openPicker"
      @dragenter.prevent="dragOver = true"
      @dragover.prevent="dragOver = true"
      @dragleave="onDragLeave"
      @drop.prevent="onDrop"
    >
      {{ uploading ? t('commentForm.uploading') : t('commentForm.attachHint') }}
    </button>
    <UProgress
      v-if="uploading"
      :model-value="Math.round(progress * 100)"
      size="sm"
    />
    <p class="text-xs text-dimmed">
      {{ t('commentForm.attachNote') }}
    </p>
    <p
      v-if="error"
      class="text-xs text-error"
    >
      {{ error }}
    </p>
    <input
      ref="fileInput"
      type="file"
      accept="image/jpeg,image/png,image/gif,image/webp,.jpg,.jpeg,.png,.gif,.webp"
      class="hidden"
      :disabled="disabled || uploading"
      @change="onInput"
    >
  </div>
</template>
