/** 게시판 SEO 순수 헬퍼 — Nuxt 의존 없음 */
import type { MemiBoardLocale } from '../i18n/locales'
import { translate } from '../i18n/translate'

/** '전체' 라벨(현재 언어 또는 예전 한국어 값)이면 전체 목록으로 본다. */
function isAllCategoryLabel(label: string | undefined, locale?: MemiBoardLocale): boolean {
  if (!label) return true
  return label === '전체' || label === translate(locale, 'seo.allCategory')
}

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

/**
 * 게시글 previewImage(원본) → 공유 미리보기용 썸네일 URL.
 * Storage: `.../images/{file}` → `.../images/thumbnails/{basename}.jpg`
 * (uploadEditorImage 와 동일 규칙, 공개 read 시 `?alt=media` 만으로 접근)
 * Firebase 가 아니면 원본 유지. 이미 thumbnails 경로면 토큰만 제거.
 */
export function toBoardOgImageUrl(value: unknown): string | null {
  const s = asHttpUrl(value)
  if (!s) return null
  if (!/firebasestorage\.googleapis\.com/i.test(s)) return s

  try {
    const u = new URL(s)
    // /v0/b/{bucket}/o/{encodedPath}
    const parts = u.pathname.split('/')
    const bucket = parts[3]
    const oIdx = parts.indexOf('o')
    if (!bucket || oIdx < 0 || !parts[oIdx + 1]) return s

    const path = decodeURIComponent(parts.slice(oIdx + 1).join('/'))
    let thumbPath = path
    if (!path.includes('/images/thumbnails/')) {
      const next = path.replace(
        /\/images\/([^/]+)$/,
        (_full, file: string) => {
          const base = String(file).replace(/\.[^.]+$/, '')
          return `/images/thumbnails/${base}.jpg`
        },
      )
      if (next === path) return s
      thumbPath = next
    }

    // 토큰 없이 공개 read — 크롤러·카톡 캐시에 유리
    return `${u.origin}/v0/b/${bucket}/o/${encodeURIComponent(thumbPath)}?alt=media`
  }
  catch {
    return s
  }
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

export function boardPostOgTitle(
  title: string,
  categoryLabel: string | undefined,
  siteName: string,
  /** 제목 없을 때(이미지 보드) 본문 요약 사용 */
  summary?: string,
  locale?: MemiBoardLocale,
): string {
  const fromSummary = summary?.trim().slice(0, 40)
  const t = title.trim() || fromSummary || translate(locale, 'seo.photo')
  const cat = categoryLabel?.trim()
  const site = siteName.trim() || 'Board'
  return cat ? `${t} · ${cat} | ${site}` : `${t} | ${site}`
}

export function boardPostOgDescription(opts: {
  summary?: string
  categoryLabel?: string
  authorName?: string | null
}, locale?: MemiBoardLocale): string {
  const bits: string[] = []
  if (opts.summary?.trim()) bits.push(opts.summary.trim().slice(0, 140))
  else bits.push(translate(locale, 'seo.postDescriptionFallback'))
  if (opts.categoryLabel?.trim()) bits.push(opts.categoryLabel.trim())
  if (opts.authorName?.trim()) bits.push(opts.authorName.trim())
  return bits.join(' · ').slice(0, 200)
}

export function boardListOgTitle(
  categoryLabel: string | null | undefined,
  siteName: string,
  locale?: MemiBoardLocale,
): string {
  const site = siteName.trim() || 'Board'
  const cat = categoryLabel?.trim()
  if (!isAllCategoryLabel(cat, locale)) return translate(locale, 'seo.listTitle', { name: cat, site })
  return translate(locale, 'seo.listTitleAll', { site })
}

export function boardListOgDescription(opts: {
  categoryLabel?: string | null
  description?: string
  recentTitles?: string[]
}, locale?: MemiBoardLocale): string {
  if (opts.description?.trim()) return opts.description.trim().slice(0, 200)
  const cat = opts.categoryLabel?.trim()
  const head = !isAllCategoryLabel(cat, locale)
    ? translate(locale, 'seo.listDescription', { name: cat })
    : translate(locale, 'seo.listDescriptionAll')
  const titles = (opts.recentTitles || []).filter(Boolean).slice(0, 3)
  if (!titles.length) return head.slice(0, 200)
  return `${head} ${titles.map(t => `「${t}」`).join(' ')}`.slice(0, 200)
}

export function normalizeBasePath(basePath: string | undefined): string {
  const raw = (basePath || '/board').trim() || '/board'
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`
  return withSlash.replace(/\/$/, '') || '/board'
}
