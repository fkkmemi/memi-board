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
  title: string
  summary?: string
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
}

export interface BoardUserRole {
  role: 'user' | 'admin'
}

export type BoardListView = 'default' | 'image' | 'video'

export interface BoardCategory {
  /** 글의 category 필드가 참조하는 키 (예: 'notice', 'free') */
  id: string
  /** 화면에 보이는 이름 */
  label: string
  /** 목록 표시 방식. 미지정된 기존 데이터는 default. */
  listView?: BoardListView
}

/** {prefix}Settings/config 문서. 관리자(role:'admin')만 생성/수정, 읽기는 전체 공개. */
export interface BoardSettingsModel {
  categories: BoardCategory[]
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
