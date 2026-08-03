/**
 * 게시판 검열 차단 누적 → 일시 이용 제한 (호스트 contentWarning 과 동일 모델).
 * - 콘텐츠 차단(로컬/AI flagged) 시 +1
 * - 유효 경고 ≥ threshold(기본 3) → 글/댓글 작성 불가
 * - 24h마다 lazy 차감 (moderationBlockAt 기준)
 */

export const DEFAULT_BLOCK_BAN_THRESHOLD = 3
export const DEFAULT_BLOCK_BAN_DECAY_MS = 24 * 60 * 60 * 1000

export function effectiveModerationBlockCount(
  count: number | null | undefined,
  blockAtMs: number | null | undefined,
  nowMs: number = Date.now(),
  decayMs: number = DEFAULT_BLOCK_BAN_DECAY_MS,
): number {
  const c = Math.max(0, Math.floor(Number(count) || 0))
  if (c <= 0) return 0
  const at = typeof blockAtMs === 'number' && Number.isFinite(blockAtMs) ? blockAtMs : null
  if (at == null) return c
  if (nowMs <= at) return c
  const decayed = Math.floor((nowMs - at) / decayMs)
  return Math.max(0, c - decayed)
}

/** 제한 해제 시각(ms). 제한 없으면 null. */
export function moderationWriteRestrictedUntilMs(
  count: number | null | undefined,
  blockAtMs: number | null | undefined,
  nowMs: number = Date.now(),
  threshold: number = DEFAULT_BLOCK_BAN_THRESHOLD,
  decayMs: number = DEFAULT_BLOCK_BAN_DECAY_MS,
): number | null {
  const c = Math.max(0, Math.floor(Number(count) || 0))
  if (c < threshold) return null
  const at = typeof blockAtMs === 'number' && Number.isFinite(blockAtMs) ? blockAtMs : null
  if (at == null) return nowMs
  // 유효 경고가 threshold-1 이하가 되는 시점
  const until = at + (c - (threshold - 1)) * decayMs
  return until > nowMs ? until : null
}

export function isModerationWriteRestricted(
  count: number | null | undefined,
  blockAtMs: number | null | undefined,
  nowMs: number = Date.now(),
  threshold: number = DEFAULT_BLOCK_BAN_THRESHOLD,
  decayMs: number = DEFAULT_BLOCK_BAN_DECAY_MS,
): boolean {
  return moderationWriteRestrictedUntilMs(count, blockAtMs, nowMs, threshold, decayMs) != null
}

export function formatRestrictedUntilLabel(untilMs: number, nowMs: number = Date.now()): string {
  const left = Math.max(0, untilMs - nowMs)
  const hours = Math.ceil(left / (60 * 60 * 1000))
  if (hours <= 0) return '곧 해제'
  if (hours < 24) return `약 ${hours}시간 후 해제`
  const days = Math.floor(hours / 24)
  const remH = hours % 24
  if (remH === 0) return `약 ${days}일 후 해제`
  return `약 ${days}일 ${remH}시간 후 해제`
}

export function toBlockAtMs(value: unknown): number | null {
  if (value == null) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'object' && value !== null && 'toMillis' in value
    && typeof (value as { toMillis: () => number }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis()
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    const s = Number((value as { seconds: number }).seconds)
    if (Number.isFinite(s)) return s * 1000
  }
  return null
}
