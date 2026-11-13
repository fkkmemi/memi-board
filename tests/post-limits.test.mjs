import assert from 'node:assert/strict'
import { test } from 'node:test'
import { normalizePostTags, postBodyMax, POST_BODY_MAX, POST_TAG_MAX } from '../src/utils/postLimits.ts'

test('tags are trimmed, cut to 30 chars, deduplicated and capped at 10', () => {
  assert.deepEqual(normalizePostTags([' Nuxt ', 'nuxt', '', 'a'.repeat(40)]), ['Nuxt', 'a'.repeat(30)])
  assert.equal(normalizePostTags(Array.from({ length: 15 }, (_, i) => `t${i}`)).length, POST_TAG_MAX)
  assert.deepEqual(normalizePostTags(undefined), [])
})

test('body limit shrinks with translation targets and is capped per call', () => {
  assert.equal(postBodyMax(0), POST_BODY_MAX)
  assert.equal(postBodyMax(9), 5_500)
  assert.equal(postBodyMax(7), 7_100)
  assert.equal(postBodyMax(3), 10_000)
  assert.equal(postBodyMax(1), 10_000)
})

test('long file names keep their extension', async () => {
  const { safeFileName } = await import('../src/utils/slugify.ts')
  const name = safeFileName(`${'a'.repeat(100)}.apk`)
  assert.equal(name.length, 60)
  assert.ok(name.endsWith('.apk'))
  assert.equal(safeFileName('짧은 이름.pdf'), '짧은-이름.pdf')
})
