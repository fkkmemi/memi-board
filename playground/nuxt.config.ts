// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  // memi-board는 클라이언트 전용(Firebase Web SDK)으로 동작한다 — SSR 비활성화
  ssr: false,
  // memi-board는 순수 Vue 컴포넌트/composable 패키지다 — nuxt-vuefire는 호스트(이 플레이그라운드)가 직접 설정한다.
  modules: ['@nuxt/ui', 'nuxt-vuefire'],
  css: ['~/assets/css/main.css'],
  vuefire: {
    config: {
      // emulators 모드에서는 'demo-' 프리픽스 projectId면 실제 키가 없어도 오프라인으로 동작한다.
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
