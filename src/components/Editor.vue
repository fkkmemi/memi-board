<script setup lang="ts">
/**
 * 글쓰기 폼 — Nuxt UI UEditor (shineb PostEditor 패턴).
 * 이미지: 툴바 / 붙여넣기 / 드롭 → Storage 원본+썸네일.
 * TipTap Extension 은 쓰지 않음 (PluginKey 충돌·빈 에디터 방지) — editorProps 로 처리.
 */
import { ref, computed, watch } from 'vue'
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

const showAddCategory = ref(false)
const newCategoryLabel = ref('')
const addingCategory = ref(false)

const attachmentNamespace = ref(props.postId ?? `new-${Date.now()}`)
const uploadedEditorImages = ref<EditorImageEntry[]>([])

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

/** TipTap view 에 이미지 노드 삽입 */
function insertImageAtSelection(view: { state: any, dispatch: (tr: any) => void }, src: string) {
  const { schema, tr, selection } = view.state
  const imageType = schema.nodes.image
  if (!imageType) return
  const node = imageType.create({ src })
  view.dispatch(tr.replaceSelectionWith(node).scrollIntoView())
  void selection
}

async function uploadAndInsert(view: { state: any, dispatch: (tr: any) => void }, file: File) {
  imageUploading.value = true
  imageUploadError.value = ''
  try {
    const entry = await doUploadImage(file)
    insertImageAtSelection(view, entry.originalUrl)
  }
  catch (e) {
    imageUploadError.value = (e as Error).message || '이미지 업로드에 실패했습니다.'
  }
  finally {
    imageUploading.value = false
  }
}

function pickAndUploadImage(editor: {
  view: { state: any, dispatch: (tr: any) => void }
  chain: () => { focus: () => { setImage: (o: { src: string }) => { run: () => void } } }
}) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = () => {
    const file = input.files?.[0]
    if (file) void uploadAndInsert(editor.view, file)
  }
  input.click()
}

const editorHandlers = {
  image: {
    canExecute: (editor: { can: () => { setImage: (o: { src: string }) => boolean } }) =>
      editor.can().setImage({ src: '' }),
    isActive: (editor: { isActive: (n: string) => boolean }) => editor.isActive('image'),
    isDisabled: undefined as undefined,
    execute: (editor: any) => {
      pickAndUploadImage(editor)
      return editor.chain()
    },
  },
}

/**
 * Extension 없이 paste/drop — PluginKey 충돌·생성 실패로 에디터가 안 뜨는 문제 회피
 * (UEditor editorProps → ProseMirror props)
 */
const editorProps = {
  handlePaste(view: any, event: ClipboardEvent) {
    const items = Array.from(event.clipboardData?.items ?? []) as DataTransferItem[]
    const imageItem = items.find(item => item.type.startsWith('image/'))
    if (!imageItem) return false
    const file = imageItem.getAsFile()
    if (!file) return false
    event.preventDefault()
    void uploadAndInsert(view, file)
    return true
  },
  handleDrop(view: any, event: DragEvent) {
    const files = Array.from(event.dataTransfer?.files ?? []) as File[]
    const image = files.find(f => f.type.startsWith('image/'))
    if (!image) return false
    event.preventDefault()
    void uploadAndInsert(view, image)
    return true
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

function isContentEmpty(md: string): boolean {
  const plain = md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/[#>*_\-~|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return !plain
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
    const text = `${title.value}\n${content.value}`
    const moderation = await checkText(text)
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

    <div class="rounded-xl border border-default overflow-hidden min-h-72">
      <UAlert
        v-if="imageUploadError"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        title="이미지 업로드 실패"
        :description="imageUploadError"
        class="rounded-none"
      />

      <!-- shineb 와 동일: handlers + toolbar, 커스텀 Extension 없음 -->
      <UEditor
        v-model="content"
        content-type="markdown"
        placeholder="내용을 입력하세요. 이미지는 붙여넣기·드래그 또는 툴바 이미지 버튼으로 추가할 수 있어요…"
        :handlers="editorHandlers"
        :editor-props="editorProps"
        :ui="{ content: 'min-h-64 p-4 max-w-none' }"
        class="w-full"
      >
        <template #default="{ editor }">
          <div class="border-b border-default sticky top-0 bg-default z-10 flex items-center gap-1">
            <UEditorToolbar
              :editor="editor"
              :items="toolbarItems"
              class="p-2 flex-1"
            />
            <div
              v-if="imageUploading"
              class="flex items-center gap-1.5 px-2 text-xs text-muted shrink-0"
            >
              <UIcon
                name="i-lucide-loader-circle"
                class="size-3.5 animate-spin"
              />
              업로드 중…
            </div>
          </div>
        </template>
      </UEditor>
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
