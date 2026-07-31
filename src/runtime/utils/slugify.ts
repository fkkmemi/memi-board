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
  return name.replace(/[^a-zA-Z0-9가-힣ㄱ-ㅎ._-]/g, '-').slice(0, maxLength)
}
