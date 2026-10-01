import {
  computed,
  getCurrentInstance,
  hasInjectionContext,
  inject,
  onServerPrefetch,
  provide,
  toValue,
  watch,
  type ComputedRef,
  type InjectionKey,
  type MaybeRefOrGetter,
} from 'vue'
import { useMemiBoardConfig } from '../config'
import {
  DEFAULT_MEMI_BOARD_LOCALE,
  memiBoardLocaleInfo,
  normalizeMemiBoardLocale,
  type MemiBoardLocale,
} from './locales'
import { loadMemiBoardLocale, translate, type MemiBoardMessageParams } from './translate'
import {
  formatDate,
  formatFullDate,
  formatRelativeDate,
  formatTimestampDetails,
} from '../utils/formatDate'
import type { Timestamp } from 'firebase/firestore'

/**
 * 호스트 언어. memi-board Nuxt 플러그인이 @nuxtjs/i18n 의 locale 을 앱 단위로 provide 한다.
 * 문자열 키 — dist 번들과 호스트 컴파일 플러그인이 같은 키를 보게 한다.
 */
export const memiBoardHostLocaleKey = 'memiBoard:hostLocale' as unknown as InjectionKey<MaybeRefOrGetter<string | undefined | null>>
/** 보드 단위 언어. 보드 화면(List·Detail·Editor)이 provide 하고 자식(댓글 등)이 따른다. */
const boardLocaleKey: InjectionKey<ComputedRef<MemiBoardLocale>> = Symbol('memiBoard:boardLocale')

export interface UseMemiBoardI18nOptions {
  /**
   * 보드 설정의 언어(`BoardModel.locale`). 비어 있으면 호스트 언어를 따른다.
   * 넘기면 이 컴포넌트 아래 자식들도 같은 언어를 쓴다.
   */
  boardLocale?: MaybeRefOrGetter<string | undefined | null>
}

export function useMemiBoardI18n(options: UseMemiBoardI18nOptions = {}) {
  const canInject = hasInjectionContext()
  const parentLocale = canInject ? inject(boardLocaleKey, null) : null
  const hostLocale = canInject ? inject(memiBoardHostLocaleKey, null) : null
  const config = useMemiBoardConfig()

  const locale = computed<MemiBoardLocale>(() =>
    normalizeMemiBoardLocale(toValue(options.boardLocale))
    ?? parentLocale?.value
    ?? normalizeMemiBoardLocale(toValue(hostLocale))
    ?? normalizeMemiBoardLocale(config.locale)
    ?? DEFAULT_MEMI_BOARD_LOCALE,
  )

  if (options.boardLocale !== undefined && canInject) provide(boardLocaleKey, locale)

  watch(locale, value => void loadMemiBoardLocale(value), { immediate: true })
  if (getCurrentInstance()) onServerPrefetch(() => loadMemiBoardLocale(locale.value))

  const info = computed(() => memiBoardLocaleInfo(locale.value))

  return {
    locale,
    /** 'ltr' | 'rtl' — 보드 루트 요소의 dir 속성에 쓴다. */
    dir: computed(() => info.value.dir),
    /** Intl 로케일 태그(예: 'ko-KR'). */
    intlLocale: computed(() => info.value.intl),
    t: (key: string, params?: MemiBoardMessageParams) => translate(locale.value, key, params),
    formatDate: (ts: Timestamp | undefined) => formatDate(ts, locale.value),
    formatFullDate: (ts: Timestamp | undefined) => formatFullDate(ts, locale.value),
    formatRelativeDate: (ts: Timestamp | undefined, now?: number) => formatRelativeDate(ts, now, locale.value),
    formatTimestampDetails: (createdAt: Timestamp | undefined, updatedAt?: Timestamp) =>
      formatTimestampDetails(createdAt, updatedAt, locale.value),
    /** 숫자를 현재 언어 형식으로(예: 1,234). */
    formatNumber: (value: number) => value.toLocaleString(info.value.intl),
  }
}

export type MemiBoardI18n = ReturnType<typeof useMemiBoardI18n>
