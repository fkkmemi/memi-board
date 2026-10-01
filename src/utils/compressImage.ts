import type { MemiBoardLocale } from '../i18n/locales'
import { translate } from '../i18n/translate'

/**
 * Canvas API로 썸네일용 이미지 압축 (shineb 와 동일).
 */
export async function compressImage(
  file: File | Blob,
  { maxWidth = 400, quality = 0.8 }: { maxWidth?: number, quality?: number } = {},
  locale?: MemiBoardLocale,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

      const ratio = Math.min(1, maxWidth / img.naturalWidth)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.naturalWidth * ratio)
      canvas.height = Math.round(img.naturalHeight * ratio)

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error(translate(locale, 'storage.canvasUnavailable')))
        return
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      canvas.toBlob(
        blob => (blob ? resolve(blob) : reject(new Error(translate(locale, 'storage.compressFailed')))),
        'image/jpeg',
        quality,
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error(translate(locale, 'storage.loadFailed')))
    }

    img.src = objectUrl
  })
}
