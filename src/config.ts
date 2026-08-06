import { reactive } from 'vue'
import {
  DEFAULT_BOARD_ID,
  DEFAULT_BOARDS_COLLECTION,
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

/**
 * 게시판 SEO (호스트 API 없이 Firestore 직조회 + useSeoMeta).
 * 호스트는 siteUrl/siteName 과 공개 board 경로 SSR on 만 맞추면 된다.
 */
export interface MemiBoardSeoOptions {
  /** false 면 useMemiBoard*Seo 가 no-op. 기본 true */
  enabled?: boolean
  /** og:site_name · title 접미사. 예: Loop Waiting */
  siteName?: string
  /**
   * 절대 URL용 origin. 예: https://loopwait.com
   * 비우면 useRequestURL / NUXT_PUBLIC_SITE_URL 순으로 추론.
   */
  siteUrl?: string
  /** 글에 previewImage 없을 때. 상대경로 또는 https */
  defaultOgImage?: string
  /**
   * 호스트 게시판 base path (trailing slash 없음). 기본 '/board'
   * canonical: {base}, {base}/{category}, {base}/{category}/{slug}
   */
  basePath?: string
}

export interface MemiBoardConfig {
  /**
   * 루트 컬렉션 이름. 기본 `memiBoards`.
   * 경로: `{boardsCollection}/{boardId}/posts|settings|users`
   */
  boardsCollection: string
  /**
   * 게시판 문서 ID (필수에 가깝다 — 미지정 시 `default`).
   * 한 호스트에 여러 게시판을 두려면 인스턴스마다 다른 boardId 를 쓴다.
   */
  boardId: string
  auth: MemiBoardAuthOptions
  moderation: MemiBoardModerationOptions
  seo: MemiBoardSeoOptions
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
      boardsCollection: DEFAULT_BOARDS_COLLECTION,
      boardId: DEFAULT_BOARD_ID,
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

/**
 * 앱 부팅 시(플러그인 등에서) 한 번 호출한다. 모든 요청/세션이 같은 값을 보므로
 * 서버 렌더링에서도 안전하다 — 사용자별/요청별로 달라지는 값이 아니다.
 */
export function configureMemiBoard(options: Partial<MemiBoardConfig>): void {
  const config = getSharedConfig()
  if (options.boardsCollection != null && options.boardsCollection !== '') {
    config.boardsCollection = options.boardsCollection.trim()
  }
  if (options.boardId != null && options.boardId !== '') {
    config.boardId = options.boardId.trim()
  }
  if (options.auth) Object.assign(config.auth, options.auth)
  if (options.moderation) Object.assign(config.moderation, options.moderation)
  if (options.seo) Object.assign(config.seo, options.seo)
}

export function useMemiBoardConfig(): MemiBoardConfig {
  return getSharedConfig()
}

/** 현재 config 기준 path 세그먼트 (composables 공용) */
export function useBoardPathConfig(): BoardPathConfig {
  const config = useMemiBoardConfig()
  return resolveBoardPathConfig(config)
}
