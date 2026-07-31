import { reactive } from 'vue'

export interface MemiBoardAuthOptions {
  providers?: Array<'google' | 'apple' | 'emailPassword'>
}

export interface MemiBoardModerationOptions {
  enabled?: boolean
  model?: string
  localBlocklist?: string[]
  onError?: 'allow' | 'block'
  moderateImages?: boolean
}

export interface MemiBoardConfig {
  collectionPrefix: string
  auth: MemiBoardAuthOptions
  moderation: MemiBoardModerationOptions
}

const config = reactive<MemiBoardConfig>({
  collectionPrefix: 'memiBoard',
  auth: { providers: ['google', 'apple'] },
  moderation: { enabled: true, model: 'gemini-2.5-flash', onError: 'allow', moderateImages: false, localBlocklist: [] },
})

/**
 * 앱 부팅 시(플러그인 등에서) 한 번 호출한다. 모든 요청/세션이 같은 값을 보므로
 * 서버 렌더링에서도 안전하다 — 사용자별/요청별로 달라지는 값이 아니다.
 */
export function configureMemiBoard(options: Partial<MemiBoardConfig>): void {
  if (options.collectionPrefix) config.collectionPrefix = options.collectionPrefix
  if (options.auth) Object.assign(config.auth, options.auth)
  if (options.moderation) Object.assign(config.moderation, options.moderation)
}

export function useMemiBoardConfig(): MemiBoardConfig {
  return config
}
