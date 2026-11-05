<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Attachment } from 'memi-board/runtime'
import { useMemiBoardStorage } from 'memi-board/storage'
import { useMemiBoardI18n } from 'memi-board/runtime'
import MemiBoardImageLightbox from './ImageLightbox.vue'

const props = withDefaults(defineProps<{
  modelValue: Attachment[]
  /** 새 글 작성 중에도 미리 생성한 Firestore 자동 ID를 넘긴다. */
  postId: string
  editable?: boolean
  maxFiles?: number
}>(), {
  editable: false,
  maxFiles: 5,
})

const emit = defineEmits<{ 'update:modelValue': [attachments: Attachment[]] }>()

const { uploadAttachment, deleteAttachment } = useMemiBoardStorage()
const { t } = useMemiBoardI18n()

const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const uploadProgress = ref(0)
const deletingIndex = ref<number | null>(null)
const uploadError = ref('')
const dropActive = ref(false)

function isImage(type: string) {
  return type.startsWith('image/')
}

const imageOpen = ref(false)
const imageIndex = ref(0)
const imageUrls = computed(() => props.modelValue.filter(item => isImage(item.type)).map(item => item.url))

function openImage(url: string) {
  const at = imageUrls.value.indexOf(url)
  if (at < 0) return
  imageIndex.value = at
  imageOpen.value = true
}

function canAcceptMore() {
  return props.editable && !uploading.value && props.modelValue.length < props.maxFiles
}

function isFileDrag(dt: DataTransfer | null) {
  return Array.from(dt?.types ?? []).includes('Files')
}

async function uploadFiles(files: File[]) {
  const remaining = props.maxFiles - props.modelValue.length
  const toUpload = files.slice(0, remaining)
  if (!toUpload.length) return

  uploading.value = true
  uploadError.value = ''
  try {
    const uploaded: Attachment[] = []
    for (const file of toUpload) {
      uploadProgress.value = 0
      const { promise } = uploadAttachment(file, props.postId, (ratio) => {
        uploadProgress.value = ratio
      })
      uploaded.push(await promise)
    }
    emit('update:modelValue', [...props.modelValue, ...uploaded])
  }
  catch (e) {
    uploadError.value = (e as Error).message
  }
  finally {
    uploading.value = false
  }
}

async function onFileInputChange(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  if (!files.length) return
  await uploadFiles(files)
}

function onDragOver(e: DragEvent) {
  if (!canAcceptMore() || !isFileDrag(e.dataTransfer)) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  dropActive.value = true
}

function onDragLeave(e: DragEvent) {
  const next = e.relatedTarget
  if (next instanceof Node && (e.currentTarget as Node).contains(next)) return
  dropActive.value = false
}

function onDrop(e: DragEvent) {
  dropActive.value = false
  if (!canAcceptMore()) return
  const files = Array.from(e.dataTransfer?.files ?? [])
  if (!files.length) return
  e.preventDefault()
  e.stopPropagation()
  void uploadFiles(files)
}

async function removeAttachment(index: number) {
  const attachment = props.modelValue[index]
  if (!attachment) return
  deletingIndex.value = index
  try {
    await deleteAttachment(attachment)
    emit('update:modelValue', props.modelValue.filter((_, i) => i !== index))
  }
  finally {
    deletingIndex.value = null
  }
}

function fileIcon(type: string): string {
  if (type === 'application/pdf') return 'i-lucide-file-text'
  if (type.includes('zip') || type.includes('archive') || type.includes('compressed')) return 'i-lucide-archive'
  if (type.includes('spreadsheet') || type.includes('excel') || type.includes('csv')) return 'i-lucide-table'
  if (type.includes('presentation') || type.includes('powerpoint')) return 'i-lucide-presentation'
  if (isImage(type)) return 'i-lucide-image'
  if (type.includes('video')) return 'i-lucide-video'
  if (type.includes('audio')) return 'i-lucide-music'
  return 'i-lucide-file'
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
</script>

<template>
  <div
    class="space-y-2"
    :class="editable && [
      'rounded-xl border-2 border-dashed p-2 transition-colors sm:p-3',
      dropActive ? 'border-primary bg-primary/5' : 'border-default bg-elevated/30',
    ]"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <div
      v-for="(attachment, i) in modelValue"
      :key="attachment.path"
      class="flex items-center gap-3 rounded-lg border border-default bg-default px-3 py-2"
    >
      <button
        v-if="isImage(attachment.type)"
        type="button"
        class="shrink-0 cursor-zoom-in bg-transparent p-0"
        :aria-label="t('common.label.image')"
        @click="openImage(attachment.url)"
      >
        <img
          :src="attachment.url"
          alt=""
          class="size-10 rounded object-cover"
        >
      </button>
      <UIcon
        v-else
        :name="fileIcon(attachment.type)"
        class="size-5 shrink-0 text-muted"
      />
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium truncate">
          {{ attachment.name }}
        </p>
        <p class="text-xs text-muted">
          {{ formatSize(attachment.size) }}
        </p>
      </div>

      <UButton
        v-if="editable"
        icon="i-lucide-x"
        size="xs"
        color="error"
        variant="ghost"
        :loading="deletingIndex === i"
        @click="removeAttachment(i)"
      />
      <UButton
        v-else
        icon="i-lucide-download"
        size="xs"
        color="neutral"
        variant="ghost"
        :to="attachment.url"
        target="_blank"
      />
    </div>

    <template v-if="editable">
      <input
        ref="fileInput"
        type="file"
        multiple
        class="hidden"
        @change="onFileInputChange"
      >
      <button
        v-if="modelValue.length < maxFiles"
        type="button"
        class="flex w-full items-center justify-center text-center text-muted transition hover:text-primary"
        :class="modelValue.length ? 'gap-2 px-3 py-3' : 'flex-col gap-2 px-4 py-10'"
        :disabled="uploading"
        @click="fileInput?.click()"
      >
        <UIcon
          :name="uploading ? 'i-lucide-loader-circle' : 'i-lucide-paperclip'"
          :class="[
            modelValue.length ? 'size-5' : 'size-10',
            uploading ? 'animate-spin' : '',
          ]"
        />
        <span class="flex flex-col gap-1">
          <span class="text-sm font-medium text-highlighted">
            {{ uploading ? t('attachments.uploading') : t('attachments.dropOrClick') }}
          </span>
          <span class="text-xs text-muted">
            {{ t('attachments.attach', { count: modelValue.length, max: maxFiles }) }}
          </span>
        </span>
      </button>
      <p
        v-else
        class="px-2 py-3 text-center text-xs text-muted"
      >
        {{ t('attachments.maxFiles', { max: maxFiles }) }}
      </p>
      <UProgress
        v-if="uploading"
        :model-value="Math.round(uploadProgress * 100)"
      />
      <p
        v-if="uploadError"
        class="text-xs text-error"
      >
        {{ uploadError }}
      </p>
    </template>

    <MemiBoardImageLightbox
      v-model:open="imageOpen"
      v-model:index="imageIndex"
      :images="imageUrls"
    />
  </div>
</template>
