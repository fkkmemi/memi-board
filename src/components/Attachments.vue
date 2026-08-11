<script setup lang="ts">
import { ref } from 'vue'
import type { Attachment } from 'memi-board/runtime'
import { useMemiBoardStorage } from 'memi-board/runtime'

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

const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const uploadProgress = ref(0)
const deletingIndex = ref<number | null>(null)
const uploadError = ref('')

function isImage(type: string) {
  return type.startsWith('image/')
}

async function onFileInputChange(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  if (!files.length) return

  const remaining = props.maxFiles - props.modelValue.length
  const toUpload = files.slice(0, remaining)

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
  <div class="space-y-2">
    <div
      v-for="(attachment, i) in modelValue"
      :key="attachment.path"
      class="flex items-center gap-3 px-3 py-2 rounded-lg border border-default"
    >
      <img
        v-if="isImage(attachment.type)"
        :src="attachment.url"
        class="size-10 rounded object-cover shrink-0"
      >
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

    <template v-if="editable && modelValue.length < maxFiles">
      <input
        ref="fileInput"
        type="file"
        multiple
        class="hidden"
        @change="onFileInputChange"
      >
      <UButton
        icon="i-lucide-paperclip"
        :label="`파일 첨부 (${modelValue.length} / ${maxFiles})`"
        variant="outline"
        color="neutral"
        size="sm"
        :loading="uploading"
        @click="fileInput?.click()"
      />
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
    <p
      v-else-if="editable"
      class="text-xs text-muted"
    >
      최대 {{ maxFiles }}개까지 첨부할 수 있습니다.
    </p>
  </div>
</template>
