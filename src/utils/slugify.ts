/** 새 게시판 이름. 이 문자열이 주소가 되므로 메뉴와 주소창에 들어가는 길이로 둔다. */
export const BOARD_NAME_MAX = 40

/**
 * 제목 문자열을 URL-friendly slug로 변환
 * e.g. "게시판 모듈 만들기!!" → "게시판-모듈-만들기"
 */
export function slugify(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, '-') // 공백(연속 포함) → 하이픈
    .replace(/[^a-zA-Z0-9가-힣ㄱ-ㅎㅏ-ㅣ-]/g, '') // 허용 문자 외 제거
    .replace(/-+/g, '-') // 연속 하이픈 → 단일 하이픈
    .replace(/^-+|-+$/g, '') // 앞뒤 하이픈 제거
}

/** Storage 경로/파일명에 안전한 문자열로 변환 (한글은 유지) */
export function safeFileName(name: string, maxLength = 60): string {
  const safe = name.replace(/[^a-zA-Z0-9가-힣ㄱ-ㅎ._-]/g, '-')
  if (safe.length <= maxLength) return safe
  // 확장자는 남긴다 — 내려받은 파일 이름과 storage.rules 의 형식 검사가 확장자를 본다.
  const dot = safe.lastIndexOf('.')
  const ext = dot > 0 && safe.length - dot <= 10 ? safe.slice(dot) : ''
  return safe.slice(0, maxLength - ext.length) + ext
}
