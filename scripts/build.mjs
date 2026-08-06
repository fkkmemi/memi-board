#!/usr/bin/env node
/**
 * 1) vite: core index.js + module.mjs
 * 2) copy src/components → dist/runtime/components (raw SFC for host Nuxt)
 */
import { cpSync, mkdirSync, existsSync, rmSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

console.log('→ vite build (core + module)')
execSync('pnpm exec vite build', { cwd: root, stdio: 'inherit' })

const srcComponents = resolve(root, 'src/components')
const destComponents = resolve(root, 'dist/runtime/components')

if (existsSync(destComponents)) {
  rmSync(destComponents, { recursive: true, force: true })
}
mkdirSync(resolve(root, 'dist/runtime'), { recursive: true })
console.log('→ copy components → dist/runtime/components')
cpSync(srcComponents, destComponents, { recursive: true })

// SEO composable — 호스트 Nuxt 컴파일용 (#imports). lib 번들에 넣지 않음.
const seoSrc = resolve(root, 'src/composables/useMemiBoardSeo.ts')
const seoDestDir = resolve(root, 'dist/runtime/composables')
mkdirSync(seoDestDir, { recursive: true })
console.log('→ copy useMemiBoardSeo → dist/runtime/composables')
cpSync(seoSrc, resolve(seoDestDir, 'useMemiBoardSeo.ts'))

// module types (vite-plugin-dts skips module entry portably)
const moduleDts = resolve(root, 'dist/module.d.ts')
writeFileSync(
  moduleDts,
  `import type { NuxtModule } from '@nuxt/schema'\nimport type { MemiBoardConfig } from './index.js'\n\ndeclare const module: NuxtModule<Partial<MemiBoardConfig>>\nexport default module\n`,
)

console.log('✓ build done')
