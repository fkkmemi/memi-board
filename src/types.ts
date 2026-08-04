import type { Timestamp } from 'firebase/firestore'

export interface Attachment {
  name: string
  url: string
  path: string
  size: number
  type: string
}

/**
 * 에디터 본문 이미지 업로드 결과 (원본 + 썸네일).
 * Storage: `{prefix}/posts/{postId}/images/...` · `.../images/thumbnails/...`
 * 본문 markdown 에는 originalUrl 만 넣고, 썸네일은 목록 카드 등에 활용 가능.
 * 수정 중 버려진 파일은 호스트 스케줄러로 정리 (본문에 없는 path).
 */
export interface EditorImageEntry {
  originalUrl: string
  originalPath: string
  thumbnailUrl: string
  thumbnailPath: string
}

/** MVP: 차단된 글은 쓰기 자체가 일어나지 않으므로 항상 'approved'만 저장된다. */
export type ModerationStatus = 'approved'

export interface PostModel {
  id?: string
  /** 카테고리 내 URL 식별자. 최초 작성 시 생성되고 제목 수정 시에도 유지된다. */
  slug: string
  title: string
  summary?: string
  /** 목록 카드용 대표 이미지. 본문의 첫 이미지 또는 이미지 첨부파일. */
  previewImage?: string
  /** 영상 목록 카드용 URL. 현재 YouTube 임베드 또는 영상 첨부파일. */
  videoUrl?: string
  tags?: string[]
  /** BoardCategory.id 참조. 미지정이면 '전체'로 취급. */
  category?: string
  attachments?: Attachment[]
  /** 클라이언트 batch로 증감하는 UI 편의 필드 — 보안 판단에 쓰지 않는다. */
  commentCount: number
  authorUid: string
  authorName: string | null
  authorPhoto: string | null
  moderationStatus: ModerationStatus
  moderationModel?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface PostDetail extends PostModel {
  content: string
}

export interface CommentModel {
  id?: string
  postId: string
  body: string
  authorUid: string
  authorName: string | null
  authorPhoto: string | null
  moderationStatus: ModerationStatus
  createdAt: Timestamp
  /** 최상위 댓글은 null, 답글은 직접 답변 대상 댓글 ID. */
  parentId?: string | null
  /** 스레드의 최상위 댓글 ID. */
  rootId?: string
  /** 화면 들여쓰기 깊이. 0 → 1 → 2, 이후 2로 고정. */
  depth?: number
  replyToUid?: string | null
  replyToName?: string | null
  /** 최상위 댓글에 저장하는 전체 답글 수. */
  replyCount?: number
  isReply?: boolean
}

export type BoardUserRole = 'admin' | 'staff' | 'user'

export interface BoardUserModel {
  id: string
  role: BoardUserRole
  displayName?: string | null
  email?: string | null
  photoURL?: string | null
  moderationBlockCount?: number
  updatedAt?: Timestamp
}

export type BoardListView = 'default' | 'image' | 'video'
export type BoardWriteRole = 'user' | 'staff' | 'admin'

export interface BoardCategory {
  /** 글의 category 필드가 참조하는 키 (예: 'notice', 'free') */
  id: string
  /** 화면에 보이는 이름 */
  label: string
  /** 목록 표시 방식. 미지정된 기존 데이터는 default. */
  listView?: BoardListView
  /** 글쓰기 최소 역할. 미지정된 기존 데이터는 user. */
  writeRole?: BoardWriteRole
  /** 목록 노출 순서. 서브컬렉션 문서의 정렬 필드. */
  order?: number
}

/** {prefix}Settings/config 메타 문서. 카테고리는 categories 서브컬렉션에 저장한다. */
export interface BoardSettingsModel {
  updatedAt?: Timestamp
}

/** 검열이 어느 단계에서 끝났는지 (호스트/로깅용, UI 노출 없음) */
export type ModerationVia =
  | 'empty'
  | 'disabled'
  | 'local'
  | 'ai'
  | 'restricted'
  | 'ai-error-allow'
  | 'ai-error-block'

export interface ModerationResult {
  flagged: boolean
  category: 'none' | 'abuse' | 'spam' | 'adult' | 'violence' | 'other'
  reason: string
  /** true면 API/파싱 실패로 판단이 불확실함 (onError 옵션에 따라 처리) */
  error?: boolean
  /** 로컬 리스트 / AI / 실패 후 allow|block */
  via?: ModerationVia
}
