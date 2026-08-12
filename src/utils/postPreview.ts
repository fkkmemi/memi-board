import type { Attachment } from '../types'

function decodeHtmlAttribute(value: string): string {
  return value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
}

/** YouTube watch/embed/shorts/youtu.be URL 에서 video id 추출. 아니면 undefined. */
export function youtubeId(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(decodeHtmlAttribute(value))
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    if (host === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0]
    if (host.endsWith('youtube.com') || host === 'youtube-nocookie.com') {
      if (url.pathname.startsWith('/embed/')) return url.pathname.split('/')[2]
      if (url.pathname.startsWith('/shorts/')) return url.pathname.split('/')[2]
      return url.searchParams.get('v') || undefined
    }
  }
  catch {
    return undefined
  }
}

/** 영상 목록 카드용 커버: YouTube 썸네일 우선, 없으면 previewImage/이미지 첨부. */
export function videoListCoverUrl(post: {
  videoUrl?: string
  previewImage?: string
  attachments?: Attachment[]
}): string | undefined {
  const id = youtubeId(post.videoUrl)
  if (id) return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
  return post.previewImage
    || post.attachments?.find(item => item.type.startsWith('image/'))?.url
}

export function buildPostPreview(content: string, attachments: Attachment[] = []): {
  summary: string
  previewImage?: string
  videoUrl?: string
} {
  const imageMatch = content.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)
  const iframeMatch = content.match(/<iframe\b[^>]*\bsrc=["']([^"']+)["']/i)
  const attachmentImage = attachments.find(item => item.type.startsWith('image/'))?.url
  const attachmentVideo = attachments.find(item => item.type.startsWith('video/'))?.url
  const videoUrl = iframeMatch ? decodeHtmlAttribute(iframeMatch[1]!) : attachmentVideo
  const videoId = videoUrl ? youtubeId(videoUrl) : undefined
  const previewImage = imageMatch
    ? decodeHtmlAttribute(imageMatch[1]!)
    : attachmentImage || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined)
  // 문단·<br> 경계를 줄바꿈으로 살려둔다 — 안 그러면 두 줄로 쓴 글도 한 줄로 뭉개져서
  // 목록의 2줄 클램프(line-clamp-2)가 "줄바꿈해서 2줄"이 아니라 "넘쳐서 2줄"에만 반응한다.
  const summary = content
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim()
    .slice(0, 160)

  return { summary, ...(previewImage ? { previewImage } : {}), ...(videoUrl ? { videoUrl } : {}) }
}
