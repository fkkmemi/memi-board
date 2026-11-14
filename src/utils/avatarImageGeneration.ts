const NAME_MAX = 50
const BIO_MAX = 200
const REQUEST_MAX = 500

/**
 * 프로필 사진을 만드는 프롬프트. 이름·소개는 분위기를 잡는 참고 데이터(JSON)이고 지시문이 아니다.
 * 사용자가 쓴 프롬프트(request)가 있으면 그것이 우선이다.
 */
export function avatarImagePrompt(input: { name?: string, bio?: string, request?: string }): string {
  const request = input.request?.trim().slice(0, REQUEST_MAX) ?? ''
  return [
    'Generate one square profile picture (avatar) for a community message board member.',
    'The subject must be a single centered figure, object or emblem that stays readable when cropped to a circle and shown very small.',
    'Use a simple, uncluttered background and a bold, friendly composition with clear shapes.',
    request
      ? 'Follow the "request" field for the subject, style and palette; use the member context only to fill in what it leaves open.'
      : 'No request was given: invent a fitting illustrated avatar from the member context, or a pleasant abstract emblem if there is none.',
    'Do not depict a real, identifiable person. Do not include text, letters, typography, logos, borders, or watermarks unless the request explicitly asks for them.',
    'Member context (JSON):',
    JSON.stringify({
      name: input.name?.trim().slice(0, NAME_MAX) ?? '',
      bio: input.bio?.trim().slice(0, BIO_MAX) ?? '',
      ...(request ? { request } : {}),
    }),
  ].join('\n')
}
