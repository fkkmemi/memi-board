/**
 * 공개 SEO용 Firestore 직조회.
 * listed === true && isPublished === true 만. boardId = 예전 category 경로 세그먼트.
 */
import {
  getDoc,
  getDocs,
  limit as fbLimit,
  orderBy,
  query,
  where,
  type Firestore,
} from 'firebase/firestore'
import { useFirestore } from 'vuefire'
import { useBoardPathConfig } from '../config'
import {
  boardPostsCol,
  boardSettingsDoc,
  resolveBoardPathConfig,
  type BoardPathConfig,
} from '../utils/boardPaths'
import {
  toBoardOgImageUrl,
  type BoardListSeoPayload,
  type BoardPostSeoPayload,
} from '../utils/boardSeo'

export type PublicSeoDb = {
  db: Firestore
  paths: BoardPathConfig
}

export function resolvePublicSeoDb(): PublicSeoDb {
  return {
    db: useFirestore(),
    paths: useBoardPathConfig(),
  }
}

async function loadBoardMeta(ctx: PublicSeoDb, boardId: string): Promise<{
  label: string
  description: string
  hidden: boolean
}> {
  try {
    const snap = await getDoc(boardSettingsDoc(ctx.db, ctx.paths, boardId))
    if (!snap.exists()) {
      // 부모 문서 fallback
      const parent = await getDoc(
        // lazy import path via settings only
        boardSettingsDoc(ctx.db, ctx.paths, boardId),
      )
      if (!parent.exists()) {
        return { label: boardId, description: '', hidden: false }
      }
    }
    const d = snap.data() ?? {}
    return {
      label: typeof d.label === 'string' && d.label.trim() ? d.label.trim() : boardId,
      description: typeof d.description === 'string' ? d.description.trim() : '',
      hidden: d.visibility === 'hidden',
    }
  }
  catch {
    return { label: boardId, description: '', hidden: false }
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

/** 공개 글 1건 (boardId + slug) */
export async function fetchPublicPostForSeo(
  boardId: string,
  slug: string,
  ctx?: PublicSeoDb,
): Promise<BoardPostSeoPayload | null> {
  const b = boardId.trim()
  const s = slug.trim()
  if (!b || !s) return null

  const store = ctx ?? resolvePublicSeoDb()
  store.paths = resolveBoardPathConfig(store.paths)
  const meta = await loadBoardMeta(store, b)
  if (meta.hidden) return null

  try {
    const snap = await getDocs(query(
      boardPostsCol(store.db, store.paths, b),
      where('slug', '==', s),
      where('listed', '==', true),
      where('isPublished', '==', true),
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
      category: b,
      categoryLabel: meta.label,
      title,
      summary: typeof d.summary === 'string' ? d.summary.trim().slice(0, 200) : '',
      previewImage: toBoardOgImageUrl(d.previewImage),
      authorName: typeof d.authorName === 'string' && d.authorName.trim() ? d.authorName.trim() : null,
      createdAt: createdAtIso(d.createdAt),
    }
  }
  catch (e) {
    if (import.meta.dev) console.warn('[memi-board] fetchPublicPostForSeo failed', e)
    return null
  }
}

/** 전체 보드 목록 또는 단일 보드 SEO */
export async function fetchPublicListForSeo(
  boardId?: string | null,
  ctx?: PublicSeoDb,
): Promise<BoardListSeoPayload> {
  const b = boardId?.trim() || null
  const store = ctx ?? resolvePublicSeoDb()
  store.paths = resolveBoardPathConfig(store.paths)

  if (b) {
    const meta = await loadBoardMeta(store, b)
    if (meta.hidden) {
      return {
        kind: 'category',
        category: b,
        categoryLabel: meta.label,
        description: '',
        ogImage: null,
        recentTitles: [],
      }
    }
    const { recentTitles, ogImage } = await loadRecentListed(store, b)
    return {
      kind: 'category',
      category: b,
      categoryLabel: meta.label,
      description: meta.description || `${meta.label} 게시판`,
      ogImage,
      recentTitles,
    }
  }

  return {
    kind: 'all',
    category: null,
    categoryLabel: '전체',
    description: '게시판 — 공지와 커뮤니티 소식을 확인하세요.',
    ogImage: null,
    recentTitles: [],
  }
}

async function loadRecentListed(ctx: PublicSeoDb, boardId: string): Promise<{
  recentTitles: string[]
  ogImage: string | null
}> {
  const recentTitles: string[] = []
  let ogImage: string | null = null
  try {
    const snap = await getDocs(query(
      boardPostsCol(ctx.db, ctx.paths, boardId),
      where('listed', '==', true),
      where('isPublished', '==', true),
      orderBy('createdAt', 'desc'),
      fbLimit(12),
    ))
    for (const row of snap.docs) {
      const d = row.data() ?? {}
      const title = typeof d.title === 'string' ? d.title.trim() : ''
      if (title && recentTitles.length < 5) recentTitles.push(title)
      if (!ogImage) ogImage = toBoardOgImageUrl(d.previewImage)
    }
  }
  catch (e) {
    if (import.meta.dev) console.warn('[memi-board] loadRecentListed failed', e)
  }
  return { recentTitles, ogImage }
}
