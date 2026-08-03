/**
 * Canvas API로 썸네일용 이미지 압축 (shineb 와 동일).
 */
export async function compressImage(
  file: File | Blob,
  { maxWidth = 400, quality = 0.8 }: { maxWidth?: number, quality?: number } = {},
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
        reject(new Error('Canvas를 사용할 수 없습니다'))
        return
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      canvas.toBlob(
        blob => (blob ? resolve(blob) : reject(new Error('압축 실패'))),
        'image/jpeg',
        quality,
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('이미지 로드 실패'))
    }

    img.src = objectUrl
  })
}
