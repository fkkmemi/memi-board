import { getDocs, limit, query, where, type Firestore } from 'firebase/firestore'
import { postsCol, type BoardPathConfig } from './boardPaths'

/** Query only documents the caller can read; rules cannot filter private drafts. */
export async function findReadablePostBySlug(
  db: Firestore,
  cfg: BoardPathConfig,
  boardId: string,
  slug: string,
  uid: string | undefined,
  canManage: boolean,
) {
  const constraints = [where('boardId', '==', boardId), where('slug', '==', slug)]
  if (canManage) {
    return (await getDocs(query(postsCol(db, cfg), ...constraints, limit(1)))).docs[0]
  }
  const snapshots = await Promise.all([
    getDocs(query(postsCol(db, cfg), ...constraints,
      where('listed', '==', true), where('isPublished', '==', true), limit(1))),
    ...(uid ? [getDocs(query(postsCol(db, cfg), ...constraints,
      where('authorUid', '==', uid), limit(1)))] : []),
  ])
  return snapshots.flatMap(snapshot => snapshot.docs)[0]
}
