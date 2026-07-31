import { defineNuxtModule, createResolver, addComponentsDir, addImportsDir, addRouteMiddleware, installModule, extendPages } from '@nuxt/kit'
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
  providers?: Array<'google' | 'emailPassword'>
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
    auth: { providers: ['google', 'emailPassword'], provideSignInUI: true },
    moderation: { enabled: true, model: 'gemini-2.5-flash', onError: 'allow', moderateImages: false, localBlocklist: [] },
    pages: false,
  },
  async setup(options, nuxt) {
    const { resolve } = createResolver(import.meta.url)

    if (!options.firebaseConfig?.projectId) {
      console.warn('[memi-board] firebaseConfig가 비어 있습니다. nuxt.config의 memiBoard.firebaseConfig를 설정해 주세요.')
    }

    // Firebase 연동은 nuxt-vuefire에 위임한다 (클라이언트 전용, Admin SDK 미사용).
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
