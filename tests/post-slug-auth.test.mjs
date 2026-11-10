import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { ref, watch } from 'vue'

// Run the actual lookup wrapper, keeping identity restoration and role loading controllable.
const source = readFileSync(new URL('../src/composables/useMemiBoardPosts.ts', import.meta.url), 'utf8')
const wrapper = source.match(/  async function findBySlug\(slug: string\) \{[\s\S]*?\n  \}/)[0]
const js = ts.transpile(wrapper, { target: ts.ScriptTarget.ES2022 })
const bind = new Function('getAuth', 'app', 'rolePending', 'watch', 'findReadablePostBySlug', 'db', 'cfg', 'bid', 'user', 'canManageBoard', `${js}; return findBySlug`)

test('refresh lookup waits for restored login and loaded role before querying private drafts', async () => {
  let restore
  const authStateReady = new Promise(resolve => { restore = resolve })
  const rolePending = ref(true)
  const user = ref(null)
  let queried = false
  const lookup = bind(() => ({ authStateReady: () => authStateReady }), {}, rolePending, watch,
    async (...args) => { queried = true; return args }, 'db', () => 'config', () => 'board', user, () => true)
  const pending = lookup('초안')
  await Promise.resolve()
  assert.equal(queried, false)
  user.value = { uid: 'restored-author' }
  restore()
  await Promise.resolve()
  assert.equal(queried, false, 'manager role must also finish loading')
  rolePending.value = false
  assert.deepEqual(await pending, ['db', 'config', 'board', '초안', 'restored-author', true])
})

test('signed-out and already-loaded sessions can still resolve public posts', async () => {
  const lookup = bind(() => ({ authStateReady: async () => {} }), {}, ref(false), watch,
    async (...args) => args, 'db', () => 'config', () => 'board', ref(null), () => false)
  assert.deepEqual(await lookup('공개-주소'), ['db', 'config', 'board', '공개-주소', undefined, false])
})
