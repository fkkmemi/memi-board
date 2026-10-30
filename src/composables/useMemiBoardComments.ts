import { computed, onScopeDispose, ref, toValue, watch } from 'vue'
import type { MaybeRefOrGetter, Ref } from 'vue'
import type { DocumentData, QueryDocumentSnapshot, Unsubscribe } from 'firebase/firestore'
import { deleteObject, getStorage, ref as storageRef } from 'firebase/storage'
import { useFirebaseApp, useFirestore } from 'vuefire'
import {
  deleteField,
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
import { isMemiBoardTranslationEnabled, useBoardPathConfig } from '../config'
import { boardTranslationLocales } from '../utils/localizedFields'
import { useMemiBoardWritingAssistant } from './useMemiBoardWritingAssistant'
import {
  commentDoc,
  commentsCol,
  postDoc,
  postStorageFolder,
} from '../utils/boardPaths'
import { commentImagePathsUnder, normalizeCommentImages } from '../utils/commentImages'
import { deleteLikesForComment } from '../utils/deletePostCascade'
import { subscribeCommentRange } from '../utils/subscribeCommentRange'
import { useMemiBoardSettings } from './useMemiBoardSettings'
import type { Attachment, CommentModel, CommentTranslationSet } from '../types'
import { useMemiBoardI18n } from '../i18n/useMemiBoardI18n'
import type { MemiBoardI18n } from '../i18n/useMemiBoardI18n'

export interface AddCommentInput {
  translations?: CommentTranslationSet
  body: string
  authorUid: string
  authorName: string | null
  authorPhoto: string | null
  /** 이미지를 먼저 올린 경우 그 경로에 쓴 댓글 ID */
  id?: string
  images?: Attachment[]
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
  const firebaseApp = useFirebaseApp()
  const cfg = () => useBoardPathConfig()
  const { isBoardHidden, getBoard } = useMemiBoardSettings()
  const { translateComment } = useMemiBoardWritingAssistant()
  let cachedTranslation: CommentTranslationSet | undefined

  async function translationFor(body: string, pending?: CommentTranslationSet) {
    if (!isMemiBoardTranslationEnabled()) return {}
    if (pending?.i18nSource.body === body) return pending
    if (getBoard(bid.value)?.autoTranslatePosts !== true) return {}
    if (cachedTranslation?.i18nSource.body !== body) {
      cachedTranslation = await translateComment({ body, targets: boardTranslationLocales(getBoard(bid.value)) })
    }
    return cachedTranslation
  }
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

  function newCommentId(): string {
    return doc(commentsColRef()).id
  }

  function commentRefFor(inputId?: string) {
    if (!inputId) return doc(commentsColRef())
    if (!/^[A-Za-z0-9]{10,128}$/.test(inputId)) throw new Error(t('commentForm.uploadFailed'))
    return commentDoc(db, cfg(), inputId)
  }

  function imagesFor(commentId: string, images: Attachment[] | null | undefined): Attachment[] {
    const prefix = `${postStorageFolder(cfg(), id.value)}/comment-images/${commentId}/`
    return normalizeCommentImages(images).filter(item => item.path.startsWith(prefix))
  }

  async function commentPayload(input: AddCommentInput, commentId: string) {
    const images = imagesFor(commentId, input.images)
    const body = normalizedCommentBody(input.body, i18n)
    return {
      postId: id.value,
      boardId: bid.value,
      listed: listedForBoard(),
      body,
      ...await translationFor(body, input.translations),
      authorUid: input.authorUid,
      authorName: input.authorName,
      authorPhoto: input.authorPhoto,
      moderationStatus: 'approved' as const,
      replyCount: 0,
      likeCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...(images.length ? { images } : {}),
    }
  }

  async function deleteStoredCommentImages(paths: string[]): Promise<void> {
    if (!paths.length) return
    const storage = getStorage(firebaseApp)
    await Promise.all(paths.map(path => deleteObject(storageRef(storage, path)).catch(() => {})))
  }

  async function addComment(input: AddCommentInput): Promise<void> {
    const batch = writeBatch(db)
    const commentRef = commentRefFor(input.id)
    batch.set(commentRef, {
      ...await commentPayload(input, commentRef.id),
      parentId: null,
      rootId: commentRef.id,
      depth: 0,
      replyToUid: null,
      replyToName: null,
      isReply: false,
    })
    batch.update(postDoc(db, cfg(), id.value), { commentCount: increment(1) })
    await batch.commit()
  }

  async function addReply(input: AddReplyInput): Promise<void> {
    if (!input.parent.id) throw new Error(t('comments.replyTargetNotFound'))
    const batch = writeBatch(db)
    const replyRef = commentRefFor(input.id)
    const rootId = input.parent.parentId == null
      ? input.parent.id
      : input.parent.rootId
    if (!rootId) throw new Error(t('comments.threadNotFound'))
    const depth = Math.min((input.parent.depth ?? 0) + 1, 2)

    batch.set(replyRef, {
      ...await commentPayload(input, replyRef.id),
      parentId: input.parent.id,
      rootId,
      depth,
      replyToUid: input.parent.authorUid,
      replyToName: input.parent.authorName,
      isReply: true,
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
    const imagePaths = commentImagePathsUnder(
      comment.images,
      `${postStorageFolder(cfg(), id.value)}/comment-images/${comment.id}/`,
    )
    await deleteLikesForComment(db, cfg(), comment.id)
    const batch = writeBatch(db)
    batch.delete(commentDoc(db, cfg(), comment.id))
    if (comment.parentId && comment.rootId) {
      batch.update(commentDoc(db, cfg(), comment.rootId), { replyCount: increment(-1) })
    }
    batch.update(postDoc(db, cfg(), id.value), { commentCount: increment(-1) })
    await batch.commit()
    await deleteStoredCommentImages(imagePaths)
    pagedComments.value = pagedComments.value.filter(item => item.id !== comment.id)
    legacyComments.value = legacyComments.value.filter(item => item.id !== comment.id)
  }

  async function updateComment(commentId: string, body: string, images?: Attachment[] | null, translations?: CommentTranslationSet): Promise<void> {
    const trimmed = normalizedCommentBody(body, i18n)
    const patch: {
      body: string
      updatedAt: ReturnType<typeof serverTimestamp>
      images?: Attachment[] | ReturnType<typeof deleteField>
    } = {
      body: trimmed,
      updatedAt: serverTimestamp(),
    }
    if (images !== undefined) {
      const normalized = imagesFor(commentId, images)
      patch.images = normalized.length ? normalized : deleteField()
    }
    await updateDoc(commentDoc(db, cfg(), commentId), { ...patch, ...await translationFor(trimmed, translations) })
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
    newCommentId,
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
