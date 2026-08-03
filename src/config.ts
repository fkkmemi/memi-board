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
  /** AI Logic App Check limited-use 토큰 (재생 보호). 기본 true */
  useLimitedUseAppCheckTokens?: boolean
  /**
   * 콘텐츠 검열 차단(로컬/AI flagged) 누적 횟수 이상이 되면 글·댓글 작성 제한.
   * 기본 3. 0 이하면 제한 기능 off.
   */
  blockBanThreshold?: number
  /** 경고 1회 차감 간격(ms). 기본 24시간 */
  blockBanDecayMs?: number
}

export interface MemiBoardConfig {
  collectionPrefix: string
  auth: MemiBoardAuthOptions
  moderation: MemiBoardModerationOptions
}

const GLOBAL_KEY = '__MEMI_BOARD_CONFIG__' as const

/**
 * link:/file: 모노레포에서 Vite 가 dist 와 src 를 서로 다른 모듈 id 로 묶으면
 * 모듈 스코프 singleton 이 둘로 갈라져 configure 가 안 먹는 문제가 난다.
 * globalThis 에 한 번만 올려 플러그인·컴포넌트가 항상 같은 config 를 보게 한다.
 */
function getSharedConfig(): MemiBoardConfig {
  const g = globalThis as typeof globalThis & {
    [GLOBAL_KEY]?: MemiBoardConfig
  }
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = reactive<MemiBoardConfig>({
      collectionPrefix: 'memiBoard',
      auth: { providers: ['google', 'apple'] },
      moderation: {
        enabled: true,
        model: 'gemini-3.5-flash-lite',
        onError: 'allow',
        moderateImages: false,
        localBlocklist: [],
        blockBanThreshold: 3,
        blockBanDecayMs: 24 * 60 * 60 * 1000,
      },
    })
  }
  return g[GLOBAL_KEY]
}

/**
 * 앱 부팅 시(플러그인 등에서) 한 번 호출한다. 모든 요청/세션이 같은 값을 보므로
 * 서버 렌더링에서도 안전하다 — 사용자별/요청별로 달라지는 값이 아니다.
 */
export function configureMemiBoard(options: Partial<MemiBoardConfig>): void {
  const config = getSharedConfig()
  if (options.collectionPrefix) config.collectionPrefix = options.collectionPrefix
  if (options.auth) Object.assign(config.auth, options.auth)
  if (options.moderation) Object.assign(config.moderation, options.moderation)
}

export function useMemiBoardConfig(): MemiBoardConfig {
  return getSharedConfig()
}
