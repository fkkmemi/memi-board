import { onScopeDispose, ref, watch } from 'vue'
import type { Unsubscribe } from 'firebase/firestore'
import { useFirestore, useCurrentUser } from 'vuefire'
import {
  increment,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore'
import { useBoardPathConfig } from '../config'
import { boardPostDoc, boardPostLikeDoc } from '../utils/boardPaths'

export function useMemiBoardLikes(boardId: string, postId: string) {
  const cfg = () => useBoardPathConfig()
  const db = useFirestore()
  const user = useCurrentUser()

  const isLiked = ref(false)
  const likePending = ref(false)
  let stopSubscription: Unsubscribe | undefined

  function likeDocRef(uid: string) {
    return boardPostLikeDoc(db, cfg(), boardId, postId, uid)
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

  async function toggleLike(): Promise<boolean> {
    const uid = user.value?.uid
    if (!uid) throw new Error('로그인이 필요합니다.')
    if (likePending.value) return isLiked.value
    likePending.value = true
    try {
      const likeRef = likeDocRef(uid)
      const postRef = boardPostDoc(db, cfg(), boardId, postId)
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
