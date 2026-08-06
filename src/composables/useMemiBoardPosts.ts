import { computed, onScopeDispose, ref, watch } from 'vue'
import type { Ref } from 'vue'
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
  boardPostBodyDoc,
  boardPostCommentsCol,
  boardPostDoc,
  boardPostStorageFolder,
  boardPostsCol,
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
  /** 작성 화면 진입 시 미리 만든 Firestore 자동 ID. Storage namespace와 동일하게 사용한다. */
  postId?: string
  title: string
  content: string
  tags?: string[]
  category?: string
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
  category?: string
  attachments?: Attachment[]
}

/** getPostBySlug 결과 — not-found 와 permission-denied 를 UI 에서 구분한다. */
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

/** 목록 조회는 posts/{id} 메타만 읽고, 본문(body/main)은 상세 조회 시에만 읽는다. */
export function useMemiBoardPosts() {
  const db = useFirestore()
  const app = useFirebaseApp()
  const { isCategoryHidden, categories } = useMemiBoardSettings()
  // boardId 는 setup 시점에 고정하지 않는다 (configure 이전 호출·이중 인스턴스 대비)
  const cfg = () => useBoardPathConfig()

  const postsCol = () => boardPostsCol(db, cfg())
  const postDoc = (id: string) => boardPostDoc(db, cfg(), id)
  const bodyDoc = (id: string) => boardPostBodyDoc(db, cfg(), id)
  const commentsCol = (id: string) => boardPostCommentsCol(db, cfg(), id)

  function listedForCategory(categoryId: string | undefined): boolean {
    return !isCategoryHidden(categoryId)
  }

  /** 카테고리 listView === 'image' — 인스타형(제목 없음, 이미지+본문 필수) */
  function isImageListCategory(categoryId: string | undefined): boolean {
    if (!categoryId) return false
    return categories.value.find(c => c.id === categoryId)?.listView === 'image'
  }

  function assertPostContent(
    input: { title?: string, content: string, attachments?: Attachment[], category?: string },
  ) {
    const imageBoard = isImageListCategory(input.category)
    if (!hasBodyText(input.content)) {
      throw new Error(
        imageBoard
          ? '내용을 입력해 주세요.'
          : '본문에 글자를 입력해 주세요. 이미지나 첨부만으로는 게시할 수 없습니다.',
      )
    }
    if (imageBoard) {
      // 저장 시 드롭존 이미지가 본문 앞에 합쳐진 뒤 검사
      if (!hasBodyImage(input.content, input.attachments)) {
        throw new Error('사진을 올려 주세요.')
      }
      return
    }
    if (!input.title?.trim()) {
      throw new Error('제목을 입력해 주세요.')
    }
  }

  /** 문서를 쓰지 않고 Firestore 자동 ID만 미리 만든다. */
  function createPostId(): string {
    return doc(postsCol()).id
  }

  async function getPosts(opts: {
    pageSize?: number
    cursor?: QueryDocumentSnapshot<DocumentData>
    /** 지정 시 해당 카테고리 글만 (settings categories id) */
    category?: string
    /** true 면 listed==true 만 (비권한 목록). staff 전체 보기는 false */
    publicOnly?: boolean
  } = {}) {
    const pageSize = opts.pageSize ?? 20
    const constraints: QueryConstraint[] = []
    if (opts.category) {
      // 복합 인덱스: category ASC + createdAt DESC (호스트 firestore.indexes.json)
      constraints.push(where('category', '==', opts.category))
    }
    if (opts.publicOnly !== false) {
      constraints.push(where('listed', '==', true))
    }
    constraints.push(orderBy('createdAt', 'desc'))
    if (opts.cursor) constraints.push(startAfter(opts.cursor))
    constraints.push(fbLimit(pageSize + 1))

    const snapshot = await getDocs(query(postsCol(), ...constraints))
    const docs = snapshot.docs.slice(0, pageSize)
    return {
      posts: docs.map(d => ({ id: d.id, ...d.data() }) as PostModel),
      cursor: docs[docs.length - 1] as QueryDocumentSnapshot<DocumentData> | undefined,
      hasMore: snapshot.docs.length > pageSize,
    }
  }

  async function getPost(id: string): Promise<PostDetail | null> {
    const [metaSnap, bodySnap] = await Promise.all([getDoc(postDoc(id)), getDoc(bodyDoc(id))])
    if (!metaSnap.exists()) return null
    return {
      id: metaSnap.id,
      ...metaSnap.data(),
      content: bodySnap.exists() ? ((bodySnap.data() as { content: string }).content ?? '') : '',
    } as PostDetail
  }

  /** 공개 URL의 category + slug로 내부 Firestore 문서를 찾는다. 권한 없음/없음 구분. */
  async function getPostBySlug(category: string, slug: string): Promise<GetPostBySlugResult> {
    try {
      const snapshot = await getDocs(query(
        postsCol(),
        where('category', '==', category),
        where('slug', '==', slug),
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

  /** 현재 카테고리의 최신순 목록을 기준으로 인접한 이전(오래된)·다음(최신) 글을 조회한다. */
  async function getAdjacentPosts(current: PostModel): Promise<{
    previous: PostModel | null
    next: PostModel | null
  }> {
    if (!current.category || !current.createdAt) return { previous: null, next: null }
    try {
      const base: QueryConstraint[] = [
        where('category', '==', current.category),
        // 공개 글 사이만 이동 (숨김 글은 staff 전용 목록에서만 인접 탐색)
        ...((current.listed !== false) ? [where('listed', '==', true)] : []),
        orderBy('createdAt', 'desc'),
      ]
      const [previousSnapshot, nextSnapshot] = await Promise.all([
        getDocs(query(postsCol(), ...base, startAfter(current.createdAt), fbLimit(1))),
        getDocs(query(postsCol(), ...base, endBefore(current.createdAt), limitToLast(1))),
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
      // 숨김 글·권한 부족 시 인접 탐색 실패는 상세를 막지 않는다
      if (import.meta.dev) console.warn('[memi-board] getAdjacentPosts failed', cause)
      return { previous: null, next: null }
    }
  }

  async function createPost(input: CreatePostInput): Promise<string> {
    assertPostContent(input)
    const id = input.postId || createPostId()
    const imageBoard = isImageListCategory(input.category)
    // 이미지 보드: title = 본문 앞부분(summary 와 유사), URL slug = 문서 ID
    // 일반: 사용자 제목 + 제목 기반 slug
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
        postsCol(),
        where('category', '==', input.category || ''),
        where('slug', '==', slug),
        fbLimit(1),
      ))).empty) {
        counter++
        slug = `${baseSlug}-${counter}`
      }
    }

    const preview = buildPostPreview(input.content, input.attachments)
    const listed = listedForCategory(input.category)
    await setDoc(postDoc(id), {
      slug,
      title,
      ...preview,
      tags: input.tags ?? [],
      ...(input.category ? { category: input.category } : {}),
      attachments: input.attachments ?? [],
      commentCount: 0,
      likeCount: 0,
      viewCount: 0,
      listed,
      authorUid: input.authorUid,
      authorName: input.authorName,
      authorPhoto: input.authorPhoto,
      moderationStatus: 'approved',
      moderationModel: input.moderationModel ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    // body 규칙이 부모 post 소유자를 조회하므로 부모 문서 생성 후 저장한다.
    await setDoc(bodyDoc(id), { content: input.content })

    return slug
  }

  async function updatePost(id: string, input: UpdatePostInput): Promise<void> {
    assertPostContent(input)
    const imageBoard = isImageListCategory(input.category)
    const title = imageBoard ? titleFromBody(input.content) : input.title.trim()
    // 메타·본문을 같이 갱신. category 미선택 시 필드 제거(부분 갱신으로 예전 값이 남는 것 방지).
    const preview = buildPostPreview(input.content, input.attachments)
    const listed = listedForCategory(input.category)
    await Promise.all([
      updateDoc(postDoc(id), {
        title,
        ...preview,
        previewImage: preview.previewImage ? preview.previewImage : deleteField(),
        videoUrl: preview.videoUrl ? preview.videoUrl : deleteField(),
        tags: input.tags ?? [],
        category: input.category ? input.category : deleteField(),
        listed,
        attachments: input.attachments ?? [],
        updatedAt: serverTimestamp(),
      }),
      setDoc(bodyDoc(id), { content: input.content }, { merge: true }),
    ])
  }

  /**
   * 글 삭제 순서 (규칙: Storage 삭제는 부모 post 문서가 있을 때 소유권 검사 가능)
   * 1) 메타·본문 읽어 첨부 path / 본문 이미지 URL 수집
   * 2) 댓글 전부
   * 3) 본문 body
   * 4) Storage: posts/{id}/** (images + attachments)
   * 5) Storage: 게시글 자동 ID namespace의 첨부·본문 이미지 경로
   * 6) 메타 post 문서
   */
  async function deletePost(id: string): Promise<void> {
    const [metaSnap, bodySnap] = await Promise.all([
      getDoc(postDoc(id)),
      getDoc(bodyDoc(id)),
    ])
    if (!metaSnap.exists()) return

    const meta = metaSnap.data() as PostModel
    const bodyContent = bodySnap.exists()
      ? String((bodySnap.data() as { content?: string }).content ?? '')
      : ''

    // ── 댓글 ──────────────────────────────────────────
    const commentsSnap = await getDocs(commentsCol(id))
    for (let offset = 0; offset < commentsSnap.docs.length; offset += 450) {
      const batch = writeBatch(db)
      commentsSnap.docs.slice(offset, offset + 450).forEach(d => batch.delete(d.ref))
      await batch.commit()
    }

    // ── Storage 정리용 path 수집 (post 문서 삭제 전) ──
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
      // 썸네일 쌍 (images/foo.png → images/thumbnails/foo.jpg 추정)
      const thumbGuess = path
        .replace(/\/images\/([^/]+)$/, '/images/thumbnails/$1')
        .replace(/\.[^.]+$/, '.jpg')
      if (thumbGuess !== path && thumbGuess.includes('/images/thumbnails/')) {
        extraPaths.add(thumbGuess)
      }
      // 원본이 thumbnails 가 아니고 basename 이 다른 확장자인 경우 동일 basename .jpg
      const m = path.match(/^(.*\/images\/)([^/]+)\.[^.]+$/)
      if (m && !path.includes('/thumbnails/')) {
        extraPaths.add(`${m[1]}thumbnails/${m[2]}.jpg`)
      }
      const ns = postNamespaceFromStoragePath(path)
      if (ns && ns !== id) extraNamespaces.add(ns)
    }

    // ── 본문 (규칙: body write 는 부모 post 소유권) ──
    await deleteDoc(bodyDoc(id))

    // ── Storage: 최종 id 폴더 전체 (images/**, attachments/**) ──
    await deleteStorageFolder(storageRef(storage, boardPostStorageFolder(cfg(), id)))

    // ── 임시 네임스페이스 폴더 (작성 중 new-ts 에 올린 파일) ──
    for (const ns of extraNamespaces) {
      await deleteStorageFolder(storageRef(storage, boardPostStorageFolder(cfg(), ns)))
    }

    // ── 폴더 삭제에 안 잡힌 개별 path ──
    await deleteStoragePaths(storage, extraPaths)

    // ── 메타 마지막 ──
    await deleteDoc(postDoc(id))
  }

  return {
    createPostId,
    getPosts,
    getPost,
    getPostBySlug,
    getAdjacentPosts,
    createPost,
    updatePost,
    deletePost,
  }
}

const POST_PAGE_SIZE = 10

/**
 * 최신 {pageSize}건은 onSnapshot으로 실시간 구독해 목록에 보이는 동안 좋아요·댓글 수가
 * 바로 갱신되게 하고, 그 이전 글은 "더보기" 클릭 시 1회성 getDocs로 이어서 불러온다.
 * 두 구간이 살짝 겹쳐도 id 기준으로 합쳐 중복 없이 렌더한다.
 *
 * 알려진 한계: "더보기"로 이전 글을 불러온 뒤 새 글이 pageSize개 이상 연달아 올라오면
 * 실시간 구간과 페이지 구간 사이에 짧은 공백이 생길 수 있다 — 새로고침하면 바로 채워지고,
 * 이 정도 트래픽 폭이면 실사용에서 발생 가능성이 낮아 별도 보정 로직은 두지 않았다.
 */
export function useMemiBoardPostList(
  category?: string | Ref<string | undefined>,
  options: { pageSize?: number, /** staff 등 숨김 글 포함 시 false. 기본 true */ publicOnly?: boolean | Ref<boolean> } = {},
) {
  const db = useFirestore()
  const { isAdmin, isStaff } = useMemiBoardAuth()
  const cfg = () => useBoardPathConfig()
  const postsCol = () => boardPostsCol(db, cfg())
  const pageSize = options.pageSize ?? POST_PAGE_SIZE

  const categoryValue = computed(() => (
    typeof category === 'string' || category === undefined ? category : category.value
  ))
  const publicOnlyValue = computed(() => {
    if (options.publicOnly === undefined) {
      // 기본: board admin/staff 만 숨김 포함 목록
      return !(isAdmin.value || isStaff.value)
    }
    return typeof options.publicOnly === 'boolean' ? options.publicOnly : options.publicOnly.value
  })

  const headPosts = ref<PostModel[]>([])
  const olderPosts = ref<PostModel[]>([])
  const headPending = ref(true)
  const hasMore = ref(true)
  const loadingMore = ref(false)
  const loadError = ref('')
  let headTailCursor: QueryDocumentSnapshot<DocumentData> | null = null
  let olderCursor: QueryDocumentSnapshot<DocumentData> | null = null
  let stopHeadSubscription: Unsubscribe | undefined

  function createdAtMs(post: PostModel): number {
    return post.createdAt?.toMillis?.() ?? 0
  }

  const posts = computed(() => {
    const byId = new Map<string, PostModel>()
    for (const post of [...olderPosts.value, ...headPosts.value]) {
      if (post.id) byId.set(post.id, post)
    }
    return [...byId.values()].sort((a, b) =>
      createdAtMs(b) - createdAtMs(a) || String(b.id).localeCompare(String(a.id)),
    )
  })

  function baseConstraints(): QueryConstraint[] {
    const constraints: QueryConstraint[] = []
    const value = categoryValue.value
    if (value) constraints.push(where('category', '==', value))
    // rules 와 동일한 공개 집합 — 쿼리에 listed 제약이 있어야 목록이 통과한다
    if (publicOnlyValue.value) constraints.push(where('listed', '==', true))
    return constraints
  }

  function startHeadSubscription() {
    stopHeadSubscription?.()
    stopHeadSubscription = onSnapshot(query(
      postsCol(),
      ...baseConstraints(),
      orderBy('createdAt', 'desc'),
      orderBy(documentId(), 'desc'),
      fbLimit(pageSize),
    ), (snapshot) => {
      headPosts.value = snapshot.docs.map(item => ({ id: item.id, ...item.data() }) as PostModel)
      headTailCursor = snapshot.docs.at(-1) ?? null
      // "더보기"를 이미 눌러 이전 페이지 커서가 잡힌 뒤에는, 새 글·좋아요 변경으로
      // 다시 흐르는 head 구독이 hasMore를 되돌리지 않도록 이전 페이지 조회 결과만 따른다.
      if (!olderCursor) hasMore.value = snapshot.docs.length >= pageSize
      headPending.value = false
    }, (cause) => {
      console.error('[memi-board:postList] onSnapshot failed', cause)
      headPending.value = false
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
      const snapshot = await getDocs(query(postsCol(), ...constraints))
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
  }

  watch([categoryValue, publicOnlyValue], reset, { immediate: true })

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

/**
 * 게시글 상세를 VueFire useDocument로 실시간 구독한다 (메타 + 본문).
 * 좋아요·댓글 수 등 다른 사람의 변경이 화면에 바로 반영된다 — 좋아요 토글도
 * 별도 로컬 낙관적 갱신 없이 이 구독이 그대로 반영해 준다.
 */
export function useMemiBoardPost(postId: string | Ref<string>) {
  const db = useFirestore()
  const cfg = () => useBoardPathConfig()

  const id = computed(() => (typeof postId === 'string' ? postId : postId.value))
  const postRef = computed(() => boardPostDoc(db, cfg(), id.value))
  const bodyRef = computed(() => boardPostBodyDoc(db, cfg(), id.value))

  const { data: meta, pending: metaPending } = useDocument<PostModel>(postRef)
  const { data: body, pending: bodyPending } = useDocument<{ content: string }>(bodyRef)

  const post = computed<PostDetail | null>(() => {
    if (!meta.value) return null
    return { ...meta.value, id: id.value, content: body.value?.content ?? '' } as PostDetail
  })
  const pending = computed(() => metaPending.value || bodyPending.value)

  return { post, pending }
}
