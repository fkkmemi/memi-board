/**
 * Firestore / Storage 경로
 *
 * ```
 * memiBoardUsers/{uid}
 *
 * memiBoards/{boardId}                         // 목록용 메타(optional stub + order)
 * memiBoards/{boardId}/settings/config         // 보드 설정 (구 category + boardSettings)
 * memiBoards/{boardId}/posts/{postId}
 * memiBoards/{boardId}/posts/{postId}/body/main
 * memiBoards/{boardId}/posts/{postId}/comments|likes
 * ```
 *
 * Storage: `memiBoards/{boardId}/posts/{postId}/...`
 *
 * 카테고리 개념 없음 — 예전 category id 가 곧 boardId.
 */
import {
  collection,
  doc,
  type CollectionReference,
  type DocumentReference,
  type Firestore,
} from 'firebase/firestore'

export const DEFAULT_BOARDS_COLLECTION = 'memiBoards'
export const DEFAULT_USERS_COLLECTION = 'memiBoardUsers'

export interface BoardPathConfig {
  boardsCollection: string
  usersCollection: string
}

export function resolveBoardPathConfig(input: {
  boardsCollection?: string
  usersCollection?: string
}): BoardPathConfig {
  return {
    boardsCollection: input.boardsCollection?.trim() || DEFAULT_BOARDS_COLLECTION,
    usersCollection: input.usersCollection?.trim() || DEFAULT_USERS_COLLECTION,
  }
}

export function boardsCol(db: Firestore, cfg: BoardPathConfig): CollectionReference {
  return collection(db, cfg.boardsCollection)
}

export function boardDoc(
  db: Firestore,
  cfg: BoardPathConfig,
  boardId: string,
): DocumentReference {
  return doc(db, cfg.boardsCollection, boardId)
}

/** 구 boardSettings — 보드 단위 설정 문서 */
export function boardSettingsDoc(
  db: Firestore,
  cfg: BoardPathConfig,
  boardId: string,
): DocumentReference {
  return doc(db, cfg.boardsCollection, boardId, 'settings', 'config')
}

export function boardPostsCol(
  db: Firestore,
  cfg: BoardPathConfig,
  boardId: string,
): CollectionReference {
  return collection(db, cfg.boardsCollection, boardId, 'posts')
}

export function boardPostDoc(
  db: Firestore,
  cfg: BoardPathConfig,
  boardId: string,
  postId: string,
): DocumentReference {
  return doc(db, cfg.boardsCollection, boardId, 'posts', postId)
}

export function boardPostBodyDoc(
  db: Firestore,
  cfg: BoardPathConfig,
  boardId: string,
  postId: string,
): DocumentReference {
  return doc(db, cfg.boardsCollection, boardId, 'posts', postId, 'body', 'main')
}

export function boardPostCommentsCol(
  db: Firestore,
  cfg: BoardPathConfig,
  boardId: string,
  postId: string,
): CollectionReference {
  return collection(db, cfg.boardsCollection, boardId, 'posts', postId, 'comments')
}

export function boardPostCommentDoc(
  db: Firestore,
  cfg: BoardPathConfig,
  boardId: string,
  postId: string,
  commentId: string,
): DocumentReference {
  return doc(db, cfg.boardsCollection, boardId, 'posts', postId, 'comments', commentId)
}

export function boardPostLikeDoc(
  db: Firestore,
  cfg: BoardPathConfig,
  boardId: string,
  postId: string,
  uid: string,
): DocumentReference {
  return doc(db, cfg.boardsCollection, boardId, 'posts', postId, 'likes', uid)
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

export function boardStorageRoot(cfg: BoardPathConfig, boardId: string): string {
  return `${cfg.boardsCollection}/${boardId}`
}

export function boardPostStorageFolder(
  cfg: BoardPathConfig,
  boardId: string,
  postId: string,
): string {
  return `${boardStorageRoot(cfg, boardId)}/posts/${postId}`
}

export function boardSsrKey(cfg: BoardPathConfig, suffix: string): string {
  return `${cfg.boardsCollection}/${cfg.usersCollection}/${suffix}`
}
