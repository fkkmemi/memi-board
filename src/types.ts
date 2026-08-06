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
 * Storage: `memiBoards/{boardId}/posts/{postId}/images/...` · `.../images/thumbnails/...`
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
  /**
   * @deprecated 카테고리 개념 제거 — 글은 memiBoards/{boardId}/posts 에만 존재.
   * 레거시 읽기 호환용으로만 남을 수 있음.
   */
  category?: string
  attachments?: Attachment[]
  /** 클라이언트 batch로 증감하는 UI 편의 필드 — 보안 판단에 쓰지 않는다. */
  commentCount: number
  /** 클라이언트 트랜잭션으로 증감하는 UI 편의 필드 — 보안 판단에 쓰지 않는다. 실제 좋아요 여부는 likes/{uid} 서브컬렉션이 기준. */
  likeCount: number
  /**
   * 조회수. 로그인 없이 +1 가능(rules 가 viewCount 단독 증가만 허용).
   * 세션당 1회로 클라이언트 중복을 줄인다. 기존 문서엔 없을 수 있음(표시 시 0).
   */
  viewCount?: number
  /**
   * 공개 목록 노출 여부. 카테고리 visibility 가 hidden 이면 false.
   * 목록 쿼리·rules 가 이 필드를 본다(미지정 레거시는 true 취급).
   */
  listed?: boolean
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
  /** 기존 댓글에는 없을 수 있다. 댓글 수정 기능에서 갱신한다. */
  updatedAt?: Timestamp
  /** 관리자·스태프의 블라인드 상태. 본문 데이터는 보존한다. */
  isBlinded?: boolean
  moderatedAt?: Timestamp
  moderatedBy?: string
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

export type BoardListView = 'default' | 'dense' | 'image' | 'video'
export type BoardWriteRole = 'user' | 'staff' | 'admin'
/** 게시판 공개 범위. hidden 이면 일반 목록·전체 필터에서 제외되고 글 listed=false. */
export type BoardVisibility = 'public' | 'hidden'

/**
 * 보드 1개 메타 (= 예전 BoardCategory).
 * id 가 곧 boardId — memiBoards/{id}/settings/config 에 저장.
 */
export interface BoardModel {
  /** boardId (예: 'notice', 'free') */
  id: string
  label: string
  description?: string
  /**
   * 보임/숨김. hidden = 일기장·비공개.
   * 보드 목록·칩에서 제외, 글 listed=false. 미지정은 public.
   */
  visibility?: BoardVisibility
  listView?: BoardListView
  writeRole?: BoardWriteRole
  commentWriteRole?: BoardWriteRole
  /**
   * writeRole/commentWriteRole 가 'staff'일 때 허용 스태프 uid.
   * 비어있으면 스태프 전체, 관리자는 항상 통과.
   */
  allowedStaffUids?: string[]
  /** 보드 목록 정렬 */
  order?: number
}

/** @deprecated BoardModel 사용 — 카테고리 개념 제거, id = boardId */
export type BoardCategory = BoardModel

/** memiBoards/{boardId}/settings/config */
export interface BoardSettingsModel extends Omit<BoardModel, 'id'> {
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
