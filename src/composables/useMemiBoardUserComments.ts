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
  where,
} from 'firebase/firestore'
import type { DocumentData, QueryConstraint, QueryDocumentSnapshot, Unsubscribe } from 'firebase/firestore'
import { useFirestore } from 'vuefire'
import { useBoardPathConfig } from '../config'
import { commentsCol } from '../utils/boardPaths'
import type { CommentModel } from '../types'

const USER_COMMENT_PAGE_SIZE = 10

/**
 * 작성자 uid로 모든 보드를 가로질러 댓글을 모은다. memiBoardComments 읽기 규칙이
 * 더 이상 부모 글을 get()하지 않고 항상 허용이라(누구나 볼 수 있어야 하는 요구사항),
 * useMemiBoardUserPosts와 동일하게 authorUid 동등 필터만으로 충분하다 — 부모 글이
 * 비공개·삭제·블라인드 상태여도 댓글 자체는 여기서 그대로 보이고, 실제 글로
 * 이동했을 때 그 글의 접근 상태에 따라 표현하는 건 호스트(클릭 시 이동하는 페이지)의 몫이다.
 */
export function useMemiBoardUserComments(
  uid: MaybeRefOrGetter<string>,
  options: { pageSize?: number } = {},
) {
  const db = useFirestore()
  const cfg = () => useBoardPathConfig()
  const commentsColRef = () => commentsCol(db, cfg())
  const pageSize = options.pageSize ?? USER_COMMENT_PAGE_SIZE
  const uidValue = computed(() => toValue(uid)?.trim() || '')

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

  const comments = computed(() => {
    const byId = new Map<string, CommentModel>()
    for (const comment of [...olderComments.value, ...headComments.value]) {
      if (comment.id) byId.set(comment.id, comment)
    }
    return [...byId.values()].sort((a, b) =>
      createdAtMs(b) - createdAtMs(a) || String(b.id).localeCompare(String(a.id)),
    )
  })

  function baseConstraints(): QueryConstraint[] {
    return [where('authorUid', '==', uidValue.value)]
  }

  function startHeadSubscription() {
    stopHeadSubscription?.()
    if (!uidValue.value) {
      headPending.value = false
      return
    }
    stopHeadSubscription = onSnapshot(query(
      commentsColRef(),
      ...baseConstraints(),
      orderBy('createdAt', 'desc'),
      orderBy(documentId(), 'desc'),
      fbLimit(pageSize),
    ), (snapshot) => {
      headComments.value = snapshot.docs.map(mapDoc)
      headTailCursor = snapshot.docs.at(-1) ?? null
      if (!olderCursor) hasMore.value = snapshot.docs.length >= pageSize
      headPending.value = false
    }, (cause) => {
      console.error('[memi-board:userComments] onSnapshot failed', cause)
      loadError.value = (cause as Error).message || String(cause)
      headPending.value = false
    })
  }

  async function loadMore(): Promise<void> {
    if (loadingMore.value || !hasMore.value || headPending.value || !uidValue.value) return
    loadingMore.value = true
    loadError.value = ''
    try {
      const cursor = olderCursor ?? headTailCursor
      const constraints = [
        ...baseConstraints(),
        orderBy('createdAt', 'desc'),
        orderBy(documentId(), 'desc'),
        ...(cursor ? [startAfter(cursor)] : []),
        fbLimit(pageSize + 1),
      ]
      const snapshot = await getDocs(query(commentsColRef(), ...constraints))
      const pageDocs = snapshot.docs.slice(0, pageSize)
      const page = pageDocs.map(mapDoc)
      const existingIds = new Set([...olderComments.value, ...headComments.value].map(comment => comment.id))
      olderComments.value.push(...page.filter(comment => !existingIds.has(comment.id)))
      olderCursor = pageDocs.at(-1) ?? olderCursor
      hasMore.value = snapshot.docs.length > pageSize
    }
    catch (e) {
      loadError.value = (e as Error).message || String(e)
      console.error('[memi-board:userComments] loadMore failed', e)
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

  watch(uidValue, reset, { immediate: true })
  onScopeDispose(() => stopHeadSubscription?.())

  return {
    comments,
    commentsPending: headPending,
    hasMore,
    loadingMore,
    loadError,
    loadMore,
  }
}
