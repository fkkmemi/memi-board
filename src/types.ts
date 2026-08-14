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
 * Storage: `memiBoardPosts/{postId}/images/...` · `.../images/thumbnails/...`
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
  /** 어느 보드(memiBoardSettings/{boardId})에 속한 글인지 — flat 컬렉션이라 경로 대신 필드로 스코핑한다. */
  boardId: string
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
   * @deprecated 카테고리 개념 제거 — boardId 로 대체.
   * 레거시 읽기 호환용으로만 남을 수 있음.
   */
  category?: string
  attachments?: Attachment[]
  /** 클라이언트 batch로 증감하는 UI 편의 필드 — 보안 판단에 쓰지 않는다. */
  commentCount: number
  /** 클라이언트 트랜잭션으로 증감하는 UI 편의 필드 — 보안 판단에 쓰지 않는다. 실제 좋아요 여부는 memiBoardLikes 컬렉션이 기준. */
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
  /**
   * 작성 직후엔 false(초안·미리보기)로 생성되고, 작성자가 미리보기에서
   * "게시하기"를 눌러야 true가 된다. 목록·인접글 쿼리와 rules가 이 필드로
   * 초안을 걸러낸다.
   */
  isPublished: boolean
  publishedAt?: Timestamp
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

/**
 * @deprecated PostModel 에 boardId 가 이미 있어 더 이상 별도 타입이 필요 없다.
 * 보드 경계를 넘는 작성자별 글 목록(예: /board-user/{uid}) 등에서 PostModel 을 그대로 쓰면 된다.
 */
export type UserPostModel = PostModel

export interface CommentModel {
  id?: string
  /** 속한 글. flat 컬렉션이라 경로 대신 필드로 스코핑한다. */
  postId: string
  /** 부모 글의 boardId — 생성 시 클라이언트가 채우고, rules 가 부모 글과 일치하는지 검증한다. */
  boardId: string
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

/** memiBoardUsers/{uid} — 이메일만 빼고 전부 공개 프로필 정보다(누구나 읽을 수 있음). */
export interface BoardUserModel {
  id: string
  role: BoardUserRole
  displayName?: string | null
  photoURL?: string | null
  moderationBlockCount?: number
  /** AI 글쓰기 도우미 24시간 사용 횟수. */
  aiWritingCount?: number
  /** AI 글쓰기 도우미 현재 24시간 구간 시작 시각. */
  aiWritingWindowAt?: Timestamp
  updatedAt?: Timestamp
  /** 최초 가입일. 기존 사용자는 비어 있고, 백필 스크립트나 다음 로그인 시 채운다. */
  joinedAt?: Timestamp
  /** 최근 방문일. 기존 사용자는 비어 있고, 백필 스크립트나 다음 로그인 시 채운다. */
  lastVisitAt?: Timestamp
  /** 프로필 자기소개. */
  bio?: string | null
}

/** memiBoardUsers/{uid}/private/info — 본인·관리자만 읽는 비공개 정보. */
export interface BoardUserPrivateModel {
  email?: string | null
}

export type AuthorMemoSentiment = 'good' | 'bad'

/** memiBoardUsers/{내uid}/memos/{targetUid} — 본인만 보는 작성자 메모. targetUid는 문서 ID라 필드로 안 둔다. */
export interface AuthorMemoModel {
  text: string
  sentiment?: AuthorMemoSentiment
  updatedAt?: Timestamp
}

export type BoardListView = 'default' | 'dense' | 'image' | 'video'
export type BoardWriteRole = 'user' | 'staff' | 'admin'
/** 게시판 공개 범위. hidden 이면 일반 목록·전체 필터에서 제외되고 글 listed=false. */
export type BoardVisibility = 'public' | 'hidden'

/**
 * 보드 1개 메타 (= 예전 BoardCategory).
 * id 가 곧 boardId — memiBoardSettings/{id} 에 저장.
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

/** memiBoardSettings/{boardId} */
export interface BoardSettingsModel extends Omit<BoardModel, 'id'> {
  updatedAt?: Timestamp
}

/** memiBoardLikes/{postId}_{uid} — "내가 좋아요한 글" 등 uid 기준 교차 조회용 flat 컬렉션. */
export interface BoardLikeModel {
  id?: string
  uid: string
  postId: string
  boardId: string
  createdAt: Timestamp
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
