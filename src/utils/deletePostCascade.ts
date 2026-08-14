import {
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
  type Firestore,
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
  postBodyDoc,
  postDoc,
  postStorageFolder,
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

/** 글 하나의 댓글(답글 포함), 본문, 첨부 Storage, 메타를 순서대로 삭제한다. */
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
  const commentsSnap = await getDocs(query(commentsCol(db, cfg), where('postId', '==', id)))
  for (let offset = 0; offset < commentsSnap.docs.length; offset += 450) {
    const batch = writeBatch(db)
    commentsSnap.docs.slice(offset, offset + 450).forEach(item => batch.delete(item.ref))
    await batch.commit()
  }

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
