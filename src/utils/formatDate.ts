import type { Timestamp } from 'firebase/firestore'
import { DEFAULT_MEMI_BOARD_LOCALE, memiBoardLocaleInfo, type MemiBoardLocale } from '../i18n/locales'
import { translate } from '../i18n/translate'

function intl(locale: MemiBoardLocale | undefined): string {
  return memiBoardLocaleInfo(locale ?? DEFAULT_MEMI_BOARD_LOCALE).intl
}

export function formatDate(ts: Timestamp | undefined, locale?: MemiBoardLocale): string {
  return ts?.toDate ? ts.toDate().toLocaleDateString(intl(locale)) : ''
}

const MINUTE = 60
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** dayjs relativeTime 기본 구간과 같은 기준으로 반올림한다. */
export function formatRelativeDate(ts: Timestamp | undefined, now = Date.now(), locale?: MemiBoardLocale): string {
  if (!ts?.toDate) return translate(locale, 'common.date.justNow')
  const seconds = Math.max(0, Math.round((now - ts.toDate().getTime()) / 1000))
  if (seconds < 45) return translate(locale, 'common.date.fewSecondsAgo')
  const rtf = new Intl.RelativeTimeFormat(intl(locale), { numeric: 'always' })
  const days = seconds / DAY
  if (seconds < 90) return rtf.format(-1, 'minute')
  if (seconds < 45 * MINUTE) return rtf.format(-Math.round(seconds / MINUTE), 'minute')
  if (seconds < 90 * MINUTE) return rtf.format(-1, 'hour')
  if (seconds < 22 * HOUR) return rtf.format(-Math.round(seconds / HOUR), 'hour')
  if (seconds < 36 * HOUR) return rtf.format(-1, 'day')
  if (days < 26) return rtf.format(-Math.round(days), 'day')
  if (days < 46) return rtf.format(-1, 'month')
  if (days < 320) return rtf.format(-Math.round(days / 30.4), 'month')
  if (days < 548) return rtf.format(-1, 'year')
  return rtf.format(-Math.round(days / 365), 'year')
}

export function formatFullDate(ts: Timestamp | undefined, locale?: MemiBoardLocale): string {
  if (!ts?.toDate) return translate(locale, 'common.date.checking')
  return new Intl.DateTimeFormat(intl(locale), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(ts.toDate())
}

/** 생성·수정 시각이 같거나 수정 시각이 없으면 한 줄, 실제 수정됐으면 두 줄. */
export function formatTimestampDetails(
  createdAt: Timestamp | undefined,
  updatedAt?: Timestamp,
  locale?: MemiBoardLocale,
): string[] {
  const created = formatFullDate(createdAt, locale)
  const createdMs = createdAt?.toMillis?.()
  const updatedMs = updatedAt?.toMillis?.()
  if (updatedMs == null || createdMs == null || createdMs === updatedMs) return [created]
  return [
    translate(locale, 'common.date.createdAt', { time: created }),
    translate(locale, 'common.date.updatedAt', { time: formatFullDate(updatedAt, locale) }),
  ]
}
