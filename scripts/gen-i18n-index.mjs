#!/usr/bin/env node
/**
 * src/i18n/messages/{ko,en}/*.ts 네임스페이스 파일을 모아 index.ts 를 만든다.
 * 네임스페이스 파일을 추가·삭제한 뒤 실행한다: node scripts/gen-i18n-index.mjs
 */
import { readdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../src/i18n/messages')

for (const locale of ['ko', 'en']) {
  const dir = resolve(root, locale)
  const names = readdirSync(dir)
    .filter(file => file.endsWith('.ts') && file !== 'index.ts')
    .map(file => file.slice(0, -3))
    .sort()
  const lines = [
    '// 자동 생성 — scripts/gen-i18n-index.mjs',
    ...names.map(name => `import ${name} from './${name}'`),
    '',
    `export default {\n${names.map(name => `  ${name},`).join('\n')}\n}`,
    '',
  ]
  writeFileSync(resolve(dir, 'index.ts'), lines.join('\n'))
  console.log(`${locale}: ${names.length} namespaces`)
}
