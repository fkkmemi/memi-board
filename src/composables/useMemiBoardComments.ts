import { computed, onScopeDispose, ref, watch } from 'vue'
import type { Ref } from 'vue'
import type { DocumentData, QueryDocumentSnapshot, Unsubscribe } from 'firebase/firestore'
import { useFirestore } from 'vuefire'
import {
  collection,
  doc,
  documentId,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { useBoardPathConfig } from '../config'
import {
  boardPostCommentDoc,
  boardPostCommentsCol,
  boardPostDoc,
} from '../utils/boardPaths'
import type { CommentModel } from '../types'

export interface AddCommentInput {
  body: string
  authorUid: string
  authorName: string | null
  authorPhoto: string | null
}

export interface AddReplyInput extends AddCommentInput {
  parent: CommentModel
}

const COMMENT_PAGE_SIZE = 10
const REPLY_PAGE_SIZE = 5
export const COMMENT_BODY_MAX_LENGTH = 1_000

function normalizedCommentBody(body: string): string {
  const trimmed = body.trim()
  if (!trimmed) throw new Error('댓글 내용을 입력해 주세요.')
  if (trimmed.length > COMMENT_BODY_MAX_LENGTH) {
    throw new Error(`댓글은 ${COMMENT_BODY_MAX_LENGTH.toLocaleString()}자까지 작성할 수 있습니다.`)
  }
  return trimmed
}

/** 10개씩 순차 조회한 뒤 마지막 페이지에서만 최신 1개를 실시간 구독한다. */
export function useMemiBoardComments(
  postId: string | Ref<string>,
  options: { subscribe?: boolean } = {},
) {
  const db = useFirestore()
  const cfg = () => useBoardPathConfig()

  const id = computed(() => (typeof postId === 'string' ? postId : postId.value))

  // limit(1) 리스너는 최신 댓글 알림 용도다. 쿼리 결과 교체로 기존 댓글이
  // 사라지지 않도록 수신 문서를 별도 배열에 누적한다.
  const liveComments = ref<CommentModel[]>([])
  // parentId 도입 전 댓글은 실시간 10개 슬롯과 분리해 최초 1회만 읽는다.
  const legacyComments = ref<CommentModel[]>([])
  const legacyPending = ref(options.subscribe !== false)
  const pagedComments = ref<CommentModel[]>([])
  const loadingMore = ref(false)
  const hasMore = ref(options.subscribe !== false)
  const initialPending = ref(options.subscribe !== false)
  let pageCursor: QueryDocumentSnapshot<DocumentData> | null = null
  let liveEnableTimer: ReturnType<typeof setTimeout> | undefined
  let stopLiveSubscription: Unsubscribe | undefined

  function createdAtMs(comment: CommentModel): number {
    return comment.createdAt?.toMillis?.() ?? 0
  }

  const comments = computed(() => {
    const byId = new Map<string, CommentModel>()
    for (const comment of [...liveComments.value, ...legacyComments.value, ...pagedComments.value]) {
      if (comment.id) byId.set(comment.id, comment)
    }
    return [...byId.values()].sort((a, b) =>
      createdAtMs(a) - createdAtMs(b) || String(a.id).localeCompare(String(b.id)),
    )
  })

  watch(id, async (currentId) => {
    pagedComments.value = []
    liveComments.value = []
    legacyComments.value = []
    pageCursor = null
    clearTimeout(liveEnableTimer)
    liveEnableTimer = undefined
    stopLiveSubscription?.()
    stopLiveSubscription = undefined
    hasMore.value = options.subscribe !== false
    if (options.subscribe === false) return

    legacyPending.value = true
    initialPending.value = true
    try {
      const snapshotPromise = getDocs(query(
        boardPostCommentsCol(db, cfg(), currentId),
        orderBy('createdAt', 'desc'),
        orderBy(documentId(), 'desc'),
      ))
      await Promise.all([snapshotPromise.then((snapshot) => {
        if (id.value !== currentId) return
        const allComments = snapshot.docs
          .map(item => ({ id: item.id, ...item.data() } as CommentModel))
        legacyComments.value = allComments.filter(comment => comment.parentId === undefined)
      }), loadMore()])
      if (id.value !== currentId) return
    }
    finally {
      if (id.value === currentId) {
        legacyPending.value = false
        initialPending.value = false
      }
    }
  }, { immediate: true })

  function startLiveSubscription() {
    stopLiveSubscription?.()
    stopLiveSubscription = onSnapshot(query(
      boardPostCommentsCol(db, cfg(), id.value),
      where('parentId', '==', null),
      orderBy('createdAt', 'desc'),
      orderBy(documentId(), 'desc'),
      limit(1),
    ), (snapshot) => {
      const byId = new Map(liveComments.value.map(comment => [comment.id, comment]))
      for (const change of snapshot.docChanges()) {
        if (change.type === 'removed') continue
        byId.set(change.doc.id, { id: change.doc.id, ...change.doc.data() } as CommentModel)
      }
      liveComments.value = [...byId.values()]
    }, (cause) => {
      console.error('[memi-board:comments] onSnapshot failed', cause)
    })
  }

  async function loadMore(): Promise<void> {
    if (loadingMore.value || !hasMore.value) return
    loadingMore.value = true
    try {
      const constraints = [
        where('parentId', '==', null),
        orderBy('createdAt', 'asc'),
        orderBy(documentId(), 'asc'),
        ...(pageCursor ? [startAfter(pageCursor)] : []),
        limit(COMMENT_PAGE_SIZE + 1),
      ]
      const snapshot = await getDocs(query(
        boardPostCommentsCol(db, cfg(), id.value),
        ...constraints,
      ))
      const pageDocs = snapshot.docs.slice(0, COMMENT_PAGE_SIZE)
      const page = pageDocs.map(item => ({ id: item.id, ...item.data() } as CommentModel))
      const existing = new Set(pagedComments.value.map(comment => comment.id))
      pagedComments.value.push(...page.filter(comment => !existing.has(comment.id)))
      pageCursor = pageDocs.at(-1) ?? pageCursor
      if (snapshot.size <= COMMENT_PAGE_SIZE) {
        hasMore.value = false
        liveEnableTimer = setTimeout(() => {
          liveEnableTimer = undefined
          startLiveSubscription()
        }, 1_000)
      }
    }
    finally {
      loadingMore.value = false
    }
  }

  onScopeDispose(() => {
    clearTimeout(liveEnableTimer)
    stopLiveSubscription?.()
  })

  async function addComment(input: AddCommentInput): Promise<void> {
    const body = normalizedCommentBody(input.body)
    const batch = writeBatch(db)
    const commentRef = doc(boardPostCommentsCol(db, cfg(), id.value))
    batch.set(commentRef, {
      postId: id.value,
      body,
      authorUid: input.authorUid,
      authorName: input.authorName,
      authorPhoto: input.authorPhoto,
      moderationStatus: 'approved',
      parentId: null,
      rootId: commentRef.id,
      depth: 0,
      replyToUid: null,
      replyToName: null,
      replyCount: 0,
      isReply: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    batch.update(boardPostDoc(db, cfg(), id.value), { commentCount: increment(1) })
    await batch.commit()
  }

  async function addReply(input: AddReplyInput): Promise<void> {
    const body = normalizedCommentBody(input.body)
    if (!input.parent.id) throw new Error('답글 대상 댓글을 찾을 수 없습니다.')
    const batch = writeBatch(db)
    const commentsCol = boardPostCommentsCol(db, cfg(), id.value)
    const replyRef = doc(commentsCol)
    const rootId = input.parent.parentId == null
      ? input.parent.id
      : input.parent.rootId
    if (!rootId) throw new Error('댓글 스레드를 찾을 수 없습니다.')
    const depth = Math.min((input.parent.depth ?? 0) + 1, 2)

    batch.set(replyRef, {
      postId: id.value,
      body,
      authorUid: input.authorUid,
      authorName: input.authorName,
      authorPhoto: input.authorPhoto,
      moderationStatus: 'approved',
      parentId: input.parent.id,
      rootId,
      depth,
      replyToUid: input.parent.authorUid,
      replyToName: input.parent.authorName,
      replyCount: 0,
      isReply: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    batch.update(doc(commentsCol, rootId), { replyCount: increment(1) })
    batch.update(boardPostDoc(db, cfg(), id.value), { commentCount: increment(1) })
    await batch.commit()
  }

  async function deleteComment(comment: CommentModel): Promise<void> {
    if (!comment.id) return
    if (comment.parentId == null && (comment.replyCount ?? 0) > 0) {
      throw new Error('답글이 있는 댓글은 현재 삭제할 수 없습니다.')
    }
    const batch = writeBatch(db)
    batch.delete(boardPostCommentDoc(db, cfg(), id.value, comment.id))
    if (comment.parentId && comment.rootId) {
      batch.update(boardPostCommentDoc(db, cfg(), id.value, comment.rootId), { replyCount: increment(-1) })
    }
    batch.update(boardPostDoc(db, cfg(), id.value), { commentCount: increment(-1) })
    await batch.commit()
    pagedComments.value = pagedComments.value.filter(item => item.id !== comment.id)
    legacyComments.value = legacyComments.value.filter(item => item.id !== comment.id)
    liveComments.value = liveComments.value.filter(item => item.id !== comment.id)
  }

  async function updateComment(commentId: string, body: string): Promise<void> {
    const trimmed = normalizedCommentBody(body)
    await updateDoc(boardPostCommentDoc(db, cfg(), id.value, commentId), {
      body: trimmed,
      updatedAt: serverTimestamp(),
    })
  }

  async function setCommentBlinded(commentId: string, isBlinded: boolean, moderatorUid: string): Promise<void> {
    await updateDoc(boardPostCommentDoc(db, cfg(), id.value, commentId), {
      isBlinded,
      moderatedAt: serverTimestamp(),
      moderatedBy: moderatorUid,
    })
  }

  return {
    comments,
    commentsPending: computed(() => initialPending.value || legacyPending.value),
    hasMore,
    loadingMore,
    loadMore,
    addComment,
    addReply,
    updateComment,
    setCommentBlinded,
    deleteComment,
  }
}

/** 펼친 스레드의 답글을 5개씩 일회성 조회한다. */
export function useMemiBoardReplies(postId: string, rootId: string) {
  const db = useFirestore()
  const cfg = () => useBoardPathConfig()
  const replies = ref<CommentModel[]>([])
  const loading = ref(false)
  const loaded = ref(false)
  const hasMore = ref(true)
  let cursor: QueryDocumentSnapshot<DocumentData> | null = null
  let stopLiveSubscription: Unsubscribe | undefined

  function sortReplies(list: CommentModel[]) {
    return list.sort((a, b) =>
      (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0)
      || String(a.id).localeCompare(String(b.id)),
    )
  }

  function startLiveSubscription() {
    if (stopLiveSubscription) return
    stopLiveSubscription = onSnapshot(query(
      boardPostCommentsCol(db, cfg(), postId),
      where('rootId', '==', rootId),
      where('isReply', '==', true),
      orderBy('createdAt', 'desc'),
      orderBy(documentId(), 'desc'),
      limit(1),
    ), (snapshot) => {
      const byId = new Map(replies.value.map(reply => [reply.id, reply]))
      for (const change of snapshot.docChanges()) {
        if (change.type === 'removed') continue
        byId.set(change.doc.id, { id: change.doc.id, ...change.doc.data() } as CommentModel)
      }
      replies.value = sortReplies([...byId.values()])
    }, (cause) => {
      console.error('[memi-board:replies] onSnapshot failed', cause)
    })
  }

  async function loadMore(): Promise<void> {
    if (loading.value || !hasMore.value) return
    loading.value = true
    try {
      const constraints = [
        where('rootId', '==', rootId),
        where('isReply', '==', true),
        orderBy('createdAt', 'asc'),
        orderBy(documentId(), 'asc'),
        ...(cursor ? [startAfter(cursor)] : []),
        limit(REPLY_PAGE_SIZE + 1),
      ]
      const snapshot = await getDocs(query(
        boardPostCommentsCol(db, cfg(), postId),
        ...constraints,
      ))
      const existing = new Set(replies.value.map(reply => reply.id))
      const pageDocs = snapshot.docs.slice(0, REPLY_PAGE_SIZE)
      const page = pageDocs
        .map(item => ({ id: item.id, ...item.data() } as CommentModel))
        .filter(reply => !existing.has(reply.id))
      replies.value = sortReplies([...replies.value, ...page])
      cursor = pageDocs.at(-1) ?? cursor
      loaded.value = true
      if (snapshot.size <= REPLY_PAGE_SIZE) {
        hasMore.value = false
        startLiveSubscription()
      }
    }
    finally {
      loading.value = false
    }
  }

  function reset() {
    stopLiveSubscription?.()
    stopLiveSubscription = undefined
    replies.value = []
    cursor = null
    loaded.value = false
    hasMore.value = true
  }

  async function refresh(): Promise<void> {
    reset()
    await loadMore()
  }

  onScopeDispose(() => stopLiveSubscription?.())

  return { replies, loading, loaded, hasMore, loadMore, refresh }
}
