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
  hasBodyText,
  plainTextFromHtml,
} from 'memi-board/runtime'
import { useMemiBoardStorage, EDITOR_IMAGE_SOURCE_MAX_BYTES } from 'memi-board/storage'
import MemiBoardAttachments from './Attachments.vue'

const props = defineProps<{
  /** 글이 속할 보드 id (필수) */
  boardId: string
  postId?: string
  /** @deprecated boardId 사용 */
  fixedCategory?: string
}>()

const emit = defineEmits<{ saved: [id: string], cancel: [] }>()

const { user, isSignedIn, isWriteRestricted, restrictedMessage } = useMemiBoardAuth()
const resolvedBoardId = computed(() => props.boardId || props.fixedCategory || '')
const { createPostId, getPost, createPost, updatePost } = useMemiBoardPosts(resolvedBoardId)
const { checkText } = useMemiBoardModeration()
const { getBoard, ensureSettings } = useMemiBoardSettings()
const { uploadEditorImage } = useMemiBoardStorage()

const title = ref('')
/** UEditor content-type=html (shineb 와 동일) */
const content = ref('')
const tagsInput = ref('')
const attachments = ref<Attachment[]>([])

/** 이미지 리스트뷰 보드 — 제목 없음, 이미지+본문 필수 */
const isImageListView = computed(() => getBoard(resolvedBoardId.value)?.listView === 'image')
const isEdit = computed(() => Boolean(props.postId))

const loading = ref(false)
const saving = ref(false)
const submitHint = ref('')
const error = ref('')
const imageUploading = ref(false)
const imageUploadError = ref('')

const attachmentNamespace = ref(props.postId ?? createPostId())
const uploadedEditorImages = ref<EditorImageEntry[]>([])
/** 이미지 보드 전용 — 상단 갤러리 (여러 장, TipTap 밖) */
type CoverSlot = { id: string, url: string }
const coverSlots = ref<CoverSlot[]>([])
const coverDropActive = ref(false)
/** 갤러리 카드 드래그 순서 변경 (파일 추가로 오인하지 않도록) */
const COVER_REORDER_MIME = 'application/x-memi-cover-index'
const coverDragFrom = ref<number | null>(null)
const coverDragOver = ref<number | null>(null)
/** 이미지 보드 한 글 최대 장수 */
const COVER_IMAGE_MAX = 20
const editorRef = ref<{ editor?: unknown } | null>(null)

function newCoverId(): string {
  return `cover-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function coverUrls(): string[] {
  return coverSlots.value.map(s => s.url)
}
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

function decodeImgSrc(raw: string): string {
  return raw
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function extractFirstImageSrc(html: string): string | null {
  const m = String(html || '').match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)
  return m?.[1] ? decodeImgSrc(m[1]) : null
}

function extractAllImageSrcs(html: string): string[] {
  const out: string[] = []
  const re = /<img\b[^>]*\bsrc=["']([^"']+)["']/gi
  let m: RegExpExecArray | null
  const s = String(html || '')
  while ((m = re.exec(s)) !== null) {
    const src = decodeImgSrc(m[1]!)
    if (src && !out.includes(src)) out.push(src)
  }
  return out
}

/** 본문에서 img 제거 (이미지 보드: 사진은 갤러리만) */
function stripImgTags(html: string): string {
  return String(html || '')
    .replace(/<img\b[^>]*>/gi, '')
    .replace(/<p>\s*<\/p>/gi, '')
    .trim()
}

/** 저장 시 갤러리 이미지를 본문 앞에 넣어 preview/SEO 파이프라인 유지 */
function withCoverImagesInContent(bodyHtml: string, imageUrls: string[]): string {
  const text = stripImgTags(bodyHtml)
  const body = text || '<p></p>'
  const imgs = imageUrls
    .filter(Boolean)
    .map(url => `<p><img src="${url.replace(/"/g, '%22')}"></p>`)
    .join('')
  return `${imgs}${body}`
}

function appendCoverUrls(urls: string[]) {
  const next = [...coverSlots.value]
  const existing = new Set(next.map(s => s.url))
  for (const url of urls) {
    if (!url || existing.has(url)) continue
    if (next.length >= COVER_IMAGE_MAX) break
    next.push({ id: newCoverId(), url })
    existing.add(url)
  }
  coverSlots.value = next
  if (urls.length && coverSlots.value.length >= COVER_IMAGE_MAX) {
    imageUploadError.value = `사진은 최대 ${COVER_IMAGE_MAX}장까지 올릴 수 있어요.`
  }
}

function removeCoverAt(index: number) {
  coverSlots.value = coverSlots.value.filter((_, i) => i !== index)
  imageUploadError.value = ''
}

function clearCoverImages() {
  coverSlots.value = []
  coverDragFrom.value = null
  coverDragOver.value = null
  imageUploadError.value = ''
}

function isCoverReorderDrag(dt: DataTransfer | null | undefined): boolean {
  if (coverDragFrom.value !== null) return true
  if (!dt) return false
  return Array.from(dt.types).includes(COVER_REORDER_MIME)
}

function reorderCover(from: number, to: number) {
  const list = [...coverSlots.value]
  if (from < 0 || to < 0 || from >= list.length || to >= list.length || from === to) return
  const [item] = list.splice(from, 1)
  if (!item) return
  list.splice(to, 0, item)
  coverSlots.value = list
}

function onCoverItemDragStart(e: DragEvent, index: number) {
  coverDragFrom.value = index
  coverDragOver.value = index
  if (!e.dataTransfer) return
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData(COVER_REORDER_MIME, String(index))
  // Firefox 등: custom type 만으로는 drop 이 막히는 경우 대비
  e.dataTransfer.setData('text/plain', `memi-cover:${index}`)
  // 브라우저가 이미지 파일로 "복사 드롭" 하지 않도록 — drag 소스를 카드로
  const el = e.currentTarget as HTMLElement | null
  if (el) {
    try {
      e.dataTransfer.setDragImage(el, el.clientWidth / 2, el.clientHeight / 2)
    }
    catch {
      // ignore
    }
  }
}

function onCoverItemDragOver(e: DragEvent, index: number) {
  if (!isCoverReorderDrag(e.dataTransfer)) return
  e.preventDefault()
  e.stopPropagation()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  coverDragOver.value = index
}

function onCoverItemDrop(e: DragEvent, toIndex: number) {
  if (!isCoverReorderDrag(e.dataTransfer)) return
  e.preventDefault()
  e.stopPropagation()
  let from = coverDragFrom.value
  const raw = e.dataTransfer?.getData(COVER_REORDER_MIME)
    || e.dataTransfer?.getData('text/plain')?.replace(/^memi-cover:/, '')
  if (raw !== undefined && raw !== '' && !Number.isNaN(Number(raw))) {
    from = Number(raw)
  }
  coverDragFrom.value = null
  coverDragOver.value = null
  if (from == null) return
  reorderCover(from, toIndex)
}

function onCoverItemDragEnd() {
  coverDragFrom.value = null
  coverDragOver.value = null
  coverDropActive.value = false
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
  // 이미지 보드: TipTap 삽입 금지 → 갤러리에 추가
  if (isImageListView.value) {
    await uploadCoverImages([file])
    return
  }
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

async function uploadCoverImages(files: File[]) {
  const images = files.filter(f => f.type.startsWith('image/'))
  if (!images.length) return
  const room = COVER_IMAGE_MAX - coverSlots.value.length
  if (room <= 0) {
    imageUploadError.value = `사진은 최대 ${COVER_IMAGE_MAX}장까지 올릴 수 있어요.`
    return
  }
  const batch = images.slice(0, room)
  imageUploading.value = true
  imageUploadError.value = ''
  try {
    const urls: string[] = []
    for (const file of batch) {
      const entry = await doUploadImage(file)
      urls.push(entry.originalUrl)
    }
    appendCoverUrls(urls)
    if (images.length > batch.length) {
      imageUploadError.value = `사진은 최대 ${COVER_IMAGE_MAX}장까지 올릴 수 있어요.`
    }
  }
  catch (e) {
    imageUploadError.value = (e as Error).message || '이미지 업로드에 실패했습니다.'
  }
  finally {
    imageUploading.value = false
  }
}

function pickCoverImages() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.multiple = true
  input.onchange = () => {
    const files = Array.from(input.files ?? [])
    if (files.length) void uploadCoverImages(files)
  }
  input.click()
}

function onCoverDragOver(e: DragEvent) {
  // 카드 순서 변경 중이면 영역 하이라이트만 (파일 추가로 취급하지 않음)
  if (isCoverReorderDrag(e.dataTransfer)) {
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
    return
  }
  e.preventDefault()
  coverDropActive.value = true
}

function onCoverDragLeave() {
  coverDropActive.value = false
}

function onCoverDrop(e: DragEvent) {
  e.preventDefault()
  coverDropActive.value = false
  // 순서 변경은 카드 onDrop 이 처리 — 여기서 파일 업로드로 오인하지 않음
  if (isCoverReorderDrag(e.dataTransfer)) {
    coverDragFrom.value = null
    coverDragOver.value = null
    return
  }
  const images = Array.from(e.dataTransfer?.files ?? []).filter(f => f.type.startsWith('image/'))
  if (images.length) void uploadCoverImages(images)
}

function pickAndUploadImage(editor: any) {
  if (isImageListView.value) {
    pickCoverImages()
    return
  }
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
const handlers = computed(() => ({
  image: {
    canExecute: (editor: any) =>
      !isImageListView.value && editor.can().setImage({ src: '' }),
    isActive: (editor: any) => editor.isActive('image'),
    isDisabled: () => isImageListView.value,
    execute: (editor: any) => {
      if (isImageListView.value) return editor.chain()
      pickAndUploadImage(editor)
      return editor.chain()
    },
  },
  youtube: {
    canExecute: (editor: any) =>
      !isImageListView.value
      && editor.can().setYoutubeVideo({ src: 'https://youtu.be/dQw4w9WgXcQ' }),
    isActive: (editor: any) => editor.isActive('youtube'),
    isDisabled: () => isImageListView.value,
    execute: (editor: any) => {
      if (isImageListView.value) return editor.chain()
      insertYoutube(editor)
      return editor.chain()
    },
  },
}))

const toolbarItems = computed(() => {
  const media = isImageListView.value
    ? [{ kind: 'link' as const, icon: 'i-lucide-link' }]
    : [
        { kind: 'link' as const, icon: 'i-lucide-link' },
        { kind: 'image' as const, icon: 'i-lucide-image' },
        { kind: 'youtube' as const, icon: 'i-lucide-youtube', label: 'YouTube' },
      ]
  return [
    [
      { kind: 'heading' as const, level: 1 as const, icon: 'i-lucide-heading-1' },
      { kind: 'heading' as const, level: 2 as const, icon: 'i-lucide-heading-2' },
      { kind: 'heading' as const, level: 3 as const, icon: 'i-lucide-heading-3' },
    ],
    [
      { kind: 'mark' as const, mark: 'bold' as const, icon: 'i-lucide-bold' },
      { kind: 'mark' as const, mark: 'italic' as const, icon: 'i-lucide-italic' },
      { kind: 'mark' as const, mark: 'underline' as const, icon: 'i-lucide-underline' },
      { kind: 'mark' as const, mark: 'strike' as const, icon: 'i-lucide-strikethrough' },
      { kind: 'mark' as const, mark: 'code' as const, icon: 'i-lucide-code' },
    ],
    [
      { kind: 'bulletList' as const, icon: 'i-lucide-list' },
      { kind: 'orderedList' as const, icon: 'i-lucide-list-ordered' },
      { kind: 'blockquote' as const, icon: 'i-lucide-quote' },
      { kind: 'codeBlock' as const, icon: 'i-lucide-square-code' },
    ],
    media,
    [
      { kind: 'horizontalRule' as const, icon: 'i-lucide-minus' },
      { kind: 'undo' as const, icon: 'i-lucide-undo-2' },
      { kind: 'redo' as const, icon: 'i-lucide-redo-2' },
      { kind: 'clearFormatting' as const, icon: 'i-lucide-remove-formatting' },
    ],
  ]
})

function resolveEditor(): any | null {
  const ed = (editorRef.value as any)?.editor
  return ed?.value ?? ed ?? null
}

// 제목에서 Tab 누르면 툴바 버튼들 건너뛰고 본문으로 바로 이동
function focusContentFromTitle() {
  resolveEditor()?.chain().focus().run()
}

function clipboardImageFile(dt: DataTransfer | null | undefined): File | null {
  if (!dt) return null
  const fromFiles = Array.from(dt.files ?? []).find(f => f.type.startsWith('image/'))
  if (fromFiles) return fromFiles
  const imageItem = Array.from(dt.items ?? []).find(
    i => i.kind === 'file' && i.type.startsWith('image/'),
  )
  return imageItem?.getAsFile() || null
}

/**
 * 이미지 보드 폼 전체(capture): 사진은 무조건 드롭존.
 * TipTap 까지 이벤트가 내려가지 않도록 stopPropagation.
 */
function onImageFormPaste(e: ClipboardEvent) {
  if (!isImageListView.value) return
  const imageFile = clipboardImageFile(e.clipboardData)
  if (imageFile) {
    e.preventDefault()
    e.stopPropagation()
    void uploadCoverImages([imageFile])
    return
  }
  // HTML 로 이미지 붙여넣기 — 본문 삽입 차단, 갤러리에 추가
  const html = e.clipboardData?.getData('text/html') || ''
  if (/<img\b/i.test(html)) {
    e.preventDefault()
    e.stopPropagation()
    const srcs = extractAllImageSrcs(html).filter(s => /^https?:\/\//i.test(s))
    if (srcs.length) {
      appendCoverUrls(srcs)
      imageUploadError.value = ''
    }
    else {
      imageUploadError.value = '사진은 위 영역에 파일로 붙여넣거나 드래그해 주세요.'
    }
  }
}

function onImageFormDrop(e: DragEvent) {
  if (!isImageListView.value) return
  // 갤러리 카드 순서 변경: capture 단계에서 가로채면 복사가 되므로 패스
  if (isCoverReorderDrag(e.dataTransfer)) return
  const images = Array.from(e.dataTransfer?.files ?? []).filter(f => f.type.startsWith('image/'))
  if (!images.length) return
  e.preventDefault()
  e.stopPropagation()
  void uploadCoverImages(images)
}

function onImageFormDragOver(e: DragEvent) {
  if (!isImageListView.value) return
  if (isCoverReorderDrag(e.dataTransfer)) return
  if (Array.from(e.dataTransfer?.types ?? []).includes('Files')) {
    e.preventDefault()
  }
}

/**
 * 일반 보드: 에디터에 이미지 삽입.
 * 이미지 보드: 폼 capture 가 이미 처리 — 여기 오면 차단만 (TipTap 삽입 금지).
 */
function onEditorRootPaste(e: ClipboardEvent) {
  const dt = e.clipboardData
  if (!dt) return

  const imageFile = clipboardImageFile(dt)

  if (isImageListView.value) {
    // 폼에서 못 잡은 경우 대비 — 절대 TipTap 에 이미지 넣지 않음
    if (imageFile || /<img\b/i.test(dt.getData('text/html') || '')) {
      e.preventDefault()
      e.stopPropagation()
      if (imageFile) void uploadCoverImages([imageFile])
      else {
        const srcs = extractAllImageSrcs(dt.getData('text/html') || '')
          .filter(s => /^https?:\/\//i.test(s))
        if (srcs.length) appendCoverUrls(srcs)
      }
    }
    return
  }

  const editor = resolveEditor()
  if (!editor) return

  if (imageFile) {
    e.preventDefault()
    e.stopPropagation()
    void uploadAndSetImage(editor, imageFile)
    return
  }

  const src = youtubeUrl(dt.getData('text/plain'))
  if (!src) return
  e.preventDefault()
  e.stopPropagation()
  insertYoutube(editor, src)
}

function onEditorRootDrop(e: DragEvent) {
  const files = Array.from(e.dataTransfer?.files ?? [])
  const image = files.find(f => f.type.startsWith('image/'))
  if (!image) return
  e.preventDefault()
  e.stopPropagation()
  if (isImageListView.value) {
    void uploadCoverImages([image])
    return
  }
  const editor = resolveEditor()
  if (!editor) return
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
      coverSlots.value = []
      return
    }
    title.value = post.title
    tagsInput.value = (post.tags ?? []).join(', ')
    attachments.value = post.attachments ?? []
    attachmentNamespace.value = id
    // 이미지 보드: 본문 이미지를 갤러리로, 에디터에는 글만
    const imageBoard = isImageListView.value
      || Boolean(post.previewImage && !post.title?.trim())
    if (imageBoard) {
      const fromBody = extractAllImageSrcs(post.content)
      const urls = fromBody.length
        ? fromBody
        : (post.previewImage ? [post.previewImage] : [])
      coverSlots.value = urls.map(url => ({ id: newCoverId(), url }))
      content.value = stripImgTags(post.content)
    }
    else {
      coverSlots.value = []
      content.value = post.content
    }
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
      coverSlots.value = []
      void ensureSettings().catch(() => {})
    }
  },
  { immediate: true },
)

function friendlyWriteError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  if (msg.includes('permission-denied') || msg.includes('Permission denied')) {
    return '수정 권한이 없습니다. 본인이 작성한 글인지, 로그인이 유지되는지 확인해 주세요.'
  }
  return msg
}

async function handleSubmit() {
  error.value = ''
  const imageBoard = isImageListView.value
  if (!imageBoard && !title.value.trim()) {
    error.value = '제목을 입력해 주세요.'
    return
  }
  if (!hasBodyText(content.value)) {
    error.value = imageBoard
      ? '내용을 입력해 주세요.'
      : '본문에 글자를 입력해 주세요. 이미지나 첨부만으로는 게시할 수 없습니다.'
    return
  }
  // 이미지 보드: 갤러리 1장 이상 (TipTap 본문 이미지 불가)
  if (imageBoard && coverSlots.value.length === 0) {
    error.value = '사진을 한 장 이상 올려 주세요.'
    return
  }
  if (!user.value) {
    error.value = '로그인이 필요합니다.'
    return
  }
  if (!resolvedBoardId.value) {
    error.value = '게시판(보드)이 지정되지 않았습니다.'
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
    const plain = plainTextFromHtml(content.value)
    const moderationText = imageBoard ? plain : `${title.value}\n${plain}`
    const moderation = await checkText(moderationText)
    if (moderation.flagged) {
      error.value = moderation.reason || '게시할 수 없는 내용이 포함되어 있습니다.'
      return
    }

    submitHint.value = '저장하는 중…'
    const tags = tagsInput.value.split(',').map(t => t.trim()).filter(Boolean)
    const bodyContent = imageBoard && coverSlots.value.length
      ? withCoverImagesInContent(content.value, coverUrls())
      : content.value
    const payload = {
      title: imageBoard ? '' : title.value.trim(),
      content: bodyContent,
      tags,
      // 이미지 보드: 파일 첨부 없음 (커버는 본문 앞 img 로 저장)
      attachments: imageBoard ? [] : attachments.value,
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
    @paste.capture="onImageFormPaste"
    @drop.capture="onImageFormDrop"
    @dragover.capture="onImageFormDragOver"
  >
    <UInput
      v-if="!isImageListView"
      v-model="title"
      placeholder="제목"
      size="lg"
      required
      @keydown.tab.exact.prevent="focusContentFromTitle"
    />
    <!-- 이미지 보드: 여러 장 갤러리 (TipTap 과 분리) -->
    <div
      v-if="isImageListView"
      class="flex flex-col gap-2"
    >
      <div class="flex items-center justify-between gap-2">
        <p class="text-xs text-muted">
          사진 {{ coverSlots.length }}/{{ COVER_IMAGE_MAX }} · 끌어 순서 변경 · 파일 드롭/붙여넣기로 추가
        </p>
        <UButton
          v-if="coverSlots.length > 0"
          type="button"
          size="xs"
          color="neutral"
          variant="ghost"
          label="사진 추가"
          icon="i-lucide-plus"
          :disabled="imageUploading || coverSlots.length >= COVER_IMAGE_MAX"
          @click="pickCoverImages"
        />
      </div>

      <div
        class="rounded-xl border-2 border-dashed p-2 transition-colors sm:p-3"
        :class="coverDropActive
          ? 'border-primary bg-primary/5'
          : 'border-default bg-elevated/30'"
        @dragover="onCoverDragOver"
        @dragleave="onCoverDragLeave"
        @drop="onCoverDrop"
      >
        <div
          v-if="coverSlots.length"
          class="grid grid-cols-3 gap-2 sm:grid-cols-4"
        >
          <div
            v-for="(slot, index) in coverSlots"
            :key="slot.id"
            draggable="true"
            class="group relative aspect-square cursor-grab overflow-hidden rounded-lg bg-default ring-1 active:cursor-grabbing"
            :class="coverDragOver === index && coverDragFrom !== null && coverDragFrom !== index
              ? 'ring-2 ring-primary ring-offset-1 ring-offset-default'
              : coverDragFrom === index
                ? 'ring-default opacity-50'
                : 'ring-default'"
            @dragstart="onCoverItemDragStart($event, index)"
            @dragover="onCoverItemDragOver($event, index)"
            @drop="onCoverItemDrop($event, index)"
            @dragend="onCoverItemDragEnd"
          >
            <img
              :src="slot.url"
              :alt="`사진 ${index + 1}`"
              class="pointer-events-none size-full object-cover"
              draggable="false"
            >
            <span
              v-if="index === 0"
              class="pointer-events-none absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white"
            >
              대표
            </span>
            <span
              class="pointer-events-none absolute bottom-1 left-1 rounded bg-black/50 px-1 py-0.5 text-[10px] text-white/90"
              aria-hidden="true"
            >
              ⋮⋮
            </span>
            <button
              type="button"
              class="absolute right-1 top-1 flex size-7 items-center justify-center rounded-full bg-black/60 text-white opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100"
              :disabled="imageUploading"
              aria-label="사진 제거"
              @click.stop="removeCoverAt(index)"
              @dragstart.stop.prevent
            >
              <UIcon name="i-lucide-x" class="size-3.5" />
            </button>
          </div>

          <!-- 추가 칸 -->
          <button
            v-if="coverSlots.length < COVER_IMAGE_MAX"
            type="button"
            class="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-default bg-default/50 text-muted transition hover:border-primary hover:text-primary"
            :disabled="imageUploading"
            @click="pickCoverImages"
          >
            <UIcon
              :name="imageUploading ? 'i-lucide-loader-circle' : 'i-lucide-plus'"
              class="size-6"
              :class="imageUploading ? 'animate-spin' : ''"
            />
            <span class="text-[11px] font-medium">추가</span>
          </button>
        </div>

        <button
          v-else
          type="button"
          class="flex w-full flex-col items-center justify-center gap-2 px-4 py-12 text-center"
          :disabled="imageUploading"
          @click="pickCoverImages"
        >
          <UIcon
            :name="imageUploading ? 'i-lucide-loader-circle' : 'i-lucide-image-plus'"
            class="size-10 text-muted"
            :class="imageUploading ? 'animate-spin' : ''"
          />
          <span class="text-sm font-medium text-highlighted">
            {{ imageUploading ? '업로드 중…' : '사진을 놓거나 클릭해서 추가' }}
          </span>
          <span class="text-xs text-muted">
            여러 장 선택 가능 · 첫 장이 목록 대표 · 끌어 순서 변경
          </span>
        </button>
      </div>

      <UAlert
        v-if="imageUploadError"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        title="업로드"
        :description="imageUploadError"
      />
    </div>

    <div
      class="rounded-xl border border-default overflow-hidden"
      @paste.capture="onEditorRootPaste"
      @drop.capture="onEditorRootDrop"
      @dragover="onEditorRootDragOver"
    >
      <UAlert
        v-if="imageUploadError && !isImageListView"
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
        :placeholder="isImageListView ? '내용을 입력하세요…' : '본문을 입력하세요…'"
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
        v-if="imageUploading && !isImageListView"
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

    <!-- 이미지 보드: 본문 이미지 업로드만 (파일 첨부 없음) -->
    <MemiBoardAttachments
      v-if="!isImageListView"
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
        :label="isEdit ? '수정 완료' : '다음: 미리보기'"
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
.board-content :deep(iframe[src*="youtube.com"]),
.board-content :deep(iframe[src*="youtube-nocookie.com"]),
.board-content :deep(iframe[src*="youtu.be"]) {
  width: 100%;
  max-width: 640px;
  aspect-ratio: 16 / 9;
  height: auto;
  border: 0;
  border-radius: 0.75rem;
}
</style>
