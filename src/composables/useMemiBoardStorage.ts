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
import { useBoardPathConfig } from '../config'
import { postStorageFolder } from '../utils/boardPaths'
import type { Attachment, EditorImageEntry } from '../types'

/** 에디터 이미지 최대 크기 (바이트) */
export const EDITOR_IMAGE_MAX_BYTES = 5 * 1024 * 1024
/** 휴대폰 원본 이미지 선택 허용 크기. 큰 이미지는 업로드 전에 최적화한다. */
export const EDITOR_IMAGE_SOURCE_MAX_BYTES = 25 * 1024 * 1024

function isHeicLike(file: File): boolean {
  const type = (file.type || '').toLowerCase()
  const name = file.name.toLowerCase()
  return type === 'image/heic'
    || type === 'image/heif'
    || name.endsWith('.heic')
    || name.endsWith('.heif')
}

/** HEIC/HEIF → JPEG (heic2any, 동적 import) */
async function heicToJpegBlob(file: File, quality = 0.85): Promise<Blob> {
  const { default: heic2any } = await import('heic2any')
  const result = await heic2any({
    blob: file,
    toType: 'image/jpeg',
    quality,
  })
  const blob = Array.isArray(result) ? result[0] : result
  if (!(blob instanceof Blob)) {
    throw new Error('HEIC 변환 결과가 비어 있습니다.')
  }
  return blob
}

async function resizeJpegIfNeeded(blob: Blob): Promise<Blob> {
  if (blob.size <= EDITOR_IMAGE_MAX_BYTES) return blob
  let next = await compressImage(blob, { maxWidth: 2560, quality: 0.85 })
  if (next.size > EDITOR_IMAGE_MAX_BYTES) {
    next = await compressImage(blob, { maxWidth: 2048, quality: 0.75 })
  }
  if (next.size > EDITOR_IMAGE_MAX_BYTES) {
    throw new Error('압축 후에도 이미지가 5MB를 초과합니다. 더 작은 이미지를 선택해 주세요.')
  }
  return next
}

/**
 * 에디터 업로드용 정규화.
 * - 5MB 초과 → 리사이즈
 * - HEIC/HEIF → heic2any 로 JPEG 변환 후 필요 시 리사이즈
 */
async function optimizeEditorImage(file: File): Promise<{ blob: File | Blob, compressed: boolean }> {
  if (file.size > EDITOR_IMAGE_SOURCE_MAX_BYTES) {
    throw new Error(`원본 이미지는 ${EDITOR_IMAGE_SOURCE_MAX_BYTES / 1024 / 1024}MB 이하여야 합니다.`)
  }

  if (isHeicLike(file)) {
    try {
      const jpeg = await heicToJpegBlob(file, 0.85)
      const blob = await resizeJpegIfNeeded(jpeg)
      return { blob, compressed: true }
    }
    catch (cause) {
      if (cause instanceof Error && cause.message.includes('압축 후에도')) throw cause
      // Safari 등 canvas 디코드가 되는 환경 폴백
      try {
        const blob = await resizeJpegIfNeeded(await compressImage(file, { maxWidth: 2560, quality: 0.85 }))
        return { blob, compressed: true }
      }
      catch {
        console.error('[memi-board] HEIC convert failed', cause)
        throw new Error('HEIC 사진을 변환하지 못했습니다. 잠시 후 다시 시도하거나 JPG로 저장해 올려 주세요.')
      }
    }
  }

  if (file.size <= EDITOR_IMAGE_MAX_BYTES) {
    return { blob: file, compressed: false }
  }

  try {
    const blob = await resizeJpegIfNeeded(file)
    return { blob, compressed: true }
  }
  catch (cause) {
    if (cause instanceof Error && cause.message.includes('압축 후에도')) throw cause
    throw new Error('이 이미지 형식은 브라우저에서 최적화할 수 없습니다. JPG, PNG 또는 WebP로 변환해 주세요.')
  }
}

export function useMemiBoardStorage() {
  const cfg = () => useBoardPathConfig()
  const app = useFirebaseApp()

  /** postId는 작성 화면 진입 시 미리 생성한 Firestore 자동 ID를 사용한다. */
  function uploadAttachment(
    file: File,
    postId: string,
    onProgress?: (ratio: number) => void,
  ): { promise: Promise<Attachment>, cancel: () => void } {
    const storage = getStorage(app)
    const path = `${postStorageFolder(cfg(), postId)}/attachments/${Date.now()}-${safeFileName(file.name)}`
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
   * 에디터 본문 이미지: 원본 + 400px JPEG 썸네일.
   * Storage:
   *   `memiBoardPosts/{postId}/images/{ts}-{name}.ext`
   *   `memiBoardPosts/{postId}/images/thumbnails/{ts}-{name}.jpg`
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
    const folder = postStorageFolder(cfg(), ns)

    const originalPath = `${folder}/images/${baseName}.${ext}`
    const originalRef = storageRef(storage, originalPath)
    await uploadBytes(originalRef, optimized.blob, {
      contentType: optimized.blob.type || 'image/jpeg',
    })
    const originalUrl = await getDownloadURL(originalRef)

    const thumbBlob = await compressImage(optimized.blob, { maxWidth: 400, quality: 0.8 })
    const thumbnailPath = `${folder}/images/thumbnails/${baseName}.jpg`
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

  /**
   * 프로필 사진. 경로가 uid로 고정돼 있어 다시 올리면 그냥 덮어쓴다(고아 파일 없음).
   * 파일은 이미 크롭 단계에서 정사각형 JPEG로 만들어져 오므로 여기선 그대로 업로드한다.
   */
  async function uploadAvatar(uid: string, file: File): Promise<string> {
    const storage = getStorage(app)
    const path = `${cfg().usersCollection}/${uid}/avatar.jpg`
    const fileRef = storageRef(storage, path)
    await uploadBytes(fileRef, file, { contentType: file.type || 'image/jpeg' })
    return getDownloadURL(fileRef)
  }

  return {
    uploadAttachment,
    deleteAttachment,
    uploadEditorImage,
    deleteEditorImage,
    uploadAvatar,
  }
}
