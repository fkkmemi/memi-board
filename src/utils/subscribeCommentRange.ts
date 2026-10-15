import {
  documentId, endAt, onSnapshot, orderBy, query, where,
  type Firestore, type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { commentsCol, type BoardPathConfig } from './boardPaths'
import type { CommentModel } from '../types'

/** Keep the loaded range live; after the final page, include newly added rows. */
export function subscribeCommentRange(
  db: Firestore,
  cfg: BoardPathConfig,
  postId: string,
  options: { rootId?: string, cursor: QueryDocumentSnapshot | null, hasMore: boolean },
  receive: (comments: CommentModel[]) => void,
  onError: (cause: Error) => void,
) {
  return onSnapshot(query(
    commentsCol(db, cfg),
    where('postId', '==', postId),
    ...(options.rootId
      ? [where('rootId', '==', options.rootId), where('isReply', '==', true)]
      : [where('parentId', '==', null)]),
    orderBy('createdAt', 'asc'),
    orderBy(documentId(), 'asc'),
    ...(options.hasMore && options.cursor ? [endAt(options.cursor)] : []),
  ), snapshot => receive(snapshot.docs.map(item => ({ ...item.data(), id: item.id }) as CommentModel)), onError)
}
