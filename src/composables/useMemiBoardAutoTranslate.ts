import { getAI, getGenerativeModel, GoogleAIBackend, Schema } from 'firebase/ai'
import { useFirebaseApp } from 'vuefire'
import { useMemiBoardConfig } from '../config'
import {
  DEFAULT_MEMI_BOARD_LOCALE,
  MEMI_BOARD_LOCALES,
  type MemiBoardLocale,
} from '../i18n/locales'
import type { MemiBoardI18nMap } from '../types'
import { memiBoardLanguageLabel } from '../utils/moderation-prompt'
import { localizedText, mergeSourceFields } from '../utils/localizedFields'

/** 번역할 항목 하나. fields 의 키(label, description 등)별로 번역 결과가 돌아온다. */
export interface MemiBoardTranslateEntry {
  id: string
  fields: Record<string, string>
  /** 짧은 이름의 뜻을 잡아 주는 참고 정보(링크 주소, 상위 메뉴 이름 등). 번역하지 않는다. */
  context?: string
}

/** 언어별 번역 결과. `{ en: { label: 'About' }, ja: { label: '…' } }` */
export type MemiBoardLocalizedFields = MemiBoardI18nMap

export interface MemiBoardTranslateOptions {
  /** 원문 언어. 기본 'ko' */
  source?: MemiBoardLocale
  /** 번역할 언어. 기본: 원문을 뺀 지원 언어 전부 */
  targets?: MemiBoardLocale[]
  /** 무엇을 번역하는지 한 줄 설명(예: 'website navigation menu labels'). 문체를 맞추는 데 쓴다. */
  purpose?: string
}

const REQUEST_TIMEOUT_MS = 30_000
const HTML_TIMEOUT_MS = 45_000
export const HTML_MAX_CHARS = 12_000
const HTML_CONCURRENCY = 3

function cleanModelOutput(value: string): string {
  return value.trim()
    .replace(/^```(?:html|text)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
}

async function mapPool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const index = next++
      out[index] = await fn(items[index]!)
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, () => worker()))
  return out
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`translation timed out after ${ms / 1000}s`)), ms)
    promise.then(
      (value) => { clearTimeout(timer); resolve(value) },
      (error) => { clearTimeout(timer); reject(error) },
    )
  })
}

/**
 * 짧은 UI 문구(메뉴 이름, 게시판 이름 등)를 Firebase AI Logic 으로 여러 언어로 번역한다.
 * 자동으로 저장하지 않는다 — 호출한 쪽이 결과를 보여 주고 저장 여부를 정한다.
 *
 * 항목 하나당 요청 하나. 응답 스키마를 `{ [locale]: { [field]: string } }` 로 고정해
 * 출력 길이가 일정하고, 모델이 같은 줄을 반복하다 토큰 한도에 걸리는 일이 없다.
 */
export function useMemiBoardAutoTranslate() {
  const app = useFirebaseApp()
  const { moderation } = useMemiBoardConfig()

  function getModel(targets: MemiBoardLocale[], fields: string[]) {
    const ai = getAI(app, {
      backend: new GoogleAIBackend(),
      useLimitedUseAppCheckTokens: moderation.useLimitedUseAppCheckTokens !== false,
    })
    const fieldSchema = Schema.object({
      properties: Object.fromEntries(fields.map(field => [field, Schema.string()])),
    })
    return getGenerativeModel(ai, {
      model: moderation.model ?? 'gemini-3.5-flash-lite',
      systemInstruction: [
        'You translate short user-interface strings for a website.',
        'Return natural, concise UI wording a native speaker would expect in a menu or title — not literal word-for-word translations.',
        'Keep proper nouns, brand names, product names and game titles as they are unless they have a well-known localized name.',
        'Use the context only to understand meaning; never translate or output it.',
      ].join('\n'),
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
        responseSchema: Schema.object({
          properties: Object.fromEntries(targets.map(code => [code, fieldSchema])),
        }),
      },
    })
  }

  async function translateOne(
    entry: MemiBoardTranslateEntry,
    source: MemiBoardLocale,
    targets: MemiBoardLocale[],
    purpose: string,
  ): Promise<MemiBoardLocalizedFields> {
    const fields = Object.keys(entry.fields)
    const prompt = [
      `Purpose: ${purpose}`,
      `Source language: ${memiBoardLanguageLabel(source)} (${source})`,
      `Translate into: ${targets.map(code => `${code} = ${memiBoardLanguageLabel(code)}`).join(', ')}`,
      entry.context ? `Context (do not translate): ${entry.context}` : '',
      'Text (JSON):',
      JSON.stringify(entry.fields),
    ].filter(Boolean).join('\n')

    const result = await withTimeout(getModel(targets, fields).generateContent(prompt), REQUEST_TIMEOUT_MS)
    const parsed = JSON.parse(result.response.text()) as Record<string, Record<string, unknown> | undefined>

    const out: MemiBoardLocalizedFields = {}
    for (const code of targets) {
      const row = parsed?.[code]
      if (!row) continue
      const picked: Record<string, string> = {}
      for (const field of fields) {
        const text = typeof row[field] === 'string' ? (row[field] as string).trim() : ''
        if (text) picked[field] = text
      }
      if (Object.keys(picked).length) out[code] = picked
    }
    return out
  }

  /**
   * entries 를 targets 언어로 번역해 `{ [id]: { [locale]: { [field]: text } } }` 로 돌려준다.
   * 빈 필드는 번역하지 않는다. 하나라도 실패하면 reject 한다(30초 제한).
   */
  async function translateEntries(
    entries: MemiBoardTranslateEntry[],
    options: MemiBoardTranslateOptions = {},
  ): Promise<Record<string, MemiBoardLocalizedFields>> {
    const source = options.source ?? DEFAULT_MEMI_BOARD_LOCALE
    const targets = (options.targets ?? MEMI_BOARD_LOCALES.map(item => item.code))
      .filter(code => code !== source)
    const purpose = options.purpose ?? 'website UI labels'

    const cleaned = entries
      .map(entry => ({
        ...entry,
        fields: Object.fromEntries(
          Object.entries(entry.fields).map(([key, value]) => [key, value.trim()]).filter(([, value]) => value),
        ),
      }))
      .filter(entry => Object.keys(entry.fields).length)
    if (!cleaned.length || !targets.length) return {}

    const results = await Promise.all(cleaned.map(entry => translateOne(entry, source, targets, purpose)))
    return Object.fromEntries(cleaned.map((entry, index) => [entry.id, results[index]!]))
  }

  function getHtmlModel() {
    const ai = getAI(app, {
      backend: new GoogleAIBackend(),
      useLimitedUseAppCheckTokens: moderation.useLimitedUseAppCheckTokens !== false,
    })
    return getGenerativeModel(ai, {
      model: moderation.model ?? 'gemini-3.5-flash-lite',
      systemInstruction: [
        'You translate an HTML fragment of a message-board post.',
        'Keep every tag, attribute, URL, class, and image source exactly as written.',
        'Translate only human-readable text nodes.',
        'Output only the HTML fragment. Do not add explanations or markdown code fences.',
      ].join('\n'),
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 8192,
      },
    })
  }

  /**
   * 게시글 본문 HTML 을 언어마다 한 번씩 번역한다.
   * 원문 언어는 넣지 않는다. 12,000자를 넘으면 reject 한다.
   */
  async function translateHtml(
    html: string,
    options: MemiBoardTranslateOptions = {},
  ): Promise<Partial<Record<MemiBoardLocale, string>>> {
    const source = options.source ?? DEFAULT_MEMI_BOARD_LOCALE
    const targets = (options.targets ?? MEMI_BOARD_LOCALES.map(item => item.code))
      .filter(code => code !== source)
    const text = html.trim()
    if (!text || !targets.length) return {}
    if (text.length > HTML_MAX_CHARS) {
      throw new Error(`translation is limited to ${HTML_MAX_CHARS} characters`)
    }

    const rows = await mapPool(targets, HTML_CONCURRENCY, async (code) => {
      const prompt = [
        `Source language: ${memiBoardLanguageLabel(source)} (${source})`,
        `Translate into: ${code} = ${memiBoardLanguageLabel(code)}`,
        'HTML:',
        text,
      ].join('\n')
      const result = await withTimeout(getHtmlModel().generateContent(prompt), HTML_TIMEOUT_MS)
      const output = cleanModelOutput(result.response.text())
      if (!output) throw new Error(`empty translation for ${code}`)
      return [code, output] as const
    })
    return Object.fromEntries(rows)
  }

  return { translateEntries, translateHtml }
}

export { localizedText, mergeSourceFields }
