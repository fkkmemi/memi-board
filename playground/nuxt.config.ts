// https://nuxt.com/docs/api/configuration/nuxt-config
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  // memi-board는 클라이언트 전용(Firebase Web SDK) — SSR 비활성화
  ssr: false,

  // 호스트가 vuefire 설정. memi-board/nuxt 는 UI SFC 등록만.
  modules: [
    '@nuxt/ui',
    'nuxt-vuefire',
    resolve(root, 'src/module.ts'),
  ],

  // playground 가 패키지 루트를 memi-board 로 resolve
  alias: {
    'memi-board': resolve(root, 'src/index.ts'),
  },

  css: ['~/assets/css/main.css'],

  vuefire: {
    config: {
      apiKey: process.env.NUXT_PUBLIC_FIREBASE_API_KEY ?? 'demo-api-key',
      authDomain: process.env.NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? 'demo-memi-board.firebaseapp.com',
      projectId: process.env.NUXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'demo-memi-board',
      storageBucket: process.env.NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? 'demo-memi-board.appspot.com',
      messagingSenderId: process.env.NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '0',
      appId: process.env.NUXT_PUBLIC_FIREBASE_APP_ID ?? 'demo-app-id',
    },
    auth: { enabled: true },
    emulators: process.env.NUXT_PUBLIC_USE_EMULATORS === '1',
  },
})
