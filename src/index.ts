/** Runtime API — composables / config / types only. UI SFC는 루트 Nuxt 모듈이 등록. */

export { configureMemiBoard, useMemiBoardConfig } from './config'
export type { MemiBoardConfig, MemiBoardAuthOptions, MemiBoardModerationOptions } from './config'

export { useMemiBoardAuth } from './composables/useMemiBoardAuth'
export { useMemiBoardPosts } from './composables/useMemiBoardPosts'
export type { CreatePostInput, UpdatePostInput } from './composables/useMemiBoardPosts'
export { useMemiBoardComments, useMemiBoardReplies } from './composables/useMemiBoardComments'
export type { AddCommentInput, AddReplyInput } from './composables/useMemiBoardComments'
export { useMemiBoardModeration } from './composables/useMemiBoardModeration'
export { useMemiBoardStorage } from './composables/useMemiBoardStorage'
export { useMemiBoardSettings, DEFAULT_CATEGORIES } from './composables/useMemiBoardSettings'
export { useMemiBoardUsers, BOARD_USER_ROLES } from './composables/useMemiBoardUsers'

export { versionHistory } from './data/versionHistory'
export type { VersionHistoryEntry } from './data/versionHistory'

export { formatDate } from './utils/formatDate'
export { slugify } from './utils/slugify'
export {
  DEFAULT_BLOCK_BAN_THRESHOLD,
  DEFAULT_BLOCK_BAN_DECAY_MS,
  effectiveModerationBlockCount,
  isModerationWriteRestricted,
  moderationWriteRestrictedUntilMs,
  formatRestrictedUntilLabel,
} from './utils/moderation-strike'

export type {
  Attachment,
  EditorImageEntry,
  ModerationStatus,
  PostModel,
  PostDetail,
  CommentModel,
  BoardUserRole,
  BoardUserModel,
  BoardCategory,
  BoardListView,
  BoardWriteRole,
  BoardSettingsModel,
  ModerationResult,
} from './types'

export { compressImage } from './utils/compressImage'
export { extractEditorImageUrls } from './utils/extractEditorImageUrls'
export { renderMarkdownToHtml } from './utils/renderMarkdown'
export { storagePathFromDownloadUrl, postNamespaceFromStoragePath } from './utils/storagePath'
export { EDITOR_IMAGE_MAX_BYTES } from './composables/useMemiBoardStorage'
// createPasteImageExtension 은 components/editor 에 두고 SFC 가 상대경로 import —
// core 번들에 @tiptap peer 를 넣으면 Vite optional-peer stub 으로 PluginKey 가 깨진다.
