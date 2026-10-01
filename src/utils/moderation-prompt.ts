import { memiBoardLocaleInfo, type MemiBoardLocale } from '../i18n/locales'
import { translate } from '../i18n/translate'

/** 한국어 보드용 원문 프롬프트 (ko). */
export const MODERATION_SYSTEM = `당신은 게시판 콘텐츠를 심사하는 엄격한 모더레이터입니다.
아래 텍스트에 욕설·비속어·성희롱·혐오·위협·스팸·도배성 광고가 있으면 반드시 거부(flagged=true)합니다.

flagged=true 예:
- 욕설/비속어: 씨발, 시발, 병신, 지랄, 좆, 개새끼, 존나, fuck, shit, bitch 등
- 성적 모욕, 혐오 발언, 협박
- 게시판 주제와 무관한 도배성 광고/스팸

flagged=false:
- 게시판 주제에 맞는 정상적인 글/댓글 (강한 의견이나 정당한 비판은 허용)

JSON만 출력:
{"flagged":boolean,"category":"none"|"abuse"|"spam"|"adult"|"violence"|"other","reason":string}
- flagged=true면 category를 고르고, reason은 한국어로 **무엇이 문제인지** 구체적으로 1문장
  (예: "욕설(비속어)이 포함되어 게시할 수 없습니다.", "광고·스팸성 문구가 있어 게시할 수 없습니다.")
  욕설 단어 전체를 그대로 길게 인용하지 말고, 유형(욕설/혐오/스팸 등)을 분명히 밝힌다.
- flagged=false면 category는 "none", reason은 ""`

/** 프롬프트에 함께 적는 언어 영어 이름 (모델이 언어를 헷갈리지 않게). */
const LOCALE_ENGLISH_NAMES: Record<MemiBoardLocale, string> = {
  ko: 'Korean',
  en: 'English',
  ja: 'Japanese',
  de: 'German',
  fr: 'French',
  es: 'Spanish',
  pt: 'Portuguese',
  zh: 'Simplified Chinese',
  ar: 'Arabic',
  id: 'Indonesian',
}

/** 예: "Japanese (日本語)", "English" */
export function memiBoardLanguageLabel(locale: MemiBoardLocale): string {
  const english = LOCALE_ENGLISH_NAMES[locale] ?? 'English'
  const native = memiBoardLocaleInfo(locale).name
  return english === native ? english : `${english} (${native})`
}

/** ko 외 모든 언어용 영어 프롬프트. 엄격도·출력 형식은 한국어 원문과 동일. */
function buildEnglishModerationPrompt(locale: MemiBoardLocale): string {
  const language = memiBoardLanguageLabel(locale)
  return `You are a strict moderator reviewing content for a message board.
If the text below contains profanity, vulgar slang, sexual harassment, hate speech, threats, spam, or repetitive/flooding advertisements, you MUST reject it (flagged=true).

The content may be written in ANY language, or a mix of languages — not only the board's language.
Judge every language equally strictly, including slang, abbreviations, romanizations, deliberate misspellings,
inserted spaces/symbols, and other obfuscation (e.g. in Korean, Japanese, Chinese, Arabic, Spanish, etc.).

flagged=true examples:
- Profanity/vulgar slang: fuck, shit, bitch, asshole, f*ck, sh1t /
  Korean: 씨발, 시발, ㅅㅂ, 병신, ㅂㅅ, 지랄, 좆, 개새끼, 존나 /
  Japanese: クソ, 死ね, ちんこ / Chinese: 操你妈, 傻逼, 他妈的 /
  Spanish: puta, mierda, pendejo / German: Scheiße, Hurensohn / French: putain, connard /
  Portuguese: porra, caralho / Indonesian: anjing, bangsat, kontol / Arabic: كس, شرموطة, etc.
- Sexual insults, hate speech, threats
- Flooding advertisements/spam unrelated to the board's topic

flagged=false:
- Normal posts/comments that fit the board's topic (strong opinions and legitimate criticism are allowed)

Output JSON only:
{"flagged":boolean,"category":"none"|"abuse"|"spam"|"adult"|"violence"|"other","reason":string}
- If flagged=true, choose a category, and write reason as ONE concrete sentence in ${language} explaining **what the problem is**
  (e.g. "It contains profanity, so it can't be posted.", "It contains advertising/spam, so it can't be posted." — but written in ${language}).
  Do not quote the offensive words at length; clearly state the type (profanity/hate/spam, etc.).
- If flagged=false, category is "none" and reason is ""`
}

/**
 * 보드 언어별 검열 시스템 프롬프트.
 * ko 는 한국어 원문(MODERATION_SYSTEM) 그대로, 그 외는 영어 프롬프트 + reason 을 보드 언어로 쓰도록 지시.
 */
export function buildModerationPrompt(locale: MemiBoardLocale = 'ko'): string {
  return locale === 'ko' ? MODERATION_SYSTEM : buildEnglishModerationPrompt(locale)
}

/** 텍스트 검열 요청 본문 */
export function buildModerationTextPrompt(text: string, locale: MemiBoardLocale = 'ko'): string {
  const body = `"""${text.slice(0, 4000)}"""`
  return locale === 'ko' ? `심사할 텍스트:\n${body}` : `Text to review:\n${body}`
}

/** 이미지 검열 요청 문구 */
export function buildModerationImagePrompt(locale: MemiBoardLocale = 'ko'): string {
  return locale === 'ko' ? '이 이미지를 심사해 주세요.' : 'Please review this image.'
}

/** 사용자 안내용 카테고리 라벨 (ko 원문. 다른 언어는 moderationCategoryLabel 사용) */
export const MODERATION_CATEGORY_LABELS: Record<string, string> = {
  abuse: '욕설·비속어·모욕',
  spam: '스팸·광고',
  adult: '선정적·성인 내용',
  violence: '폭력·위협',
  other: '부적절한 내용',
  none: '',
}

/** 카테고리 라벨을 보드 언어로 */
export function moderationCategoryLabel(category: string, locale: MemiBoardLocale = 'ko'): string {
  if (!category || category === 'none') return ''
  if (!(category in MODERATION_CATEGORY_LABELS)) return category
  return translate(locale, `moderationPrompt.categories.${category}`)
}

/** 차단 사유를 사용자에게 읽기 쉽게 정리 */
export function formatModerationUserReason(opts: {
  reason?: string
  category?: string
  via?: string
  localHit?: string
  /** 안내 문구 언어 (기본 ko) */
  locale?: MemiBoardLocale
}): string {
  const locale = opts.locale ?? 'ko'
  if (opts.via === 'local' && opts.localHit) {
    const hit = opts.localHit.trim()
    // 짧은 금칙어만 표시 (너무 길면 유형만)
    if (hit.length > 0 && hit.length <= 12) {
      return translate(locale, 'moderationPrompt.localHit', { hit })
    }
    return translate(locale, 'moderationPrompt.localGeneric')
  }

  const raw = (opts.reason || '').trim()
  if (raw) return raw

  const cat = opts.category ? moderationCategoryLabel(opts.category, locale) : ''
  if (cat) return translate(locale, 'moderationPrompt.categoryBlocked', { category: cat })
  return translate(locale, 'moderationPrompt.genericBlocked')
}

/** API 없이도 1차로 걸러내는 한국어/영어 비속어 (부분 문자열 매칭) */
export const DEFAULT_LOCAL_BLOCKLIST = [
  '씨발', '시발', '시이발', '씨팔', '시팔', '병신', '븅신', '지랄', '좆', '존나',
  '개새끼', '개새', '새끼', '꺼져', '닥쳐', '씹', '니미', '느금', '애미', '애비',
  'fuck', 'shit', 'bitch', 'asshole',
]

export function buildLocalBlockRegex(patterns: string[]): RegExp {
  return new RegExp(patterns.join('|'), 'i')
}

const CATEGORIES = new Set(['none', 'abuse', 'spam', 'adult', 'violence', 'other'])

export function parseModerationJson(raw: string): { flagged: boolean, category: string, reason: string } | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  }
  catch {
    const match = trimmed.match(/\{[\s\S]*\}/)
    if (!match) return null
    try {
      parsed = JSON.parse(match[0])
    }
    catch {
      return null
    }
  }

  if (typeof parsed !== 'object' || parsed === null) return null
  const obj = parsed as Record<string, unknown>
  if (typeof obj.flagged !== 'boolean') return null

  const category = typeof obj.category === 'string' && CATEGORIES.has(obj.category) ? obj.category : (obj.flagged ? 'other' : 'none')
  const reason = typeof obj.reason === 'string' ? obj.reason : ''
  return { flagged: obj.flagged, category, reason }
}
