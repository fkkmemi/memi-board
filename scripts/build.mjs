#!/usr/bin/env node
/**
 * 1) vite: core index.js + module.mjs
 * 2) copy src/components → dist/runtime/components (raw SFC for host Nuxt)
 */
import { cpSync, mkdirSync, existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
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
assertShippedComponentImports(destComponents)

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

// Host Nuxt compiles the copied SFCs. A relative import into src/ works while
// linked, then fails in the published package because only dist/ is shipped.
function assertShippedComponentImports(dir) {
  const importRe = /from\s+['"](\.[^'"]+)['"]/g
  const files = []
  const walk = (current) => {
    for (const name of readdirSync(current)) {
      const path = join(current, name)
      if (statSync(path).isDirectory()) walk(path)
      else if (name.endsWith('.vue') || name.endsWith('.ts')) files.push(path)
    }
  }
  walk(dir)
  const missing = []
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    for (const match of text.matchAll(importRe)) {
      const spec = match[1]
      if (!spec.startsWith('../')) continue
      const base = resolve(dirname(file), spec)
      const found = ['', '.ts', '.js', '.mjs', '.vue'].some(ext => existsSync(base + ext))
      if (!found) missing.push(`${file} → ${spec}`)
    }
  }
  if (missing.length) {
    console.error('component import is not in the published package:')
    for (const line of missing) console.error(`  ${line}`)
    process.exit(1)
  }
}
