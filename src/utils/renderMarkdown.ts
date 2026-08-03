/**
 * 게시글 상세용 가벼운 마크다운 → HTML (TipTap 없이).
 * 목록 이동 시 UEditor destroy/recreate 로 나는
 * "Adding different instances of a keyed plugin" 를 피한다.
 * 신뢰된 작성자 콘텐츠 전제 — 기본 이스케이프 후 허용 패턴만 복원.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 인라인 마크다운 (이미 escape 된 문자열에 적용) */
function formatInline(s: string): string {
  let out = s
  // code
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>')
  // images ![alt](url) — url 은 http(s) 만
  out = out.replace(
    /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g,
    '<img src="$2" alt="$1" class="max-w-full h-auto rounded-lg my-3" loading="lazy" />',
  )
  // links [text](url)
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary underline">$1</a>',
  )
  // bold ** ** 먼저
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  // italic * * (bold 처리 후 남은 단일 *)
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  // strikethrough ~~
  out = out.replace(/~~([^~]+)~~/g, '<del>$1</del>')
  return out
}

/**
 * GFM-ish 최소 변환. 코드 펜스·목록·제목·인용·hr·단락.
 */
export function renderMarkdownToHtml(markdown: string): string {
  if (!markdown?.trim()) return ''

  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const blocks: string[] = []
  let i = 0
  let inCode = false
  let codeLang = ''
  let codeBuf: string[] = []
  let listType: 'ul' | 'ol' | null = null
  let listItems: string[] = []

  function flushList() {
    if (!listType || !listItems.length) {
      listType = null
      listItems = []
      return
    }
    const tag = listType
    blocks.push(`<${tag}>${listItems.map(li => `<li>${formatInline(li)}</li>`).join('')}</${tag}>`)
    listType = null
    listItems = []
  }

  while (i < lines.length) {
    const line = lines[i] ?? ''

    // fenced code
    const fence = line.match(/^```(\w*)\s*$/)
    if (fence) {
      if (inCode) {
        blocks.push(
          `<pre class="overflow-x-auto rounded-lg bg-muted p-3 text-sm"><code>${codeBuf.join('\n')}</code></pre>`,
        )
        codeBuf = []
        inCode = false
        codeLang = ''
      }
      else {
        flushList()
        inCode = true
        codeLang = fence[1] || ''
        void codeLang
      }
      i++
      continue
    }
    if (inCode) {
      codeBuf.push(escapeHtml(line))
      i++
      continue
    }

    // hr
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flushList()
      blocks.push('<hr class="my-4 border-default" />')
      i++
      continue
    }

    // heading
    const h = line.match(/^(#{1,3})\s+(.+)$/)
    if (h) {
      flushList()
      const level = h[1]!.length
      blocks.push(`<h${level} class="font-semibold mt-4 mb-2">${formatInline(escapeHtml(h[2]!))}</h${level}>`)
      i++
      continue
    }

    // blockquote
    if (line.startsWith('> ')) {
      flushList()
      const quoteLines: string[] = []
      while (i < lines.length && (lines[i] ?? '').startsWith('> ')) {
        quoteLines.push(escapeHtml((lines[i] ?? '').slice(2)))
        i++
      }
      blocks.push(
        `<blockquote class="border-l-4 border-default pl-3 text-muted my-3">${formatInline(quoteLines.join('<br />'))}</blockquote>`,
      )
      continue
    }

    // unordered list
    const ul = line.match(/^[-*+]\s+(.+)$/)
    if (ul) {
      if (listType && listType !== 'ul') flushList()
      listType = 'ul'
      listItems.push(escapeHtml(ul[1]!))
      i++
      continue
    }

    // ordered list
    const ol = line.match(/^\d+\.\s+(.+)$/)
    if (ol) {
      if (listType && listType !== 'ol') flushList()
      listType = 'ol'
      listItems.push(escapeHtml(ol[1]!))
      i++
      continue
    }

    // empty line
    if (!line.trim()) {
      flushList()
      i++
      continue
    }

    // paragraph (merge consecutive non-empty)
    flushList()
    const para: string[] = []
    while (i < lines.length) {
      const l = lines[i] ?? ''
      if (!l.trim()) break
      if (/^(#{1,3}\s|```|[-*+]\s|\d+\.\s|> |(-{3,}|\*{3,})\s*$)/.test(l)) break
      para.push(escapeHtml(l))
      i++
    }
    blocks.push(`<p class="my-2 leading-relaxed">${formatInline(para.join('<br />'))}</p>`)
  }

  flushList()
  if (inCode && codeBuf.length) {
    blocks.push(
      `<pre class="overflow-x-auto rounded-lg bg-muted p-3 text-sm"><code>${codeBuf.join('\n')}</code></pre>`,
    )
  }

  return blocks.join('\n')
}
