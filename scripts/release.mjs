#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const otp = process.argv[2]

if (!/^\d{6}$/.test(otp ?? '')) {
  console.error('사용법: pnpm release 123456 (npm OTP 6자리)')
  process.exit(1)
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
  })

  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

const gitStatus = spawnSync('git', ['status', '--porcelain'], {
  cwd: root,
  encoding: 'utf8',
  shell: false,
})

if (gitStatus.error) throw gitStatus.error
if (gitStatus.status !== 0) process.exit(gitStatus.status ?? 1)
if (gitStatus.stdout.trim()) {
  console.error('커밋하지 않은 변경이 있습니다. 워크플로를 완료한 뒤 다시 실행하세요.')
  process.exit(1)
}

console.log('→ build')
run('pnpm', ['build'])

console.log('→ typecheck')
run('pnpm', ['typecheck'])

console.log('→ package dry-run')
run('npm', ['pack', '--dry-run', '--ignore-scripts'])

console.log('→ npm publish')
run('pnpm', ['publish', '--access', 'public', '--otp', otp, '--ignore-scripts', '--no-git-checks'])
