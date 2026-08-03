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

// module types (vite-plugin-dts skips module entry portably)
const moduleDts = resolve(root, 'dist/module.d.ts')
writeFileSync(
  moduleDts,
  `import type { NuxtModule } from '@nuxt/schema'\n\ndeclare const module: NuxtModule<Record<string, never>>\nexport default module\n`,
)

console.log('✓ build done')
