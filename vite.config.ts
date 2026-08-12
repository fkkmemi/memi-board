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
        'src/storage.ts',
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
        storage: resolve(import.meta.dirname, 'src/storage.ts'),
      },
      formats: ['es'],
      fileName: (_format, entryName) => {
        if (entryName === 'module') return 'module.mjs'
        if (entryName === 'storage') return 'storage.js'
        return 'index.js'
      },
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
    // 라이브러리 빌드는 minify 안 함 — 압축 시 rollup이 내부 변수를 h/e/t 같은
    // 한 글자로 재명명하는데, 호스트 Nuxt의 auto-import(unimport)가 link:로
    // 심볼릭 링크된 이 패키지를 node_modules 예외 대상으로 인식하지 못하고
    // "프로젝트 소스"로 스캔하면서, 우연히 Vue의 전역 auto-import `h`(hyperscript)와
    // 이름이 겹치면 `import { h } from 'vue'`를 그 청크에 주입해버려 파일 자체에
    // 이미 있는 `h` 선언과 충돌한다("Identifier 'h' has already been declared").
    // 최종 소비자 앱이 어차피 자기 번들러로 다시 압축하므로 여기서 압축할 이유도 없다.
    minify: false,
  },
})
