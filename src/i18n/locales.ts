/** 게시판 UI 지원 언어. 코드는 @nuxtjs/i18n 호스트의 locale code 와 맞춘다. */
export const MEMI_BOARD_LOCALES = [
  { code: 'ko', name: '한국어', intl: 'ko-KR', dir: 'ltr' },
  { code: 'en', name: 'English', intl: 'en-US', dir: 'ltr' },
  { code: 'ja', name: '日本語', intl: 'ja-JP', dir: 'ltr' },
  { code: 'de', name: 'Deutsch', intl: 'de-DE', dir: 'ltr' },
  { code: 'fr', name: 'Français', intl: 'fr-FR', dir: 'ltr' },
  { code: 'es', name: 'Español', intl: 'es-419', dir: 'ltr' },
  { code: 'pt', name: 'Português', intl: 'pt-BR', dir: 'ltr' },
  { code: 'zh', name: '中文', intl: 'zh-CN', dir: 'ltr' },
  { code: 'ar', name: 'العربية', intl: 'ar', dir: 'rtl' },
  { code: 'id', name: 'Indonesia', intl: 'id-ID', dir: 'ltr' },
] as const

export type MemiBoardLocale = typeof MEMI_BOARD_LOCALES[number]['code']
export type MemiBoardLocaleInfo = typeof MEMI_BOARD_LOCALES[number]

export const DEFAULT_MEMI_BOARD_LOCALE: MemiBoardLocale = 'ko'
/** 번역이 빠진 키(긴 안내문 등)를 채우는 언어. ko 는 원문이라 모든 키가 있다. */
export const FALLBACK_MEMI_BOARD_LOCALE: MemiBoardLocale = 'en'

const CODES = new Set<string>(MEMI_BOARD_LOCALES.map(item => item.code))

/** 'en-US', 'pt_BR', 'zh-Hans' 같은 값을 지원 언어 코드로 맞춘다. 지원하지 않으면 undefined. */
export function normalizeMemiBoardLocale(value: unknown): MemiBoardLocale | undefined {
  if (typeof value !== 'string') return undefined
  const code = value.trim().toLowerCase().split(/[-_]/)[0]
  return code && CODES.has(code) ? code as MemiBoardLocale : undefined
}

export function memiBoardLocaleInfo(locale: MemiBoardLocale): MemiBoardLocaleInfo {
  return MEMI_BOARD_LOCALES.find(item => item.code === locale) ?? MEMI_BOARD_LOCALES[0]
}
