import { computed, onScopeDispose, ref, toValue, watch } from 'vue'
import type { MaybeRefOrGetter, Ref } from 'vue'
import {
  doc,
  documentId,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
  query,
  where,
  orderBy,
  limit as fbLimit,
  limitToLast,
  startAfter,
  endBefore,
  serverTimestamp,
  deleteField,
} from 'firebase/firestore'
import type { QueryConstraint, Unsubscribe } from 'firebase/firestore'
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { useDocument, useFirebaseApp, useFirestore } from 'vuefire'
import { slugify } from '../utils/slugify'
import { findReadablePostBySlug } from '../utils/findReadablePost'
import { deletePostCascade } from '../utils/deletePostCascade'
import { hasBodyImage, hasBodyText, titleFromBody } from '../utils/postBody'
import { assertMemiBoardTranslationEnabled, useBoardPathConfig } from '../config'
import { buildPostPreview } from '../utils/postPreview'
import {
  postBodyDoc,
  postDoc,
  postsCol,
} from '../utils/boardPaths'
import { useMemiBoardSettings } from './useMemiBoardSettings'
import { useMemiBoardAuth } from './useMemiBoardAuth'
import type { MemiBoardLocale } from '../i18n/locales'
import { translate } from '../i18n/translate'
import { useMemiBoardI18n } from '../i18n/useMemiBoardI18n'
import type { Attachment, PostDetail, PostModel, PostTranslationSet } from '../types'
import { readContentI18nSource, readI18nSource, readLocalizedFields } from '../utils/localizedFields'

export interface CreatePostInput {
  postId?: string
  title: string
  content: string
  tags?: string[]
  attachments?: Attachment[]
  authorUid: string
  authorName: string | null
  authorPhoto: string | null
  moderationModel?: string
  /** resolveUniqueSlug 로 미리 구한 slug. 없으면 createPost 가 직접 구한다. */
  slug?: string
  /** 10개 언어 번역. 있으면 글과 본문에 함께 저장한다. */
  translations?: PostTranslationSet
}

export interface UpdatePostInput {
  title: string
  content: string
  tags?: string[]
  attachments?: Attachment[]
  /** 있으면 제목·본문 번역을 이 값으로 바꾼다. 없으면 기존 번역을 건드리지 않는다. */
  translations?: PostTranslationSet
}

export type GetPostBySlugResult =
  | { status: 'ok', post: PostDetail }
  | { status: 'not-found' }
  | { status: 'permission-denied' }
  | { status: 'error', message: string }

export type ResolvePostIdResult =
  | { status: 'ok', id: string }
  | { status: 'not-found' }
  | { status: 'permission-denied' }
  | { status: 'error', message: string }

/**
 * 방금 만든 글의 `boardId/slug` → id.
 * 저장 직후 상세(미리보기)로 갈 때 slug 재조회 왕복을 건너뛴다. slug 는 바뀌지 않는다.
 */
const createdPostIds = new Map<string, string>()

export function isFirestorePermissionDenied(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = 'code' in error ? String((error as { code?: string }).code) : ''
  return code === 'permission-denied' || code === 'firestore/permission-denied'
}

function resolveBoardId(boardId: MaybeRefOrGetter<string>, locale?: MemiBoardLocale): string {
  const id = toValue(boardId)?.trim()
  if (!id) throw new Error(translate(locale, 'posts.boardIdRequired'))
  return id
}

/** 목록은 posts 메타만, 본문(body/main)은 상세에서만. */
export function useMemiBoardPosts(boardId: MaybeRefOrGetter<string>) {
  const db = useFirestore()
  const app = useFirebaseApp()
  const { isBoardHidden, getBoard } = useMemiBoardSettings()
  const { user, canManageBoard } = useMemiBoardAuth()
  const { t, locale } = useMemiBoardI18n()
  const cfg = () => useBoardPathConfig()
  const bid = () => resolveBoardId(boardId, locale.value)

  const postsColRef = () => postsCol(db, cfg())
  const postDocRef = (id: string) => postDoc(db, cfg(), id)
  const bodyDocRef = (id: string) => postBodyDoc(db, cfg(), id)

  function readPostDetail(id: string, data: Record<string, unknown>, body: Record<string, unknown> | undefined): PostDetail {
    return {
      id,
      ...data,
      i18n: readLocalizedFields(data.i18n),
      i18nSource: readI18nSource(data.i18nSource),
      content: typeof body?.content === 'string' ? body.content : '',
      contentI18n: readLocalizedFields(body?.i18n),
      contentI18nSource: readContentI18nSource(body?.i18nSource),
    } as PostDetail
  }

  function listedForBoard(): boolean {
    return !isBoardHidden(bid())
  }

  function isImageEditorBoard(): boolean {
    return getBoard(bid())?.editorType === 'image'
  }

  function assertPostContent(
    input: { title?: string, content: string, attachments?: Attachment[] },
  ) {
    const imageBoard = isImageEditorBoard()
    const hasText = hasBodyText(input.content)
    const hasImage = hasBodyImage(input.content, input.attachments)
    if (imageBoard) {
      if (!hasImage) {
        throw new Error(t('posts.photoRequired'))
      }
      return
    }
    if (!hasText && !hasImage) {
      throw new Error(t('posts.bodyRequired'))
    }
    if (!input.title?.trim()) {
      throw new Error(t('posts.titleRequired'))
    }
  }

  function createPostId(): string {
    return doc(postsColRef()).id
  }

  function findBySlug(slug: string) {
    return findReadablePostBySlug(db, cfg(), bid(), slug, user.value?.uid, canManageBoard(bid()))
  }

  async function getPosts(opts: {
    pageSize?: number
    cursor?: QueryDocumentSnapshot<DocumentData>
    publicOnly?: boolean
  } = {}) {
    const pageSize = opts.pageSize ?? 20
    const constraints: QueryConstraint[] = [
      where('boardId', '==', bid()),
      where('isPublished', '==', true),
    ]
    if (opts.publicOnly !== false) {
      constraints.push(where('listed', '==', true))
    }
    constraints.push(orderBy('createdAt', 'desc'))
    if (opts.cursor) constraints.push(startAfter(opts.cursor))
    constraints.push(fbLimit(pageSize + 1))

    const snapshot = await getDocs(query(postsColRef(), ...constraints))
    const docs = snapshot.docs.slice(0, pageSize)
    return {
      posts: docs.map(d => ({ id: d.id, ...d.data() }) as PostModel),
      cursor: docs[docs.length - 1] as QueryDocumentSnapshot<DocumentData> | undefined,
      hasMore: snapshot.docs.length > pageSize,
    }
  }

  async function getPost(id: string): Promise<PostDetail | null> {
    const [metaSnap, bodySnap] = await Promise.all([getDoc(postDocRef(id)), getDoc(bodyDocRef(id))])
    if (!metaSnap.exists()) return null
    return readPostDetail(
      metaSnap.id,
      metaSnap.data() as Record<string, unknown>,
      bodySnap.exists() ? bodySnap.data() as Record<string, unknown> : undefined,
    )
  }

  /** 보드 내 slug 로 조회 */
  async function getPostBySlug(slug: string): Promise<GetPostBySlugResult> {
    try {
      const meta = await findBySlug(slug.trim())
      if (!meta) return { status: 'not-found' }
      try {
        const post = await getPost(meta.id)
        if (!post) return { status: 'not-found' }
        return { status: 'ok', post }
      }
      catch (cause) {
        if (isFirestorePermissionDenied(cause)) return { status: 'permission-denied' }
        return { status: 'error', message: cause instanceof Error ? cause.message : String(cause) }
      }
    }
    catch (cause) {
      if (isFirestorePermissionDenied(cause)) return { status: 'permission-denied' }
      return { status: 'error', message: cause instanceof Error ? cause.message : String(cause) }
    }
  }

  /**
   * slug → 글 id 만. 상세·수정 페이지는 id 만 필요하므로 본문까지 읽는 getPostBySlug 보다 왕복이 적다.
   * 이 탭에서 방금 만든 글이면 조회 없이 바로 돌려준다.
   */
  async function resolvePostIdBySlug(slug: string): Promise<ResolvePostIdResult> {
    const s = slug.trim()
    const cached = createdPostIds.get(`${bid()}/${s}`)
    if (cached) return { status: 'ok', id: cached }
    try {
      const row = await findBySlug(s)
      return row ? { status: 'ok', id: row.id }
        : { status: isBoardHidden(bid()) ? 'permission-denied' : 'not-found' }
    }
    catch (cause) {
      if (isFirestorePermissionDenied(cause)) return { status: 'permission-denied' }
      return { status: 'error', message: cause instanceof Error ? cause.message : String(cause) }
    }
  }

  /** Auto-ID suffix also prevents collisions with unreadable drafts and concurrent writers. */
  async function resolveUniqueSlug(title: string): Promise<string> {
    const baseSlug = slugify(title.trim()) || 'post'
    return `${baseSlug}-${createPostId()}`
  }

  async function getAdjacentPosts(current: PostModel): Promise<{
    previous: PostModel | null
    next: PostModel | null
  }> {
    if (!current.createdAt) return { previous: null, next: null }
    try {
      const base: QueryConstraint[] = [
        where('boardId', '==', bid()),
        where('isPublished', '==', true),
        ...((current.listed !== false) ? [where('listed', '==', true)] : []),
        orderBy('createdAt', 'desc'),
      ]
      const [previousSnapshot, nextSnapshot] = await Promise.all([
        getDocs(query(postsColRef(), ...base, startAfter(current.createdAt), fbLimit(1))),
        getDocs(query(postsColRef(), ...base, endBefore(current.createdAt), limitToLast(1))),
      ])
      const mapPost = (snapshot: typeof previousSnapshot): PostModel | null => {
        const item = snapshot.docs[0]
        return item ? ({ id: item.id, ...item.data() } as PostModel) : null
      }
      return {
        previous: mapPost(previousSnapshot),
        next: mapPost(nextSnapshot),
      }
    }
    catch (cause) {
      if (import.meta.dev) console.warn('[memi-board] getAdjacentPosts failed', cause)
      return { previous: null, next: null }
    }
  }

  async function createPost(input: CreatePostInput): Promise<string> {
    assertPostContent(input)
    const id = input.postId || createPostId()
    const imageBoard = isImageEditorBoard()
    let slug: string
    let title: string
    if (imageBoard) {
      slug = id
      title = titleFromBody(input.content)
    }
    else {
      title = input.title.trim()
      slug = input.slug?.trim() || await resolveUniqueSlug(title)
    }

    const preview = buildPostPreview(input.content, input.attachments)
    const listed = listedForBoard()
    // 메타·본문을 한 번에 커밋 — 순차 setDoc 두 번보다 왕복 1회 적다.
    const batch = writeBatch(db)
    batch.set(postDocRef(id), {
      boardId: bid(),
      slug,
      title,
      ...preview,
      tags: input.tags ?? [],
      attachments: input.attachments ?? [],
      commentCount: 0,
      likeCount: 0,
      viewCount: 0,
      listed,
      isPublished: false,
      authorUid: input.authorUid,
      authorName: input.authorName,
      authorPhoto: input.authorPhoto,
      moderationStatus: 'approved',
      moderationModel: input.moderationModel ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...(input.translations ? {
        i18n: input.translations.i18n,
        i18nSource: input.translations.i18nSource,
      } : {}),
    })
    batch.set(bodyDocRef(id), {
      content: input.content,
      ...(input.translations?.contentI18n ? {
        i18n: input.translations.contentI18n,
        i18nSource: input.translations.contentI18nSource,
      } : {}),
    })
    await batch.commit()
    createdPostIds.set(`${bid()}/${slug}`, id)
    return slug
  }

  async function updatePost(id: string, input: UpdatePostInput): Promise<void> {
    assertPostContent(input)
    const imageBoard = isImageEditorBoard()
    const title = imageBoard ? titleFromBody(input.content) : input.title.trim()
    const preview = buildPostPreview(input.content, input.attachments)
    const listed = listedForBoard()
    await Promise.all([
      updateDoc(postDocRef(id), {
        title,
        ...preview,
        previewImage: preview.previewImage ? preview.previewImage : deleteField(),
        videoUrl: preview.videoUrl ? preview.videoUrl : deleteField(),
        tags: input.tags ?? [],
        listed,
        attachments: input.attachments ?? [],
        updatedAt: serverTimestamp(),
        ...(input.translations ? {
          i18n: input.translations.i18n,
          i18nSource: input.translations.i18nSource,
        } : {}),
      }),
      setDoc(bodyDocRef(id), {
        content: input.content,
        ...(input.translations
          ? (input.translations.contentI18n
              ? { i18n: input.translations.contentI18n, i18nSource: input.translations.contentI18nSource }
              : { i18n: deleteField(), i18nSource: deleteField() })
          : {}),
      }, { merge: true }),
    ])
  }

  /** 이미 있는 글에 10개 언어 번역만 기록한다. 제목·본문 원문은 바꾸지 않는다. */
  async function savePostTranslations(id: string, translations: PostTranslationSet): Promise<void> {
    assertMemiBoardTranslationEnabled()
    await Promise.all([
      updateDoc(postDocRef(id), {
        i18n: translations.i18n,
        i18nSource: translations.i18nSource,
        updatedAt: serverTimestamp(),
      }),
      setDoc(bodyDocRef(id), translations.contentI18n
        ? { i18n: translations.contentI18n, i18nSource: translations.contentI18nSource }
        : { i18n: deleteField(), i18nSource: deleteField() }, { merge: true }),
    ])
  }

  async function publishPost(id: string): Promise<void> {
    await updateDoc(postDocRef(id), {
      isPublished: true,
      publishedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }

  /** 공지 지정·해제. 보드 매니저만 가능(rules 가 pinned·pinnedAt 만 바꾸는 갱신으로 제한). */
  async function setPostPinned(id: string, pinned: boolean): Promise<void> {
    await updateDoc(postDocRef(id), pinned
      ? { pinned: true, pinnedAt: serverTimestamp() }
      : { pinned: deleteField(), pinnedAt: deleteField() })
  }

  async function deletePost(id: string): Promise<void> {
    await deletePostCascade(db, getStorage(app), cfg(), id)
    for (const [key, value] of createdPostIds) {
      if (value === id) createdPostIds.delete(key)
    }
  }

  return {
    createPostId,
    getPosts,
    getPost,
    getPostBySlug,
    resolvePostIdBySlug,
    resolveUniqueSlug,
    getAdjacentPosts,
    createPost,
    updatePost,
    savePostTranslations,
    publishPost,
    setPostPinned,
    deletePost,
  }
}

const POST_PAGE_SIZE = 10
const NOTICE_LIMIT = 10

export function useMemiBoardPostList(
  boardId: MaybeRefOrGetter<string>,
  options: { pageSize?: number, publicOnly?: boolean | Ref<boolean> } = {},
) {
  const db = useFirestore()
  const { isAdmin, user, canManageBoard } = useMemiBoardAuth()
  const cfg = () => useBoardPathConfig()
  const pageSize = options.pageSize ?? POST_PAGE_SIZE
  const uidValue = computed(() => user.value?.uid ?? '')

  const boardIdValue = computed(() => resolveBoardId(boardId))
  const postsColRef = () => postsCol(db, cfg())

  const publicOnlyValue = computed(() => {
    if (options.publicOnly === undefined) {
      return !(isAdmin.value || canManageBoard(boardIdValue.value))
    }
    return typeof options.publicOnly === 'boolean' ? options.publicOnly : options.publicOnly.value
  })

  const headPosts = ref<PostModel[]>([])
  const olderPosts = ref<PostModel[]>([])
  /** 본인의 미게시 초안 — 목록 쿼리(isPublished==true)엔 안 걸리므로 별도 구독해 얹는다. */
  const ownDraftPosts = ref<PostModel[]>([])
  /** 공지 — 일반 목록과 별도 쿼리로 동시에 구독하고, 일반 목록에서는 뺀다. */
  const notices = ref<PostModel[]>([])
  const noticesPending = ref(true)
  const headPending = ref(true)
  const hasMore = ref(true)
  const loadingMore = ref(false)
  const loadError = ref('')
  let headTailCursor: QueryDocumentSnapshot<DocumentData> | null = null
  let olderCursor: QueryDocumentSnapshot<DocumentData> | null = null
  let stopHeadSubscription: Unsubscribe | undefined
  let stopOwnDraftSubscription: Unsubscribe | undefined
  let stopNoticeSubscription: Unsubscribe | undefined

  function createdAtMs(post: PostModel): number {
    return post.createdAt?.toMillis?.() ?? 0
  }

  const posts = computed(() => {
    const noticeIds = new Set(notices.value.map(post => post.id))
    const byId = new Map<string, PostModel>()
    for (const post of [...olderPosts.value, ...headPosts.value, ...ownDraftPosts.value]) {
      if (post.id && !noticeIds.has(post.id)) byId.set(post.id, post)
    }
    return [...byId.values()].sort((a, b) =>
      createdAtMs(b) - createdAtMs(a) || String(b.id).localeCompare(String(a.id)),
    )
  })

  function baseConstraints(): QueryConstraint[] {
    const constraints: QueryConstraint[] = [
      where('boardId', '==', boardIdValue.value),
      where('isPublished', '==', true),
    ]
    if (publicOnlyValue.value) constraints.push(where('listed', '==', true))
    return constraints
  }

  function startHeadSubscription() {
    stopHeadSubscription?.()
    stopHeadSubscription = onSnapshot(query(
      postsColRef(),
      ...baseConstraints(),
      orderBy('createdAt', 'desc'),
      orderBy(documentId(), 'desc'),
      fbLimit(pageSize),
    ), (snapshot) => {
      headPosts.value = snapshot.docs.map(item => ({ id: item.id, ...item.data() }) as PostModel)
      headTailCursor = snapshot.docs.at(-1) ?? null
      if (!olderCursor) hasMore.value = snapshot.docs.length >= pageSize
      headPending.value = false
    }, (cause) => {
      console.error('[memi-board:postList] onSnapshot failed', cause)
      loadError.value = (cause as Error).message || String(cause)
      headPending.value = false
    })
  }

  function startNoticeSubscription() {
    stopNoticeSubscription?.()
    stopNoticeSubscription = onSnapshot(query(
      postsColRef(),
      ...baseConstraints(),
      where('pinned', '==', true),
      orderBy('pinnedAt', 'desc'),
      fbLimit(NOTICE_LIMIT),
    ), (snapshot) => {
      notices.value = snapshot.docs.map(item => ({ id: item.id, ...item.data() }) as PostModel)
      noticesPending.value = false
    }, (cause) => {
      // 공지 인덱스가 아직 없어도 일반 목록은 보여 준다.
      console.error('[memi-board:postList] notice onSnapshot failed', cause)
      notices.value = []
      noticesPending.value = false
    })
  }

  function startOwnDraftSubscription() {
    stopOwnDraftSubscription?.()
    const uid = uidValue.value
    if (!uid) {
      ownDraftPosts.value = []
      return
    }
    stopOwnDraftSubscription = onSnapshot(query(
      postsColRef(),
      where('boardId', '==', boardIdValue.value),
      where('authorUid', '==', uid),
      where('isPublished', '==', false),
      orderBy('createdAt', 'desc'),
      fbLimit(20),
    ), (snapshot) => {
      ownDraftPosts.value = snapshot.docs.map(item => ({ id: item.id, ...item.data() }) as PostModel)
    }, (cause) => {
      console.error('[memi-board:postList] own draft onSnapshot failed', cause)
    })
  }

  async function loadMore(): Promise<void> {
    if (loadingMore.value || !hasMore.value || headPending.value) return
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
      const page = pageDocs.map(item => ({ id: item.id, ...item.data() }) as PostModel)
      const existingIds = new Set([...olderPosts.value, ...headPosts.value].map(post => post.id))
      olderPosts.value.push(...page.filter(post => !existingIds.has(post.id)))
      olderCursor = pageDocs.at(-1) ?? olderCursor
      hasMore.value = snapshot.docs.length > pageSize
    }
    catch (e) {
      loadError.value = (e as Error).message || String(e)
      console.error('[memi-board:postList] loadMore failed', e)
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
    notices.value = []
    noticesPending.value = true
    startHeadSubscription()
    startNoticeSubscription()
    startOwnDraftSubscription()
  }

  watch([boardIdValue, publicOnlyValue, uidValue], reset, { immediate: true })
  onScopeDispose(() => {
    stopHeadSubscription?.()
    stopNoticeSubscription?.()
    stopOwnDraftSubscription?.()
  })

  return {
    posts,
    notices,
    // 공지가 나중에 튀어나오지 않게 둘 다 도착한 뒤 그린다.
    postsPending: computed(() => headPending.value || noticesPending.value),
    hasMore,
    loadingMore,
    loadError,
    loadMore,
  }
}

export function useMemiBoardPost(
  boardId: MaybeRefOrGetter<string>,
  postId: string | Ref<string>,
) {
  const db = useFirestore()
  const cfg = () => useBoardPathConfig()

  const bid = computed(() => resolveBoardId(boardId))
  const id = computed(() => (typeof postId === 'string' ? postId : postId.value))
  const postRef = computed(() => postDoc(db, cfg(), id.value))
  const bodyRef = computed(() => postBodyDoc(db, cfg(), id.value))

  const { data: meta, pending: metaPending } = useDocument<PostModel>(postRef)
  const { data: body, pending: bodyPending } = useDocument<{
    content: string
    i18n?: PostModel['i18n']
    i18nSource?: { locale?: string, hash?: string }
  }>(bodyRef)

  const post = computed<PostDetail | null>(() => {
    // boardId 는 이제 문서 필드라, URL의 boardId 세그먼트와 실제 글이 다른 보드에
    // 속하면(잘못된 URL 등) 상세를 보여주지 않는다.
    if (!meta.value || meta.value.boardId !== bid.value) return null
    const bodyData = body.value as Record<string, unknown> | null | undefined
    return {
      ...meta.value,
      id: id.value,
      i18n: readLocalizedFields(meta.value.i18n),
      i18nSource: readI18nSource(meta.value.i18nSource),
      content: body.value?.content ?? '',
      contentI18n: readLocalizedFields(bodyData?.i18n),
      contentI18nSource: readContentI18nSource(bodyData?.i18nSource),
    }
  })
  const pending = computed(() => metaPending.value || bodyPending.value)

  return { post, pending }
}
