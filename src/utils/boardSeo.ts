/** 게시판 SEO 순수 헬퍼 — Nuxt 의존 없음 */

export type BoardPostSeoPayload = {
  id: string
  slug: string
  category: string
  categoryLabel: string
  title: string
  summary: string
  previewImage: string | null
  authorName: string | null
  createdAt: string | null
}

export type BoardListSeoPayload = {
  kind: 'all' | 'category'
  category: string | null
  categoryLabel: string
  description: string
  ogImage: string | null
  recentTitles: string[]
}

export function asHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const s = value.trim()
  return /^https?:\/\//i.test(s) ? s : null
}

export function toAbsoluteUrl(pathOrUrl: string, origin: string, fallbackPath = ''): string {
  const base = origin.replace(/\/$/, '')
  const s = pathOrUrl.trim()
  if (!s) {
    if (fallbackPath) return toAbsoluteUrl(fallbackPath, origin)
    return base
  }
  if (/^https?:\/\//i.test(s)) return s
  return `${base}${s.startsWith('/') ? s : `/${s}`}`
}

export function boardPostOgTitle(title: string, categoryLabel: string | undefined, siteName: string): string {
  const t = title.trim() || '게시글'
  const cat = categoryLabel?.trim()
  const site = siteName.trim() || 'Board'
  return cat ? `${t} · ${cat} | ${site}` : `${t} | ${site}`
}

export function boardPostOgDescription(opts: {
  summary?: string
  categoryLabel?: string
  authorName?: string | null
}): string {
  const bits: string[] = []
  if (opts.summary?.trim()) bits.push(opts.summary.trim().slice(0, 140))
  else bits.push('게시판 글')
  if (opts.categoryLabel?.trim()) bits.push(opts.categoryLabel.trim())
  if (opts.authorName?.trim()) bits.push(opts.authorName.trim())
  return bits.join(' · ').slice(0, 200)
}

export function boardListOgTitle(categoryLabel: string | null | undefined, siteName: string): string {
  const site = siteName.trim() || 'Board'
  const cat = categoryLabel?.trim()
  if (cat && cat !== '전체') return `${cat} 게시판 | ${site}`
  return `게시판 | ${site}`
}

export function boardListOgDescription(opts: {
  categoryLabel?: string | null
  description?: string
  recentTitles?: string[]
}): string {
  if (opts.description?.trim()) return opts.description.trim().slice(0, 200)
  const cat = opts.categoryLabel?.trim()
  const head = cat && cat !== '전체'
    ? `${cat} 게시판 — 소식을 확인하세요.`
    : '게시판 — 공지와 이야기를 확인하세요.'
  const titles = (opts.recentTitles || []).filter(Boolean).slice(0, 3)
  if (!titles.length) return head.slice(0, 200)
  return `${head} ${titles.map(t => `「${t}」`).join(' ')}`.slice(0, 200)
}

export function normalizeBasePath(basePath: string | undefined): string {
  const raw = (basePath || '/board').trim() || '/board'
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`
  return withSlash.replace(/\/$/, '') || '/board'
}
