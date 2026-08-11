import { increment, updateDoc } from 'firebase/firestore'
import { useFirestore } from 'vuefire'
import { useBoardPathConfig } from '../config'
import { postDoc } from '../utils/boardPaths'

/**
 * 게시글 조회수 (memiBoardPosts, flat).
 */
export function useMemiBoardViews() {
  const cfg = () => useBoardPathConfig()
  const db = useFirestore()

  function sessionKey(boardId: string, postId: string): string {
    const { postsCollection } = cfg()
    return `memi-board:viewed:${postsCollection}:${boardId}:${postId}`
  }

  function hasRecordedView(boardId: string, postId: string): boolean {
    if (typeof sessionStorage === 'undefined') return false
    try {
      return sessionStorage.getItem(sessionKey(boardId, postId)) === '1'
    }
    catch {
      return false
    }
  }

  function markRecorded(boardId: string, postId: string): void {
    if (typeof sessionStorage === 'undefined') return
    try {
      sessionStorage.setItem(sessionKey(boardId, postId), '1')
    }
    catch {
      // ignore
    }
  }

  async function recordView(boardId: string, postId: string): Promise<void> {
    const b = boardId?.trim()
    const id = postId?.trim()
    if (!b || !id) return
    if (hasRecordedView(b, id)) return
    markRecorded(b, id)
    try {
      await updateDoc(postDoc(db, cfg(), id), {
        viewCount: increment(1),
      })
    }
    catch (error) {
      try {
        sessionStorage.removeItem(sessionKey(b, id))
      }
      catch {
        // ignore
      }
      if (import.meta.dev) {
        console.warn('[memi-board] recordView failed', error)
      }
    }
  }

  return {
    recordView,
    hasRecordedView,
  }
}
