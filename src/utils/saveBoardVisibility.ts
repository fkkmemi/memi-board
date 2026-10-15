import { getDocs, limit as fbLimit, orderBy, query, runTransaction, serverTimestamp, startAfter, where, writeBatch, type Firestore, type QueryDocumentSnapshot, type DocumentData } from 'firebase/firestore'
import { commentsCol, postsCol, settingsDoc, type BoardPathConfig } from './boardPaths'

function normalizeVisibility(value: unknown) { return value === 'hidden' ? 'hidden' : 'public' }

/** 숨김 전환 시 해당 보드 글·댓글 listed 일괄 맞춤. 값이 이미 같으면 건너뛴다. */
async function syncListedForCol(
  db: Firestore,
  col: ReturnType<typeof postsCol>,
  boardId: string,
  listed: boolean,
  ): Promise<void> {
  let cursor: QueryDocumentSnapshot | undefined
  for (;;) {
    const page = await getDocs(query(
      col,
      where('boardId', '==', boardId),
      orderBy('__name__'),
      ...(cursor ? [startAfter(cursor)] : []),
      fbLimit(400),
    ))
    if (page.empty) break
    const batch = writeBatch(db)
    let writes = 0
    for (const item of page.docs) {
      if (item.data().listed === listed) continue
      batch.update(item.ref, { listed })
      writes++
    }
    if (writes) await batch.commit()
    cursor = page.docs[page.docs.length - 1]
    if (page.docs.length < 400) break
}
}

async function syncListedForBoard(db: Firestore, cfg: BoardPathConfig, boardId: string, listed: boolean): Promise<void> {
  await syncListedForCol(db, postsCol(db, cfg), boardId, listed)
  await syncListedForCol(db, commentsCol(db, cfg), boardId, listed)
}

export async function saveBoardWithVisibility(db: Firestore, cfg: BoardPathConfig, id: string, payload: DocumentData): Promise<void> {
  const ref = settingsDoc(db, cfg, id)
  const visibility = normalizeVisibility(payload.visibility)
  // Lock creation before paging through content. A failed transition remains
  // explicit and can be resumed by saving the same visibility again.
  const transition = await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref)
    const previous = snapshot.data()
    const pending = previous?.visibilityTransition || ''
    if (pending && pending !== visibility) {
      throw new Error('Finish the pending visibility change before changing it again.')
    }
    if (!snapshot.exists() || (!pending && normalizeVisibility(previous?.visibility) === visibility)) {
      transaction.set(ref, payload, { merge: true })
      return false
    }
    // Unhiding is authorized before publishing any content. Hiding is only
    // marked complete AFTER all posts and comments have been hidden.
    transaction.set(ref, {
      ...payload,
      visibility: visibility === 'public' ? 'public' : normalizeVisibility(previous?.visibility),
      visibilityTransition: visibility,
    }, { merge: true })
    return true
  })
  if (!transition) return
  await syncListedForBoard(db, cfg, id, visibility !== 'hidden')
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref)
    if (snapshot.data()?.visibilityTransition !== visibility) {
      throw new Error('The visibility transition changed. Reload and retry.')
    }
    transaction.update(ref, { visibility, visibilityTransition: '', updatedAt: serverTimestamp() })
  })
}
