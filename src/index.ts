/** Runtime API — composables / config / types only. UI SFC는 루트 Nuxt 모듈이 등록. */

export { configureMemiBoard, useMemiBoardConfig, useBoardPathConfig } from './config'
export type {
  MemiBoardConfig,
  MemiBoardAuthOptions,
  MemiBoardModerationOptions,
  MemiBoardSeoOptions,
} from './config'

export {
  DEFAULT_POSTS_COLLECTION,
  DEFAULT_COMMENTS_COLLECTION,
  DEFAULT_LIKES_COLLECTION,
  DEFAULT_REPORTS_COLLECTION,
  DEFAULT_SETTINGS_COLLECTION,
  DEFAULT_USERS_COLLECTION,
  resolveBoardPathConfig,
  settingsCol,
  settingsDoc,
  postsCol,
  postDoc,
  postBodyDoc,
  commentsCol,
  commentDoc,
  likesCol,
  likeDoc,
  likeDocId,
  reportsCol,
  reportDoc,
  reportDocId,
  boardUsersCol,
  boardUserDoc,
  postStorageFolder,
  boardSsrKey,
} from './utils/boardPaths'
export type { BoardPathConfig } from './utils/boardPaths'

// useMemiBoardPostSeo / useMemiBoardListSeo 는 Nuxt 모듈 auto-import
// (호스트 파이프라인이 컴파일 — dist 번들 + nuxt/app 이중 로딩 방지)
export {
  fetchPublicPostForSeo,
  fetchPublicListForSeo,
  resolvePublicSeoDb,
} from './composables/fetchPublicSeo'
export type { PublicSeoDb } from './composables/fetchPublicSeo'
export {
  boardPostOgTitle,
  boardPostOgDescription,
  boardListOgTitle,
  boardListOgDescription,
  toAbsoluteUrl,
  asHttpUrl,
  toBoardOgImageUrl,
  normalizeBasePath,
} from './utils/boardSeo'
export type { BoardPostSeoPayload, BoardListSeoPayload } from './utils/boardSeo'

export { useMemiBoardAuth } from './composables/useMemiBoardAuth'
export { imeSafeSubmitClick, imeSafeSubmitPointerDown } from './utils/imeSafeSubmit'
export { useMemiBoardPosts, useMemiBoardPostList, useMemiBoardPost } from './composables/useMemiBoardPosts'
export type { CreatePostInput, UpdatePostInput, GetPostBySlugResult, ResolvePostIdResult } from './composables/useMemiBoardPosts'
export { isFirestorePermissionDenied } from './composables/useMemiBoardPosts'
export { useMemiBoardUserPosts } from './composables/useMemiBoardUserPosts'
export { useMemiBoardUserComments } from './composables/useMemiBoardUserComments'
export { useMemiBoardCommentFeed } from './composables/useMemiBoardCommentFeed'
export type { CommentFeedSort } from './composables/useMemiBoardCommentFeed'
export { AUTHOR_MEMO_MAX_LENGTH, useMemiBoardAuthorMemo } from './composables/useMemiBoardAuthorMemo'
export { COMMENT_BODY_MAX_LENGTH, useMemiBoardComments, useMemiBoardReplies } from './composables/useMemiBoardComments'
export type { AddCommentInput, AddReplyInput } from './composables/useMemiBoardComments'
export {
  useMemiBoardLikes,
  useMemiBoardCommentLikes,
  memiBoardCommentLikesKey,
} from './composables/useMemiBoardLikes'
export type { MemiBoardCommentLikesApi } from './composables/useMemiBoardLikes'
export {
  REPORT_DETAIL_MAX_LENGTH,
  REPORT_REASONS,
  reportReasonLabel,
  useMemiBoardReports,
  useMemiBoardReportQueue,
} from './composables/useMemiBoardReports'
export { useMemiBoardViews } from './composables/useMemiBoardViews'
export { useMemiBoardModeration } from './composables/useMemiBoardModeration'
// useMemiBoardStorage(이미지 압축 등 브라우저 전용) — 'memi-board/storage' 서브패스로 분리.
// 여기(SSR로도 로드되는 dist/index.js)에는 절대 다시 넣지 않는다.
export { useMemiBoardSettings, DEFAULT_CATEGORIES, DEFAULT_BOARDS } from './composables/useMemiBoardSettings'
export { canManageBoardByRole, canWriteCommentByRole, isAssignedStaff } from './utils/boardAccess'
export { useMemiBoardUsers, BOARD_USER_ROLES } from './composables/useMemiBoardUsers'
export { useMemiBoardUserProfile } from './composables/useMemiBoardUserProfile'
export { useMemiBoardSections, normalizeBoardSection } from './composables/useMemiBoardSections'
export { useMemiBoardMiniLatest, useMemiBoardMiniPicked } from './composables/useMemiBoardMiniPosts'

export { versionHistory } from './data/versionHistory'
export type { VersionHistoryEntry } from './data/versionHistory'

export {
  MEMI_BOARD_LOCALES,
  DEFAULT_MEMI_BOARD_LOCALE,
  FALLBACK_MEMI_BOARD_LOCALE,
  normalizeMemiBoardLocale,
  memiBoardLocaleInfo,
} from './i18n/locales'
export type { MemiBoardLocale, MemiBoardLocaleInfo } from './i18n/locales'
export { translate, loadMemiBoardLocale, isMemiBoardLocaleLoaded } from './i18n/translate'
export type { MemiBoardMessages, MemiBoardMessageParams } from './i18n/translate'
export { useMemiBoardI18n, memiBoardHostLocaleKey } from './i18n/useMemiBoardI18n'
export type { MemiBoardI18n, UseMemiBoardI18nOptions } from './i18n/useMemiBoardI18n'

export { formatDate, formatFullDate, formatRelativeDate, formatTimestampDetails } from './utils/formatDate'
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
  UserPostModel,
  CommentModel,
  BoardUserRole,
  BoardUserModel,
  BoardUserPrivateModel,
  AuthorMemoModel,
  AuthorMemoSentiment,
  BoardCategory,
  BoardModel,
  BoardListView,
  BoardEditorType,
  BoardWriteRole,
  BoardVisibility,
  BoardSettingsModel,
  BoardLikeModel,
  BoardLikeTarget,
  BoardReportModel,
  BoardReportReason,
  BoardReportStatus,
  BoardReportTarget,
  BoardSection,
  BoardSectionCols,
  BoardSectionHeight,
  BoardSectionKind,
  BoardSectionSort,
  BoardSectionLayout,
  ModerationResult,
} from './types'

export {
  plainTextFromHtml,
  hasBodyText,
  hasBodyImage,
  isContentEmpty,
  titleFromBody,
} from './utils/postBody'
export { extractEditorImageUrls } from './utils/extractEditorImageUrls'
export {
  useMemiBoardWritingAssistant,
  WRITING_ASSISTANT_DAILY_LIMIT,
} from './composables/useMemiBoardWritingAssistant'
export type { WritingAssistantAction } from './composables/useMemiBoardWritingAssistant'
export { useMemiBoardAutoTranslate, localizedText } from './composables/useMemiBoardAutoTranslate'
export type {
  MemiBoardTranslateEntry,
  MemiBoardTranslateOptions,
  MemiBoardLocalizedFields,
} from './composables/useMemiBoardAutoTranslate'
export { renderMarkdownToHtml } from './utils/renderMarkdown'
export { buildPostPreview, youtubeId, videoListCoverUrl } from './utils/postPreview'
export {
  BOARD_SECTION_COLS,
  BOARD_SECTION_KINDS,
  BOARD_SECTION_SORTS,
  boardSectionKinds,
  boardSectionSorts,
  defaultSectionCount,
  clampSectionCount,
  pairSectionCols,
  sectionColClass,
  sectionMinHeight,
  miniPostLink,
  miniCommentLink,
  miniMoreLink,
  miniPostImage,
  miniPostTitle,
  miniViewGroup,
  miniViewLabel,
  miniBoardView,
  miniPostsView,
} from './utils/section'
export type { MiniViewGroup } from './utils/section'
export { storagePathFromDownloadUrl, postNamespaceFromStoragePath } from './utils/storagePath'
// compressImage / EDITOR_IMAGE_*_BYTES — 'memi-board/storage' 서브패스로 이동.
// createPasteImageExtension 은 components/editor 에 두고 SFC 가 상대경로 import —
// core 번들에 @tiptap peer 를 넣으면 Vite optional-peer stub 으로 PluginKey 가 깨진다.
