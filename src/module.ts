// @ts-nocheck — NuxtModule 반환 타입이 @nuxt/schema 경로에 묶여 d.ts 생성 시 불안정
import {
  defineNuxtModule,
  createResolver,
  addComponentsDir,
  addImports,
  addPlugin,
  addTemplate,
} from '@nuxt/kit'
import { existsSync } from 'node:fs'
import type { NuxtModule } from '@nuxt/schema'
import type { MemiBoardConfig } from './config'

type MemiBoardModuleOptions = Partial<MemiBoardConfig>

/**
 * Nuxt 전용 모듈 — 호스트 Vite 파이프라인에 게시판 SFC와 필수 설정을 올린다.
 *
 * 하지 않는 일:
 * - nuxt-vuefire / Firebase 설정
 * - 라우트·미들웨어 등록
 *
 * 하는 일:
 * - components 디렉터리 등록 → 호스트가 SFC 컴파일 → Nuxt UI auto-import 정상 동작
 * - composable / configure 를 auto-import
 * - memiBoard 옵션을 런타임 플러그인으로 전달해 configureMemiBoard 자동 호출
 * - transpile + optimizeDeps 설정으로 linked package와 CommonJS 의존성 정규화
 */
const memiBoardModule: NuxtModule<MemiBoardModuleOptions> = defineNuxtModule<MemiBoardModuleOptions>({
  meta: {
    name: 'memi-board',
    configKey: 'memiBoard',
  },
  setup(options, nuxt) {
    const { resolve } = createResolver(import.meta.url)

    // 우선순위:
    // 1) monorepo link 시 dist/module.mjs → ../src/components (소스 직접, 재빌드 없이 UI 수정)
    // 2) publish 패키지 dist/runtime/components
    // 3) src/module.ts 로 직접 로드할 때 ./components
    const candidates = [
      resolve('../src/components'),
      resolve('./runtime/components'),
      resolve('./components'),
    ]
    const componentsDir = candidates.find(p => existsSync(p))
    if (!componentsDir) {
      throw new Error('[memi-board] components directory not found')
    }
    nuxt.options.build.transpile.push('memi-board')

    nuxt.options.vite ||= {}

    // link:/file: 설치 시 memi-board 패키지 루트(dist/ 등)가 호스트의 node_modules
    // 밖에 있어서 Vite dev 서버의 fs.allow 기본값(root + node_modules)에 안 걸린다 —
    // /@fs/ 요청이 403("outside of Vite serving allow list")으로 막히고, 그 403 HTML을
    // JS로 파싱하려다 알 수 없는 SyntaxError가 난다. 패키지 루트를 명시적으로 허용한다.
    const packageRoot = resolve('..')
    nuxt.options.vite.server ||= {}
    nuxt.options.vite.server.fs ||= {}
    const fsAllow = new Set([
      ...(nuxt.options.vite.server.fs.allow || []),
      packageRoot,
    ])
    nuxt.options.vite.server.fs.allow = [...fsAllow]

    nuxt.options.vite.resolve ||= {}
    // link:/file: 로 설치 시 패키지 쪽 node_modules 의 vuefire·firebase 가
    // 호스트와 이중으로 잡히면 useFirestore 가 깨져 permission-denied 가 난다.
    const dedupe = new Set([
      ...(nuxt.options.vite.resolve.dedupe || []),
      'vue',
      'vue-router',
      'vuefire',
      'firebase',
      'nuxt',
      '@tiptap/core',
      '@tiptap/pm',
      '@tiptap/vue-3',
    ])
    nuxt.options.vite.resolve.dedupe = [...dedupe]

    nuxt.options.vite.optimizeDeps ||= {}
    const exclude = new Set(nuxt.options.vite.optimizeDeps.exclude || [])
    exclude.add('memi-board')
    nuxt.options.vite.optimizeDeps.exclude = [...exclude]

    // link:/file: 개발 중엔 memi-board의 실제 경로가 host의 node_modules 밖에 있어서
    // Nuxt auto-import(unimport)의 "node_modules는 건드리지 않는다" 체크(경로에
    // 'node_modules' 문자열이 있는지로 판단)를 그냥 통과해버린다 — 그러면 memi-board의
    // dist 청크를 "프로젝트 소스"로 스캔하다가, rollup이 공유 청크의 export를 붙일 때
    // 우연히 짧은 별칭(a, b, … h …)을 골랐는데 그게 Vue의 전역 auto-import `h`
    // (hyperscript)와 겹치면 `import { h } from 'vue'`를 그 청크에 주입해버려서
    // 이미 있는 `h` export 별칭과 충돌한다("Identifier 'h' has already been declared").
    // 명시적으로 제외해 이 청크는 절대 auto-import 스캔 대상이 되지 않게 한다
    // (published npm 패키지 설치 시엔 이미 node_modules 안이라 원래도 제외 대상).
    nuxt.options.imports ||= {}
    nuxt.options.imports.transform ||= {}
    const transformExclude = new Set([
      ...(nuxt.options.imports.transform.exclude || []),
      /[\\/]memi-board[\\/]dist[\\/]/,
    ])
    nuxt.options.imports.transform.exclude = [...transformExclude]

    addComponentsDir({
      path: componentsDir,
      pathPrefix: false,
      prefix: 'MemiBoard',
      // List.vue → MemiBoardList
    })

    // SEO: 호스트 Nuxt 가 소스를 컴파일해야 #imports / useSeoMeta 가 앱 인스턴스를 탄다.
    // dist/index.js 에 넣으면 link 시 패키지 node_modules/nuxt 로 해석되어 깨진다.
    const seoCandidates = [
      resolve('../src/composables/useMemiBoardSeo.ts'),
      resolve('./runtime/composables/useMemiBoardSeo.ts'),
      resolve('./composables/useMemiBoardSeo.ts'),
    ]
    const seoFrom = seoCandidates.find(p => existsSync(p))
    if (!seoFrom) {
      throw new Error('[memi-board] useMemiBoardSeo runtime not found')
    }

    const from = 'memi-board/runtime'
    addImports([
      { name: 'configureMemiBoard', from },
      { name: 'useMemiBoardConfig', from },
      { name: 'useMemiBoardAuth', from },
      { name: 'useMemiBoardPosts', from },
      { name: 'useMemiBoardComments', from },
      { name: 'useMemiBoardViews', from },
      { name: 'useMemiBoardModeration', from },
      // 이미지 압축 등 브라우저 전용 — SSR 서버 번들에 안 섞이도록 별도 서브패스에서 해석
      { name: 'useMemiBoardStorage', from: 'memi-board/storage' },
      { name: 'useMemiBoardSettings', from },
      { name: 'useMemiBoardUsers', from },
      { name: 'useMemiBoardPostSeo', from: seoFrom },
      { name: 'useMemiBoardListSeo', from: seoFrom },
      { name: 'fetchPublicPostForSeo', from },
      { name: 'fetchPublicListForSeo', from },
      { name: 'resolvePublicSeoDb', from },
      { name: 'versionHistory', from },
      { name: 'useMemiBoardI18n', from },
      { name: 'MEMI_BOARD_LOCALES', from },
      { name: 'useMemiBoardAutoTranslate', from },
    ])

    const runtimeConfig = JSON.stringify(options).replace(/</g, '\\u003c')
    const configPlugin = addTemplate({
      filename: 'memi-board.config.mjs',
      getContents: () => `
import { computed } from 'vue'
import {
  configureMemiBoard,
  loadMemiBoardLocale,
  memiBoardHostLocaleKey,
  normalizeMemiBoardLocale,
} from 'memi-board/runtime'

export default defineNuxtPlugin({
  name: 'memi-board:config',
  // @nuxtjs/i18n 플러그인이 $i18n 을 만든 뒤 실행되어야 한다.
  dependsOn: ['i18n:plugin'],
  async setup(nuxtApp) {
    configureMemiBoard(${runtimeConfig})
    // 호스트가 @nuxtjs/i18n 을 쓰면 그 언어를 게시판 기본 언어로 쓴다.
    // 요청(SSR)마다 앱 인스턴스가 따로라 provide 로 넘긴다.
    const i18n = nuxtApp.$i18n
    if (!i18n?.locale) return
    const hostLocale = computed(() => i18n.locale.value)
    nuxtApp.vueApp.provide(memiBoardHostLocaleKey, hostLocale)
    const initial = normalizeMemiBoardLocale(hostLocale.value)
    if (initial) await loadMemiBoardLocale(initial)
  },
})
`,
    })
    addPlugin(configPlugin.dst)
  },
})

export default memiBoardModule
