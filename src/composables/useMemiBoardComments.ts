import { computed, onScopeDispose, ref, toValue, watch } from 'vue'
import type { MaybeRefOrGetter, Ref } from 'vue'
import type { DocumentData, QueryDocumentSnapshot, Unsubscribe } from 'firebase/firestore'
import { useFirestore } from 'vuefire'
import {
  doc,
  documentId,
  getDocs,
  increment,
  limit,
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
  commentDoc,
  commentsCol,
  postDoc,
} from '../utils/boardPaths'
import { deleteLikesForComment } from '../utils/deletePostCascade'
import { subscribeCommentRange } from '../utils/subscribeCommentRange'
import { useMemiBoardSettings } from './useMemiBoardSettings'
import type { CommentModel } from '../types'
import { useMemiBoardI18n } from '../i18n/useMemiBoardI18n'
import type { MemiBoardI18n } from '../i18n/useMemiBoardI18n'

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

function normalizedCommentBody(body: string, { t, formatNumber }: Pick<MemiBoardI18n, 't' | 'formatNumber'>): string {
  const trimmed = body.trim()
  if (!trimmed) throw new Error(t('comments.bodyRequired'))
  if (trimmed.length > COMMENT_BODY_MAX_LENGTH) {
    throw new Error(t('comments.bodyTooLong', { max: formatNumber(COMMENT_BODY_MAX_LENGTH) }))
  }
  return trimmed
}

/** 10개씩 순차 조회하고 불러온 범위의 수정·좋아요·삭제를 실시간 구독한다. */
export function useMemiBoardComments(
  boardId: MaybeRefOrGetter<string>,
  postId: MaybeRefOrGetter<string>,
  options: { subscribe?: boolean } = {},
) {
  const db = useFirestore()
  const cfg = () => useBoardPathConfig()
  const { isBoardHidden } = useMemiBoardSettings()
  const i18n = useMemiBoardI18n()
  const { t } = i18n
  const commentsColRef = () => commentsCol(db, cfg())

  const bid = computed(() => toValue(boardId))
  const id = computed(() => toValue(postId))
  const listedForBoard = () => !isBoardHidden(bid.value)

  // parentId 도입 전 댓글은 범위 구독과 분리해 최초 1회만 읽는다.
  const legacyComments = ref<CommentModel[]>([])
  const legacyPending = ref(options.subscribe !== false)
  const pagedComments = ref<CommentModel[]>([])
  const loadingMore = ref(false)
  const hasMore = ref(options.subscribe !== false)
  const initialPending = ref(options.subscribe !== false)
  let pageCursor: QueryDocumentSnapshot<DocumentData> | null = null
  let epoch = 0
  let subscriptionVersion = 0
  let stopLiveSubscription: Unsubscribe | undefined

  function createdAtMs(comment: CommentModel): number {
    return comment.createdAt?.toMillis?.() ?? 0
  }

  const comments = computed(() => {
    const byId = new Map<string, CommentModel>()
    for (const comment of [...legacyComments.value, ...pagedComments.value]) {
      if (comment.id) byId.set(comment.id, comment)
    }
    return [...byId.values()].sort((a, b) =>
      createdAtMs(a) - createdAtMs(b) || String(a.id).localeCompare(String(b.id)),
    )
  })

  watch([id, bid], async ([currentId]) => {
    const currentEpoch = ++epoch
    subscriptionVersion++
    loadingMore.value = false
    pagedComments.value = []
    legacyComments.value = []
    pageCursor = null
    stopLiveSubscription?.()
    stopLiveSubscription = undefined
    hasMore.value = options.subscribe !== false
    if (options.subscribe === false) return

    legacyPending.value = true
    initialPending.value = true
    try {
      const snapshotPromise = getDocs(query(
        commentsColRef(),
        where('postId', '==', currentId),
        orderBy('createdAt', 'desc'),
        orderBy(documentId(), 'desc'),
      ))
      await Promise.all([snapshotPromise.then((snapshot) => {
        if (currentEpoch !== epoch) return
        const allComments = snapshot.docs
          .map(item => ({ id: item.id, ...item.data() } as CommentModel))
        legacyComments.value = allComments.filter(comment => comment.parentId === undefined)
      }), loadMore()])
      if (currentEpoch !== epoch) return
    }
    finally {
      if (currentEpoch === epoch) {
        legacyPending.value = false
        initialPending.value = false
      }
    }
  }, { immediate: true })

  function startLiveSubscription() {
    stopLiveSubscription?.()
    const version = ++subscriptionVersion
    stopLiveSubscription = subscribeCommentRange(db, cfg(), id.value, {
      cursor: pageCursor, hasMore: hasMore.value,
    }, (items) => {
      if (version === subscriptionVersion) pagedComments.value = items
    }, (cause) => {
      console.error('[memi-board:comments] onSnapshot failed', cause)
    })
  }

  async function loadMore(): Promise<void> {
    if (loadingMore.value || !hasMore.value) return
    const currentEpoch = epoch
    loadingMore.value = true
    try {
      const constraints = [
        where('postId', '==', id.value),
        where('parentId', '==', null),
        orderBy('createdAt', 'asc'),
        orderBy(documentId(), 'asc'),
        ...(pageCursor ? [startAfter(pageCursor)] : []),
        limit(COMMENT_PAGE_SIZE + 1),
      ]
      const snapshot = await getDocs(query(
        commentsColRef(),
        ...constraints,
      ))
      if (currentEpoch !== epoch) return
      const pageDocs = snapshot.docs.slice(0, COMMENT_PAGE_SIZE)
      const page = pageDocs.map(item => ({ id: item.id, ...item.data() } as CommentModel))
      const existing = new Set(pagedComments.value.map(comment => comment.id))
      pagedComments.value.push(...page.filter(comment => !existing.has(comment.id)))
      pageCursor = pageDocs.at(-1) ?? pageCursor
      hasMore.value = snapshot.size > COMMENT_PAGE_SIZE
      startLiveSubscription()
    }
    finally {
      if (currentEpoch === epoch) loadingMore.value = false
    }
  }

  onScopeDispose(() => {
    epoch++
    subscriptionVersion++
    stopLiveSubscription?.()
  })

  async function addComment(input: AddCommentInput): Promise<void> {
    const body = normalizedCommentBody(input.body, i18n)
    const batch = writeBatch(db)
    const commentRef = doc(commentsColRef())
    batch.set(commentRef, {
      postId: id.value,
      boardId: bid.value,
      listed: listedForBoard(),
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
      likeCount: 0,
      isReply: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    batch.update(postDoc(db, cfg(), id.value), { commentCount: increment(1) })
    await batch.commit()
  }

  async function addReply(input: AddReplyInput): Promise<void> {
    const body = normalizedCommentBody(input.body, i18n)
    if (!input.parent.id) throw new Error(t('comments.replyTargetNotFound'))
    const batch = writeBatch(db)
    const replyRef = doc(commentsColRef())
    const rootId = input.parent.parentId == null
      ? input.parent.id
      : input.parent.rootId
    if (!rootId) throw new Error(t('comments.threadNotFound'))
    const depth = Math.min((input.parent.depth ?? 0) + 1, 2)

    batch.set(replyRef, {
      postId: id.value,
      boardId: bid.value,
      listed: listedForBoard(),
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
      likeCount: 0,
      isReply: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    batch.update(commentDoc(db, cfg(), rootId), { replyCount: increment(1) })
    batch.update(postDoc(db, cfg(), id.value), { commentCount: increment(1) })
    await batch.commit()
  }

  async function deleteComment(comment: CommentModel): Promise<void> {
    if (!comment.id) return
    if (comment.parentId == null && (comment.replyCount ?? 0) > 0) {
      throw new Error(t('comments.hasRepliesCannotDelete'))
    }
    await deleteLikesForComment(db, cfg(), comment.id)
    const batch = writeBatch(db)
    batch.delete(commentDoc(db, cfg(), comment.id))
    if (comment.parentId && comment.rootId) {
      batch.update(commentDoc(db, cfg(), comment.rootId), { replyCount: increment(-1) })
    }
    batch.update(postDoc(db, cfg(), id.value), { commentCount: increment(-1) })
    await batch.commit()
    pagedComments.value = pagedComments.value.filter(item => item.id !== comment.id)
    legacyComments.value = legacyComments.value.filter(item => item.id !== comment.id)
  }

  async function updateComment(commentId: string, body: string): Promise<void> {
    const trimmed = normalizedCommentBody(body, i18n)
    await updateDoc(commentDoc(db, cfg(), commentId), {
      body: trimmed,
      updatedAt: serverTimestamp(),
    })
  }

  async function setCommentBlinded(commentId: string, isBlinded: boolean, moderatorUid: string): Promise<void> {
    await updateDoc(commentDoc(db, cfg(), commentId), {
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

/**
 * 펼친 스레드의 답글을 5개씩 조회하고 불러온 범위를 실시간 구독한다.
 */
export function useMemiBoardReplies(boardId: string, postId: string, rootId: string) {
  const db = useFirestore()
  const cfg = () => useBoardPathConfig()
  const commentsColRef = () => commentsCol(db, cfg())
  const pid = postId.trim()
  const replies = ref<CommentModel[]>([])
  const loading = ref(false)
  const loaded = ref(false)
  const hasMore = ref(true)
  let cursor: QueryDocumentSnapshot<DocumentData> | null = null
  let stopLiveSubscription: Unsubscribe | undefined
  let epoch = 0
  let subscriptionVersion = 0

  function sortReplies(list: CommentModel[]) {
    return list.sort((a, b) =>
      (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0)
      || String(a.id).localeCompare(String(b.id)),
    )
  }

  function startLiveSubscription() {
    stopLiveSubscription?.()
    const version = ++subscriptionVersion
    stopLiveSubscription = subscribeCommentRange(db, cfg(), pid, {
      rootId, cursor, hasMore: hasMore.value,
    }, (items) => {
      if (version === subscriptionVersion) replies.value = items
    }, (cause) => {
      console.error('[memi-board:replies] onSnapshot failed', cause)
    })
  }

  async function loadMore(): Promise<void> {
    if (loading.value || !hasMore.value) return
    const currentEpoch = epoch
    loading.value = true
    try {
      const constraints = [
        where('postId', '==', pid),
        where('rootId', '==', rootId),
        where('isReply', '==', true),
        orderBy('createdAt', 'asc'),
        orderBy(documentId(), 'asc'),
        ...(cursor ? [startAfter(cursor)] : []),
        limit(REPLY_PAGE_SIZE + 1),
      ]
      const snapshot = await getDocs(query(
        commentsColRef(),
        ...constraints,
      ))
      if (currentEpoch !== epoch) return
      const existing = new Set(replies.value.map(reply => reply.id))
      const pageDocs = snapshot.docs.slice(0, REPLY_PAGE_SIZE)
      const page = pageDocs
        .map(item => ({ id: item.id, ...item.data() } as CommentModel))
        .filter(reply => !existing.has(reply.id))
      replies.value = sortReplies([...replies.value, ...page])
      cursor = pageDocs.at(-1) ?? cursor
      loaded.value = true
      hasMore.value = snapshot.size > REPLY_PAGE_SIZE
      startLiveSubscription()
    }
    finally {
      if (currentEpoch === epoch) loading.value = false
    }
  }

  function reset() {
    epoch++
    subscriptionVersion++
    loading.value = false
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

  onScopeDispose(() => { epoch++; subscriptionVersion++; stopLiveSubscription?.() })

  return { replies, loading, loaded, hasMore, loadMore, refresh }
}
