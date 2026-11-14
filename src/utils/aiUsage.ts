/** AI 사용 횟수는 24시간 구간 단위로 센다. 글쓰기와 그림은 서로 다른 필드를 쓴다. */
export const AI_USAGE_WINDOW_MS = 24 * 60 * 60 * 1000

export type AiUsageKind = 'writing' | 'image'

/** 사용자 문서의 필드 이름. 글쓰기는 0.47.1부터 쓰던 이름을 그대로 둔다. */
export const AI_USAGE_FIELDS = {
  writing: { count: 'aiWritingCount', pending: 'aiWritingPending', windowAt: 'aiWritingWindowAt' },
  image: { count: 'aiImageCount', pending: 'aiImagePending', windowAt: 'aiImageWindowAt' },
} as const

function timestampMs(value: unknown): number | null {
  if (!value || typeof value !== 'object') return null
  const toMillis = (value as { toMillis?: () => number }).toMillis
  return typeof toMillis === 'function' ? toMillis.call(value) : null
}

/** 현재 구간의 확정 횟수와 예약 횟수. 구간이 끝났으면 0으로 본다. */
export function aiUsageOf(data: Record<string, unknown> | null | undefined, kind: AiUsageKind, now: number) {
  const fields = AI_USAGE_FIELDS[kind]
  const windowAt = timestampMs(data?.[fields.windowAt])
  const active = windowAt != null && now - windowAt < AI_USAGE_WINDOW_MS
  const count = Math.max(0, Math.floor(Number(data?.[fields.count]) || 0))
  const pending = Math.max(0, Math.floor(Number(data?.[fields.pending]) || 0))
  return {
    active,
    windowAt,
    count: active ? count : 0,
    pending: active ? pending : 0,
  }
}

/** 화면 표시용: 사용한 횟수(예약 포함)와 초기화까지 남은 시간(시). */
export function aiUsageSummary(data: Record<string, unknown> | null | undefined, kind: AiUsageKind, limit: number, now: number) {
  const usage = aiUsageOf(data, kind, now)
  const used = Math.min(limit, usage.count + usage.pending)
  const hours = usage.active && usage.windowAt != null
    // 이 기기 시계가 서버보다 늦으면 25시간처럼 나올 수 있어 24시간으로 막는다.
    ? Math.min(24, Math.max(1, Math.ceil((usage.windowAt + AI_USAGE_WINDOW_MS - now) / (60 * 60 * 1000))))
    : 0
  return { used, limit, remaining: Math.max(0, limit - used), hours }
}
