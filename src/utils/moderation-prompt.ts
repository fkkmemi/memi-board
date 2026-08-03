export const MODERATION_SYSTEM = `당신은 게시판 콘텐츠를 심사하는 엄격한 모더레이터입니다.
아래 텍스트에 욕설·비속어·성희롱·혐오·위협·스팸·도배성 광고가 있으면 반드시 거부(flagged=true)합니다.

flagged=true 예:
- 욕설/비속어: 씨발, 시발, 병신, 지랄, 좆, 개새끼, 존나, fuck, shit, bitch 등
- 성적 모욕, 혐오 발언, 협박
- 게시판 주제와 무관한 도배성 광고/스팸

flagged=false:
- 게시판 주제에 맞는 정상적인 글/댓글 (강한 의견이나 정당한 비판은 허용)

JSON만 출력:
{"flagged":boolean,"category":"none"|"abuse"|"spam"|"adult"|"violence"|"other","reason":string}
- flagged=true면 category를 고르고, reason은 한국어로 **무엇이 문제인지** 구체적으로 1문장
  (예: "욕설(비속어)이 포함되어 게시할 수 없습니다.", "광고·스팸성 문구가 있어 게시할 수 없습니다.")
  욕설 단어 전체를 그대로 길게 인용하지 말고, 유형(욕설/혐오/스팸 등)을 분명히 밝힌다.
- flagged=false면 category는 "none", reason은 ""`

/** 사용자 안내용 카테고리 라벨 */
export const MODERATION_CATEGORY_LABELS: Record<string, string> = {
  abuse: '욕설·비속어·모욕',
  spam: '스팸·광고',
  adult: '선정적·성인 내용',
  violence: '폭력·위협',
  other: '부적절한 내용',
  none: '',
}

/** 차단 사유를 사용자에게 읽기 쉽게 정리 */
export function formatModerationUserReason(opts: {
  reason?: string
  category?: string
  via?: string
  localHit?: string
}): string {
  if (opts.via === 'local' && opts.localHit) {
    const hit = opts.localHit.trim()
    // 짧은 금칙어만 표시 (너무 길면 유형만)
    if (hit.length > 0 && hit.length <= 12) {
      return `「${hit}」 같은 표현은 사용할 수 없습니다. 다른 말로 바꿔 주세요.`
    }
    return '욕설·비속어가 포함되어 게시할 수 없습니다. 표현을 바꿔 주세요.'
  }

  const raw = (opts.reason || '').trim()
  if (raw) return raw

  const cat = opts.category && opts.category !== 'none'
    ? MODERATION_CATEGORY_LABELS[opts.category] || opts.category
    : ''
  if (cat) return `${cat}이(가) 포함되어 게시할 수 없습니다. 내용을 수정해 주세요.`
  return '게시할 수 없는 내용이 포함되어 있습니다. 내용을 수정해 주세요.'
}

/** API 없이도 1차로 걸러내는 한국어/영어 비속어 (부분 문자열 매칭) */
export const DEFAULT_LOCAL_BLOCKLIST = [
  '씨발', '시발', '시이발', '씨팔', '시팔', '병신', '븅신', '지랄', '좆', '존나',
  '개새끼', '개새', '새끼', '꺼져', '닥쳐', '씹', '니미', '느금', '애미', '애비',
  'fuck', 'shit', 'bitch', 'asshole',
]

export function buildLocalBlockRegex(patterns: string[]): RegExp {
  return new RegExp(patterns.join('|'), 'i')
}

const CATEGORIES = new Set(['none', 'abuse', 'spam', 'adult', 'violence', 'other'])

export function parseModerationJson(raw: string): { flagged: boolean, category: string, reason: string } | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  }
  catch {
    const match = trimmed.match(/\{[\s\S]*\}/)
    if (!match) return null
    try {
      parsed = JSON.parse(match[0])
    }
    catch {
      return null
    }
  }

  if (typeof parsed !== 'object' || parsed === null) return null
  const obj = parsed as Record<string, unknown>
  if (typeof obj.flagged !== 'boolean') return null

  const category = typeof obj.category === 'string' && CATEGORIES.has(obj.category) ? obj.category : (obj.flagged ? 'other' : 'none')
  const reason = typeof obj.reason === 'string' ? obj.reason : ''
  return { flagged: obj.flagged, category, reason }
}
