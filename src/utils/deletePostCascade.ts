import {
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
  type Firestore,
  type Query,
} from 'firebase/firestore'
import {
  deleteObject,
  listAll,
  ref as storageRef,
  type FirebaseStorage,
  type StorageReference,
} from 'firebase/storage'
import type { BoardPathConfig } from './boardPaths'
import {
  commentsCol,
  likesCol,
  postBodyDoc,
  postDoc,
  postStorageFolder,
  reportsCol,
} from './boardPaths'
import { extractEditorImageUrls } from './extractEditorImageUrls'
import { postNamespaceFromStoragePath, storagePathFromDownloadUrl } from './storagePath'
import type { PostModel } from '../types'

async function deleteStorageFolder(folderRef: StorageReference): Promise<void> {
  const list = await listAll(folderRef)
  await Promise.all([
    ...list.items.map(item => deleteObject(item)),
    ...list.prefixes.map(prefix => deleteStorageFolder(prefix)),
  ])
}

async function deleteStoragePaths(storage: FirebaseStorage, paths: Iterable<string>): Promise<void> {
  const unique = [...new Set([...paths].filter(Boolean))]
  await Promise.all(unique.map(path => deleteObject(storageRef(storage, path)).catch(() => {})))
}

const DELETE_BATCH_SIZE = 450

async function deleteQueryDocs(db: Firestore, docsQuery: Query): Promise<void> {
  const snapshot = await getDocs(docsQuery)
  for (let offset = 0; offset < snapshot.docs.length; offset += DELETE_BATCH_SIZE) {
    const batch = writeBatch(db)
    snapshot.docs.slice(offset, offset + DELETE_BATCH_SIZE).forEach(item => batch.delete(item.ref))
    await batch.commit()
  }
}

/** 글에 달린 본문·댓글 좋아요를 모두 지운다. 둘 다 postId 필드를 가진다. */
export async function deleteLikesForPost(
  db: Firestore,
  cfg: BoardPathConfig,
  postId: string,
): Promise<void> {
  await deleteQueryDocs(db, query(likesCol(db, cfg), where('postId', '==', postId)))
}

/** 글에 달린 신고를 모두 지운다. */
export async function deleteReportsForPost(
  db: Firestore,
  cfg: BoardPathConfig,
  postId: string,
): Promise<void> {
  await deleteQueryDocs(db, query(reportsCol(db, cfg), where('postId', '==', postId)))
}

/** 댓글 하나에 달린 좋아요만 지운다. */
export async function deleteLikesForComment(
  db: Firestore,
  cfg: BoardPathConfig,
  commentId: string,
): Promise<void> {
  await deleteQueryDocs(db, query(likesCol(db, cfg), where('commentId', '==', commentId)))
}

/** 글 하나의 댓글(답글 포함), 좋아요, 본문, 첨부 Storage, 메타를 순서대로 삭제한다. */
export async function deletePostCascade(
  db: Firestore,
  storage: FirebaseStorage,
  cfg: BoardPathConfig,
  id: string,
): Promise<void> {
  const metaRef = postDoc(db, cfg, id)
  const bodyRef = postBodyDoc(db, cfg, id)
  const [metaSnap, bodySnap] = await Promise.all([getDoc(metaRef), getDoc(bodyRef)])
  if (!metaSnap.exists()) return

  const meta = metaSnap.data() as PostModel
  const bodyContent = bodySnap.exists()
    ? String((bodySnap.data() as { content?: string }).content ?? '')
    : ''

  // 답글도 같은 flat 컬렉션에서 같은 postId를 가지므로 함께 삭제된다.
  await deleteQueryDocs(db, query(commentsCol(db, cfg), where('postId', '==', id)))
  await deleteLikesForPost(db, cfg, id)
  await deleteReportsForPost(db, cfg, id)

  const extraPaths = new Set<string>()
  const extraNamespaces = new Set<string>()
  for (const attachment of meta.attachments ?? []) {
    if (!attachment?.path) continue
    extraPaths.add(attachment.path)
    const namespace = postNamespaceFromStoragePath(attachment.path)
    if (namespace && namespace !== id) extraNamespaces.add(namespace)
  }
  for (const url of extractEditorImageUrls(bodyContent)) {
    const path = storagePathFromDownloadUrl(url)
    if (!path) continue
    extraPaths.add(path)
    const thumbGuess = path
      .replace(/\/images\/([^/]+)$/, '/images/thumbnails/$1')
      .replace(/\.[^.]+$/, '.jpg')
    if (thumbGuess !== path && thumbGuess.includes('/images/thumbnails/')) extraPaths.add(thumbGuess)
    const match = path.match(/^(.*\/images\/)([^/]+)\.[^.]+$/)
    if (match && !path.includes('/thumbnails/')) extraPaths.add(`${match[1]}thumbnails/${match[2]}.jpg`)
    const namespace = postNamespaceFromStoragePath(path)
    if (namespace && namespace !== id) extraNamespaces.add(namespace)
  }

  await deleteDoc(bodyRef)
  await deleteStorageFolder(storageRef(storage, postStorageFolder(cfg, id)))
  for (const namespace of extraNamespaces) {
    await deleteStorageFolder(storageRef(storage, postStorageFolder(cfg, namespace)))
  }
  await deleteStoragePaths(storage, extraPaths)
  await deleteDoc(metaRef)
}
