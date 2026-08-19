import { reactive } from 'vue'
import {
  DEFAULT_COMMENTS_COLLECTION,
  DEFAULT_LIKES_COLLECTION,
  DEFAULT_REPORTS_COLLECTION,
  DEFAULT_POSTS_COLLECTION,
  DEFAULT_SETTINGS_COLLECTION,
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
  /** 글 컬렉션. 기본 `memiBoardPosts` */
  postsCollection: string
  /** 댓글 컬렉션. 기본 `memiBoardComments` */
  commentsCollection: string
  /** 좋아요 컬렉션. 기본 `memiBoardLikes` */
  likesCollection: string
  /** 신고 컬렉션. 기본 `memiBoardReports` */
  reportsCollection: string
  /** 보드 설정 컬렉션. 기본 `memiBoardSettings` */
  settingsCollection: string
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
      postsCollection: DEFAULT_POSTS_COLLECTION,
      commentsCollection: DEFAULT_COMMENTS_COLLECTION,
      likesCollection: DEFAULT_LIKES_COLLECTION,
      reportsCollection: DEFAULT_REPORTS_COLLECTION,
      settingsCollection: DEFAULT_SETTINGS_COLLECTION,
      usersCollection: DEFAULT_USERS_COLLECTION,
      auth: { providers: ['google', 'apple'] },
      moderation: {
        enabled: true,
        model: 'gemini-3.5-flash-lite',
        onError: 'allow',
        moderateImages: false,
        localBlocklist: [],
        blockBanThreshold: 10,
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
  if (options.postsCollection != null && options.postsCollection !== '') {
    config.postsCollection = options.postsCollection.trim()
  }
  if (options.commentsCollection != null && options.commentsCollection !== '') {
    config.commentsCollection = options.commentsCollection.trim()
  }
  if (options.likesCollection != null && options.likesCollection !== '') {
    config.likesCollection = options.likesCollection.trim()
  }
  if (options.reportsCollection != null && options.reportsCollection !== '') {
    config.reportsCollection = options.reportsCollection.trim()
  }
  if (options.settingsCollection != null && options.settingsCollection !== '') {
    config.settingsCollection = options.settingsCollection.trim()
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
