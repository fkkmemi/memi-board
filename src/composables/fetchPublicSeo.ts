/**
 * 공개 SEO용 Firestore 직조회 (호스트 API 불필요).
 * listed === true 만 — 숨김 게시판 글은 null / 빈 목록.
 *
 * useFirestore 는 setup 에서 받은 db 를 넘긴다 (async 핸들러 안 use* 금지).
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as fbLimit,
  orderBy,
  query,
  where,
  type Firestore,
} from 'firebase/firestore'
import { useFirestore } from 'vuefire'
import { useMemiBoardConfig } from '../config'
import {
  asHttpUrl,
  type BoardListSeoPayload,
  type BoardPostSeoPayload,
} from '../utils/boardSeo'

export type PublicSeoDb = {
  db: Firestore
  prefix: string
}

/** setup 동기 구간에서만 호출 — useFirestore + config 캡처 */
export function resolvePublicSeoDb(): PublicSeoDb {
  return {
    db: useFirestore(),
    prefix: useMemiBoardConfig().collectionPrefix,
  }
}

function postsCol(ctx: PublicSeoDb) {
  return collection(ctx.db, `${ctx.prefix}Posts`)
}

function categoryDoc(ctx: PublicSeoDb, categoryId: string) {
  return doc(ctx.db, `${ctx.prefix}Settings`, 'config', 'categories', categoryId)
}

async function loadCategoryMeta(ctx: PublicSeoDb, categoryId: string): Promise<{
  label: string
  description: string
  hidden: boolean
}> {
  try {
    const snap = await getDoc(categoryDoc(ctx, categoryId))
    if (!snap.exists()) {
      return { label: categoryId, description: '', hidden: false }
    }
    const d = snap.data() ?? {}
    return {
      label: typeof d.label === 'string' && d.label.trim() ? d.label.trim() : categoryId,
      description: typeof d.description === 'string' ? d.description.trim() : '',
      hidden: d.visibility === 'hidden',
    }
  }
  catch {
    return { label: categoryId, description: '', hidden: false }
  }
}

function createdAtIso(value: unknown): string | null {
  if (value && typeof value === 'object' && 'toDate' in value) {
    try {
      const d = (value as { toDate: () => Date }).toDate()
      return d instanceof Date ? d.toISOString() : null
    }
    catch {
      return null
    }
  }
  return null
}

/** 공개 글 1건 (category + slug). 없거나 숨김이면 null. */
export async function fetchPublicPostForSeo(
  category: string,
  slug: string,
  ctx?: PublicSeoDb,
): Promise<BoardPostSeoPayload | null> {
  const cat = category.trim()
  const s = slug.trim()
  if (!cat || !s) return null

  const store = ctx ?? resolvePublicSeoDb()
  const meta = await loadCategoryMeta(store, cat)
  if (meta.hidden) return null

  try {
    const snap = await getDocs(query(
      postsCol(store),
      where('category', '==', cat),
      where('slug', '==', s),
      where('listed', '==', true),
      fbLimit(1),
    ))
    const row = snap.docs[0]
    if (!row) return null
    const d = row.data() ?? {}
    const title = typeof d.title === 'string' ? d.title.trim() : ''
    if (!title) return null
    return {
      id: row.id,
      slug: typeof d.slug === 'string' ? d.slug : s,
      category: cat,
      categoryLabel: meta.label,
      title,
      summary: typeof d.summary === 'string' ? d.summary.trim().slice(0, 200) : '',
      previewImage: asHttpUrl(d.previewImage),
      authorName: typeof d.authorName === 'string' && d.authorName.trim() ? d.authorName.trim() : null,
      createdAt: createdAtIso(d.createdAt),
    }
  }
  catch (e) {
    if (import.meta.dev) console.warn('[memi-board] fetchPublicPostForSeo failed', e)
    return null
  }
}

/** 전체 또는 카테고리 공개 목록 SEO 페이로드. */
export async function fetchPublicListForSeo(
  category?: string | null,
  ctx?: PublicSeoDb,
): Promise<BoardListSeoPayload> {
  const cat = category?.trim() || null
  const store = ctx ?? resolvePublicSeoDb()

  if (cat) {
    const meta = await loadCategoryMeta(store, cat)
    if (meta.hidden) {
      return {
        kind: 'category',
        category: cat,
        categoryLabel: meta.label,
        description: '',
        ogImage: null,
        recentTitles: [],
      }
    }
    const { recentTitles, ogImage } = await loadRecentListed(store, cat)
    return {
      kind: 'category',
      category: cat,
      categoryLabel: meta.label,
      description: meta.description || `${meta.label} 게시판`,
      ogImage,
      recentTitles,
    }
  }

  const { recentTitles, ogImage } = await loadRecentListed(store, null)
  return {
    kind: 'all',
    category: null,
    categoryLabel: '전체',
    description: '게시판 — 공지와 커뮤니티 소식을 확인하세요.',
    ogImage,
    recentTitles,
  }
}

async function loadRecentListed(ctx: PublicSeoDb, category: string | null): Promise<{
  recentTitles: string[]
  ogImage: string | null
}> {
  const recentTitles: string[] = []
  let ogImage: string | null = null
  try {
    const constraints = category
      ? [
          where('category', '==', category),
          where('listed', '==', true),
          orderBy('createdAt', 'desc'),
          fbLimit(12),
        ]
      : [
          where('listed', '==', true),
          orderBy('createdAt', 'desc'),
          fbLimit(12),
        ]
    const snap = await getDocs(query(postsCol(ctx), ...constraints))
    for (const row of snap.docs) {
      const d = row.data() ?? {}
      const title = typeof d.title === 'string' ? d.title.trim() : ''
      if (title && recentTitles.length < 5) recentTitles.push(title)
      if (!ogImage) ogImage = asHttpUrl(d.previewImage)
    }
  }
  catch (e) {
    if (import.meta.dev) console.warn('[memi-board] loadRecentListed failed', e)
  }
  return { recentTitles, ogImage }
}
