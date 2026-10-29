import { MEMI_BOARD_LOCALES, normalizeMemiBoardLocale, type MemiBoardLocale } from '../i18n/locales'
import { isMemiBoardTranslationEnabled } from '../config'
import type { MemiBoardI18nMap, MemiBoardI18nSource, PostContentI18nSource, PostDetail, PostModel } from '../types'

const SOURCE_KEYS = ['label', 'description', 'title', 'summary', 'contentHash'] as const

/** 본문처럼 긴 문자열이 번역 당시와 같은지 비교할 때 쓴다. */
export function hashText(value: string): string {
  let hash = 5381
  for (let i = 0; i < value.length; i++) hash = ((hash << 5) + hash) ^ value.charCodeAt(i)
  return (hash >>> 0).toString(36)
}

function pickField(row: Record<string, string> | undefined, field: string): string {
  const value = row?.[field]
  return typeof value === 'string' ? value.trim() : ''
}

/** Firestore에 넣은 i18n 맵만 남긴다. 지원하지 않는 키와 빈 문자열은 버린다. */
export function readLocalizedFields(value: unknown): MemiBoardI18nMap | undefined {
  if (!value || typeof value !== 'object') return undefined
  const out: MemiBoardI18nMap = {}
  for (const [code, row] of Object.entries(value as Record<string, unknown>)) {
    const locale = normalizeMemiBoardLocale(code)
    if (!locale || !row || typeof row !== 'object') continue
    const fields: Record<string, string> = {}
    for (const [key, text] of Object.entries(row as Record<string, unknown>)) {
      if (typeof text === 'string' && text.trim()) fields[key] = text.trim()
    }
    if (Object.keys(fields).length) out[locale] = fields
  }
  return Object.keys(out).length ? out : undefined
}

export function readI18nSource(value: unknown): MemiBoardI18nSource | undefined {
  if (!value || typeof value !== 'object') return undefined
  const raw = value as Record<string, unknown>
  const source: MemiBoardI18nSource = {}
  const locale = normalizeMemiBoardLocale(raw.locale)
  if (locale) source.locale = locale
  for (const key of SOURCE_KEYS) {
    if (typeof raw[key] === 'string') source[key] = raw[key]
  }
  return Object.keys(source).length ? source : undefined
}

export function readContentI18nSource(value: unknown): PostContentI18nSource | undefined {
  if (!value || typeof value !== 'object') return undefined
  const raw = value as Record<string, unknown>
  const source: PostContentI18nSource = {}
  const locale = normalizeMemiBoardLocale(raw.locale)
  if (locale) source.locale = locale
  if (typeof raw.hash === 'string' && raw.hash) source.hash = raw.hash
  return source.locale || source.hash ? source : undefined
}

/** 모델 결과에 원문 언어 값을 합쳐 10개 언어가 모두 있게 만든다. */
export function mergeSourceFields(
  source: MemiBoardLocale,
  fields: Record<string, string>,
  translated: MemiBoardI18nMap | undefined,
): MemiBoardI18nMap {
  const out: MemiBoardI18nMap = {}
  if (translated) {
    for (const item of MEMI_BOARD_LOCALES) {
      const row = translated[item.code]
      if (!row) continue
      const picked: Record<string, string> = {}
      for (const [key, value] of Object.entries(row)) {
        if (typeof value === 'string' && value.trim()) picked[key] = value.trim()
      }
      if (Object.keys(picked).length) out[item.code] = picked
    }
  }
  const copy: Record<string, string> = {}
  for (const [key, value] of Object.entries(fields)) {
    const text = value.trim()
    if (text) copy[key] = text
  }
  if (Object.keys(copy).length) out[source] = { ...out[source], ...copy }
  return out
}

/**
 * 보드가 번역할 언어. `translationLocales` 가 비어 있으면 지원 언어 전체.
 * 지원하지 않는 코드와 중복은 버리고 MEMI_BOARD_LOCALES 순서로 돌려준다.
 */
export function boardTranslationLocales(board?: { translationLocales?: readonly string[] | null } | null): MemiBoardLocale[] {
  const picked = new Set(
    (board?.translationLocales ?? [])
      .map(code => normalizeMemiBoardLocale(code))
      .filter((code): code is MemiBoardLocale => !!code),
  )
  const all = MEMI_BOARD_LOCALES.map(item => item.code)
  return picked.size ? all.filter(code => picked.has(code)) : all
}

/** Firestore 값 → 저장용 번역 언어 목록. 전체를 고른 경우는 빈 배열(= 전체)로 둔다. */
export function readTranslationLocales(raw: unknown): MemiBoardLocale[] {
  if (!Array.isArray(raw)) return []
  const picked = boardTranslationLocales({ translationLocales: raw.filter((v): v is string => typeof v === 'string') })
  return picked.length === MEMI_BOARD_LOCALES.length ? [] : picked
}

/** locales(기본: 지원 언어 전체)가 모두 해당 필드를 가졌는지. */
export function coversLocales(
  i18n: MemiBoardI18nMap | undefined,
  fields: string[],
  locales: readonly MemiBoardLocale[] = MEMI_BOARD_LOCALES.map(item => item.code),
): boolean {
  if (!i18n || !fields.length) return false
  return locales.every(code => fields.every(field => !!pickField(i18n[code], field)))
}

/**
 * 저장된 번역에서 현재 언어 값을 고른다.
 * 원문 언어로 볼 때는 번역 대신 fallback(원문 필드)을 쓴다.
 * 그 외에는 현재 언어 → en → 원문 순.
 */
export function localizedText(
  i18n: MemiBoardI18nMap | null | undefined,
  locale: string | null | undefined,
  field: string,
  fallback: string,
  sourceLocale?: string | null,
): string {
  if (!isMemiBoardTranslationEnabled()) return fallback
  const code = normalizeMemiBoardLocale(locale)
  const source = normalizeMemiBoardLocale(sourceLocale)
  if (!code || (source && code === source)) return fallback
  const direct = pickField(i18n?.[code], field)
  if (direct) return direct
  if (code !== 'en' && source !== 'en') {
    const english = pickField(i18n?.en, field)
    if (english) return english
  }
  return fallback
}

/**
 * 원문 필드가 번역을 만들 때와 같을 때만 번역을 쓴다.
 * 제목·이름·설명을 나중에 고치면 옛 번역 대신 원문이 보인다.
 */
export function displayStoredField(
  i18n: MemiBoardI18nMap | null | undefined,
  i18nSource: MemiBoardI18nSource | null | undefined,
  field: 'label' | 'description' | 'title' | 'summary',
  current: string,
  locale?: string | null,
): string {
  if (!current) return ''
  if (!i18nSource || i18nSource[field] !== current) return current
  return localizedText(i18n, locale, field, current, i18nSource.locale)
}

export function displayPostTitle(
  post: Pick<PostModel, 'title' | 'i18n' | 'i18nSource'>,
  locale?: string | null,
): string {
  return displayStoredField(post.i18n, post.i18nSource, 'title', post.title ?? '', locale)
}

export function displayPostSummary(
  post: Pick<PostModel, 'summary' | 'i18n' | 'i18nSource'>,
  locale?: string | null,
): string {
  return displayStoredField(post.i18n, post.i18nSource, 'summary', post.summary ?? '', locale)
}

/** 본문 해시가 번역 당시와 같을 때만 번역 HTML 을 돌려준다. */
export function displayPostContent(
  post: Pick<PostDetail, 'content' | 'contentI18n' | 'contentI18nSource'>,
  locale?: string | null,
): string {
  const content = post.content || ''
  const hash = post.contentI18nSource?.hash
  if (!content || !hash || hash !== hashText(content)) return content
  return localizedText(post.contentI18n, locale, 'content', content, post.contentI18nSource?.locale) || content
}

export function boardCopyIsTranslated(board: {
  label: string
  description?: string
  i18n?: MemiBoardI18nMap
  i18nSource?: MemiBoardI18nSource
  translationLocales?: readonly string[]
}): boolean {
  const label = board.label.trim()
  const description = (board.description ?? '').trim()
  if (!label || !board.i18nSource) return false
  if (board.i18nSource.label !== label) return false
  if ((board.i18nSource.description ?? '') !== description) return false
  return coversLocales(board.i18n, description ? ['label', 'description'] : ['label'], boardTranslationLocales(board))
}
