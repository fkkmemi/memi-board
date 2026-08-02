import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage'
import type { UploadTask } from 'firebase/storage'
import { useFirebaseApp } from 'vuefire'
import { useMemiBoardConfig } from '../../config'
import { safeFileName } from '../utils/slugify'
import type { Attachment } from '../types'

export function useMemiBoardStorage() {
  const config = useMemiBoardConfig()
  const app = useFirebaseApp()
  const prefix = config.collectionPrefix

  /** postId는 아직 저장되지 않은 새 글이면 임시 id(예: 'new-<timestamp>')를 넘겨도 된다 — 경로 네임스페이스일 뿐이다. */
  function uploadAttachment(
    file: File,
    postId: string,
    onProgress?: (ratio: number) => void,
  ): { promise: Promise<Attachment>, cancel: () => void } {
    const storage = getStorage(app)
    const path = `${prefix}/posts/${postId}/attachments/${Date.now()}-${safeFileName(file.name)}`
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

  return { uploadAttachment, deleteAttachment }
}
