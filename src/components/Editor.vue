<script setup lang="ts">
/**
 * 글쓰기 폼 — Nuxt UI UEditor + shineb PostEditor 패턴.
 * @see https://ui.nuxt.com/docs/components/editor
 * @see shineb app/components/PostEditor.vue
 *
 * 커스텀은 handlers.image(파일 업로드), YouTube 임베드 + DOM paste/drop.
 */
import { ref, computed, watch } from 'vue'
import Youtube from '@tiptap/extension-youtube'
import type { Attachment, EditorImageEntry } from 'memi-board/runtime'
import {
  useMemiBoardAuth,
  useMemiBoardPosts,
  useMemiBoardModeration,
  useMemiBoardSettings,
  useMemiBoardStorage,
  EDITOR_IMAGE_SOURCE_MAX_BYTES,
} from 'memi-board/runtime'
import MemiBoardAttachments from './Attachments.vue'

const props = defineProps<{
  postId?: string
  fixedCategory?: string
}>()

const emit = defineEmits<{ saved: [id: string], cancel: [] }>()

const { user, isSignedIn, isWriteRestricted, restrictedMessage } = useMemiBoardAuth()
const { createPostId, getPost, createPost, updatePost } = useMemiBoardPosts()
const { checkText } = useMemiBoardModeration()
const { categories, ensureSettings, addCategory } = useMemiBoardSettings()
const { uploadEditorImage } = useMemiBoardStorage()

const title = ref('')
/** UEditor content-type=html (shineb 와 동일) */
const content = ref('')
const tagsInput = ref('')
const category = ref<string | undefined>(undefined)
const attachments = ref<Attachment[]>([])

const categoryItems = computed(() =>
  categories.value.map(c => ({ label: c.label, value: c.id })),
)
const effectiveCategory = computed(() => props.fixedCategory || category.value)
const isEdit = computed(() => Boolean(props.postId))

const loading = ref(false)
const saving = ref(false)
const submitHint = ref('')
const error = ref('')
const imageUploading = ref(false)
const imageUploadError = ref('')

const showAddCategory = ref(false)
const newCategoryLabel = ref('')
const addingCategory = ref(false)

const attachmentNamespace = ref(props.postId ?? createPostId())
const uploadedEditorImages = ref<EditorImageEntry[]>([])
const editorRef = ref<{ editor?: unknown } | null>(null)
const editorExtensions = [
  Youtube.configure({
    nocookie: true,
    controls: true,
    width: 640,
    height: 360,
  }),
]

function imageNamespace(): string {
  return props.postId || attachmentNamespace.value
}

async function doUploadImage(file: File): Promise<EditorImageEntry> {
  if (!file.type.startsWith('image/')) {
    throw new Error('이미지 파일만 업로드할 수 있습니다.')
  }
  if (file.size > EDITOR_IMAGE_SOURCE_MAX_BYTES) {
    throw new Error(`원본 이미지는 ${EDITOR_IMAGE_SOURCE_MAX_BYTES / 1024 / 1024}MB 이하여야 합니다.`)
  }
  const entry = await uploadEditorImage(file, imageNamespace())
  uploadedEditorImages.value.push(entry)
  return entry
}

async function uploadAndSetImage(editor: any, file: File) {
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
}

function pickAndUploadImage(editor: any) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = () => {
    const file = input.files?.[0]
    if (file) void uploadAndSetImage(editor, file)
  }
  input.click()
}

function youtubeUrl(value: string | null | undefined): string | null {
  const raw = value?.trim()
  if (!raw) return null
  try {
    const url = new URL(raw)
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    if (host === 'youtu.be' || host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      return url.toString()
    }
  }
  catch {
    // URL 형식이 아니면 YouTube 임베드로 처리하지 않는다.
  }
  return null
}

function insertYoutube(editor: any, value?: string | null): boolean {
  const src = youtubeUrl(value ?? window.prompt('YouTube 링크를 입력하세요.'))
  if (!src) return false
  return editor.chain().focus().setYoutubeVideo({ src }).run()
}

/** 공식 handlers API — 기본 image(URL prompt) 를 파일 업로드로 교체 (shineb) */
const handlers = {
  image: {
    canExecute: (editor: any) => editor.can().setImage({ src: '' }),
    isActive: (editor: any) => editor.isActive('image'),
    isDisabled: (editor: any) =>
      !editor.extensionManager?.extensions?.some((ext: any) => ext.name === 'image'),
    execute: (editor: any) => {
      pickAndUploadImage(editor)
      return editor.chain()
    },
  },
  youtube: {
    canExecute: (editor: any) => editor.can().setYoutubeVideo({ src: 'https://youtu.be/dQw4w9WgXcQ' }),
    isActive: (editor: any) => editor.isActive('youtube'),
    isDisabled: (editor: any) =>
      !editor.extensionManager?.extensions?.some((ext: any) => ext.name === 'youtube'),
    execute: (editor: any) => {
      insertYoutube(editor)
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
    { kind: 'youtube', icon: 'i-lucide-youtube', label: 'YouTube' },
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

function resolveEditor(): any | null {
  const ed = (editorRef.value as any)?.editor
  return ed?.value ?? ed ?? null
}

/** 앱 레벨 paste/drop (TipTap Extension 아님 — shineb 툴바 업로드와 동일 업로드 경로) */
function onEditorRootPaste(e: ClipboardEvent) {
  const items = Array.from(e.clipboardData?.items ?? [])
  const imageItem = items.find(i => i.type.startsWith('image/'))
  const editor = resolveEditor()
  if (!editor) return
  if (imageItem) {
    const file = imageItem.getAsFile()
    if (!file) return
    e.preventDefault()
    void uploadAndSetImage(editor, file)
    return
  }

  const src = youtubeUrl(e.clipboardData?.getData('text/plain'))
  if (!src) return
  e.preventDefault()
  insertYoutube(editor, src)
}

function onEditorRootDrop(e: DragEvent) {
  const files = Array.from(e.dataTransfer?.files ?? [])
  const image = files.find(f => f.type.startsWith('image/'))
  const editor = resolveEditor()
  if (!image || !editor) return
  e.preventDefault()
  void uploadAndSetImage(editor, image)
}

function onEditorRootDragOver(e: DragEvent) {
  if (Array.from(e.dataTransfer?.types ?? []).includes('Files')) e.preventDefault()
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
      attachmentNamespace.value = createPostId()
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
        postId: attachmentNamespace.value,
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
      v-if="!fixedCategory"
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
        ref="editorRef"
        v-model="content"
        content-type="html"
        :extensions="editorExtensions"
        :handlers="handlers"
        placeholder="본문을 입력하세요…"
        :ui="{ content: 'min-h-64 p-4' }"
        class="board-content w-full"
      >
        <template #default="{ editor }">
          <UEditorToolbar
            :editor="editor"
            :items="toolbarItems"
            class="border-b border-default p-2"
          />
          <UEditorDragHandle :editor="editor" />
        </template>
      </UEditor>

      <p
        v-if="imageUploading"
        class="flex items-center gap-2 border-t border-default px-4 py-2 text-xs text-muted"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="size-3.5 animate-spin"
        />
        이미지 최적화 및 업로드 중…
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

<style scoped>
.board-content :deep(iframe[src*="youtube.com"], iframe[src*="youtube-nocookie.com"], iframe[src*="youtu.be"]) {
  width: 100%;
  max-width: 640px;
  aspect-ratio: 16 / 9;
  height: auto;
  border: 0;
  border-radius: 0.75rem;
}
</style>
