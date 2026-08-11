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
import { postsCol } from '../utils/boardPaths'
import type { UserPostModel } from '../types'

const USER_POST_PAGE_SIZE = 10

/**
 * 작성자 uid로 모든 보드를 가로질러 글을 모은다.
 * memiBoardPosts 가 flat 컬렉션이라 일반 where('authorUid',...) 쿼리로 충분 —
 * collectionGroup 이 필요했던 건 구버전이 보드별 posts 서브컬렉션이었을 때뿐.
 * 공개 글만 — canReadPost rules와 같은 기준(listed && isPublished)이라
 * 본인이 아니면 숨김 보드·미게시 글은 애초에 안 온다.
 */
export function useMemiBoardUserPosts(
  uid: MaybeRefOrGetter<string>,
  options: { pageSize?: number } = {},
) {
  const db = useFirestore()
  const cfg = () => useBoardPathConfig()
  const postsColRef = () => postsCol(db, cfg())
  const pageSize = options.pageSize ?? USER_POST_PAGE_SIZE
  const uidValue = computed(() => toValue(uid)?.trim() || '')

  const headPosts = ref<UserPostModel[]>([])
  const olderPosts = ref<UserPostModel[]>([])
  const headPending = ref(true)
  const hasMore = ref(true)
  const loadingMore = ref(false)
  const loadError = ref('')
  let headTailCursor: QueryDocumentSnapshot<DocumentData> | null = null
  let olderCursor: QueryDocumentSnapshot<DocumentData> | null = null
  let stopHeadSubscription: Unsubscribe | undefined

  function mapDoc(item: QueryDocumentSnapshot<DocumentData>): UserPostModel {
    return { id: item.id, ...item.data() } as UserPostModel
  }

  function createdAtMs(post: UserPostModel): number {
    return post.createdAt?.toMillis?.() ?? 0
  }

  const posts = computed(() => {
    const byId = new Map<string, UserPostModel>()
    for (const post of [...olderPosts.value, ...headPosts.value]) {
      if (post.id) byId.set(post.id, post)
    }
    return [...byId.values()].sort((a, b) =>
      createdAtMs(b) - createdAtMs(a) || String(b.id).localeCompare(String(a.id)),
    )
  })

  function baseConstraints(): QueryConstraint[] {
    return [
      where('authorUid', '==', uidValue.value),
      where('isPublished', '==', true),
      where('listed', '==', true),
    ]
  }

  function startHeadSubscription() {
    stopHeadSubscription?.()
    if (!uidValue.value) {
      headPending.value = false
      return
    }
    stopHeadSubscription = onSnapshot(query(
      postsColRef(),
      ...baseConstraints(),
      orderBy('createdAt', 'desc'),
      orderBy(documentId(), 'desc'),
      fbLimit(pageSize),
    ), (snapshot) => {
      headPosts.value = snapshot.docs.map(mapDoc)
      headTailCursor = snapshot.docs.at(-1) ?? null
      if (!olderCursor) hasMore.value = snapshot.docs.length >= pageSize
      headPending.value = false
    }, (cause) => {
      console.error('[memi-board:userPosts] onSnapshot failed', cause)
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
      const snapshot = await getDocs(query(postsColRef(), ...constraints))
      const pageDocs = snapshot.docs.slice(0, pageSize)
      const page = pageDocs.map(mapDoc)
      const existingIds = new Set([...olderPosts.value, ...headPosts.value].map(post => post.id))
      olderPosts.value.push(...page.filter(post => !existingIds.has(post.id)))
      olderCursor = pageDocs.at(-1) ?? olderCursor
      hasMore.value = snapshot.docs.length > pageSize
    }
    catch (e) {
      loadError.value = (e as Error).message || String(e)
      console.error('[memi-board:userPosts] loadMore failed', e)
    }
    finally {
      loadingMore.value = false
    }
  }

  function reset() {
    stopHeadSubscription?.()
    headPosts.value = []
    olderPosts.value = []
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
    posts,
    postsPending: headPending,
    hasMore,
    loadingMore,
    loadError,
    loadMore,
  }
}

export type { UserPostModel }
