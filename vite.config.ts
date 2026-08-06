import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

/**
 * Core only — Vue SFC 는 빌드하지 않는다.
 * 컴포넌트는 dist/runtime/components 로 복사되어 호스트 Nuxt 가 컴파일한다.
 */
export default defineConfig({
  plugins: [
    dts({
      include: [
        'src/index.ts',
        'src/config.ts',
        'src/types.ts',
        'src/composables/**/*.ts',
        'src/data/**/*.ts',
        'src/utils/**/*.ts',
      ],
      // SEO composable 은 #imports 사용 → 호스트 전용 runtime 복사본만 배포
      exclude: [
        'src/module.ts',
        'src/components/**',
        'src/composables/useMemiBoardSeo.ts',
      ],
    }),
  ],
  build: {
    lib: {
      entry: {
        index: resolve(import.meta.dirname, 'src/index.ts'),
        module: resolve(import.meta.dirname, 'src/module.ts'),
      },
      formats: ['es'],
      fileName: (_format, entryName) =>
        entryName === 'module' ? 'module.mjs' : 'index.js',
    },
    rollupOptions: {
      external: [
        'vue',
        'vue-router',
        'vuefire',
        'firebase/app',
        'firebase/auth',
        'firebase/firestore',
        'firebase/storage',
        'firebase/ai',
        '@nuxt/kit',
        '@nuxt/schema',
        // useMemiBoard*Seo — 호스트 Nuxt 런타임에서 해석
        'nuxt',
        'nuxt/app',
        /^nuxt\//,
        '#app',
        '#imports',
        '@tiptap/core',
        '@tiptap/pm',
        '@tiptap/pm/state',
        '@tiptap/pm/view',
        '@tiptap/pm/model',
        'node:fs',
        /^node:/,
        /^@tiptap\//,
      ],
      // module 엔트리는 d.ts 생성 대상에서 제외 (scripts/build.mjs 가 module.d.ts 작성)
      onwarn(warning, warn) {
        if (warning.code === 'PLUGIN_WARNING' && String(warning.message).includes('module.ts')) return
        warn(warning)
      },
    },
    sourcemap: true,
    emptyOutDir: true,
  },
})
