import { shallowRef, type Ref } from 'vue'
import {
  DEFAULT_MEMI_BOARD_LOCALE,
  FALLBACK_MEMI_BOARD_LOCALE,
  type MemiBoardLocale,
} from './locales'
import ko from './messages/ko'

export interface MemiBoardMessages {
  [key: string]: string | MemiBoardMessages
}

export type MemiBoardMessageParams = Record<string, string | number | null | undefined>

/**
 * 언어별 번역은 필요할 때만 받는다(언어당 별도 청크).
 * ko 는 원문이자 최종 폴백이라 코어 번들에 들어간다.
 */
const loaders: Record<Exclude<MemiBoardLocale, 'ko'>, () => Promise<{ default: MemiBoardMessages }>> = {
  en: () => import('./messages/en'),
  ja: () => import('./messages/ja'),
  de: () => import('./messages/de'),
  fr: () => import('./messages/fr'),
  es: () => import('./messages/es'),
  pt: () => import('./messages/pt'),
  zh: () => import('./messages/zh'),
  ar: () => import('./messages/ar'),
  id: () => import('./messages/id'),
}

const GLOBAL_KEY = '__MEMI_BOARD_I18N__' as const

interface I18nStore {
  messages: Partial<Record<MemiBoardLocale, MemiBoardMessages>>
  pending: Partial<Record<MemiBoardLocale, Promise<void>>>
  /** 언어 파일이 도착하면 올라가서 t() 를 쓰는 화면을 다시 그린다. */
  version: Ref<number>
}

function store(): I18nStore {
  const g = globalThis as typeof globalThis & { [GLOBAL_KEY]?: I18nStore }
  g[GLOBAL_KEY] ??= { messages: { ko }, pending: {}, version: shallowRef(0) }
  return g[GLOBAL_KEY]
}

function loadOne(locale: MemiBoardLocale): Promise<void> {
  const s = store()
  if (s.messages[locale]) return Promise.resolve()
  if (locale === 'ko') return Promise.resolve()
  s.pending[locale] ??= loaders[locale]()
    .then((mod) => {
      s.messages[locale] = mod.default
      s.version.value++
    })
    .catch((error) => {
      delete s.pending[locale]
      console.warn(`[memi-board] failed to load locale "${locale}"`, error)
    })
  return s.pending[locale]!
}

/** 해당 언어와 폴백(en) 번역을 받아 둔다. 이미 받았으면 바로 끝난다. */
export function loadMemiBoardLocale(locale: MemiBoardLocale): Promise<void> {
  if (locale === 'ko') return Promise.resolve()
  return Promise.all([loadOne(locale), loadOne(FALLBACK_MEMI_BOARD_LOCALE)]).then(() => undefined)
}

export function isMemiBoardLocaleLoaded(locale: MemiBoardLocale): boolean {
  return !!store().messages[locale]
}

function lookup(tree: MemiBoardMessages | undefined, key: string): string | undefined {
  let node: string | MemiBoardMessages | undefined = tree
  for (const part of key.split('.')) {
    if (!node || typeof node === 'string') return undefined
    node = node[part]
  }
  return typeof node === 'string' ? node : undefined
}

function interpolate(text: string, params?: MemiBoardMessageParams): string {
  if (!params) return text
  return text.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name]
    return value == null ? match : String(value)
  })
}

/**
 * 키 하나를 번역한다. 언어 → en → ko 순으로 찾는다.
 * 아직 받지 않은 언어는 건너뛰므로, 파일이 오기 전 잠깐은 폴백 문구가 보일 수 있다.
 * 반응형 의존성을 걸어 두어 파일이 도착하면 다시 계산된다.
 */
export function translate(
  locale: MemiBoardLocale | undefined,
  key: string,
  params?: MemiBoardMessageParams,
): string {
  const s = store()
  void s.version.value
  const code = locale ?? DEFAULT_MEMI_BOARD_LOCALE
  const text = lookup(s.messages[code], key)
    ?? (code === 'ko' ? undefined : lookup(s.messages[FALLBACK_MEMI_BOARD_LOCALE], key))
    ?? lookup(s.messages.ko, key)
  return text == null ? key : interpolate(text, params)
}
