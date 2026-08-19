import { computed, onScopeDispose, ref, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import {
  documentId,
  getDocs,
  limit as fbLimit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
} from 'firebase/firestore'
import type { DocumentData, QueryConstraint, QueryDocumentSnapshot, Unsubscribe } from 'firebase/firestore'
import { useFirestore } from 'vuefire'
import { useBoardPathConfig } from '../config'
import { commentsCol } from '../utils/boardPaths'
import type { CommentModel } from '../types'

const COMMENT_FEED_PAGE_SIZE = 10

export type CommentFeedSort = 'latest' | 'likes'

/**
 * 보드를 가로질러 댓글을 모은다. 최신순은 createdAt, 좋아요순은 likeCount.
 * likeCount 가 없는 예전 댓글은 좋아요순 쿼리에 나오지 않는다(표시 시 0).
 */
export function useMemiBoardCommentFeed(
  sort: MaybeRefOrGetter<CommentFeedSort> = 'latest',
  options: { pageSize?: MaybeRefOrGetter<number> } = {},
) {
  const db = useFirestore()
  const cfg = () => useBoardPathConfig()
  const commentsColRef = () => commentsCol(db, cfg())
  const pageSize = computed(() => {
    const n = Math.floor(Number(toValue(options.pageSize)))
    return Number.isFinite(n) && n > 0 ? n : COMMENT_FEED_PAGE_SIZE
  })
  const sortValue = computed<CommentFeedSort>(() => {
    const value = toValue(sort)
    return value === 'likes' ? 'likes' : 'latest'
  })

  const headComments = ref<CommentModel[]>([])
  const olderComments = ref<CommentModel[]>([])
  const headPending = ref(true)
  const hasMore = ref(true)
  const loadingMore = ref(false)
  const loadError = ref('')
  let headTailCursor: QueryDocumentSnapshot<DocumentData> | null = null
  let olderCursor: QueryDocumentSnapshot<DocumentData> | null = null
  let stopHeadSubscription: Unsubscribe | undefined

  function mapDoc(item: QueryDocumentSnapshot<DocumentData>): CommentModel {
    return { id: item.id, ...item.data() } as CommentModel
  }

  function createdAtMs(comment: CommentModel): number {
    return comment.createdAt?.toMillis?.() ?? 0
  }

  function compare(a: CommentModel, b: CommentModel): number {
    if (sortValue.value === 'likes') {
      const likes = (b.likeCount ?? 0) - (a.likeCount ?? 0)
      if (likes) return likes
    }
    return createdAtMs(b) - createdAtMs(a) || String(b.id).localeCompare(String(a.id))
  }

  const comments = computed(() => {
    const byId = new Map<string, CommentModel>()
    for (const comment of [...olderComments.value, ...headComments.value]) {
      if (comment.id) byId.set(comment.id, comment)
    }
    return [...byId.values()].sort(compare)
  })

  function orderConstraints(): QueryConstraint[] {
    if (sortValue.value === 'likes') {
      return [
        orderBy('likeCount', 'desc'),
        orderBy('createdAt', 'desc'),
        orderBy(documentId(), 'desc'),
      ]
    }
    return [
      orderBy('createdAt', 'desc'),
      orderBy(documentId(), 'desc'),
    ]
  }

  function startHeadSubscription() {
    stopHeadSubscription?.()
    stopHeadSubscription = onSnapshot(query(
      commentsColRef(),
      ...orderConstraints(),
      fbLimit(pageSize.value),
    ), (snapshot) => {
      headComments.value = snapshot.docs.map(mapDoc)
      headTailCursor = snapshot.docs.at(-1) ?? null
      if (!olderCursor) hasMore.value = snapshot.docs.length >= pageSize.value
      headPending.value = false
    }, (cause) => {
      console.error('[memi-board:commentFeed] onSnapshot failed', cause)
      loadError.value = (cause as Error).message || String(cause)
      headPending.value = false
    })
  }

  async function loadMore(): Promise<void> {
    if (loadingMore.value || !hasMore.value || headPending.value) return
    loadingMore.value = true
    loadError.value = ''
    try {
      const cursor = olderCursor ?? headTailCursor
      const snapshot = await getDocs(query(
        commentsColRef(),
        ...orderConstraints(),
        ...(cursor ? [startAfter(cursor)] : []),
        fbLimit(pageSize.value + 1),
      ))
      const pageDocs = snapshot.docs.slice(0, pageSize.value)
      const page = pageDocs.map(mapDoc)
      const existingIds = new Set([...olderComments.value, ...headComments.value].map(comment => comment.id))
      olderComments.value.push(...page.filter(comment => !existingIds.has(comment.id)))
      olderCursor = pageDocs.at(-1) ?? olderCursor
      hasMore.value = snapshot.docs.length > pageSize.value
    }
    catch (e) {
      loadError.value = (e as Error).message || String(e)
      console.error('[memi-board:commentFeed] loadMore failed', e)
    }
    finally {
      loadingMore.value = false
    }
  }

  function reset() {
    stopHeadSubscription?.()
    headComments.value = []
    olderComments.value = []
    headTailCursor = null
    olderCursor = null
    hasMore.value = true
    loadError.value = ''
    headPending.value = true
    startHeadSubscription()
  }

  watch([sortValue, pageSize], reset, { immediate: true })
  onScopeDispose(() => stopHeadSubscription?.())

  return {
    comments,
    commentsPending: headPending,
    hasMore,
    loadingMore,
    loadError,
    loadMore,
    sort: sortValue,
  }
}
