/**
 * Firestore / Storage 경로 — multi-board 트리.
 *
 * ```
 * memiBoards/{boardId}/posts/{postId}
 * memiBoards/{boardId}/posts/{postId}/body/main
 * memiBoards/{boardId}/posts/{postId}/comments/{commentId}
 * memiBoards/{boardId}/posts/{postId}/likes/{uid}
 * memiBoards/{boardId}/settings/config
 * memiBoards/{boardId}/settings/config/categories/{categoryId}
 * memiBoards/{boardId}/users/{uid}
 * ```
 *
 * Storage: `memiBoards/{boardId}/posts/{postId}/...`
 */
import {
  collection,
  doc,
  type CollectionReference,
  type DocumentReference,
  type Firestore,
} from 'firebase/firestore'

export const DEFAULT_BOARDS_COLLECTION = 'memiBoards'
export const DEFAULT_BOARD_ID = 'default'

export interface BoardPathConfig {
  /** 루트 컬렉션. 기본 `memiBoards` */
  boardsCollection: string
  /** 게시판 문서 ID */
  boardId: string
}

export function resolveBoardPathConfig(input: {
  boardsCollection?: string
  boardId?: string
}): BoardPathConfig {
  const boardsCollection = input.boardsCollection?.trim() || DEFAULT_BOARDS_COLLECTION
  const boardId = input.boardId?.trim() || DEFAULT_BOARD_ID
  if (!boardId) {
    throw new Error('[memi-board] boardId 가 비어 있습니다.')
  }
  return { boardsCollection, boardId }
}

/** `memiBoards/{boardId}` */
export function boardDocPath(cfg: BoardPathConfig): string {
  return `${cfg.boardsCollection}/${cfg.boardId}`
}

/** Storage 루트 접두 — `memiBoards/{boardId}` */
export function boardStorageRoot(cfg: BoardPathConfig): string {
  return boardDocPath(cfg)
}

export function boardPostStorageFolder(cfg: BoardPathConfig, postId: string): string {
  return `${boardStorageRoot(cfg)}/posts/${postId}`
}

export function boardPostsCol(db: Firestore, cfg: BoardPathConfig): CollectionReference {
  return collection(db, cfg.boardsCollection, cfg.boardId, 'posts')
}

export function boardPostDoc(
  db: Firestore,
  cfg: BoardPathConfig,
  postId: string,
): DocumentReference {
  return doc(db, cfg.boardsCollection, cfg.boardId, 'posts', postId)
}

export function boardPostBodyDoc(
  db: Firestore,
  cfg: BoardPathConfig,
  postId: string,
): DocumentReference {
  return doc(db, cfg.boardsCollection, cfg.boardId, 'posts', postId, 'body', 'main')
}

export function boardPostCommentsCol(
  db: Firestore,
  cfg: BoardPathConfig,
  postId: string,
): CollectionReference {
  return collection(db, cfg.boardsCollection, cfg.boardId, 'posts', postId, 'comments')
}

export function boardPostCommentDoc(
  db: Firestore,
  cfg: BoardPathConfig,
  postId: string,
  commentId: string,
): DocumentReference {
  return doc(db, cfg.boardsCollection, cfg.boardId, 'posts', postId, 'comments', commentId)
}

export function boardPostLikeDoc(
  db: Firestore,
  cfg: BoardPathConfig,
  postId: string,
  uid: string,
): DocumentReference {
  return doc(db, cfg.boardsCollection, cfg.boardId, 'posts', postId, 'likes', uid)
}

/** 기존 boardSettings 메타 — `.../settings/config` */
export function boardSettingsDoc(db: Firestore, cfg: BoardPathConfig): DocumentReference {
  return doc(db, cfg.boardsCollection, cfg.boardId, 'settings', 'config')
}

export function boardCategoriesCol(db: Firestore, cfg: BoardPathConfig): CollectionReference {
  return collection(db, cfg.boardsCollection, cfg.boardId, 'settings', 'config', 'categories')
}

export function boardCategoryDoc(
  db: Firestore,
  cfg: BoardPathConfig,
  categoryId: string,
): DocumentReference {
  return doc(
    db,
    cfg.boardsCollection,
    cfg.boardId,
    'settings',
    'config',
    'categories',
    categoryId,
  )
}

export function boardUsersCol(db: Firestore, cfg: BoardPathConfig): CollectionReference {
  return collection(db, cfg.boardsCollection, cfg.boardId, 'users')
}

export function boardUserDoc(
  db: Firestore,
  cfg: BoardPathConfig,
  uid: string,
): DocumentReference {
  return doc(db, cfg.boardsCollection, cfg.boardId, 'users', uid)
}

/** vuefire ssrKey / 로그용 안정 문자열 */
export function boardSsrKey(cfg: BoardPathConfig, suffix: string): string {
  return `${boardDocPath(cfg)}/${suffix}`
}
