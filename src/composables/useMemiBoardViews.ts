import { updateDoc, increment, doc } from 'firebase/firestore'
import { useFirestore } from 'vuefire'
import { useMemiBoardConfig } from '../config'

/**
 * 게시글 조회수.
 *
 * - 로그인 불필요: rules 가 viewCount +1 만 허용하면 익명도 증가 가능.
 * - 신뢰 수준은 likeCount/commentCount 와 같은 클라이언트 편의 카운터.
 * - 같은 브라우저·세션에서 같은 글을 반복 열어 폭증하지 않도록 sessionStorage 로 1회만 기록.
 */
export function useMemiBoardViews() {
  const config = useMemiBoardConfig()
  const db = useFirestore()
  const prefix = config.collectionPrefix

  function sessionKey(postId: string): string {
    return `memi-board:viewed:${prefix}:${postId}`
  }

  function hasRecordedView(postId: string): boolean {
    if (typeof sessionStorage === 'undefined') return false
    try {
      return sessionStorage.getItem(sessionKey(postId)) === '1'
    }
    catch {
      return false
    }
  }

  function markRecorded(postId: string): void {
    if (typeof sessionStorage === 'undefined') return
    try {
      sessionStorage.setItem(sessionKey(postId), '1')
    }
    catch {
      // private mode 등 — 카운트만 올리고 중복 방지 실패는 허용
    }
  }

  /**
   * 상세 진입 시 1회 호출. 이미 이 세션에서 본 글이면 no-op.
   * 실패해도 UI 는 막지 않는다(조회수는 부수 효과).
   */
  async function recordView(postId: string): Promise<void> {
    const id = postId?.trim()
    if (!id) return
    if (hasRecordedView(id)) return
    // 낙관적으로 먼저 표시 — 동시 탭 이중 증가 완화
    markRecorded(id)
    try {
      await updateDoc(doc(db, `${prefix}Posts`, id), {
        viewCount: increment(1),
      })
    }
    catch (error) {
      // 규칙 미배포·오프라인 등 — 다음 방문에서 재시도할 수 있게 표시 롤백
      try {
        sessionStorage.removeItem(sessionKey(id))
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
