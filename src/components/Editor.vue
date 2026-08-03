<script setup lang="ts">
/**
 * 글쓰기 폼 — Nuxt UI UEditor (shineb PostEditor 와 동일 축).
 * content-type=html (shineb). markdown 은 TipTap Markdown 확장 의존으로 빈 에디터 유발 가능.
 */
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import type { Attachment, EditorImageEntry } from 'memi-board'
import {
  useMemiBoardAuth,
  useMemiBoardPosts,
  useMemiBoardModeration,
  useMemiBoardSettings,
  useMemiBoardStorage,
  EDITOR_IMAGE_MAX_BYTES,
} from 'memi-board'
import MemiBoardAttachments from './Attachments.vue'

const props = defineProps<{
  postId?: string
  fixedCategory?: string
}>()

const emit = defineEmits<{ saved: [id: string], cancel: [] }>()

const { user, isSignedIn, isWriteRestricted, restrictedMessage } = useMemiBoardAuth()
const { getPost, createPost, updatePost } = useMemiBoardPosts()
const { checkText } = useMemiBoardModeration()
const { categories, categoryLabel, ensureSettings, addCategory } = useMemiBoardSettings()
const { uploadEditorImage } = useMemiBoardStorage()

const title = ref('')
/** HTML (UEditor content-type=html). 레거시 plain/markdown 도 로드 가능 */
const content = ref('')
const tagsInput = ref('')
const category = ref<string | undefined>(undefined)
const attachments = ref<Attachment[]>([])

const categoryItems = computed(() =>
  categories.value.map(c => ({ label: c.label, value: c.id })),
)
const effectiveCategory = computed(() => props.fixedCategory || category.value)
const isEdit = computed(() => Boolean(props.postId))
const categoryLocked = computed(() => Boolean(props.fixedCategory))

const loading = ref(false)
const saving = ref(false)
const submitHint = ref('')
const error = ref('')
const imageUploading = ref(false)
const imageUploadError = ref('')
/** UEditor 마운트 실패 시 폴백 */
const editorBroken = ref(false)

const showAddCategory = ref(false)
const newCategoryLabel = ref('')
const addingCategory = ref(false)

const attachmentNamespace = ref(props.postId ?? `new-${Date.now()}`)
const uploadedEditorImages = ref<EditorImageEntry[]>([])

const editorRef = ref<{ editor?: { value?: unknown } | unknown } | null>(null)

function imageNamespace(): string {
  return props.postId || attachmentNamespace.value
}

async function doUploadImage(file: File): Promise<EditorImageEntry> {
  if (!file.type.startsWith('image/')) {
    throw new Error('이미지 파일만 업로드할 수 있습니다.')
  }
  if (file.size > EDITOR_IMAGE_MAX_BYTES) {
    throw new Error(`이미지는 ${EDITOR_IMAGE_MAX_BYTES / 1024 / 1024}MB 이하여야 합니다.`)
  }
  const entry = await uploadEditorImage(file, imageNamespace())
  uploadedEditorImages.value.push(entry)
  return entry
}

function pickAndUploadImage(editor: any) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = () => {
    const file = input.files?.[0]
    if (!file) return
    void (async () => {
      imageUploading.value = true
      imageUploadError.value = ''
      try {
        const entry = await doUploadImage(file)
        editor.chain().focus().setImage({ src: entry.originalUrl }).run()
      }
      catch (e) {
        imageUploadError.value = (e as Error).message || '이미지 업로드에 실패했습니다.'
      }
      finally {
        imageUploading.value = false
      }
    })()
  }
  input.click()
}

// shineb 와 동일 — 이미지 파일 업로드 핸들러 (isDisabled 는 생략: 초기화 중 extensionManager 접근 회피)
const handlers = {
  image: {
    canExecute: (editor: any) => editor.can().setImage({ src: '' }),
    isActive: (editor: any) => editor.isActive('image'),
    isDisabled: undefined as undefined,
    execute: (editor: any) => {
      pickAndUploadImage(editor)
      return editor.chain()
    },
  },
}

const toolbarItems = [
  [
    { kind: 'heading', level: 1, icon: 'i-lucide-heading-1' },
    { kind: 'heading', level: 2, icon: 'i-lucide-heading-2' },
    { kind: 'heading', level: 3, icon: 'i-lucide-heading-3' },
  ],
  [
    { kind: 'mark', mark: 'bold', icon: 'i-lucide-bold' },
    { kind: 'mark', mark: 'italic', icon: 'i-lucide-italic' },
    { kind: 'mark', mark: 'underline', icon: 'i-lucide-underline' },
    { kind: 'mark', mark: 'strike', icon: 'i-lucide-strikethrough' },
    { kind: 'mark', mark: 'code', icon: 'i-lucide-code' },
  ],
  [
    { kind: 'bulletList', icon: 'i-lucide-list' },
    { kind: 'orderedList', icon: 'i-lucide-list-ordered' },
    { kind: 'blockquote', icon: 'i-lucide-quote' },
    { kind: 'codeBlock', icon: 'i-lucide-square-code' },
  ],
  [
    { kind: 'link', icon: 'i-lucide-link' },
    { kind: 'image', icon: 'i-lucide-image' },
  ],
  [
    { kind: 'horizontalRule', icon: 'i-lucide-minus' },
    { kind: 'undo', icon: 'i-lucide-undo-2' },
    { kind: 'redo', icon: 'i-lucide-redo-2' },
    { kind: 'clearFormatting', icon: 'i-lucide-remove-formatting' },
  ],
] as const

function isContentEmpty(html: string): boolean {
  const plain = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return !plain
}

/** 붙여넣기/드롭 이미지 — DOM 이벤트로 처리 (TipTap Extension 없음) */
function onEditorRootPaste(e: ClipboardEvent) {
  const items = Array.from(e.clipboardData?.items ?? [])
  const imageItem = items.find(i => i.type.startsWith('image/'))
  if (!imageItem) return
  const file = imageItem.getAsFile()
  if (!file) return
  e.preventDefault()
  const ed = (editorRef.value as any)?.editor
  const editor = ed?.value ?? ed
  if (!editor) return
  void (async () => {
    imageUploading.value = true
    imageUploadError.value = ''
    try {
      const entry = await doUploadImage(file)
      editor.chain().focus().setImage({ src: entry.originalUrl }).run()
    }
    catch (err) {
      imageUploadError.value = (err as Error).message || '이미지 업로드에 실패했습니다.'
    }
    finally {
      imageUploading.value = false
    }
  })()
}

function onEditorRootDrop(e: DragEvent) {
  const files = Array.from(e.dataTransfer?.files ?? [])
  const image = files.find(f => f.type.startsWith('image/'))
  if (!image) return
  e.preventDefault()
  const ed = (editorRef.value as any)?.editor
  const editor = ed?.value ?? ed
  if (!editor) return
  void (async () => {
    imageUploading.value = true
    imageUploadError.value = ''
    try {
      const entry = await doUploadImage(image)
      editor.chain().focus().setImage({ src: entry.originalUrl }).run()
    }
    catch (err) {
      imageUploadError.value = (err as Error).message || '이미지 업로드에 실패했습니다.'
    }
    finally {
      imageUploading.value = false
    }
  })()
}

function onEditorRootDragOver(e: DragEvent) {
  if (Array.from(e.dataTransfer?.types ?? []).includes('Files')) {
    e.preventDefault()
  }
}

async function loadPost(id: string) {
  loading.value = true
  error.value = ''
  try {
    await ensureSettings().catch(() => {})
    const post = await getPost(id)
    if (!post) {
      error.value = '게시글을 찾을 수 없습니다.'
      title.value = ''
      content.value = ''
      return
    }
    title.value = post.title
    content.value = post.content
    tagsInput.value = (post.tags ?? []).join(', ')
    category.value = post.category
    attachments.value = post.attachments ?? []
    attachmentNamespace.value = id
  }
  catch (e) {
    const msg = (e as Error).message || String(e)
    error.value = msg.includes('permission')
      ? '글을 불러올 권한이 없습니다. 로그인 상태를 확인해 주세요.'
      : `글을 불러오지 못했습니다: ${msg}`
  }
  finally {
    loading.value = false
  }
}

watch(
  () => props.postId,
  (id) => {
    if (id) void loadPost(id)
    else {
      loading.value = false
      attachmentNamespace.value = `new-${Date.now()}`
      if (props.fixedCategory) category.value = props.fixedCategory
      void ensureSettings().catch(() => {})
    }
  },
  { immediate: true },
)

watch(
  () => props.fixedCategory,
  (c) => {
    if (c && !props.postId) category.value = c
  },
  { immediate: true },
)

// 에디터가 안 뜨면 (생성 실패) 수 초 후 폴백 표시
let brokenTimer: ReturnType<typeof setTimeout> | undefined
onMounted(() => {
  brokenTimer = setTimeout(() => {
    const ed = (editorRef.value as any)?.editor
    const editor = ed?.value ?? ed
    if (!editor && !editorBroken.value) {
      console.warn('[memi-board] UEditor failed to mount — falling back to textarea')
      editorBroken.value = true
    }
  }, 2000)
})
onBeforeUnmount(() => {
  if (brokenTimer) clearTimeout(brokenTimer)
})

async function handleAddCategory() {
  error.value = ''
  if (!isSignedIn.value) {
    error.value = '카테고리 추가에는 로그인이 필요합니다.'
    return
  }
  addingCategory.value = true
  try {
    const label = newCategoryLabel.value.trim()
    const moderation = await checkText(label)
    if (moderation.flagged) {
      error.value = moderation.reason || '사용할 수 없는 카테고리 이름입니다.'
      return
    }
    const id = await addCategory(label)
    category.value = id
    newCategoryLabel.value = ''
    showAddCategory.value = false
  }
  catch (e) {
    error.value = (e as Error).message || String(e)
  }
  finally {
    addingCategory.value = false
  }
}

function friendlyWriteError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  if (msg.includes('permission-denied') || msg.includes('Permission denied')) {
    return '수정 권한이 없습니다. 본인이 작성한 글인지, 로그인이 유지되는지 확인해 주세요.'
  }
  return msg
}

async function handleSubmit() {
  error.value = ''
  if (!title.value.trim() || isContentEmpty(content.value)) {
    error.value = '제목과 내용을 입력해 주세요.'
    return
  }
  if (!user.value) {
    error.value = '로그인이 필요합니다.'
    return
  }
  const cat = effectiveCategory.value
  if (!cat) {
    error.value = '카테고리를 선택해 주세요.'
    return
  }
  if (!categories.value.some(c => c.id === cat) && !props.fixedCategory) {
    error.value = '목록에 있는 카테고리를 선택해 주세요.'
    return
  }
  if (isWriteRestricted.value) {
    error.value = restrictedMessage.value
      || '콘텐츠 경고가 누적되어 글·댓글 작성이 잠시 제한됐어요.'
    return
  }

  saving.value = true
  submitHint.value = '내용을 검토하는 중…'
  try {
    // 검열용: HTML 태그 제거한 plain text + 제목
    const plain = content.value.replace(/<[^>]+>/g, ' ')
    const moderation = await checkText(`${title.value}\n${plain}`)
    if (moderation.flagged) {
      error.value = moderation.reason || '게시할 수 없는 내용이 포함되어 있습니다.'
      return
    }

    submitHint.value = '저장하는 중…'
    const tags = tagsInput.value.split(',').map(t => t.trim()).filter(Boolean)
    const payload = {
      title: title.value.trim(),
      content: content.value,
      tags,
      category: cat,
      attachments: attachments.value,
    }

    if (props.postId) {
      await updatePost(props.postId, payload)
      emit('saved', props.postId)
    }
    else {
      const id = await createPost({
        ...payload,
        authorUid: user.value.uid,
        authorName: user.value.displayName,
        authorPhoto: user.value.photoURL,
      })
      emit('saved', id)
    }
  }
  catch (e) {
    error.value = friendlyWriteError(e)
  }
  finally {
    saving.value = false
    submitHint.value = ''
  }
}
</script>

<template>
  <div
    v-if="loading"
    class="flex flex-col gap-3"
  >
    <USkeleton class="h-10 w-full" />
    <USkeleton class="h-40 w-full" />
  </div>

  <form
    v-else
    class="flex flex-col gap-4"
    @submit.prevent="handleSubmit"
  >
    <div
      v-if="categoryLocked"
      class="flex items-center gap-2 text-sm"
    >
      <span class="text-muted">카테고리</span>
      <UBadge
        :label="categoryLabel(fixedCategory) || fixedCategory"
        variant="subtle"
      />
    </div>

    <div
      v-else
      class="flex flex-col gap-2"
    >
      <div class="flex items-center gap-2 flex-wrap">
        <USelect
          v-model="category"
          :items="categoryItems"
          placeholder="카테고리 선택"
          class="w-48"
        />
        <UButton
          v-if="isSignedIn"
          type="button"
          variant="outline"
          color="neutral"
          size="sm"
          icon="i-lucide-plus"
          label="카테고리 추가"
          @click="showAddCategory = !showAddCategory"
        />
      </div>
      <div
        v-if="showAddCategory"
        class="flex items-center gap-2"
      >
        <UInput
          v-model="newCategoryLabel"
          placeholder="새 카테고리 이름"
          class="w-48"
          @keydown.enter.prevent="handleAddCategory"
        />
        <UButton
          type="button"
          size="sm"
          label="추가"
          :loading="addingCategory"
          @click="handleAddCategory"
        />
        <UButton
          type="button"
          size="sm"
          variant="ghost"
          color="neutral"
          label="취소"
          @click="showAddCategory = false; newCategoryLabel = ''"
        />
      </div>
    </div>

    <UInput
      v-model="title"
      placeholder="제목"
      size="lg"
      required
    />

    <!-- shineb PostEditor 와 동일: content-type=html, handlers, toolbar -->
    <div
      class="rounded-xl border border-default overflow-hidden"
      @paste="onEditorRootPaste"
      @drop="onEditorRootDrop"
      @dragover="onEditorRootDragOver"
    >
      <UAlert
        v-if="imageUploadError"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        title="업로드 실패"
        :description="imageUploadError"
        class="rounded-none rounded-t-xl"
      />

      <UEditor
        v-if="!editorBroken"
        ref="editorRef"
        v-model="content"
        content-type="html"
        :handlers="handlers"
        placeholder="본문을 입력하세요…"
        :ui="{
          root: 'w-full',
          base: 'min-h-64 focus:outline-none',
          content: 'min-h-64 p-4',
        }"
        class="w-full min-h-72"
      >
        <template #default="{ editor }">
          <UEditorToolbar
            v-if="editor"
            :editor="editor"
            :items="toolbarItems"
            class="border-b border-default p-2 sticky top-0 z-10 bg-default"
          />
        </template>
      </UEditor>

      <UTextarea
        v-else
        v-model="content"
        placeholder="본문을 입력하세요… (간단 입력 모드)"
        :rows="12"
        class="w-full"
      />

      <p
        v-if="imageUploading"
        class="flex items-center gap-2 border-t border-default px-4 py-2 text-xs text-muted"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="size-3.5 animate-spin"
        />
        이미지 업로드 중…
      </p>
    </div>

    <UInput
      v-model="tagsInput"
      placeholder="태그 (쉼표로 구분)"
    />

    <MemiBoardAttachments
      v-model="attachments"
      :post-id="attachmentNamespace"
      editable
    />

    <p
      v-if="isWriteRestricted && restrictedMessage"
      class="text-sm text-warning"
    >
      {{ restrictedMessage }}
    </p>
    <p
      v-if="error"
      class="text-sm text-error"
    >
      {{ error }}
    </p>
    <p
      v-else-if="submitHint"
      class="text-sm text-muted"
    >
      {{ submitHint }}
    </p>

    <div class="flex gap-2">
      <UButton
        type="submit"
        :loading="saving"
        :disabled="isWriteRestricted || imageUploading"
        :label="isEdit ? '수정 완료' : '게시하기'"
      />
      <UButton
        type="button"
        variant="ghost"
        color="neutral"
        label="취소"
        @click="emit('cancel')"
      />
    </div>
  </form>
</template>
