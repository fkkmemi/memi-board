import { reactive } from 'vue'
import type { BoardUserRole } from './types'
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

export interface MemiBoardI18nOptions {
  /** false이면 호스트·게시판 언어 대신 locale로 UI를 고정하고 번역 기능도 끈다. 기본 true. */
  enabled?: boolean
}

export interface MemiBoardTranslationOptions {
  /** false이면 콘텐츠 번역 생성과 번역문 표시를 끈다. UI 언어 설정은 유지한다. 기본 true. */
  enabled?: boolean
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
  i18n?: MemiBoardI18nOptions
  translation?: MemiBoardTranslationOptions
  /**
   * 기본 언어. 호스트에 @nuxtjs/i18n 이 있으면 그 언어를 따르고,
   * 보드 설정에서 언어를 고르면 그 보드는 그 언어로 고정된다. 기본 'ko'.
   */
  roleLabels?: Partial<Record<BoardUserRole, string>>
  locale?: string
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
  if (options.i18n) config.i18n = { ...config.i18n, ...options.i18n }
  if (options.translation) config.translation = { ...config.translation, ...options.translation }
  if (options.roleLabels) config.roleLabels = { ...options.roleLabels }
  if (options.locale) config.locale = options.locale
}

export function useMemiBoardConfig(): MemiBoardConfig {
  return getSharedConfig()
}

export function isMemiBoardI18nEnabled(): boolean {
  return useMemiBoardConfig().i18n?.enabled !== false
}

export function isMemiBoardTranslationEnabled(): boolean {
  return isMemiBoardI18nEnabled() && useMemiBoardConfig().translation?.enabled !== false
}

/** UI를 거치지 않는 호출도 AI 요청·이용 횟수 갱신 전에 차단한다. */
export function assertMemiBoardTranslationEnabled(): void {
  if (!isMemiBoardTranslationEnabled()) {
    throw Object.assign(new Error('Content translation is disabled for this board service.'), {
      code: 'memi-board/translation-disabled',
    })
  }
}

export function useBoardPathConfig(): BoardPathConfig {
  return resolveBoardPathConfig(useMemiBoardConfig())
}
