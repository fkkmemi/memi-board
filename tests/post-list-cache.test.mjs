import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  POST_LIST_CACHE_TTL_MS,
  clearPostListCache,
  postListCacheKey,
  savePostListSnapshot,
  takePostListSnapshot,
} from '../src/utils/postListCache.ts'

const snapshot = n => ({ olderPosts: Array.from({ length: n }, (_, i) => ({ id: String(i) })), olderCursor: { id: 'c' }, hasMore: true, scrollY: 1234 })
const key = postListCacheKey('fromAI', true, 'u1')

test('a saved list comes back once with its cursor and scroll position', () => {
  clearPostListCache()
  savePostListSnapshot(key, snapshot(20), 1000)
  const entry = takePostListSnapshot(key, 2000)
  assert.equal(entry.olderPosts.length, 20)
  assert.equal(entry.scrollY, 1234)
  assert.deepEqual(entry.olderCursor, { id: 'c' })
  assert.equal(takePostListSnapshot(key, 2000), null)
})

test('an entry older than the TTL is discarded', () => {
  clearPostListCache()
  savePostListSnapshot(key, snapshot(10), 0)
  assert.equal(takePostListSnapshot(key, POST_LIST_CACHE_TTL_MS + 1), null)
})

test('boards, public scope and users do not share entries', () => {
  clearPostListCache()
  savePostListSnapshot(key, snapshot(10), 0)
  assert.equal(takePostListSnapshot(postListCacheKey('other', true, 'u1'), 1), null)
  assert.equal(takePostListSnapshot(postListCacheKey('fromAI', false, 'u1'), 1), null)
  assert.equal(takePostListSnapshot(postListCacheKey('fromAI', true, 'u2'), 1), null)
  assert.notEqual(takePostListSnapshot(key, 1), null)
})

test('clearing drops every entry and the store keeps at most twelve boards', () => {
  clearPostListCache()
  for (let i = 0; i < 15; i++) savePostListSnapshot(`b${i}`, snapshot(1), 0)
  assert.equal(takePostListSnapshot('b0', 1), null)
  assert.notEqual(takePostListSnapshot('b14', 1), null)
  savePostListSnapshot(key, snapshot(1), 0)
  clearPostListCache()
  assert.equal(takePostListSnapshot(key, 1), null)
})
