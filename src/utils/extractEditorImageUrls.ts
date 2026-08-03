/**
 * 에디터 본문(markdown 또는 html)에서 이미지 URL 추출.
 * 고아 파일 정리 스케줄러·저장 시 참조 비교에 사용.
 */
export function extractEditorImageUrls(content: string): string[] {
  if (!content) return []
  const urls = new Set<string>()

  for (const m of content.matchAll(/!\[[^\]]*]\((https?:\/\/[^)\s]+)\)/g)) {
    if (m[1]) urls.add(m[1].replaceAll('&amp;', '&'))
  }
  for (const m of content.matchAll(/<img[^>]*\ssrc=["'](https?:\/\/[^"']+)["']/gi)) {
    if (m[1]) urls.add(m[1].replaceAll('&amp;', '&'))
  }

  return [...urls]
}
