import { computed, onScopeDispose, ref, toValue, watch, type InjectionKey, type MaybeRefOrGetter } from 'vue'
import type { Unsubscribe } from 'firebase/firestore'
import { useFirestore, useCurrentUser } from 'vuefire'
import {
  increment,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import { useBoardPathConfig } from '../config'
import { commentDoc, likeDoc, likesCol, postDoc } from '../utils/boardPaths'

export function useMemiBoardLikes(boardId: string, postId: string) {
  const cfg = () => useBoardPathConfig()
  const db = useFirestore()
  const user = useCurrentUser()

  const isLiked = ref(false)
  const likePending = ref(false)
  let stopSubscription: Unsubscribe | undefined

  function likeDocRef(uid: string) {
    return likeDoc(db, cfg(), postId, uid)
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
      const postRef = postDoc(db, cfg(), postId)
      return await runTransaction(db, async (tx) => {
        const likeSnap = await tx.get(likeRef)
        if (likeSnap.exists()) {
          tx.delete(likeRef)
          tx.update(postRef, { likeCount: increment(-1) })
          return false
        }
        tx.set(likeRef, { uid, postId, boardId, createdAt: serverTimestamp() })
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

export interface MemiBoardCommentLikesApi {
  isLiked: (commentId: string | undefined) => boolean
  isPending: (commentId: string | undefined) => boolean
  toggleLike: (commentId: string) => Promise<boolean>
}

export const memiBoardCommentLikesKey: InjectionKey<MemiBoardCommentLikesApi> = Symbol.for('memi-board:comment-likes')

/** 글 하나에서 내가 누른 댓글 좋아요를 쿼리 1번으로 구독한다. 댓글마다 리스너를 달지 않는다. */
export function useMemiBoardCommentLikes(
  boardId: MaybeRefOrGetter<string>,
  postId: MaybeRefOrGetter<string>,
): MemiBoardCommentLikesApi {
  const cfg = () => useBoardPathConfig()
  const db = useFirestore()
  const user = useCurrentUser()
  const bid = computed(() => toValue(boardId))
  const pid = computed(() => toValue(postId))

  const likedIds = ref(new Set<string>())
  const pendingId = ref<string | null>(null)
  let stopSubscription: Unsubscribe | undefined

  watch([user, pid], ([current, currentPostId]) => {
    stopSubscription?.()
    stopSubscription = undefined
    likedIds.value = new Set()
    if (!current || !currentPostId) return

    stopSubscription = onSnapshot(
      query(
        likesCol(db, cfg()),
        where('uid', '==', current.uid),
        where('postId', '==', currentPostId),
        where('target', '==', 'comment'),
      ),
      (snapshot) => {
        const next = new Set<string>()
        for (const item of snapshot.docs) {
          const commentId = item.data().commentId
          if (typeof commentId === 'string' && commentId) next.add(commentId)
        }
        likedIds.value = next
      },
      (cause) => {
        console.error('[memi-board:comment-likes] onSnapshot failed', cause)
      },
    )
  }, { immediate: true })

  onScopeDispose(() => stopSubscription?.())

  function isLiked(commentId: string | undefined): boolean {
    return !!commentId && likedIds.value.has(commentId)
  }

  function isPending(commentId: string | undefined): boolean {
    return !!commentId && pendingId.value === commentId
  }

  async function toggleLike(commentId: string): Promise<boolean> {
    const uid = user.value?.uid
    if (!uid) throw new Error('로그인이 필요합니다.')
    if (!commentId) return false
    if (pendingId.value) return isLiked(commentId)
    pendingId.value = commentId
    try {
      const likeRef = likeDoc(db, cfg(), commentId, uid)
      const commentRef = commentDoc(db, cfg(), commentId)
      const nextLiked = await runTransaction(db, async (tx) => {
        const likeSnap = await tx.get(likeRef)
        const commentSnap = await tx.get(commentRef)
        if (!commentSnap.exists()) throw new Error('댓글을 찾을 수 없습니다.')
        const current = Number(commentSnap.data()?.likeCount ?? 0)
        if (likeSnap.exists()) {
          tx.delete(likeRef)
          tx.update(commentRef, { likeCount: Math.max(0, current - 1) })
          return false
        }
        tx.set(likeRef, {
          uid,
          postId: pid.value,
          boardId: bid.value,
          commentId,
          target: 'comment',
          createdAt: serverTimestamp(),
        })
        tx.update(commentRef, { likeCount: current + 1 })
        return true
      })
      const next = new Set(likedIds.value)
      if (nextLiked) next.add(commentId)
      else next.delete(commentId)
      likedIds.value = next
      return nextLiked
    }
    finally {
      pendingId.value = null
    }
  }

  return { isLiked, isPending, toggleLike }
}
