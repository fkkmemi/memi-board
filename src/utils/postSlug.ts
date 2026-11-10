import { doc, getDoc, runTransaction, type Firestore, type Transaction } from 'firebase/firestore'
import type { BoardPathConfig } from './boardPaths'

/** Keep room for numeric suffixes within Firestore's 1,500-byte document ID limit. */
export function postSlugBase(slug: string): string {
  let result = ''
  let bytes = 0
  for (const char of slug) {
    bytes += new TextEncoder().encode(char).length
    if (bytes > 1400) break
    result += char
  }
  return result.replace(/-+$/g, '') || 'post'
}

export function postSlugRef(db: Firestore, cfg: BoardPathConfig, boardId: string, slug: string) {
  return doc(db, `${cfg.postsCollection}Slugs`, boardId, 'slugs', slug)
}

export function postSlugMigrationRef(db: Firestore, cfg: BoardPathConfig) {
  return doc(db, `${cfg.postsCollection}Slugs`, '__migration')
}

/** Advisory only: the final reservation must be committed with the new post. */
export async function availablePostSlug(db: Firestore, cfg: BoardPathConfig, boardId: string, base: string) {
  return choosePostSlug(base, async slug => !(await getDoc(postSlugRef(db, cfg, boardId, slug))).exists())
}

/** The callback atomically claims a candidate, or returns false when already occupied. */
export async function choosePostSlug(base: string, claim: (slug: string) => Promise<boolean>): Promise<string> {
  const normalized = postSlugBase(base)
  for (let n = 1; ; n++) {
    const slug = n === 1 ? normalized : `${normalized}-${n}`
    // /board/:board/new is the editor route, so it cannot identify a post.
    if (slug !== 'new' && await claim(slug)) return slug
  }
}

/** Reservation, metadata and body either all commit, or none do. Retries cannot overwrite a post. */
export async function createPostWithSlug(
  db: Firestore, cfg: BoardPathConfig, boardId: string, postId: string, base: string,
  write: (transaction: Transaction, slug: string) => void,
): Promise<string> {
  return choosePostSlug(base, slug => runTransaction(db, async transaction => {
    const migration = await transaction.get(postSlugMigrationRef(db, cfg))
    if (migration.data()?.ready !== true) {
      throw new Error('Post URL reservations are not initialized. Run the post slug backfill before creating new posts.')
    }
    const reservation = postSlugRef(db, cfg, boardId, slug)
    if ((await transaction.get(reservation)).exists()) return false
    // An ambiguous network failure must never turn a retry into a metadata overwrite.
    const post = doc(db, cfg.postsCollection, postId)
    if ((await transaction.get(post)).exists()) throw new Error('This post has already been saved. Reload it before editing.')
    transaction.set(reservation, { postId })
    write(transaction, slug)
    return true
  }))
}
