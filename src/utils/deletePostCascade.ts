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
} from './boardPaths'
import { commentImagePathsUnder } from './commentImages'
import { extractEditorImageUrls } from './extractEditorImageUrls'
import { postNamespaceFromStoragePath, storagePathFromDownloadUrl } from './storagePath'
import type { PostModel } from '../types'

async function deleteStorageFolder(folderRef: StorageReference): Promise<void> {
  try {
    const list = await listAll(folderRef)
    await Promise.all([
      ...list.items.map(item => deleteObject(item).catch(() => {})),
      ...list.prefixes.map(prefix => deleteStorageFolder(prefix)),
    ])
  }
  catch {
    // 이 경로에 list 규칙이 없으면 건너뛴다. 호출 쪽에서 하위 폴더를 따로 비운다.
  }
}

/**
 * 규칙이 매칭하는 images/·attachments/·comment-images/ 만 비운다.
 * 부모 폴더 listAll 은 호스트 규칙에서 403 이 난다.
 * comment-images 는 저장만 되고 댓글 문서가 되지 않은 파일도 포함한다.
 */
async function deletePostStorageTree(storage: FirebaseStorage, folder: string): Promise<void> {
  await deleteStorageFolder(storageRef(storage, `${folder}/images`))
  await deleteStorageFolder(storageRef(storage, `${folder}/attachments`))
  await deleteStorageFolder(storageRef(storage, `${folder}/comment-images`))
}

const DELETE_BATCH_SIZE = 450

/** 댓글 문서를 지우기 전에, 그 글 폴더 안 댓글 이미지 경로를 모은다. */
async function commentImagePathsForPost(
  db: Firestore,
  cfg: BoardPathConfig,
  postId: string,
): Promise<string[]> {
  const snapshot = await getDocs(query(commentsCol(db, cfg), where('postId', '==', postId)))
  return snapshot.docs.flatMap(item => commentImagePathsUnder(
    item.data().images,
    `${postStorageFolder(cfg, postId)}/comment-images/`,
  ))
}

async function deleteStoragePaths(storage: FirebaseStorage, paths: Iterable<string>): Promise<void> {
  const unique = [...new Set([...paths].filter(Boolean))]
  await Promise.all(unique.map(path => deleteObject(storageRef(storage, path)).catch(() => {})))
}

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

/** 댓글 하나에 달린 좋아요만 지운다. */
export async function deleteLikesForComment(
  db: Firestore,
  cfg: BoardPathConfig,
  commentId: string,
): Promise<void> {
  await deleteQueryDocs(db, query(likesCol(db, cfg), where('commentId', '==', commentId), where('target', '==', 'comment')))
}

/**
 * 글 하나의 Storage(본문 이미지, 첨부, 댓글 이미지)를 글 문서가 남아 있는 동안 지운 뒤
 * 댓글·좋아요·본문·메타를 삭제한다. 게시판 삭제도 글마다 이 함수를 호출한다.
 */
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

  // 답글도 같은 postId를 가진다. 경로는 문서를 지우기 전에 모은다.
  // Storage 삭제가 중간에 끊겨도 다시 시도할 때 댓글 문서에서 경로를 다시 읽는다.
  const commentImagePaths = await commentImagePathsForPost(db, cfg, id)
  // Reports are moderation/audit records. Keep them after the post is deleted.

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

  // 글 문서가 남아 있는 동안 지운다. 문서가 없으면 댓글 작성자가 아닌 파일은
  // ownerUid 규칙만 남아 글 작성자의 삭제가 실패한다.
  await deletePostStorageTree(storage, postStorageFolder(cfg, id))
  for (const namespace of extraNamespaces) {
    await deletePostStorageTree(storage, postStorageFolder(cfg, namespace))
  }
  // 폴더 목록이 거절돼도 댓글 문서에 남아 있던 경로는 파일 단위로 지운다.
  await deleteStoragePaths(storage, commentImagePaths)
  await deleteStoragePaths(storage, extraPaths)

  await deleteQueryDocs(db, query(commentsCol(db, cfg), where('postId', '==', id)))
  await deleteLikesForPost(db, cfg, id)
  await deleteDoc(bodyRef)
  await deleteDoc(metaRef)
}
