export { configureMemiBoard, useMemiBoardConfig } from './config'
export type { MemiBoardConfig, MemiBoardAuthOptions, MemiBoardModerationOptions } from './config'

export { useMemiBoardAuth } from './composables/useMemiBoardAuth'
export { useMemiBoardPosts } from './composables/useMemiBoardPosts'
export type { CreatePostInput, UpdatePostInput } from './composables/useMemiBoardPosts'
export { useMemiBoardComments } from './composables/useMemiBoardComments'
export type { AddCommentInput } from './composables/useMemiBoardComments'
export { useMemiBoardModeration } from './composables/useMemiBoardModeration'
export { useMemiBoardStorage } from './composables/useMemiBoardStorage'
export { useMemiBoardSettings } from './composables/useMemiBoardSettings'

export { default as MemiBoardList } from './components/List.vue'
export { default as MemiBoardDetail } from './components/Detail.vue'
export { default as MemiBoardEditor } from './components/Editor.vue'
export { default as MemiBoardCommentList } from './components/CommentList.vue'
export { default as MemiBoardCommentForm } from './components/CommentForm.vue'
export { default as MemiBoardAttachments } from './components/Attachments.vue'
export { default as MemiBoardSignIn } from './components/SignIn.vue'
export { default as MemiBoardVersionHistory } from './components/VersionHistory.vue'

export { versionHistory } from './data/versionHistory'
export type { VersionHistoryEntry } from './data/versionHistory'

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
