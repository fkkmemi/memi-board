import { computed, ref, watch } from 'vue'
import type { Ref } from 'vue'
import { useCollection, useFirestore } from 'vuefire'
import {
  collection,
  doc,
  documentId,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  writeBatch,
} from 'firebase/firestore'
import { useMemiBoardConfig } from '../config'
import type { CommentModel } from '../types'

export interface AddCommentInput {
  body: string
  authorUid: string
  authorName: string | null
  authorPhoto: string | null
}

const COMMENT_PAGE_SIZE = 5

/** 최근 5개는 onSnapshot, 이전 댓글은 더보기마다 5개씩 getDocs로 읽는다. */
export function useMemiBoardComments(
  postId: string | Ref<string>,
  options: { subscribe?: boolean } = {},
) {
  const config = useMemiBoardConfig()
  const db = useFirestore()
  const prefix = () => config.collectionPrefix

  const id = computed(() => (typeof postId === 'string' ? postId : postId.value))

  const commentsQuery = computed(() => options.subscribe === false
    ? null
    : query(
      collection(db, `${prefix()}Posts`, id.value, 'comments'),
      orderBy('createdAt', 'desc'),
      orderBy(documentId(), 'desc'),
      limit(COMMENT_PAGE_SIZE),
    ),
  )

  const recentComments = useCollection<CommentModel>(commentsQuery, {
    ssrKey: `${prefix()}Posts/${id.value}/comments/recent`,
  })
  const olderComments = ref<CommentModel[]>([])
  const loadingMore = ref(false)
  const hasMore = ref(options.subscribe !== false)

  function createdAtMs(comment: CommentModel): number {
    return comment.createdAt?.toMillis?.() ?? 0
  }

  const comments = computed(() => {
    const byId = new Map<string, CommentModel>()
    for (const comment of [...recentComments.value, ...olderComments.value]) {
      if (comment.id) byId.set(comment.id, comment)
    }
    return [...byId.values()].sort((a, b) =>
      createdAtMs(a) - createdAtMs(b) || String(a.id).localeCompare(String(b.id)),
    )
  })

  watch(id, () => {
    olderComments.value = []
    hasMore.value = options.subscribe !== false
  })

  watch(recentComments, (list) => {
    if (!recentComments.pending.value && list.length < COMMENT_PAGE_SIZE && olderComments.value.length === 0) {
      hasMore.value = false
    }
  }, { immediate: true })

  async function loadMore(): Promise<void> {
    if (loadingMore.value || !hasMore.value) return
    const oldest = comments.value[0]
    if (!oldest?.id || !oldest.createdAt) {
      hasMore.value = false
      return
    }

    loadingMore.value = true
    try {
      const snapshot = await getDocs(query(
        collection(db, `${prefix()}Posts`, id.value, 'comments'),
        orderBy('createdAt', 'desc'),
        orderBy(documentId(), 'desc'),
        startAfter(oldest.createdAt, oldest.id),
        limit(COMMENT_PAGE_SIZE),
      ))
      const page = snapshot.docs.map(item => ({ id: item.id, ...item.data() } as CommentModel))
      const existing = new Set(olderComments.value.map(comment => comment.id))
      olderComments.value.push(...page.filter(comment => !existing.has(comment.id)))
      if (snapshot.size < COMMENT_PAGE_SIZE) hasMore.value = false
    }
    finally {
      loadingMore.value = false
    }
  }

  async function addComment(input: AddCommentInput): Promise<void> {
    const batch = writeBatch(db)
    const p = prefix()
    const commentRef = doc(collection(db, `${p}Posts`, id.value, 'comments'))
    batch.set(commentRef, {
      postId: id.value,
      body: input.body,
      authorUid: input.authorUid,
      authorName: input.authorName,
      authorPhoto: input.authorPhoto,
      moderationStatus: 'approved',
      createdAt: serverTimestamp(),
    })
    batch.update(doc(db, `${p}Posts`, id.value), { commentCount: increment(1) })
    await batch.commit()
  }

  async function deleteComment(commentId: string): Promise<void> {
    const batch = writeBatch(db)
    const p = prefix()
    batch.delete(doc(db, `${p}Posts`, id.value, 'comments', commentId))
    batch.update(doc(db, `${p}Posts`, id.value), { commentCount: increment(-1) })
    await batch.commit()
    olderComments.value = olderComments.value.filter(comment => comment.id !== commentId)
  }

  return {
    comments,
    commentsPending: recentComments.pending,
    hasMore,
    loadingMore,
    loadMore,
    addComment,
    deleteComment,
  }
}
