import type { Attachment } from '../types'

/** 댓글·답글에 둘 수 있는 이미지 수 */
export const COMMENT_IMAGE_LIMIT = 1

const COMMENT_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])

export function isCommentImageFile(file: File): boolean {
  const type = (file.type || '').toLowerCase()
  if (COMMENT_IMAGE_TYPES.has(type)) return true
  const name = file.name.toLowerCase()
  return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].some(ext => name.endsWith(ext))
}

export function normalizeCommentImages(images: Attachment[] | null | undefined): Attachment[] {
  if (!images?.length) return []
  for (const item of images) {
    if (!item?.name || !item.url?.startsWith('https://') || !item.path) continue
    if (item.path.includes('..') || !item.type?.startsWith('image/')) continue
    if (!Number.isFinite(item.size) || item.size <= 0) continue
    return [{
      name: item.name.slice(0, 200),
      url: item.url,
      path: item.path,
      size: Math.round(item.size),
      type: item.type,
    }]
  }
  return []
}

/** prefix 아래의 댓글 이미지 객체 경로만 모은다. 다른 글의 파일은 빼 둔다. */
export function commentImagePathsUnder(images: unknown, prefix: string): string[] {
  const base = prefix.endsWith('/') ? prefix : `${prefix}/`
  if (!Array.isArray(images)) return []
  const paths = new Set<string>()
  for (const item of images) {
    if (!item || typeof item !== 'object') continue
    const path = (item as { path?: unknown }).path
    if (typeof path !== 'string' || !path.startsWith(base)) continue
    if (path.split('/').includes('..')) continue
    paths.add(path)
  }
  return [...paths]
}
