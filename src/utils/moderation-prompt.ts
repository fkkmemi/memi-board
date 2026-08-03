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
- flagged=true면 category는 상황에 맞게 고르고, reason은 한국어 1문장 (예: "욕설이 포함되어 있어 게시할 수 없습니다.")
- flagged=false면 category는 "none", reason은 ""`

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
