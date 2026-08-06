import { reactive } from 'vue'
import {
  DEFAULT_BOARDS_COLLECTION,
  DEFAULT_USERS_COLLECTION,
  resolveBoardPathConfig,
  type BoardPathConfig,
} from './utils/boardPaths'

export interface MemiBoardAuthOptions {
  providers?: Array<'google' | 'apple' | 'emailPassword'>
}

export interface MemiBoardModerationOptions {
  enabled?: boolean
  model?: string
  localBlocklist?: string[]
  onError?: 'allow' | 'block'
  moderateImages?: boolean
  useLimitedUseAppCheckTokens?: boolean
  blockBanThreshold?: number
  blockBanDecayMs?: number
}

export interface MemiBoardSeoOptions {
  enabled?: boolean
  siteName?: string
  siteUrl?: string
  defaultOgImage?: string
  /**
   * 호스트 게시판 base path (trailing slash 없음). 기본 '/board'
   * canonical: {base}, {base}/{boardId}, {base}/{boardId}/{slug}
   */
  basePath?: string
}

export interface MemiBoardConfig {
  /** 루트 컬렉션. 기본 `memiBoards` */
  boardsCollection: string
  /** 역할 문서 컬렉션. 기본 `memiBoardUsers` */
  usersCollection: string
  auth: MemiBoardAuthOptions
  moderation: MemiBoardModerationOptions
  seo: MemiBoardSeoOptions
}

const GLOBAL_KEY = '__MEMI_BOARD_CONFIG__' as const

function getSharedConfig(): MemiBoardConfig {
  const g = globalThis as typeof globalThis & {
    [GLOBAL_KEY]?: MemiBoardConfig
  }
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = reactive<MemiBoardConfig>({
      boardsCollection: DEFAULT_BOARDS_COLLECTION,
      usersCollection: DEFAULT_USERS_COLLECTION,
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
      seo: {
        enabled: true,
        siteName: 'Board',
        siteUrl: '',
        defaultOgImage: '',
        basePath: '/board',
      },
    })
  }
  return g[GLOBAL_KEY]
}

export function configureMemiBoard(options: Partial<MemiBoardConfig>): void {
  const config = getSharedConfig()
  if (options.boardsCollection != null && options.boardsCollection !== '') {
    config.boardsCollection = options.boardsCollection.trim()
  }
  if (options.usersCollection != null && options.usersCollection !== '') {
    config.usersCollection = options.usersCollection.trim()
  }
  if (options.auth) Object.assign(config.auth, options.auth)
  if (options.moderation) Object.assign(config.moderation, options.moderation)
  if (options.seo) Object.assign(config.seo, options.seo)
}

export function useMemiBoardConfig(): MemiBoardConfig {
  return getSharedConfig()
}

export function useBoardPathConfig(): BoardPathConfig {
  return resolveBoardPathConfig(useMemiBoardConfig())
}
