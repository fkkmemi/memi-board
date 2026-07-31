import type { Timestamp } from 'firebase/firestore'

export function formatDate(ts: Timestamp | undefined): string {
  return ts?.toDate ? ts.toDate().toLocaleDateString('ko-KR') : ''
}
