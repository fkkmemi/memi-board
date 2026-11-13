/** 프로필 이름·소개 최대 글자 수. memi-dev 의 firestore.rules 와 같은 값으로 맞춘다. */
export const PROFILE_NAME_MAX = 50
export const PROFILE_BIO_MAX = 200

/** 저장 전에 이름을 규칙 한도에 맞춘다. 비어 있으면 null. */
export function clampProfileName(name: string | null | undefined): string | null {
  const trimmed = (name ?? '').trim()
  return trimmed ? trimmed.slice(0, PROFILE_NAME_MAX) : null
}
