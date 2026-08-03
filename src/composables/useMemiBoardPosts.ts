import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as fbLimit,
  startAfter,
  serverTimestamp,
  writeBatch,
  deleteField,
} from 'firebase/firestore'
import type { QueryConstraint } from 'firebase/firestore'
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore'
import { getStorage, ref as storageRef, listAll, deleteObject } from 'firebase/storage'
import type { StorageReference } from 'firebase/storage'
import { useFirebaseApp, useFirestore } from 'vuefire'
import { slugify } from '../utils/slugify'
import { useMemiBoardConfig } from '../config'
import type { Attachment, PostDetail, PostModel } from '../types'

async function deleteStorageFolder(folderRef: StorageReference): Promise<void> {
  const list = await listAll(folderRef).catch(() => ({ items: [], prefixes: [] }))
  await Promise.all([
    ...list.items.map(item => deleteObject(item)),
    ...list.prefixes.map(prefix => deleteStorageFolder(prefix)),
  ])
}

export interface CreatePostInput {
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

  async function createPost(input: CreatePostInput): Promise<string> {
    const baseSlug = slugify(input.title) || 'post'
    let slug = baseSlug
    let counter = 1
    while ((await getDoc(postDoc(slug))).exists()) {
      counter++
      slug = `${baseSlug}-${counter}`
    }

    await Promise.all([
      setDoc(postDoc(slug), {
        title: input.title,
        tags: input.tags ?? [],
        ...(input.category ? { category: input.category } : {}),
        attachments: input.attachments ?? [],
        commentCount: 0,
        authorUid: input.authorUid,
        authorName: input.authorName,
        authorPhoto: input.authorPhoto,
        moderationStatus: 'approved',
        moderationModel: input.moderationModel ?? null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
      setDoc(bodyDoc(slug), { content: input.content }),
    ])

    return slug
  }

  async function updatePost(id: string, input: UpdatePostInput): Promise<void> {
    // 메타·본문을 같이 갱신. category 미선택 시 필드 제거(부분 갱신으로 예전 값이 남는 것 방지).
    await Promise.all([
      updateDoc(postDoc(id), {
        title: input.title,
        tags: input.tags ?? [],
        category: input.category ? input.category : deleteField(),
        attachments: input.attachments ?? [],
        updatedAt: serverTimestamp(),
      }),
      setDoc(bodyDoc(id), { content: input.content }, { merge: true }),
    ])
  }

  /** 댓글 서브컬렉션 → 본문 → Storage 폴더 → 메타 순으로 삭제한다. */
  async function deletePost(id: string): Promise<void> {
    const commentsSnap = await getDocs(commentsCol(id))
    // Firestore write batch는 최대 500건. 여유를 두고 450건씩 나눠 삭제한다.
    for (let offset = 0; offset < commentsSnap.docs.length; offset += 450) {
      const batch = writeBatch(db)
      commentsSnap.docs.slice(offset, offset + 450).forEach(d => batch.delete(d.ref))
      await batch.commit()
    }

    const storage = getStorage(app)
    // Firestore/Storage 규칙이 부모 게시글의 소유권을 조회하므로 부모 문서는 마지막에 삭제한다.
    await deleteDoc(bodyDoc(id))
    await deleteStorageFolder(storageRef(storage, `${prefix()}/posts/${id}`))
    await deleteDoc(postDoc(id))
  }

  return { getPosts, getPost, createPost, updatePost, deletePost }
}
