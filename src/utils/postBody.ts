/**
 * 게시글 본문 HTML 검증.
 * 이미지만·영상만·빈 태그만 있으면 "글자 없음"으로 본다.
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

/** 본문에 실제 글자가 있는지 (이미지·유튜브만이면 false) */
export function hasBodyText(html: string): boolean {
  return plainTextFromHtml(html).length > 0
}

export function isContentEmpty(html: string): boolean {
  return !hasBodyText(html)
}
