import { computed, onScopeDispose, ref, watch } from 'vue'
import type { Ref } from 'vue'
import {
  collection,
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
import { useMemiBoardConfig } from '../config'
import { buildPostPreview } from '../utils/postPreview'
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

/** 목록 조회는 posts/{id} 메타만 읽고, 본문(body/main)은 상세 조회 시에만 읽는다. */
export function useMemiBoardPosts() {
  const config = useMemiBoardConfig()
  const db = useFirestore()
  const app = useFirebaseApp()
  // prefix 는 setup 시점에 고정하지 않는다 (configure 이전 호출·이중 인스턴스 대비)
  const prefix = () => config.collectionPrefix

  const postsCol = () => collection(db, `${prefix()}Posts`)
  const postDoc = (id: string) => doc(db, `${prefix()}Posts`, id)
  const bodyDoc = (id: string) => doc(db, `${prefix()}Posts`, id, 'body', 'main')
  const commentsCol = (id: string) => collection(db, `${prefix()}Posts`, id, 'comments')

  /** 문서를 쓰지 않고 Firestore 자동 ID만 미리 만든다. */
  function createPostId(): string {
    return doc(postsCol()).id
  }

  async function getPosts(opts: {
    pageSize?: number
    cursor?: QueryDocumentSnapshot<DocumentData>
    /** 지정 시 해당 카테고리 글만 (boardSettings 의 category id) */
    category?: string
  } = {}) {
    const pageSize = opts.pageSize ?? 20
    const constraints: QueryConstraint[] = []
    if (opts.category) {
      // 복합 인덱스: category ASC + createdAt DESC (호스트 firestore.indexes.json)
      constraints.push(where('category', '==', opts.category))
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

  /** 공개 URL의 category + slug로 내부 Firestore 문서를 찾는다. */
  async function getPostBySlug(category: string, slug: string): Promise<PostDetail | null> {
    const snapshot = await getDocs(query(
      postsCol(),
      where('category', '==', category),
      where('slug', '==', slug),
      fbLimit(1),
    ))
    const meta = snapshot.docs[0]
    return meta ? getPost(meta.id) : null
  }

  /** 현재 카테고리의 최신순 목록을 기준으로 인접한 이전(오래된)·다음(최신) 글을 조회한다. */
  async function getAdjacentPosts(current: PostModel): Promise<{
    previous: PostModel | null
    next: PostModel | null
  }> {
    if (!current.category || !current.createdAt) return { previous: null, next: null }
    const base: QueryConstraint[] = [
      where('category', '==', current.category),
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

  async function createPost(input: CreatePostInput): Promise<string> {
    const baseSlug = slugify(input.title) || 'post'
    let slug = baseSlug
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
    const id = input.postId || createPostId()

    const preview = buildPostPreview(input.content, input.attachments)
    await setDoc(postDoc(id), {
      slug,
      title: input.title,
      ...preview,
      tags: input.tags ?? [],
      ...(input.category ? { category: input.category } : {}),
      attachments: input.attachments ?? [],
      commentCount: 0,
      likeCount: 0,
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
    // 메타·본문을 같이 갱신. category 미선택 시 필드 제거(부분 갱신으로 예전 값이 남는 것 방지).
    const preview = buildPostPreview(input.content, input.attachments)
    await Promise.all([
      updateDoc(postDoc(id), {
        title: input.title,
        ...preview,
        previewImage: preview.previewImage ? preview.previewImage : deleteField(),
        videoUrl: preview.videoUrl ? preview.videoUrl : deleteField(),
        tags: input.tags ?? [],
        category: input.category ? input.category : deleteField(),
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
    await deleteStorageFolder(storageRef(storage, `${prefix()}/posts/${id}`))

    // ── 임시 네임스페이스 폴더 (작성 중 new-ts 에 올린 파일) ──
    for (const ns of extraNamespaces) {
      await deleteStorageFolder(storageRef(storage, `${prefix()}/posts/${ns}`))
    }

    // ── 폴더 삭제에 안 잡힌 개별 path (다른 prefix 등) ──
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
  options: { pageSize?: number } = {},
) {
  const config = useMemiBoardConfig()
  const db = useFirestore()
  const prefix = () => config.collectionPrefix
  const postsCol = () => collection(db, `${prefix()}Posts`)
  const pageSize = options.pageSize ?? POST_PAGE_SIZE

  const categoryValue = computed(() => (
    typeof category === 'string' || category === undefined ? category : category.value
  ))

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
    const value = categoryValue.value
    return value ? [where('category', '==', value)] : []
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

  watch(categoryValue, reset, { immediate: true })

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
  const config = useMemiBoardConfig()
  const db = useFirestore()
  const prefix = () => config.collectionPrefix

  const id = computed(() => (typeof postId === 'string' ? postId : postId.value))
  const postRef = computed(() => doc(db, `${prefix()}Posts`, id.value))
  const bodyRef = computed(() => doc(db, `${prefix()}Posts`, id.value, 'body', 'main'))

  const { data: meta, pending: metaPending } = useDocument<PostModel>(postRef)
  const { data: body, pending: bodyPending } = useDocument<{ content: string }>(bodyRef)

  const post = computed<PostDetail | null>(() => {
    if (!meta.value) return null
    return { ...meta.value, id: id.value, content: body.value?.content ?? '' } as PostDetail
  })
  const pending = computed(() => metaPending.value || bodyPending.value)

  return { post, pending }
}
