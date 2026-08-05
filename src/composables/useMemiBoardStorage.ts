import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage'
import type { UploadTask } from 'firebase/storage'
import { useFirebaseApp } from 'vuefire'
import { safeFileName } from '../utils/slugify'
import { compressImage } from '../utils/compressImage'
import { useMemiBoardConfig } from '../config'
import type { Attachment, EditorImageEntry } from '../types'

/** 에디터 이미지 최대 크기 (바이트) */
export const EDITOR_IMAGE_MAX_BYTES = 5 * 1024 * 1024
/** 휴대폰 원본 이미지 선택 허용 크기. 큰 이미지는 업로드 전에 최적화한다. */
export const EDITOR_IMAGE_SOURCE_MAX_BYTES = 25 * 1024 * 1024

async function optimizeEditorImage(file: File): Promise<{ blob: File | Blob, compressed: boolean }> {
  if (file.size > EDITOR_IMAGE_SOURCE_MAX_BYTES) {
    throw new Error(`원본 이미지는 ${EDITOR_IMAGE_SOURCE_MAX_BYTES / 1024 / 1024}MB 이하여야 합니다.`)
  }
  if (file.size <= EDITOR_IMAGE_MAX_BYTES) return { blob: file, compressed: false }

  try {
    let blob = await compressImage(file, { maxWidth: 2560, quality: 0.85 })
    if (blob.size > EDITOR_IMAGE_MAX_BYTES) {
      blob = await compressImage(file, { maxWidth: 2048, quality: 0.75 })
    }
    if (blob.size > EDITOR_IMAGE_MAX_BYTES) {
      throw new Error('압축 후에도 이미지가 5MB를 초과합니다. 더 작은 이미지를 선택해 주세요.')
    }
    return { blob, compressed: true }
  }
  catch (cause) {
    if (cause instanceof Error && cause.message.includes('압축 후에도')) throw cause
    throw new Error('이 이미지 형식은 브라우저에서 최적화할 수 없습니다. JPG, PNG 또는 WebP로 변환해 주세요.')
  }
}

export function useMemiBoardStorage() {
  const config = useMemiBoardConfig()
  const app = useFirebaseApp()
  const prefix = () => config.collectionPrefix

  /** postId는 작성 화면 진입 시 미리 생성한 Firestore 자동 ID를 사용한다. */
  function uploadAttachment(
    file: File,
    postId: string,
    onProgress?: (ratio: number) => void,
  ): { promise: Promise<Attachment>, cancel: () => void } {
    const storage = getStorage(app)
    const path = `${prefix()}/posts/${postId}/attachments/${Date.now()}-${safeFileName(file.name)}`
    const fileRef = storageRef(storage, path)
    const task: UploadTask = uploadBytesResumable(fileRef, file, {
      contentType: file.type || 'application/octet-stream',
      contentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    })

    const promise = new Promise<Attachment>((resolve, reject) => {
      task.on(
        'state_changed',
        (snapshot) => {
          if (onProgress && snapshot.totalBytes > 0) {
            onProgress(snapshot.bytesTransferred / snapshot.totalBytes)
          }
        },
        reject,
        async () => {
          const url = await getDownloadURL(fileRef)
          resolve({ name: file.name, url, path, size: file.size, type: file.type })
        },
      )
    })

    return { promise, cancel: () => task.cancel() }
  }

  async function deleteAttachment(attachment: Pick<Attachment, 'path'>): Promise<void> {
    const storage = getStorage(app)
    await deleteObject(storageRef(storage, attachment.path)).catch(() => {})
  }

  /**
   * 에디터 본문 이미지: 원본 + 400px JPEG 썸네일 (shineb 동일).
   * Storage:
   *   `{prefix}/posts/{postId}/images/{ts}-{name}.ext`
   *   `{prefix}/posts/{postId}/images/thumbnails/{ts}-{name}.jpg`
   */
  async function uploadEditorImage(file: File, postId: string): Promise<EditorImageEntry> {
    if (!file.type.startsWith('image/')) {
      throw new Error('이미지 파일만 업로드할 수 있습니다.')
    }
    const optimized = await optimizeEditorImage(file)

    const storage = getStorage(app)
    const ext = (optimized.compressed ? 'jpg' : (file.name.split('.').pop() || file.type.split('/')[1] || 'png'))
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 8) || 'png'
    const safeName = safeFileName(file.name.replace(/\.[^.]+$/, '') || 'image', 40)
    const baseName = `${Date.now()}-${safeName || 'image'}`
    const ns = postId || `new-${Date.now()}`

    const originalPath = `${prefix()}/posts/${ns}/images/${baseName}.${ext}`
    const originalRef = storageRef(storage, originalPath)
    await uploadBytes(originalRef, optimized.blob, {
      contentType: optimized.blob.type || 'image/jpeg',
    })
    const originalUrl = await getDownloadURL(originalRef)

    const thumbBlob = await compressImage(optimized.blob, { maxWidth: 400, quality: 0.8 })
    const thumbnailPath = `${prefix()}/posts/${ns}/images/thumbnails/${baseName}.jpg`
    const thumbRef = storageRef(storage, thumbnailPath)
    await uploadBytes(thumbRef, thumbBlob, { contentType: 'image/jpeg' })
    const thumbnailUrl = await getDownloadURL(thumbRef)

    return { originalUrl, originalPath, thumbnailUrl, thumbnailPath }
  }

  /** 원본·썸네일 쌍 삭제 (고아 정리·첨부 삭제용) */
  async function deleteEditorImage(entry: Pick<EditorImageEntry, 'originalPath' | 'thumbnailPath'>): Promise<void> {
    const storage = getStorage(app)
    await Promise.all([
      deleteObject(storageRef(storage, entry.originalPath)).catch(() => {}),
      deleteObject(storageRef(storage, entry.thumbnailPath)).catch(() => {}),
    ])
  }

  return {
    uploadAttachment,
    deleteAttachment,
    uploadEditorImage,
    deleteEditorImage,
  }
}
