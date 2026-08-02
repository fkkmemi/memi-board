import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit as fbLimit,
  startAfter,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore'
import { getStorage, ref as storageRef, listAll, deleteObject } from 'firebase/storage'
import type { StorageReference } from 'firebase/storage'
import { useFirebaseApp, useFirestore } from 'vuefire'
import { useMemiBoardConfig } from '../../config'
import { slugify } from '../utils/slugify'
import type { Attachment, PostDetail, PostModel } from '../types'

async function deleteStorageFolder(folderRef: StorageReference): Promise<void> {
  const list = await listAll(folderRef)
  await Promise.all([
    ...list.items.map(item => deleteObject(item)),
    ...list.prefixes.map(prefix => deleteStorageFolder(prefix)),
  ])
}

export interface CreatePostInput {
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

/** 목록 조회는 posts/{id} 메타만 읽고, 본문(body/main)은 상세 조회 시에만 읽는다. */
export function useMemiBoardPosts() {
  const config = useMemiBoardConfig()
  const db = useFirestore()
  const app = useFirebaseApp()
  const prefix = config.collectionPrefix

  const postsCol = () => collection(db, `${prefix}Posts`)
  const postDoc = (id: string) => doc(db, `${prefix}Posts`, id)
  const bodyDoc = (id: string) => doc(db, `${prefix}Posts`, id, 'body', 'main')
  const commentsCol = (id: string) => collection(db, `${prefix}Posts`, id, 'comments')

  async function getPosts(opts: { pageSize?: number, cursor?: QueryDocumentSnapshot<DocumentData> } = {}) {
    const pageSize = opts.pageSize ?? 20
    const constraints = opts.cursor
      ? [orderBy('createdAt', 'desc'), startAfter(opts.cursor), fbLimit(pageSize + 1)]
      : [orderBy('createdAt', 'desc'), fbLimit(pageSize + 1)]
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
    await Promise.all([
      updateDoc(postDoc(id), {
        title: input.title,
        tags: input.tags ?? [],
        attachments: input.attachments ?? [],
        updatedAt: serverTimestamp(),
      }),
      setDoc(bodyDoc(id), { content: input.content }),
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
    await deleteStorageFolder(storageRef(storage, `${prefix}/posts/${id}`))
    await deleteDoc(postDoc(id))
  }

  return { getPosts, getPost, createPost, updatePost, deletePost }
}
