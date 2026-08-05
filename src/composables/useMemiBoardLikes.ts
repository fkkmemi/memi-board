import { onScopeDispose, ref, watch } from 'vue'
import type { Unsubscribe } from 'firebase/firestore'
import { useFirestore, useCurrentUser } from 'vuefire'
import {
  doc,
  increment,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore'
import { useMemiBoardConfig } from '../config'

/**
 * 게시글 좋아요 상태 구독 + 토글.
 * `{prefix}Posts/{postId}/likes/{uid}` 문서 존재 여부가 "좋아요함"의 기준이고,
 * `likeCount`는 그 문서 수를 반영하는 클라이언트 편의 카운터일 뿐이다(commentCount와 동일한 성격).
 * 토글은 배치가 아니라 트랜잭션으로 처리한다 — "있으면 취소, 없으면 추가"라는 read-then-branch라
 * 다중 탭 경합 시에도 likeCount가 실제 likes 문서 수와 어긋나지 않게 하기 위함이다.
 */
export function useMemiBoardLikes(postId: string) {
  const config = useMemiBoardConfig()
  const db = useFirestore()
  const user = useCurrentUser()
  const prefix = () => config.collectionPrefix

  const isLiked = ref(false)
  const likePending = ref(false)
  let stopSubscription: Unsubscribe | undefined

  function likeDocRef(uid: string) {
    return doc(db, `${prefix()}Posts`, postId, 'likes', uid)
  }

  watch(user, (current) => {
    stopSubscription?.()
    stopSubscription = undefined
    if (!current) {
      isLiked.value = false
      return
    }
    stopSubscription = onSnapshot(likeDocRef(current.uid), (snap) => {
      isLiked.value = snap.exists()
    }, (cause) => {
      console.error('[memi-board:likes] onSnapshot failed', cause)
    })
  }, { immediate: true })

  onScopeDispose(() => stopSubscription?.())

  /** 좋아요 토글. 반환값은 토글 후의 좋아요 상태. */
  async function toggleLike(): Promise<boolean> {
    const uid = user.value?.uid
    if (!uid) throw new Error('로그인이 필요합니다.')
    if (likePending.value) return isLiked.value
    likePending.value = true
    try {
      const likeRef = likeDocRef(uid)
      const postRef = doc(db, `${prefix()}Posts`, postId)
      return await runTransaction(db, async (tx) => {
        const likeSnap = await tx.get(likeRef)
        if (likeSnap.exists()) {
          tx.delete(likeRef)
          tx.update(postRef, { likeCount: increment(-1) })
          return false
        }
        tx.set(likeRef, { uid, createdAt: serverTimestamp() })
        tx.update(postRef, { likeCount: increment(1) })
        return true
      })
    }
    finally {
      likePending.value = false
    }
  }

  return { isLiked, likePending, toggleLike }
}
