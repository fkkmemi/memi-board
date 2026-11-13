/**
 * Firestore / Storage 경로
 *
 * ```
 * memiBoardUsers/{uid}
 * memiBoardSettings/{boardId}                  // 보드 설정 (구 memiBoards/{id} stub + settings/config 통합)
 * memiBoardPosts/{postId}                      // boardId 는 문서 필드
 * memiBoardPosts/{postId}/body/main
 * memiBoardPosts/{postId}/revisions/{n}        // 수정 직전 상태. n = 덮어쓰인 revision 번호
 * memiBoardComments/{commentId}                // postId, boardId 는 문서 필드
 * memiBoardComments/{commentId}/revisions/{n}  // 댓글 수정 직전 상태
 * memiBoardLikes/{targetId}_{uid}              // 글: postId_uid / 댓글: commentId_uid
 * memiBoardReports/{postId}_{uid}              // 글 신고. 유저당 글당 1건
 * memiBoardReports/c_{commentId}_{uid}         // 댓글 신고. 유저당 댓글당 1건
 * ```
 *
 * Storage: `memiBoardPosts/{postId}/...` (postId 가 전역 고유이므로 boardId 불필요)
 *
 * 카테고리 개념 없음 — 예전 category id 가 곧 boardId. boardId/postId 는 경로가
 * 아니라 문서 필드이므로, 보드/글 단위로 좁혀야 하는 쿼리는 항상 where 필터로
 * 스코핑한다 (컬렉션 자체는 항상 최상위 flat 컬렉션).
 */
import {
  collection,
  doc,
  type CollectionReference,
  type DocumentReference,
  type Firestore,
} from 'firebase/firestore'

export const DEFAULT_POSTS_COLLECTION = 'memiBoardPosts'
export const DEFAULT_COMMENTS_COLLECTION = 'memiBoardComments'
export const DEFAULT_LIKES_COLLECTION = 'memiBoardLikes'
export const DEFAULT_REPORTS_COLLECTION = 'memiBoardReports'
export const DEFAULT_SETTINGS_COLLECTION = 'memiBoardSettings'
export const DEFAULT_USERS_COLLECTION = 'memiBoardUsers'

export interface BoardPathConfig {
  postsCollection: string
  commentsCollection: string
  likesCollection: string
  reportsCollection: string
  settingsCollection: string
  usersCollection: string
}

export function resolveBoardPathConfig(input: {
  postsCollection?: string
  commentsCollection?: string
  likesCollection?: string
  reportsCollection?: string
  settingsCollection?: string
  usersCollection?: string
}): BoardPathConfig {
  return {
    postsCollection: input.postsCollection?.trim() || DEFAULT_POSTS_COLLECTION,
    commentsCollection: input.commentsCollection?.trim() || DEFAULT_COMMENTS_COLLECTION,
    likesCollection: input.likesCollection?.trim() || DEFAULT_LIKES_COLLECTION,
    reportsCollection: input.reportsCollection?.trim() || DEFAULT_REPORTS_COLLECTION,
    settingsCollection: input.settingsCollection?.trim() || DEFAULT_SETTINGS_COLLECTION,
    usersCollection: input.usersCollection?.trim() || DEFAULT_USERS_COLLECTION,
  }
}

/** 보드 설정 목록/문서 — 구 memiBoards/{boardId} stub + settings/config 통합 */
export function settingsCol(db: Firestore, cfg: BoardPathConfig): CollectionReference {
  return collection(db, cfg.settingsCollection)
}

export function settingsDoc(
  db: Firestore,
  cfg: BoardPathConfig,
  boardId: string,
): DocumentReference {
  return doc(db, cfg.settingsCollection, boardId)
}

export function postsCol(db: Firestore, cfg: BoardPathConfig): CollectionReference {
  return collection(db, cfg.postsCollection)
}

export function postDoc(db: Firestore, cfg: BoardPathConfig, postId: string): DocumentReference {
  return doc(db, cfg.postsCollection, postId)
}

export function postBodyDoc(
  db: Firestore,
  cfg: BoardPathConfig,
  postId: string,
): DocumentReference {
  return doc(db, cfg.postsCollection, postId, 'body', 'main')
}

/** 글 수정 기록. 문서 ID는 덮어쓰인 revision 번호(0, 1, 2…)다. */
export function postRevisionsCol(
  db: Firestore,
  cfg: BoardPathConfig,
  postId: string,
): CollectionReference {
  return collection(db, cfg.postsCollection, postId, 'revisions')
}

export function postRevisionDoc(
  db: Firestore,
  cfg: BoardPathConfig,
  postId: string,
  revision: number,
): DocumentReference {
  return doc(db, cfg.postsCollection, postId, 'revisions', String(revision))
}

export function commentsCol(db: Firestore, cfg: BoardPathConfig): CollectionReference {
  return collection(db, cfg.commentsCollection)
}

export function commentDoc(
  db: Firestore,
  cfg: BoardPathConfig,
  commentId: string,
): DocumentReference {
  return doc(db, cfg.commentsCollection, commentId)
}

/** 댓글 수정 기록. 문서 ID는 덮어쓰인 revision 번호(0, 1, 2…)다. */
export function commentRevisionsCol(
  db: Firestore,
  cfg: BoardPathConfig,
  commentId: string,
): CollectionReference {
  return collection(db, cfg.commentsCollection, commentId, 'revisions')
}

export function commentRevisionDoc(
  db: Firestore,
  cfg: BoardPathConfig,
  commentId: string,
  revision: number,
): DocumentReference {
  return doc(db, cfg.commentsCollection, commentId, 'revisions', String(revision))
}

export function likesCol(db: Firestore, cfg: BoardPathConfig): CollectionReference {
  return collection(db, cfg.likesCollection)
}

/** 좋아요 문서ID 관례: `${targetId}_{uid}` — targetId 는 postId 또는 commentId. 토글은 create-or-delete */
export function likeDocId(targetId: string, uid: string): string {
  return `${targetId}_${uid}`
}

export function likeDoc(
  db: Firestore,
  cfg: BoardPathConfig,
  targetId: string,
  uid: string,
): DocumentReference {
  return doc(db, cfg.likesCollection, likeDocId(targetId, uid))
}

export function reportsCol(db: Firestore, cfg: BoardPathConfig): CollectionReference {
  return collection(db, cfg.reportsCollection)
}

/** 신고 문서ID: `${postId}_{uid}` — 유저당 글당 1건 */
export function reportDocId(postId: string, uid: string): string {
  return `${postId}_${uid}`
}

export function reportDoc(
  db: Firestore,
  cfg: BoardPathConfig,
  postId: string,
  uid: string,
): DocumentReference {
  return doc(db, cfg.reportsCollection, reportDocId(postId, uid))
}

/** 댓글 신고 문서ID: `c_${commentId}_{uid}` — 유저당 댓글당 1건. 글 신고 ID 와 겹치지 않게 접두어를 붙인다. */
export function commentReportDocId(commentId: string, uid: string): string {
  return `c_${commentId}_${uid}`
}

export function commentReportDoc(
  db: Firestore,
  cfg: BoardPathConfig,
  commentId: string,
  uid: string,
): DocumentReference {
  return doc(db, cfg.reportsCollection, commentReportDocId(commentId, uid))
}

/** 이미 읽은 신고 문서를 ID 그대로 다시 가리킨다 (글·댓글 신고 공통). */
export function reportDocById(db: Firestore, cfg: BoardPathConfig, reportId: string): DocumentReference {
  return doc(db, cfg.reportsCollection, reportId)
}

export function boardUsersCol(db: Firestore, cfg: BoardPathConfig): CollectionReference {
  return collection(db, cfg.usersCollection)
}

export function boardUserDoc(
  db: Firestore,
  cfg: BoardPathConfig,
  uid: string,
): DocumentReference {
  return doc(db, cfg.usersCollection, uid)
}

/** 이메일만 담는 비공개 문서 — memiBoardUsers/{uid}는 공개 프로필이라 이메일만 분리한다. */
export function boardUserPrivateDoc(
  db: Firestore,
  cfg: BoardPathConfig,
  uid: string,
): DocumentReference {
  return doc(db, cfg.usersCollection, uid, 'private', 'info')
}

/** 본인만 보는 작성자 메모 — 문서 ID 자체가 targetUid라 대상당 메모가 하나로 고정된다. */
export function authorMemoDoc(
  db: Firestore,
  cfg: BoardPathConfig,
  viewerUid: string,
  targetUid: string,
): DocumentReference {
  return doc(db, cfg.usersCollection, viewerUid, 'memos', targetUid)
}

/** 내가 남긴 작성자 메모 전체 — 목록 화면에서 한 번의 쿼리로 모두 불러올 때 쓴다. */
export function authorMemosCollection(
  db: Firestore,
  cfg: BoardPathConfig,
  viewerUid: string,
): CollectionReference {
  return collection(db, cfg.usersCollection, viewerUid, 'memos')
}

/** postId 가 전역 고유이므로 boardId 프리픽스 불필요 */
export function postStorageFolder(cfg: BoardPathConfig, postId: string): string {
  return `${cfg.postsCollection}/${postId}`
}

export function boardSsrKey(cfg: BoardPathConfig, suffix: string): string {
  return `${cfg.postsCollection}/${cfg.usersCollection}/${suffix}`
}
