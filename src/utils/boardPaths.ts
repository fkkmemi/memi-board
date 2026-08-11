/**
 * Firestore / Storage 경로
 *
 * ```
 * memiBoardUsers/{uid}
 * memiBoardSettings/{boardId}                  // 보드 설정 (구 memiBoards/{id} stub + settings/config 통합)
 * memiBoardPosts/{postId}                      // boardId 는 문서 필드
 * memiBoardPosts/{postId}/body/main
 * memiBoardComments/{commentId}                // postId, boardId 는 문서 필드
 * memiBoardLikes/{postId}_{uid}                // uid, postId, boardId 는 문서 필드
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
export const DEFAULT_SETTINGS_COLLECTION = 'memiBoardSettings'
export const DEFAULT_USERS_COLLECTION = 'memiBoardUsers'

export interface BoardPathConfig {
  postsCollection: string
  commentsCollection: string
  likesCollection: string
  settingsCollection: string
  usersCollection: string
}

export function resolveBoardPathConfig(input: {
  postsCollection?: string
  commentsCollection?: string
  likesCollection?: string
  settingsCollection?: string
  usersCollection?: string
}): BoardPathConfig {
  return {
    postsCollection: input.postsCollection?.trim() || DEFAULT_POSTS_COLLECTION,
    commentsCollection: input.commentsCollection?.trim() || DEFAULT_COMMENTS_COLLECTION,
    likesCollection: input.likesCollection?.trim() || DEFAULT_LIKES_COLLECTION,
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

export function likesCol(db: Firestore, cfg: BoardPathConfig): CollectionReference {
  return collection(db, cfg.likesCollection)
}

/** 좋아요 문서ID 관례: `${postId}_${uid}` — 유저당 글당 좋아요 1개, 토글은 create-or-delete */
export function likeDocId(postId: string, uid: string): string {
  return `${postId}_${uid}`
}

export function likeDoc(
  db: Firestore,
  cfg: BoardPathConfig,
  postId: string,
  uid: string,
): DocumentReference {
  return doc(db, cfg.likesCollection, likeDocId(postId, uid))
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

/** postId 가 전역 고유이므로 boardId 프리픽스 불필요 */
export function postStorageFolder(cfg: BoardPathConfig, postId: string): string {
  return `${cfg.postsCollection}/${postId}`
}

export function boardSsrKey(cfg: BoardPathConfig, suffix: string): string {
  return `${cfg.postsCollection}/${cfg.usersCollection}/${suffix}`
}
