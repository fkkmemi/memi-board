import { defineNuxtModule, createResolver, addComponentsDir, addImportsDir, addRouteMiddleware, installModule, extendPages, hasNuxtModule } from '@nuxt/kit'
import { defu } from 'defu'

export interface MemiBoardFirebaseConfig {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
  measurementId?: string
}

export interface MemiBoardAppCheckOptions {
  provider: 'ReCaptchaV3' | 'ReCaptchaEnterprise'
  siteKey: string
  isTokenAutoRefreshEnabled?: boolean
}

export interface MemiBoardAuthOptions {
  providers?: Array<'google' | 'apple' | 'emailPassword'>
  provideSignInUI?: boolean
}

export interface MemiBoardModerationOptions {
  enabled?: boolean
  model?: string
  localBlocklist?: string[]
  onError?: 'allow' | 'block'
  moderateImages?: boolean
}

export interface MemiBoardModuleOptions {
  firebaseConfig: MemiBoardFirebaseConfig
  appCheck?: MemiBoardAppCheckOptions
  collectionPrefix?: string
  auth?: MemiBoardAuthOptions
  moderation?: MemiBoardModerationOptions
  pages?: boolean | { base?: string }
  /** 로컬 개발 시 Firebase Local Emulator Suite(Auth/Firestore/Storage, 기본 포트)에 연결한다. */
  emulators?: boolean
}

export default defineNuxtModule<MemiBoardModuleOptions>({
  meta: {
    name: 'memi-board',
    configKey: 'memiBoard',
  },
  defaults: {
    collectionPrefix: 'memiBoard',
    auth: { providers: ['google', 'apple'], provideSignInUI: true },
    moderation: { enabled: true, model: 'gemini-2.5-flash', onError: 'allow', moderateImages: false, localBlocklist: [] },
    pages: false,
  },
  async setup(options, nuxt) {
    const { resolve } = createResolver(import.meta.url)

    if (!options.firebaseConfig?.projectId) {
      console.warn('[memi-board] firebaseConfig가 비어 있습니다. nuxt.config의 memiBoard.firebaseConfig를 설정해 주세요.')
    }

    // Firebase 연동은 nuxt-vuefire에 위임한다 (클라이언트 전용, Admin SDK 미사용).
    // 호스트 앱이 이미 nuxt-vuefire를 쓰고 있으면(예: 자체 Admin SDK 서버 기능이 있는 앱)
    // 여기서 또 installModule 하면 setup()이 두 번 실행돼 플러그인·서버 라우트가 중복 등록된다
    // (nuxt-vuefire 자체엔 중복 설치 가드가 없음). 이미 등록돼 있으면 호스트 설정을 그대로 재사용하고,
    // 이때는 호스트 쪽 nuxt-vuefire에 auth.enabled: true 가 켜져 있어야 이 모듈의 인증이 동작한다.
    if (hasNuxtModule('nuxt-vuefire', nuxt)) {
      console.info('[memi-board] nuxt-vuefire가 이미 등록돼 있어 호스트 설정을 그대로 재사용합니다 (auth.enabled 필요).')
    }
    else {
      await installModule('nuxt-vuefire', {
        config: options.firebaseConfig,
        auth: { enabled: true },
        ...(options.emulators ? { emulators: true } : {}),
        ...(options.appCheck
          ? {
              appCheck: {
                provider: options.appCheck.provider,
                key: options.appCheck.siteKey,
                isTokenAutoRefreshEnabled: options.appCheck.isTokenAutoRefreshEnabled ?? true,
              },
            }
          : {}),
      })
    }

    nuxt.options.runtimeConfig.public.memiBoard = defu(
      nuxt.options.runtimeConfig.public.memiBoard as Record<string, unknown> | undefined,
      {
        collectionPrefix: options.collectionPrefix ?? 'memiBoard',
        auth: options.auth ?? {},
        moderation: options.moderation ?? {},
      },
    )

    addImportsDir(resolve('./runtime/composables'))
    addComponentsDir({ path: resolve('./runtime/components'), prefix: 'MemiBoard' })

    if (options.pages) {
      const base = (typeof options.pages === 'object' ? options.pages.base : undefined) ?? '/board'
      addRouteMiddleware({
        name: 'memi-board-auth',
        path: resolve('./runtime/middleware/memi-board-auth'),
        global: false,
      })
      extendPages((pages) => {
        pages.unshift(
          { name: 'memi-board-index', path: base, file: resolve('./runtime/pages/index.vue'), meta: { memiBoardBase: base } },
          { name: 'memi-board-version-history', path: `${base}/version-history`, file: resolve('./runtime/pages/version-history.vue') },
          { name: 'memi-board-new', path: `${base}/new`, file: resolve('./runtime/pages/new.vue'), meta: { middleware: 'memi-board-auth', memiBoardBase: base } },
          { name: 'memi-board-detail', path: `${base}/:id()`, file: resolve('./runtime/pages/[id].vue'), meta: { memiBoardBase: base } },
          { name: 'memi-board-edit', path: `${base}/:id()/edit`, file: resolve('./runtime/pages/[id]/edit.vue'), meta: { middleware: 'memi-board-auth', memiBoardBase: base } },
        )
      })
    }
  },
})
