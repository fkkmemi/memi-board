/**
 * 게시글 본문 HTML 검증·파생 필드.
 * - 일반 보드: 글자 필수 (이미지만 불가)
 * - 이미지 리스트뷰 보드: 글자 + 이미지 필수, 제목은 본문에서 자동 생성
 */

/** 미디어·태그를 제거하고 보이는 글자만 남긴다. */
export function plainTextFromHtml(html: string): string {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<img\b[^>]*>/gi, ' ')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, ' ')
    .replace(/<video\b[\s\S]*?<\/video>/gi, ' ')
    .replace(/<audio\b[\s\S]*?<\/audio>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#160;/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/&#\d+;/g, ' ')
    // zero-width / soft hyphen 등
    .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 이미지 보드 등 제목 미입력 시 본문 plain 앞부분을 title 로 쓴다.
 * summary(160) 보다 짧게 — 목록·탭·OG 한 줄용.
 */
export function titleFromBody(html: string, maxLength = 40): string {
  const plain = plainTextFromHtml(html)
  if (!plain) return ''
  if (plain.length <= maxLength) return plain
  // 단어 중간 자르기 완화: 마지막 공백 근처에서 끊기
  const slice = plain.slice(0, maxLength)
  const sp = slice.lastIndexOf(' ')
  const cut = sp >= Math.floor(maxLength * 0.6) ? slice.slice(0, sp) : slice
  return `${cut.trimEnd()}…`
}

/** 본문에 실제 글자가 있는지 (이미지·유튜브만이면 false) */
export function hasBodyText(html: string): boolean {
  return plainTextFromHtml(html).length > 0
}

/** 본문 HTML 또는 이미지 첨부 중 하나라도 있으면 true */
export function hasBodyImage(
  html: string,
  attachments?: Array<{ type?: string } | null> | null,
): boolean {
  if (/<img\b/i.test(String(html || ''))) return true
  return (attachments || []).some(a => !!a?.type?.startsWith('image/'))
}

export function isContentEmpty(html: string): boolean {
  return !hasBodyText(html)
}
