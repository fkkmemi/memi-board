import type { Timestamp } from 'firebase/firestore'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/ko'

dayjs.extend(relativeTime)
dayjs.locale('ko')

export function formatDate(ts: Timestamp | undefined): string {
  return ts?.toDate ? ts.toDate().toLocaleDateString('ko-KR') : ''
}

export function formatRelativeDate(ts: Timestamp | undefined, now = Date.now()): string {
  return ts?.toDate ? dayjs(ts.toDate()).from(dayjs(now)) : '방금 전'
}

export function formatFullDate(ts: Timestamp | undefined): string {
  return ts?.toDate ? dayjs(ts.toDate()).format('YYYY년 M월 D일 HH:mm:ss') : '시간 확인 중'
}

/** 생성·수정 시각이 같거나 수정 시각이 없으면 한 줄, 실제 수정됐으면 두 줄. */
export function formatTimestampDetails(createdAt: Timestamp | undefined, updatedAt?: Timestamp): string[] {
  const created = formatFullDate(createdAt)
  const createdMs = createdAt?.toMillis?.()
  const updatedMs = updatedAt?.toMillis?.()
  if (updatedMs == null || createdMs == null || createdMs === updatedMs) return [created]
  return [`생성시간: ${created}`, `수정시간: ${formatFullDate(updatedAt)}`]
}
