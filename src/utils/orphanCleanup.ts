export type OrphanKind = 'file' | 'comment' | 'like'
export interface OrphanItem {
  kind: OrphanKind
  path: string
  postId: string
  commentId?: string
  size?: number
}

/** Only records with a valid, missing parent are candidates. Unknown schemas are retained. */
export function isOrphanRecord(
  kind: 'comment' | 'like',
  data: Record<string, unknown>,
  posts: ReadonlySet<string>,
  comments: ReadonlySet<string>,
): boolean {
  if (typeof data.postId !== 'string' || !data.postId || data.postId.includes('/')) return false
  if (!posts.has(data.postId)) return true
  return kind === 'like' && data.target === 'comment'
    && typeof data.commentId === 'string' && !!data.commentId && !data.commentId.includes('/')
    && !comments.has(data.commentId)
}

export const ORPHAN_FILE_MIN_AGE_MS = 24 * 60 * 60 * 1000

export function isOldOrphanFile(updated: string, now: number): boolean {
  const timestamp = Date.parse(updated)
  return Number.isFinite(timestamp) && now - timestamp >= ORPHAN_FILE_MIN_AGE_MS
}


/** Only recognized package-owned paths can enter a cleanup plan. */
export function parseCleanupFilePath(path: string, postsCollection: string): { postId: string, commentId?: string } | null {
  if (!path.startsWith(`${postsCollection}/`)) return null
  const parts = path.slice(postsCollection.length + 1).split('/')
  if (parts.some(part => !part || part === '.' || part === '..')) return null
  const [postId, kind, third] = parts
  if (kind === 'attachments' && parts.length === 3) return { postId: postId! }
  if (kind === 'images' && (parts.length === 3 || (parts.length === 4 && third === 'thumbnails'))) return { postId: postId! }
  if (kind === 'comment-images' && parts.length === 4) return { postId: postId!, commentId: third }
  return null
}

export function isCleanupDocumentPath(path: string, kind: 'comment' | 'like', cfg: { commentsCollection: string, likesCollection: string }): boolean {
  const prefix = `${kind === 'comment' ? cfg.commentsCollection : cfg.likesCollection}/`
  const id = path.startsWith(prefix) ? path.slice(prefix.length) : ''
  return !!id && !id.includes('/') && id !== '.' && id !== '..'
}
