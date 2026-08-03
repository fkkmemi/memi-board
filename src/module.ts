// @ts-nocheck — NuxtModule 반환 타입이 @nuxt/schema 경로에 묶여 d.ts 생성 시 불안정
import {
  defineNuxtModule,
  createResolver,
  addComponentsDir,
  addImports,
} from '@nuxt/kit'
import { existsSync } from 'node:fs'

/**
 * Thin Nuxt module — 호스트 Vite 파이프라인에 컴포넌트 SFC 만 올린다.
 *
 * 하지 않는 일:
 * - nuxt-vuefire / Firebase 설정
 * - 라우트·미들웨어 등록
 * - configureMemiBoard (호스트 플러그인에서 호출)
 *
 * 하는 일:
 * - components 디렉터리 등록 → 호스트가 SFC 컴파일 → Nuxt UI auto-import 정상 동작
 * - composable / configure 를 auto-import
 * - transpile + optimizeDeps.exclude 로 prebundle 재발 방지
 */
export default defineNuxtModule({
  meta: {
    name: 'memi-board',
    configKey: 'memiBoard',
  },
  setup(_options, nuxt) {
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
    nuxt.options.vite.resolve ||= {}
    // link:/file: 로 설치 시 패키지 쪽 node_modules 의 vuefire·firebase 가
    // 호스트와 이중으로 잡히면 useFirestore 가 깨져 permission-denied 가 난다.
    const dedupe = new Set([
      ...(nuxt.options.vite.resolve.dedupe || []),
      'vue',
      'vue-router',
      'vuefire',
      'firebase',
    ])
    nuxt.options.vite.resolve.dedupe = [...dedupe]

    nuxt.options.vite.optimizeDeps ||= {}
    const exclude = new Set(nuxt.options.vite.optimizeDeps.exclude || [])
    exclude.add('memi-board')
    nuxt.options.vite.optimizeDeps.exclude = [...exclude]

    addComponentsDir({
      path: componentsDir,
      pathPrefix: false,
      prefix: 'MemiBoard',
      // List.vue → MemiBoardList
    })

    const from = 'memi-board'
    addImports([
      { name: 'configureMemiBoard', from },
      { name: 'useMemiBoardConfig', from },
      { name: 'useMemiBoardAuth', from },
      { name: 'useMemiBoardPosts', from },
      { name: 'useMemiBoardComments', from },
      { name: 'useMemiBoardModeration', from },
      { name: 'useMemiBoardStorage', from },
      { name: 'useMemiBoardSettings', from },
      { name: 'versionHistory', from },
    ])
  },
})
