/** Core API — composables / config / types only. UI SFC 는 memi-board/nuxt 모듈이 등록. */

export { configureMemiBoard, useMemiBoardConfig } from './config'
export type { MemiBoardConfig, MemiBoardAuthOptions, MemiBoardModerationOptions } from './config'

export { useMemiBoardAuth } from './composables/useMemiBoardAuth'
export { useMemiBoardPosts } from './composables/useMemiBoardPosts'
export type { CreatePostInput, UpdatePostInput } from './composables/useMemiBoardPosts'
export { useMemiBoardComments } from './composables/useMemiBoardComments'
export type { AddCommentInput } from './composables/useMemiBoardComments'
export { useMemiBoardModeration } from './composables/useMemiBoardModeration'
export { useMemiBoardStorage } from './composables/useMemiBoardStorage'
export { useMemiBoardSettings, DEFAULT_CATEGORIES } from './composables/useMemiBoardSettings'

export { versionHistory } from './data/versionHistory'
export type { VersionHistoryEntry } from './data/versionHistory'

export { formatDate } from './utils/formatDate'
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
  ModerationStatus,
  PostModel,
  PostDetail,
  CommentModel,
  BoardUserRole,
  BoardCategory,
  BoardSettingsModel,
  ModerationResult,
} from './types'
