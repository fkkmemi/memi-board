import type { MemiBoardI18nMap } from '../types'

/** 글 제목 최대 글자 수. memi-dev 의 firestore.rules 와 같은 값으로 맞춘다. */
export const POST_TITLE_MAX = 150
/** 번역 제목은 원문보다 길어지므로 따로 둔다(영어는 한국어의 1.5~2배). */
export const POST_TITLE_TRANSLATION_MAX = 300

export function clampPostTitle(title: string): string {
  return title.trim().slice(0, POST_TITLE_MAX).trim()
}

export function clampI18nTitles(map: MemiBoardI18nMap | undefined): MemiBoardI18nMap | undefined {
  if (!map) return map
  const out: MemiBoardI18nMap = {}
  for (const [locale, fields] of Object.entries(map) as [keyof MemiBoardI18nMap, Record<string, string> | undefined][]) {
    if (!fields) continue
    out[locale] = typeof fields.title === 'string'
      ? { ...fields, title: fields.title.slice(0, POST_TITLE_TRANSLATION_MAX) }
      : fields
  }
  return out
}

/** 번역 기준 제목도 저장되는 제목과 같게 잘라야 번역이 "최신"으로 보인다. */
export function clampI18nSourceTitle<T extends { title?: string }>(source: T): T {
  return typeof source?.title === 'string' ? { ...source, title: clampPostTitle(source.title) } : source
}

/** 본문(HTML) 절대 상한. 번역이 꺼진 보드는 이 값을 그대로 쓴다. */
export const POST_BODY_MAX = 50_000
/** 저장 한 번에 번역하는 본문 총량. 번역 언어 수로 나눠 보드별 본문 한도를 정한다. */
export const POST_TRANSLATION_BUDGET = 50_000
/** 언어 하나를 번역하는 호출 한 번의 본문 상한. 출력 잘림과 시간 초과를 막는다. */
export const POST_TRANSLATION_CALL_MAX = 10_000

/** 번역할 언어 수(원문 제외)로 본문 한도를 정한다. 100자 단위로 내림. */
export function postBodyMax(translationTargets: number): number {
  if (translationTargets <= 0) return POST_BODY_MAX
  const share = Math.floor(POST_TRANSLATION_BUDGET / translationTargets / 100) * 100
  return Math.min(POST_TRANSLATION_CALL_MAX, share)
}

/** 글당 태그 수와 태그 하나의 글자 수. 태그는 상세 화면에 배지로만 보인다. */
export const POST_TAG_MAX = 10
export const POST_TAG_LENGTH_MAX = 30

/** 공백 정리 → 30자 자르기 → 대소문자 무시 중복 제거 → 10개까지. */
export function normalizePostTags(tags: readonly string[] | null | undefined): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of tags ?? []) {
    const tag = String(raw).trim().slice(0, POST_TAG_LENGTH_MAX).trim()
    const key = tag.toLocaleLowerCase()
    if (!tag || seen.has(key)) continue
    seen.add(key)
    out.push(tag)
    if (out.length >= POST_TAG_MAX) break
  }
  return out
}

/** 글당 첨부 수. 파일 크기·종류는 호스트 storage.rules 가 정한다(사이트마다 다르게 둘 수 있다). */
export const POST_ATTACHMENT_MAX = 5
