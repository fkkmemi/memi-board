import { reactive } from 'vue'
import { MEMI_BOARD_LOCALES, normalizeMemiBoardLocale, type MemiBoardLocale } from './i18n/locales'
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
  /** Login route for comment prompts; the host receives the return URL as `next`. */
  loginPath?: string
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

/**
 * 관리자가 보드 전체 설정 화면에서 바꾸는 값(Firestore `memiBoardSettings/__app` 문서).
 * 호스트 `nuxt.config` 설정 위에 덧씌우며, 비어 있으면 호스트 설정을 그대로 따른다.
 */
export interface MemiBoardSiteSettings {
  /** true 이면 AI 기능(검열·번역·글쓰기 도우미·AI 제목)을 모두 끈다. */
  disableAi?: boolean
  /** true 이면 국제화를 끄고 `locale` 한 언어로 고정한다. */
  disableI18n?: boolean
  /** 기본 언어(국제화를 끄면 고정 언어). */
  locale?: string
  /** 쓸 수 있는 언어(MEMI_BOARD_LOCALES 코드). 비어 있으면 지원 언어 전체. */
  locales?: string[]
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
  /** 배너 생성 전용 이미지 모델. 일반 글쓰기·검열 모델과 별개. */
  bannerGeneration?: { model?: string }
  /** 관리자 화면에서 바꾸는 사이트 전체 설정. 런타임에 Firestore 값으로 채운다. */
  site?: MemiBoardSiteSettings
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
  if (options.bannerGeneration) config.bannerGeneration = { ...config.bannerGeneration, ...options.bannerGeneration }
  if (options.roleLabels) config.roleLabels = { ...options.roleLabels }
  if (options.locale) config.locale = options.locale
}

export function useMemiBoardConfig(): MemiBoardConfig {
  return getSharedConfig()
}

/** 관리자가 AI 기능을 끄지 않았는지. 검열·번역·글쓰기 도우미·AI 제목이 모두 이 값을 따른다. */
export function isMemiBoardAiEnabled(): boolean {
  return useMemiBoardConfig().site?.disableAi !== true
}

/** UI를 거치지 않는 호출도 AI 요청 전에 차단한다. */
export function assertMemiBoardAiEnabled(): void {
  if (!isMemiBoardAiEnabled()) {
    throw Object.assign(new Error('AI features are disabled for this board service.'), {
      code: 'memi-board/ai-disabled',
    })
  }
}

export function isMemiBoardI18nEnabled(): boolean {
  const config = useMemiBoardConfig()
  return config.site?.disableI18n !== true && config.i18n?.enabled !== false
}

export function isMemiBoardTranslationEnabled(): boolean {
  return isMemiBoardAiEnabled() && isMemiBoardI18nEnabled() && useMemiBoardConfig().translation?.enabled !== false
}

/**
 * 관리자가 사용하도록 고른 언어. 국제화가 꺼져 있거나 고른 언어가 없으면 지원 언어 전체.
 * 번역 대상, 보드 언어 선택, 호스트의 언어 메뉴가 이 목록을 따른다.
 */
export function memiBoardEnabledLocales(): MemiBoardLocale[] {
  const all = MEMI_BOARD_LOCALES.map(item => item.code)
  const picked = useMemiBoardConfig().site?.locales
  if (!isMemiBoardI18nEnabled() || !picked?.length) return all
  const chosen = new Set(picked.map(code => normalizeMemiBoardLocale(code)).filter(Boolean))
  const enabled = all.filter(code => chosen.has(code))
  return enabled.length ? enabled : all
}

/** 기본(또는 고정) 언어. 관리자가 고른 값이 호스트 설정보다 우선하고, 사용 언어 목록 안에 있어야 한다. */
export function memiBoardDefaultLocale(): string | undefined {
  const config = useMemiBoardConfig()
  const wanted = config.site?.locale || config.locale
  const enabled = memiBoardEnabledLocales()
  const normalized = normalizeMemiBoardLocale(wanted)
  if (enabled.length === MEMI_BOARD_LOCALES.length || (normalized && enabled.includes(normalized))) return wanted
  return enabled[0]
}

/** Firestore 의 사이트 설정 문서 값을 런타임 설정에 반영한다. 문서가 없으면 호스트 설정으로 돌아간다. */
export function applyMemiBoardSiteSettings(data: Record<string, unknown> | undefined): void {
  useMemiBoardConfig().site = {
    disableAi: data?.disableAi === true,
    disableI18n: data?.disableI18n === true,
    locale: typeof data?.locale === 'string' && data.locale ? data.locale : undefined,
    locales: Array.isArray(data?.locales) ? data.locales.filter((code): code is string => typeof code === 'string') : undefined,
  }
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
