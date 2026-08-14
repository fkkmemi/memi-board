/**
 * Firebase Storage download URL → object path.
 * 예: .../o/board%2Fposts%2Fid%2Fimages%2Fx.png?alt=media → board/posts/id/images/x.png
 */
export function storagePathFromDownloadUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase()
    const isFirebaseStorage = host === 'firebasestorage.googleapis.com'
      || host.endsWith('.firebasestorage.app')
    if (!isFirebaseStorage) return null
    const m = parsed.pathname.match(/\/o\/([^?]+)/)
    if (!m?.[1]) return null
    return decodeURIComponent(m[1])
  }
  catch {
    return null
  }
}

/** path 에서 posts/{ns}/... 의 ns 추출 */
export function postNamespaceFromStoragePath(path: string): string | null {
  const m = path.match(/(?:^|\/)posts\/([^/]+)\//)
  return m?.[1] ?? null
}
