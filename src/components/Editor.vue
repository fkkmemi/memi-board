<script setup lang="ts">
/**
 * 글쓰기 폼 — Nuxt UI UEditor + shineb PostEditor 패턴.
 * @see https://ui.nuxt.com/docs/components/editor
 * @see shineb app/components/PostEditor.vue
 *
 * 커스텀은 handlers.image(파일 업로드), YouTube 임베드 + DOM paste/drop.
 */
import { ref, computed, watch } from 'vue'
import { imeSafeSubmitClick, imeSafeSubmitPointerDown } from 'memi-board/runtime'
import Youtube from '@tiptap/extension-youtube'
import type { DropdownMenuItem, EditorSuggestionMenuItem } from '@nuxt/ui'
import { mapEditorItems } from '@nuxt/ui/utils/editor'
import type { Attachment, EditorImageEntry } from 'memi-board/runtime'
import type { WritingAssistantAction } from 'memi-board/runtime'
import {
  useMemiBoardAuth,
  useMemiBoardPosts,
  useMemiBoardModeration,
  useMemiBoardI18n,
  useMemiBoardSettings,
  hasBodyImage,
  hasBodyText,
  plainTextFromHtml,
  useMemiBoardWritingAssistant,
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

const { user, isSignedIn, isAdmin, isWriteRestricted, restrictedMessage } = useMemiBoardAuth()
const resolvedBoardId = computed(() => props.boardId || props.fixedCategory || '')
const { createPostId, getPost, createPost, updatePost, resolveUniqueSlug } = useMemiBoardPosts(resolvedBoardId)
const { getBoard, ensureSettings } = useMemiBoardSettings()
// 보드 설정 언어 → 호스트 언어 순.
const { t, dir, locale } = useMemiBoardI18n({ boardLocale: () => getBoard(resolvedBoardId.value)?.locale })
// provide 한 컴포넌트 자신은 inject 를 못 받으므로 AI 프롬프트 언어를 직접 넘긴다.
const { checkText } = useMemiBoardModeration({ locale })
const { uploadEditorImage } = useMemiBoardStorage()
const { assist } = useMemiBoardWritingAssistant({ locale })

const title = ref('')
/** UEditor content-type=html (shineb 와 동일) */
const content = ref('')
const tags = ref<string[]>([])
const attachments = ref<Attachment[]>([])

/** 이미지 리스트뷰 보드 — 제목 없음, 이미지만 있어도 작성 가능 */
const isImageEditor = computed(() => getBoard(resolvedBoardId.value)?.editorType === 'image')
const isEdit = computed(() => Boolean(props.postId))

const loading = ref(false)
const saving = ref(false)
const submitHint = ref('')
const error = ref('')
const imageUploading = ref(false)
const imageUploadError = ref('')
const imageDialogOpen = ref(false)
const imageDialogEditor = ref<any | null>(null)
const externalImageUrl = ref('')
const externalImageChecking = ref(false)
const externalImageCandidate = computed(() => {
  try {
    return normalizeExternalImageUrl(externalImageUrl.value)
  }
  catch {
    return ''
  }
})
const aiRunning = ref(false)
const aiError = ref('')
const aiCustomDialogOpen = ref(false)
const aiCustomInstruction = ref('')

interface AiPreviewPending {
  action: WritingAssistantAction
  result: string
  hasSelection: boolean
  from: number
  to: number
  /** true면 before/after를 일반 텍스트로, false면 HTML로 렌더링 */
  isPlainText: boolean
}
const aiPreviewOpen = ref(false)
const aiPreviewBefore = ref('')
const aiPreviewPending = ref<AiPreviewPending | null>(null)
const aiPreviewLabels = computed(() => {
  switch (aiPreviewPending.value?.action) {
    case 'title': return { before: t('editor.aiPreview.currentTitle'), after: t('editor.aiPreview.newTitle') }
    case 'continue': return { before: t('editor.aiPreview.currentContent'), after: t('editor.aiPreview.appendedContent') }
    default: return { before: t('editor.aiPreview.before'), after: t('editor.aiPreview.after') }
  }
})
/** 관리자 전용 — 비속어 필터 건너뛰기 (테스트/공지 등 의도적 작성용) */
const adminSkipModeration = ref(false)

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
    imageUploadError.value = t('editor.errors.coverMax', { max: COVER_IMAGE_MAX })
  }
}

function normalizeExternalImageUrl(value: string): string {
  const raw = value.trim()
  if (!raw) throw new Error(t('editor.errors.imageUrlRequired'))
  let url: URL
  try {
    url = new URL(raw)
  }
  catch {
    throw new Error(t('editor.errors.imageUrlInvalid'))
  }
  if (url.protocol !== 'https:') {
    throw new Error(t('editor.errors.imageUrlHttps'))
  }
  if (url.username || url.password) {
    throw new Error(t('editor.errors.imageUrlCredentials'))
  }
  return url.toString()
}

function verifyExternalImage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const timeout = window.setTimeout(() => {
      image.src = ''
      reject(new Error(t('editor.errors.imageTimeout')))
    }, 10_000)
    image.onload = () => {
      window.clearTimeout(timeout)
      if (!image.naturalWidth || !image.naturalHeight) {
        reject(new Error(t('editor.errors.imageNotDisplayable')))
        return
      }
      resolve(url)
    }
    image.onerror = () => {
      window.clearTimeout(timeout)
      reject(new Error(t('editor.errors.imageLoadFailed')))
    }
    image.referrerPolicy = 'no-referrer'
    image.src = url
  })
}

function openImageDialog(editor?: any) {
  imageDialogEditor.value = editor ?? resolveEditor()
  externalImageUrl.value = ''
  imageUploadError.value = ''
  imageDialogOpen.value = true
}

function chooseImageFileFromDialog() {
  const editor = imageDialogEditor.value ?? resolveEditor()
  imageDialogOpen.value = false
  if (isImageEditor.value) pickCoverImages()
  else if (editor) pickAndUploadImage(editor)
}

async function addExternalImage() {
  if (externalImageChecking.value) return
  imageUploadError.value = ''
  externalImageChecking.value = true
  try {
    const url = await verifyExternalImage(normalizeExternalImageUrl(externalImageUrl.value))
    if (isImageEditor.value) {
      appendCoverUrls([url])
    }
    else {
      const editor = imageDialogEditor.value ?? resolveEditor()
      if (!editor) throw new Error(t('editor.errors.editorNotReady'))
      editor.chain().focus().setImage({ src: url }).run()
    }
    imageDialogOpen.value = false
  }
  catch (cause) {
    imageUploadError.value = cause instanceof Error ? cause.message : t('editor.errors.imageLinkFailed')
  }
  finally {
    externalImageChecking.value = false
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

function setRepresentativeCover(index: number) {
  if (index <= 0 || index >= coverSlots.value.length) return
  reorderCover(index, 0)
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
    throw new Error(t('editor.errors.imageOnly'))
  }
  if (file.size > EDITOR_IMAGE_SOURCE_MAX_BYTES) {
    throw new Error(t('editor.errors.imageTooLarge', { mb: EDITOR_IMAGE_SOURCE_MAX_BYTES / 1024 / 1024 }))
  }
  const entry = await uploadEditorImage(file, imageNamespace())
  uploadedEditorImages.value.push(entry)
  return entry
}

async function uploadAndSetImage(editor: any, file: File) {
  // 이미지 보드: TipTap 삽입 금지 → 갤러리에 추가
  if (isImageEditor.value) {
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
    imageUploadError.value = (e as Error).message || t('editor.errors.imageUploadFailed')
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
    imageUploadError.value = t('editor.errors.coverMax', { max: COVER_IMAGE_MAX })
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
      imageUploadError.value = t('editor.errors.coverMax', { max: COVER_IMAGE_MAX })
    }
  }
  catch (e) {
    imageUploadError.value = (e as Error).message || t('editor.errors.imageUploadFailed')
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
  if (isImageEditor.value) {
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
  const src = youtubeUrl(value ?? window.prompt(t('editor.youtubePrompt')))
  if (!src) return false
  return editor.chain().focus().setYoutubeVideo({ src }).run()
}

/** 공식 handlers API — 파일 업로드 또는 외부 HTTPS 이미지 링크 */
const handlers = computed(() => ({
  image: {
    canExecute: (editor: any) =>
      !isImageEditor.value && editor.can().setImage({ src: '' }),
    isActive: (editor: any) => editor.isActive('image'),
    isDisabled: () => isImageEditor.value,
    execute: (editor: any) => {
      if (isImageEditor.value) return editor.chain()
      openImageDialog(editor)
      return editor.chain()
    },
  },
  youtube: {
    canExecute: (editor: any) =>
      !isImageEditor.value
      && editor.can().setYoutubeVideo({ src: 'https://youtu.be/dQw4w9WgXcQ' }),
    isActive: (editor: any) => editor.isActive('youtube'),
    isDisabled: () => isImageEditor.value,
    execute: (editor: any) => {
      if (isImageEditor.value) return editor.chain()
      insertYoutube(editor)
      return editor.chain()
    },
  },
  aiContinue: {
    canExecute: () => !aiRunning.value,
    isActive: () => false,
    isDisabled: () => aiRunning.value,
    execute: (editor: any) => {
      void runWritingAssistant('continue')
      return editor.chain()
    },
  },
}))

const selectedNode = ref<{ node: { type?: string }, pos: number }>()

const suggestionItems = computed(() => {
  const insertItems: EditorSuggestionMenuItem<typeof handlers.value>[] = [
    { kind: 'horizontalRule', label: t('editor.menu.horizontalRule'), icon: 'i-lucide-separator-horizontal' },
  ]
  if (!isImageEditor.value) {
    insertItems.unshift(
      { kind: 'image', label: t('editor.menu.image'), icon: 'i-lucide-image' },
      { kind: 'youtube', label: 'YouTube', icon: 'i-lucide-youtube' },
    )
  }
  return [
    [
      { type: 'label' as const, label: t('editor.menu.ai') },
      { kind: 'aiContinue' as const, label: t('editor.menu.aiContinue'), icon: 'i-lucide-sparkles' },
    ],
    [
      { type: 'label' as const, label: t('editor.menu.style') },
      { kind: 'paragraph' as const, label: t('editor.menu.paragraph'), icon: 'i-lucide-type' },
      { kind: 'heading' as const, level: 1 as const, label: t('editor.menu.heading1'), icon: 'i-lucide-heading-1' },
      { kind: 'heading' as const, level: 2 as const, label: t('editor.menu.heading2'), icon: 'i-lucide-heading-2' },
      { kind: 'heading' as const, level: 3 as const, label: t('editor.menu.heading3'), icon: 'i-lucide-heading-3' },
      { kind: 'bulletList' as const, label: t('editor.menu.bulletList'), icon: 'i-lucide-list' },
      { kind: 'orderedList' as const, label: t('editor.menu.orderedList'), icon: 'i-lucide-list-ordered' },
      { kind: 'blockquote' as const, label: t('editor.menu.blockquote'), icon: 'i-lucide-text-quote' },
      { kind: 'codeBlock' as const, label: t('editor.menu.codeBlock'), icon: 'i-lucide-square-code' },
    ],
    [{ type: 'label' as const, label: t('editor.menu.insert') }, ...insertItems],
  ]
})

const handleItems = (editor: any): DropdownMenuItem[][] => {
  if (!selectedNode.value?.node?.type) return []
  return mapEditorItems(editor, [
    [
      { type: 'label', label: t('editor.blockMenu') },
      {
        label: t('editor.menu.turnInto'),
        icon: 'i-lucide-repeat-2',
        children: [
          { kind: 'paragraph', label: t('editor.menu.paragraph'), icon: 'i-lucide-type' },
          { kind: 'heading', level: 1, label: t('editor.menu.heading1'), icon: 'i-lucide-heading-1' },
          { kind: 'heading', level: 2, label: t('editor.menu.heading2'), icon: 'i-lucide-heading-2' },
          { kind: 'heading', level: 3, label: t('editor.menu.heading3'), icon: 'i-lucide-heading-3' },
          { kind: 'bulletList', label: t('editor.menu.bulletList'), icon: 'i-lucide-list' },
          { kind: 'orderedList', label: t('editor.menu.orderedList'), icon: 'i-lucide-list-ordered' },
          { kind: 'blockquote', label: t('editor.menu.blockquote'), icon: 'i-lucide-text-quote' },
          { kind: 'codeBlock', label: t('editor.menu.codeBlock'), icon: 'i-lucide-square-code' },
        ],
      },
      { kind: 'clearFormatting', pos: selectedNode.value.pos, label: t('editor.menu.resetFormatting'), icon: 'i-lucide-rotate-ccw' },
    ],
    [
      { kind: 'duplicate', pos: selectedNode.value.pos, label: t('editor.menu.duplicate'), icon: 'i-lucide-copy' },
      { kind: 'moveUp', pos: selectedNode.value.pos, label: t('editor.menu.moveUp'), icon: 'i-lucide-arrow-up' },
      { kind: 'moveDown', pos: selectedNode.value.pos, label: t('editor.menu.moveDown'), icon: 'i-lucide-arrow-down' },
    ],
    [{ kind: 'delete', pos: selectedNode.value.pos, label: t('editor.menu.delete'), icon: 'i-lucide-trash' }],
  ], handlers.value) as DropdownMenuItem[][]
}

const toolbarItems = computed(() => {
  const media = isImageEditor.value
    ? [{ kind: 'link' as const, icon: 'i-lucide-link', tooltip: { text: t('editor.toolbar.link') } }]
    : [
        { kind: 'link' as const, icon: 'i-lucide-link', tooltip: { text: t('editor.toolbar.link') } },
        { kind: 'image' as const, icon: 'i-lucide-image', tooltip: { text: t('editor.toolbar.image') } },
        { kind: 'youtube' as const, icon: 'i-lucide-youtube', tooltip: { text: 'YouTube' } },
      ]
  return [
    [
      {
        icon: 'i-lucide-a-large-small',
        tooltip: { text: t('editor.toolbar.format') },
        content: { align: 'start' as const },
        items: [
          [
            { kind: 'mark' as const, mark: 'bold' as const, icon: 'i-lucide-bold', label: t('editor.toolbar.bold') },
            { kind: 'mark' as const, mark: 'italic' as const, icon: 'i-lucide-italic', label: t('editor.toolbar.italic') },
            { kind: 'mark' as const, mark: 'underline' as const, icon: 'i-lucide-underline', label: t('editor.toolbar.underline') },
            { kind: 'mark' as const, mark: 'strike' as const, icon: 'i-lucide-strikethrough', label: t('editor.toolbar.strike') },
          ],
          [
            { kind: 'heading' as const, level: 1 as const, icon: 'i-lucide-heading-1', label: t('editor.toolbar.title') },
            { kind: 'heading' as const, level: 2 as const, icon: 'i-lucide-heading-2', label: t('editor.toolbar.heading') },
            { kind: 'heading' as const, level: 3 as const, icon: 'i-lucide-heading-3', label: t('editor.toolbar.subheading') },
            { kind: 'paragraph' as const, icon: 'i-lucide-text', label: t('editor.toolbar.body') },
            { kind: 'mark' as const, mark: 'code' as const, icon: 'i-lucide-code', label: t('editor.toolbar.mono') },
          ],
          [
            { kind: 'bulletList' as const, icon: 'i-lucide-list', label: t('editor.toolbar.bulletList') },
            { kind: 'orderedList' as const, icon: 'i-lucide-list-ordered', label: t('editor.toolbar.orderedList') },
            { kind: 'blockquote' as const, icon: 'i-lucide-quote', label: t('editor.toolbar.blockquote') },
            { kind: 'codeBlock' as const, icon: 'i-lucide-square-code', label: t('editor.toolbar.codeBlock') },
          ],
          [
            { kind: 'horizontalRule' as const, icon: 'i-lucide-minus', label: t('editor.toolbar.horizontalRule') },
            { kind: 'clearFormatting' as const, icon: 'i-lucide-remove-formatting', label: t('editor.toolbar.clearFormatting') },
          ],
        ],
      },
    ],
    media,
    [
      { kind: 'undo' as const, icon: 'i-lucide-undo-2', tooltip: { text: t('editor.toolbar.undo') } },
      { kind: 'redo' as const, icon: 'i-lucide-redo-2', tooltip: { text: t('editor.toolbar.redo') } },
    ],
  ]
})

const aiMenuItems = computed(() => [
  [
    { label: t('editor.ai.proofread'), icon: 'i-lucide-spell-check-2', onSelect: () => runWritingAssistant('proofread') },
    { label: t('editor.ai.polish'), icon: 'i-lucide-wand-sparkles', onSelect: () => runWritingAssistant('polish') },
    { label: t('editor.ai.continue'), icon: 'i-lucide-text-cursor-input', onSelect: () => runWritingAssistant('continue') },
    { label: t('editor.ai.summarize'), icon: 'i-lucide-scan-text', onSelect: () => runWritingAssistant('summarize') },
  ],
  [
    { label: t('editor.ai.translateEn'), icon: 'i-lucide-languages', onSelect: () => runWritingAssistant('translate-en') },
    { label: t('editor.ai.translateKo'), icon: 'i-lucide-languages', onSelect: () => runWritingAssistant('translate-ko') },
  ],
  [
    { label: t('editor.ai.title'), icon: 'i-lucide-heading-1', onSelect: () => runWritingAssistant('title') },
  ],
  [
    { label: t('editor.ai.custom'), icon: 'i-lucide-pencil-line', onSelect: () => openCustomAssistantDialog() },
  ],
])

function resolveEditor(): any | null {
  const ed = (editorRef.value as any)?.editor
  return ed?.value ?? ed ?? null
}

function openCustomAssistantDialog() {
  aiCustomInstruction.value = ''
  aiCustomDialogOpen.value = true
}

async function submitCustomAssistant() {
  const instruction = aiCustomInstruction.value.trim()
  if (!instruction) return
  aiCustomDialogOpen.value = false
  await runWritingAssistant('custom', instruction)
}

async function runWritingAssistant(action: WritingAssistantAction, customInstruction?: string) {
  const editor = resolveEditor()
  if (!editor || aiRunning.value) return
  aiError.value = ''

  const { from, to } = editor.state.selection
  const hasSelection = from !== to
  const selectedText = hasSelection ? editor.state.doc.textBetween(from, to, '\n') : ''
  const source = action === 'title'
    ? plainTextFromHtml(content.value)
    : hasSelection ? selectedText : content.value

  const isPlainText = hasSelection || action === 'title'

  aiRunning.value = true
  try {
    const result = await assist({
      action,
      content: source,
      title: title.value,
      selection: isPlainText,
      customInstruction,
    })

    aiPreviewBefore.value = action === 'title' ? title.value : source
    aiPreviewPending.value = { action, result, hasSelection, from, to, isPlainText }
    aiPreviewOpen.value = true
  }
  catch (cause) {
    console.warn('[memi-board] writing assistant failed', cause)
    aiError.value = cause instanceof Error ? cause.message : t('editor.ai.failed')
  }
  finally {
    aiRunning.value = false
  }
}

function closeAiPreview() {
  aiPreviewOpen.value = false
  aiPreviewPending.value = null
  aiPreviewBefore.value = ''
}

function applyAiPreview() {
  const pending = aiPreviewPending.value
  const editor = resolveEditor()
  if (!pending || !editor) return
  const { action, result, hasSelection, from, to } = pending

  if (action === 'title') {
    title.value = result.replace(/^['"“”]|['"“”]$/g, '').trim()
  }
  else if (action === 'continue') {
    const position = hasSelection ? to : editor.state.doc.content.size
    editor.chain().focus().insertContentAt(position, result).run()
  }
  else if (hasSelection) {
    editor.chain().focus().insertContentAt({ from, to }, result).run()
  }
  else {
    editor.commands.setContent(result, { emitUpdate: true })
    editor.chain().focus('end').run()
  }
  closeAiPreview()
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
  if (!isImageEditor.value) return
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
      imageUploadError.value = t('editor.errors.pasteAsFile')
    }
  }
}

function onImageFormDrop(e: DragEvent) {
  if (!isImageEditor.value) return
  // 갤러리 카드 순서 변경: capture 단계에서 가로채면 복사가 되므로 패스
  if (isCoverReorderDrag(e.dataTransfer)) return
  const images = Array.from(e.dataTransfer?.files ?? []).filter(f => f.type.startsWith('image/'))
  if (!images.length) return
  e.preventDefault()
  e.stopPropagation()
  void uploadCoverImages(images)
}

function onImageFormDragOver(e: DragEvent) {
  if (!isImageEditor.value) return
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

  if (isImageEditor.value) {
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
  if (isImageEditor.value) {
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
      error.value = t('editor.errors.postNotFound')
      title.value = ''
      content.value = ''
      coverSlots.value = []
      return
    }
    title.value = post.title
    tags.value = post.tags ?? []
    attachments.value = post.attachments ?? []
    attachmentNamespace.value = id
    // 이미지 보드: 본문 이미지를 갤러리로, 에디터에는 글만
    const imageBoard = isImageEditor.value
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
      ? t('editor.errors.loadPermission')
      : t('editor.errors.loadFailed', { message: msg })
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
    return t('editor.errors.editPermission')
  }
  return msg
}

async function handleSubmit() {
  if (saving.value) return
  error.value = ''
  const imageBoard = isImageEditor.value
  if (!imageBoard && !title.value.trim()) {
    error.value = t('editor.errors.titleRequired')
    return
  }
  // 이미지 보드: 갤러리 1장 이상 (TipTap 본문 이미지 불가)
  if (imageBoard && coverSlots.value.length === 0) {
    error.value = t('editor.errors.photoRequired')
    return
  }
  if (!imageBoard && !hasBodyText(content.value) && !hasBodyImage(content.value, attachments.value)) {
    error.value = t('editor.errors.bodyRequired')
    return
  }
  if (!user.value) {
    error.value = t('editor.errors.signInRequired')
    return
  }
  if (!resolvedBoardId.value) {
    error.value = t('editor.errors.boardMissing')
    return
  }
  if (isWriteRestricted.value) {
    error.value = restrictedMessage.value
      || t('editor.errors.writeRestricted')
    return
  }

  saving.value = true
  submitHint.value = t('editor.hint.reviewing')
  // 새 글 slug 중복 확인을 검열과 동시에 시작 — 검열에 걸리면 결과만 버린다.
  const slugPromise = !props.postId && !imageBoard ? resolveUniqueSlug(title.value) : null
  slugPromise?.catch(() => {})
  try {
    const plain = plainTextFromHtml(content.value)
    const moderationText = imageBoard ? plain : `${title.value}\n${plain}`
    const moderation = await checkText(moderationText, { skipFilter: isAdmin.value && adminSkipModeration.value })
    if (moderation.flagged) {
      error.value = moderation.reason || t('editor.errors.moderationBlocked')
      return
    }

    submitHint.value = t('editor.hint.saving')
    const bodyContent = imageBoard && coverSlots.value.length
      ? withCoverImagesInContent(content.value, coverUrls())
      : content.value
    const payload = {
      title: imageBoard ? '' : title.value.trim(),
      content: bodyContent,
      tags: tags.value.map(t => t.trim()).filter(Boolean),
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
        slug: (await slugPromise) ?? undefined,
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
    :dir="dir"
    class="flex flex-col gap-3"
  >
    <USkeleton class="h-10 w-full" />
    <USkeleton class="h-40 w-full" />
  </div>

  <form
    v-else
    :dir="dir"
    class="flex flex-col gap-4"
    @submit.prevent="handleSubmit"
    @paste.capture="onImageFormPaste"
    @drop.capture="onImageFormDrop"
    @dragover.capture="onImageFormDragOver"
  >
    <UInput
      v-if="!isImageEditor"
      v-model="title"
      :placeholder="t('editor.titlePlaceholder')"
      size="lg"
      required
      @keydown.tab.exact.prevent="focusContentFromTitle"
    />
    <!-- 이미지 보드: 여러 장 갤러리 (TipTap 과 분리) -->
    <div
      v-if="isImageEditor"
      class="flex flex-col gap-2"
    >
      <div class="flex items-center justify-between gap-2">
        <p class="text-xs text-muted">
          {{ t('editor.cover.hint', { count: coverSlots.length, max: COVER_IMAGE_MAX }) }}
        </p>
        <div class="flex shrink-0 items-center gap-1">
          <UButton
            type="button"
            size="xs"
            color="neutral"
            variant="ghost"
            :label="t('editor.cover.imageLink')"
            icon="i-lucide-link"
            :disabled="imageUploading || coverSlots.length >= COVER_IMAGE_MAX"
            @click="openImageDialog()"
          />
          <UButton
            v-if="coverSlots.length > 0"
            type="button"
            size="xs"
            color="neutral"
            variant="ghost"
            :label="t('editor.cover.addPhoto')"
            icon="i-lucide-plus"
            :disabled="imageUploading || coverSlots.length >= COVER_IMAGE_MAX"
            @click="pickCoverImages"
          />
        </div>
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
              :alt="t('editor.cover.alt', { n: index + 1 })"
              class="pointer-events-none size-full object-cover"
              draggable="false"
            >
            <span
              v-if="index === 0"
              class="pointer-events-none absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white"
            >
              {{ t('editor.cover.representative') }}
            </span>
            <button
              v-else
              type="button"
              class="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-100 transition hover:bg-primary sm:opacity-0 sm:group-hover:opacity-100"
              :disabled="imageUploading"
              :aria-label="t('editor.cover.setRepresentativeAria', { n: index + 1 })"
              @click.stop="setRepresentativeCover(index)"
              @dragstart.stop.prevent
            >
              {{ t('editor.cover.setRepresentative') }}
            </button>
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
              :aria-label="t('editor.cover.remove')"
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
            <span class="text-[11px] font-medium">{{ t('editor.cover.add') }}</span>
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
            {{ imageUploading ? t('editor.cover.uploading') : t('editor.cover.dropOrClick') }}
          </span>
          <span class="text-xs text-muted">
            {{ t('editor.cover.emptyHint') }}
          </span>
        </button>
      </div>

      <UAlert
        v-if="imageUploadError"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :title="t('editor.cover.uploadTitle')"
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
        v-if="imageUploadError && !isImageEditor"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :title="t('editor.uploadFailed')"
        :description="imageUploadError"
        class="rounded-none rounded-t-xl"
      />

      <UEditor
        ref="editorRef"
        v-model="content"
        content-type="html"
        :extensions="editorExtensions"
        :handlers="handlers"
        :placeholder="isImageEditor ? t('editor.imageContentPlaceholder') : t('editor.contentPlaceholder')"
        :ui="{ content: 'min-h-64 p-4' }"
        class="board-content w-full"
      >
        <template #default="{ editor, handlers: editorHandlers }">
          <div class="flex items-start border-b border-default">
            <UEditorToolbar
              :editor="editor"
              :items="toolbarItems"
              class="min-w-0 flex-1 p-2 flex-wrap"
            />
            <UDropdownMenu :items="aiMenuItems">
              <UButton
                icon="i-lucide-sparkles"
                label="AI"
                color="neutral"
                variant="ghost"
                size="sm"
                class="m-2 shrink-0"
                :loading="aiRunning"
                :disabled="aiRunning"
                :aria-label="t('editor.aiAssistant')"
              />
            </UDropdownMenu>
          </div>
          <UEditorSuggestionMenu :editor="editor" :items="suggestionItems" />

          <UEditorDragHandle v-slot="{ ui, onClick }" :editor="editor" @node-change="selectedNode = $event">
            <UButton
              icon="i-lucide-plus"
              color="neutral"
              variant="ghost"
              size="sm"
              :class="ui.handle()"
              :aria-label="t('editor.insertBlock')"
              @click="(event: MouseEvent) => {
                event.stopPropagation()
                const selected = onClick()
                editorHandlers.suggestion?.execute(editor, { pos: selected?.pos }).run()
              }"
            />
            <UDropdownMenu
              v-slot="{ open }"
              :modal="false"
              :items="handleItems(editor)"
              :content="{ side: 'left' }"
              :ui="{ content: 'w-52', label: 'text-xs' }"
              @update:open="editor.chain().setMeta('lockDragHandle', $event).run()"
            >
              <UButton
                color="neutral"
                variant="ghost"
                active-variant="soft"
                size="sm"
                icon="i-lucide-grip-vertical"
                :active="open"
                :class="ui.handle()"
                :aria-label="t('editor.blockMenu')"
              />
            </UDropdownMenu>
          </UEditorDragHandle>
        </template>
      </UEditor>

      <p
        v-if="aiError"
        class="flex items-center gap-2 border-t border-default px-4 py-2 text-xs text-error"
      >
        <UIcon name="i-lucide-circle-alert" class="size-3.5 shrink-0" />
        {{ aiError }}
      </p>

      <p
        v-if="imageUploading && !isImageEditor"
        class="flex items-center gap-2 border-t border-default px-4 py-2 text-xs text-muted"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="size-3.5 animate-spin"
        />
        {{ t('editor.imageOptimizing') }}
      </p>
    </div>

    <UInputTags
      v-model="tags"
      :placeholder="t('editor.tagsPlaceholder')"
      :delimiter="','"
      add-on-paste
    />

    <!-- 이미지 보드: 본문 이미지 업로드만 (파일 첨부 없음) -->
    <MemiBoardAttachments
      v-if="!isImageEditor"
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

    <div
      v-if="isAdmin"
      class="flex items-center gap-2"
    >
      <USwitch
        v-model="adminSkipModeration"
        size="sm"
        :label="t('editor.skipModeration')"
      />
    </div>

    <div class="flex gap-2">
      <UButton
        type="submit"
        :loading="saving"
        :disabled="isWriteRestricted || imageUploading"
        :label="isEdit ? t('editor.submitEdit') : t('editor.submitNext')"
        @pointerdown="imeSafeSubmitPointerDown"
        @click="imeSafeSubmitClick"
      />
      <UButton
        type="button"
        variant="ghost"
        color="neutral"
        :label="t('common.action.cancel')"
        @click="emit('cancel')"
      />
    </div>
  </form>

  <UModal
    v-model:open="imageDialogOpen"
    :title="t('editor.imageDialog.title')"
    :ui="{ content: 'sm:max-w-lg' }"
  >
    <template #body>
      <div class="flex flex-col gap-4">
        <UButton
          type="button"
          color="neutral"
          variant="outline"
          icon="i-lucide-upload"
          :label="t('editor.imageDialog.chooseFile')"
          block
          :disabled="imageUploading"
          @click="chooseImageFileFromDialog"
        />

        <div class="flex items-center gap-3 text-xs text-muted">
          <span class="h-px flex-1 bg-default" />
          {{ t('editor.imageDialog.orLink') }}
          <span class="h-px flex-1 bg-default" />
        </div>

        <UFormField
          :label="t('editor.imageDialog.urlLabel')"
          :help="t('editor.imageDialog.urlHelp')"
        >
          <UInput
            v-model="externalImageUrl"
            type="url"
            inputmode="url"
            placeholder="https://example.com/image.jpg"
            autocomplete="off"
            class="w-full"
            @keyup.enter="addExternalImage"
          />
        </UFormField>

        <div
          v-if="externalImageCandidate"
          class="flex min-h-32 items-center justify-center overflow-hidden rounded-lg border border-default bg-elevated/30"
        >
          <img
            :src="externalImageCandidate"
            :alt="t('editor.imageDialog.previewAlt')"
            referrerpolicy="no-referrer"
            class="max-h-64 max-w-full object-contain"
          >
        </div>

        <UAlert
          v-if="imageUploadError"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :description="imageUploadError"
        />
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          :disabled="externalImageChecking"
          @click="imageDialogOpen = false"
        >
          {{ t('common.action.cancel') }}
        </UButton>
        <UButton
          type="button"
          icon="i-lucide-link"
          :loading="externalImageChecking"
          :disabled="!externalImageCandidate"
          @click="addExternalImage"
        >
          {{ t('editor.imageDialog.addLink') }}
        </UButton>
      </div>
    </template>
  </UModal>

  <UModal
    v-model:open="aiCustomDialogOpen"
    :title="t('editor.customDialog.title')"
    :ui="{ content: 'sm:max-w-lg' }"
  >
    <template #body>
      <UFormField
        :label="t('editor.customDialog.label')"
        :help="t('editor.customDialog.help')"
      >
        <UTextarea
          v-model="aiCustomInstruction"
          :placeholder="t('editor.customDialog.placeholder')"
          autocomplete="off"
          class="w-full"
          :rows="2"
          autofocus
          @keydown.enter.exact.prevent="submitCustomAssistant"
        />
      </UFormField>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          @click="aiCustomDialogOpen = false"
        >
          {{ t('common.action.cancel') }}
        </UButton>
        <UButton
          type="button"
          icon="i-lucide-sparkles"
          :disabled="!aiCustomInstruction.trim()"
          @click="submitCustomAssistant"
        >
          {{ t('editor.apply') }}
        </UButton>
      </div>
    </template>
  </UModal>

  <UModal
    v-model:open="aiPreviewOpen"
    :title="t('editor.aiPreview.title')"
    :ui="{ content: 'sm:max-w-4xl lg:max-w-6xl' }"
  >
    <template #body>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div class="flex flex-col gap-1">
          <span class="text-xs font-medium text-muted">{{ aiPreviewLabels.before }}</span>
          <div class="overflow-y-auto rounded-lg border border-default bg-elevated/30 p-3 text-sm sm:max-h-96">
            <p
              v-if="aiPreviewPending?.isPlainText"
              class="whitespace-pre-wrap"
            >{{ aiPreviewBefore }}</p>
            <div
              v-else
              v-html="aiPreviewBefore"
            />
          </div>
        </div>
        <div class="flex flex-col gap-1">
          <span class="text-xs font-medium text-primary">{{ aiPreviewLabels.after }}</span>
          <div class="overflow-y-auto rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm sm:max-h-96">
            <p
              v-if="aiPreviewPending?.isPlainText"
              class="whitespace-pre-wrap"
            >{{ aiPreviewPending?.result }}</p>
            <div
              v-else
              v-html="aiPreviewPending?.result"
            />
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          @click="closeAiPreview"
        >
          {{ t('common.action.cancel') }}
        </UButton>
        <UButton
          type="button"
          icon="i-lucide-check"
          @click="applyAiPreview"
        >
          {{ t('editor.apply') }}
        </UButton>
      </div>
    </template>
  </UModal>
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
