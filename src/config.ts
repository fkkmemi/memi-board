export type MemiBoardAuthProvider = 'google' | 'apple' | 'emailPassword'

export interface MemiBoardConfig {
  collectionPrefix?: string
  auth?: {
    providers?: MemiBoardAuthProvider[]
  }
  moderation?: {
    enabled?: boolean
    model?: string
    localBlocklist?: string[]
    onError?: 'allow' | 'block'
    moderateImages?: boolean
  }
}

const config: Required<Pick<MemiBoardConfig, 'collectionPrefix'>> & Omit<MemiBoardConfig, 'collectionPrefix'> = {
  collectionPrefix: 'memiBoard',
  auth: { providers: ['google', 'apple'] },
  moderation: {
    enabled: true,
    model: 'gemini-2.5-flash',
    localBlocklist: [],
    onError: 'allow',
    moderateImages: false,
  },
}

/** 호스트 앱의 Vue/Nuxt 플러그인에서 한 번 호출한다. Firebase 초기화는 호스트가 담당한다. */
export function configureMemiBoard(input: MemiBoardConfig): void {
  config.collectionPrefix = input.collectionPrefix ?? config.collectionPrefix
  config.auth = { ...config.auth, ...input.auth }
  config.moderation = { ...config.moderation, ...input.moderation }
}

export function useMemiBoardConfig() {
  return config
}
