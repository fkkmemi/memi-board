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
  deleteDoc,
  query,
  where,
  orderBy,
  limit as fbLimit,
  limitToLast,
  startAfter,
  endBefore,
  serverTimestamp,
  writeBatch,
  deleteField,
} from 'firebase/firestore'
import type { QueryConstraint, Unsubscribe } from 'firebase/firestore'
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore'
import { getStorage, ref as storageRef, listAll, deleteObject } from 'firebase/storage'
import type { StorageReference } from 'firebase/storage'
import { useDocument, useFirebaseApp, useFirestore } from 'vuefire'
import { slugify } from '../utils/slugify'
import { extractEditorImageUrls } from '../utils/extractEditorImageUrls'
import { postNamespaceFromStoragePath, storagePathFromDownloadUrl } from '../utils/storagePath'
import { hasBodyImage, hasBodyText, titleFromBody } from '../utils/postBody'
import { useBoardPathConfig } from '../config'
import { buildPostPreview } from '../utils/postPreview'
import {
  postBodyDoc,
  commentsCol,
  postDoc,
  postStorageFolder,
  postsCol,
} from '../utils/boardPaths'
import { useMemiBoardSettings } from './useMemiBoardSettings'
import { useMemiBoardAuth } from './useMemiBoardAuth'
import type { Attachment, PostDetail, PostModel } from '../types'

async function deleteStorageFolder(folderRef: StorageReference): Promise<void> {
  const list = await listAll(folderRef).catch(() => ({ items: [], prefixes: [] }))
  await Promise.all([
    ...list.items.map(item => deleteObject(item)),
    ...list.prefixes.map(prefix => deleteStorageFolder(prefix)),
  ])
}

async function deleteStoragePaths(storage: ReturnType<typeof getStorage>, paths: Iterable<string>): Promise<void> {
  const unique = [...new Set([...paths].filter(Boolean))]
  await Promise.all(
    unique.map(path => deleteObject(storageRef(storage, path)).catch(() => {})),
  )
}

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
}

export interface UpdatePostInput {
  title: string
  content: string
  tags?: string[]
  attachments?: Attachment[]
}

export type GetPostBySlugResult =
  | { status: 'ok', post: PostDetail }
  | { status: 'not-found' }
  | { status: 'permission-denied' }
  | { status: 'error', message: string }

export function isFirestorePermissionDenied(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = 'code' in error ? String((error as { code?: string }).code) : ''
  return code === 'permission-denied' || code === 'firestore/permission-denied'
}

function resolveBoardId(boardId: MaybeRefOrGetter<string>): string {
  const id = toValue(boardId)?.trim()
  if (!id) throw new Error('[memi-board] boardId 가 필요합니다.')
  return id
}

/** 목록은 posts 메타만, 본문(body/main)은 상세에서만. */
export function useMemiBoardPosts(boardId: MaybeRefOrGetter<string>) {
  const db = useFirestore()
  const app = useFirebaseApp()
  const { isBoardHidden, getBoard } = useMemiBoardSettings()
  const cfg = () => useBoardPathConfig()
  const bid = () => resolveBoardId(boardId)

  const postsColRef = () => postsCol(db, cfg())
  const postDocRef = (id: string) => postDoc(db, cfg(), id)
  const bodyDocRef = (id: string) => postBodyDoc(db, cfg(), id)
  const commentsColRef = () => commentsCol(db, cfg())

  function listedForBoard(): boolean {
    return !isBoardHidden(bid())
  }

  function isImageListBoard(): boolean {
    return getBoard(bid())?.listView === 'image'
  }

  function assertPostContent(
    input: { title?: string, content: string, attachments?: Attachment[] },
  ) {
    const imageBoard = isImageListBoard()
    if (!hasBodyText(input.content)) {
      throw new Error(
        imageBoard
          ? '내용을 입력해 주세요.'
          : '본문에 글자를 입력해 주세요. 이미지나 첨부만으로는 게시할 수 없습니다.',
      )
    }
    if (imageBoard) {
      if (!hasBodyImage(input.content, input.attachments)) {
        throw new Error('사진을 올려 주세요.')
      }
      return
    }
    if (!input.title?.trim()) {
      throw new Error('제목을 입력해 주세요.')
    }
  }

  function createPostId(): string {
    return doc(postsColRef()).id
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
    return {
      id: metaSnap.id,
      ...metaSnap.data(),
      content: bodySnap.exists() ? ((bodySnap.data() as { content: string }).content ?? '') : '',
    } as PostDetail
  }

  /** 보드 내 slug 로 조회 */
  async function getPostBySlug(slug: string): Promise<GetPostBySlugResult> {
    try {
      const snapshot = await getDocs(query(
        postsColRef(),
        where('boardId', '==', bid()),
        where('slug', '==', slug.trim()),
        fbLimit(1),
      ))
      const meta = snapshot.docs[0]
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
    const imageBoard = isImageListBoard()
    let slug: string
    let title: string
    if (imageBoard) {
      slug = id
      title = titleFromBody(input.content)
    }
    else {
      title = input.title.trim()
      const baseSlug = slugify(title) || 'post'
      slug = baseSlug
      let counter = 1
      while (!(await getDocs(query(
        postsColRef(),
        where('boardId', '==', bid()),
        where('slug', '==', slug),
        fbLimit(1),
      ))).empty) {
        counter++
        slug = `${baseSlug}-${counter}`
      }
    }

    const preview = buildPostPreview(input.content, input.attachments)
    const listed = listedForBoard()
    await setDoc(postDocRef(id), {
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
    })
    await setDoc(bodyDocRef(id), { content: input.content })
    return slug
  }

  async function updatePost(id: string, input: UpdatePostInput): Promise<void> {
    assertPostContent(input)
    const imageBoard = isImageListBoard()
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
      }),
      setDoc(bodyDocRef(id), { content: input.content }, { merge: true }),
    ])
  }

  async function publishPost(id: string): Promise<void> {
    await updateDoc(postDocRef(id), {
      isPublished: true,
      publishedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }

  async function deletePost(id: string): Promise<void> {
    const [metaSnap, bodySnap] = await Promise.all([
      getDoc(postDocRef(id)),
      getDoc(bodyDocRef(id)),
    ])
    if (!metaSnap.exists()) return

    const meta = metaSnap.data() as PostModel
    const bodyContent = bodySnap.exists()
      ? String((bodySnap.data() as { content?: string }).content ?? '')
      : ''

    const commentsSnap = await getDocs(query(commentsColRef(), where('postId', '==', id)))
    for (let offset = 0; offset < commentsSnap.docs.length; offset += 450) {
      const batch = writeBatch(db)
      commentsSnap.docs.slice(offset, offset + 450).forEach(d => batch.delete(d.ref))
      await batch.commit()
    }

    const storage = getStorage(app)
    const extraPaths = new Set<string>()
    const extraNamespaces = new Set<string>()

    for (const att of meta.attachments ?? []) {
      if (att?.path) {
        extraPaths.add(att.path)
        const ns = postNamespaceFromStoragePath(att.path)
        if (ns && ns !== id) extraNamespaces.add(ns)
      }
    }

    for (const url of extractEditorImageUrls(bodyContent)) {
      const path = storagePathFromDownloadUrl(url)
      if (!path) continue
      extraPaths.add(path)
      const thumbGuess = path
        .replace(/\/images\/([^/]+)$/, '/images/thumbnails/$1')
        .replace(/\.[^.]+$/, '.jpg')
      if (thumbGuess !== path && thumbGuess.includes('/images/thumbnails/')) {
        extraPaths.add(thumbGuess)
      }
      const m = path.match(/^(.*\/images\/)([^/]+)\.[^.]+$/)
      if (m && !path.includes('/thumbnails/')) {
        extraPaths.add(`${m[1]}thumbnails/${m[2]}.jpg`)
      }
      const ns = postNamespaceFromStoragePath(path)
      if (ns && ns !== id) extraNamespaces.add(ns)
    }

    await deleteDoc(bodyDocRef(id))
    await deleteStorageFolder(storageRef(storage, postStorageFolder(cfg(), id)))
    for (const ns of extraNamespaces) {
      await deleteStorageFolder(storageRef(storage, postStorageFolder(cfg(), ns)))
    }
    await deleteStoragePaths(storage, extraPaths)
    await deleteDoc(postDocRef(id))
  }

  return {
    createPostId,
    getPosts,
    getPost,
    getPostBySlug,
    getAdjacentPosts,
    createPost,
    updatePost,
    publishPost,
    deletePost,
  }
}

const POST_PAGE_SIZE = 10

export function useMemiBoardPostList(
  boardId: MaybeRefOrGetter<string>,
  options: { pageSize?: number, publicOnly?: boolean | Ref<boolean> } = {},
) {
  const db = useFirestore()
  const { isAdmin, isStaff, user } = useMemiBoardAuth()
  const cfg = () => useBoardPathConfig()
  const pageSize = options.pageSize ?? POST_PAGE_SIZE
  const uidValue = computed(() => user.value?.uid ?? '')

  const boardIdValue = computed(() => resolveBoardId(boardId))
  const postsColRef = () => postsCol(db, cfg())

  const publicOnlyValue = computed(() => {
    if (options.publicOnly === undefined) {
      return !(isAdmin.value || isStaff.value)
    }
    return typeof options.publicOnly === 'boolean' ? options.publicOnly : options.publicOnly.value
  })

  const headPosts = ref<PostModel[]>([])
  const olderPosts = ref<PostModel[]>([])
  /** 본인의 미게시 초안 — 목록 쿼리(isPublished==true)엔 안 걸리므로 별도 구독해 얹는다. */
  const ownDraftPosts = ref<PostModel[]>([])
  const headPending = ref(true)
  const hasMore = ref(true)
  const loadingMore = ref(false)
  const loadError = ref('')
  let headTailCursor: QueryDocumentSnapshot<DocumentData> | null = null
  let olderCursor: QueryDocumentSnapshot<DocumentData> | null = null
  let stopHeadSubscription: Unsubscribe | undefined
  let stopOwnDraftSubscription: Unsubscribe | undefined

  function createdAtMs(post: PostModel): number {
    return post.createdAt?.toMillis?.() ?? 0
  }

  const posts = computed(() => {
    const byId = new Map<string, PostModel>()
    for (const post of [...olderPosts.value, ...headPosts.value, ...ownDraftPosts.value]) {
      if (post.id) byId.set(post.id, post)
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
    startHeadSubscription()
    startOwnDraftSubscription()
  }

  watch([boardIdValue, publicOnlyValue, uidValue], reset, { immediate: true })
  onScopeDispose(() => {
    stopHeadSubscription?.()
    stopOwnDraftSubscription?.()
  })

  return {
    posts,
    postsPending: headPending,
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
  const { data: body, pending: bodyPending } = useDocument<{ content: string }>(bodyRef)

  const post = computed<PostDetail | null>(() => {
    // boardId 는 이제 문서 필드라, URL의 boardId 세그먼트와 실제 글이 다른 보드에
    // 속하면(잘못된 URL 등) 상세를 보여주지 않는다.
    if (!meta.value || meta.value.boardId !== bid.value) return null
    return { ...meta.value, id: id.value, content: body.value?.content ?? '' } as PostDetail
  })
  const pending = computed(() => metaPending.value || bodyPending.value)

  return { post, pending }
}
