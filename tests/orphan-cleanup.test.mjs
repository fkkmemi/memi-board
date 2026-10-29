import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isOldOrphanFile, isOrphanRecord, ORPHAN_FILE_MIN_AGE_MS } from '../src/utils/orphanCleanup.ts'

const posts = new Set(['post'])
const comments = new Set(['comment'])

test('comments and post likes require a missing post; drafts remain valid parents', () => {
  for (const kind of ['comment', 'like']) {
    assert.equal(isOrphanRecord(kind, { postId: 'post' }, posts, comments), false)
    assert.equal(isOrphanRecord(kind, { postId: 'deleted' }, posts, comments), true)
  }
})

test('comment likes are orphaned when either their post or comment is missing', () => {
  const like = { postId: 'post', target: 'comment', commentId: 'comment' }
  assert.equal(isOrphanRecord('like', like, posts, comments), false)
  assert.equal(isOrphanRecord('like', like, new Set(), comments), true)
  assert.equal(isOrphanRecord('like', like, posts, new Set()), true)
  assert.equal(isOrphanRecord('like', { ...like, target: 'post' }, posts, new Set()), false)
})

test('unknown or malformed parent identifiers are retained', () => {
  for (const postId of [undefined, null, 123, '', 'wrong/path']) {
    assert.equal(isOrphanRecord('comment', { postId }, posts, comments), false)
  }
  for (const commentId of [undefined, null, 123, '', 'wrong/path']) {
    assert.equal(isOrphanRecord('like', { postId: 'post', target: 'comment', commentId }, posts, comments), false)
  }
})

test('a restored parent excludes a previously selected orphan', () => {
  const data = { postId: 'restored' }
  assert.equal(isOrphanRecord('comment', data, posts, comments), true)
  assert.equal(isOrphanRecord('comment', data, new Set([...posts, 'restored']), comments), false)
})

test('files require a valid update time at least 24 hours old', () => {
  const now = Date.parse('2026-10-29T12:00:00Z')
  assert.equal(isOldOrphanFile(new Date(now - ORPHAN_FILE_MIN_AGE_MS).toISOString(), now), true)
  assert.equal(isOldOrphanFile(new Date(now - ORPHAN_FILE_MIN_AGE_MS + 1).toISOString(), now), false)
  assert.equal(isOldOrphanFile(new Date(now + 1000).toISOString(), now), false)
  assert.equal(isOldOrphanFile('invalid', now), false)
})

test('cleanup file paths cannot leave the configured storage namespace', async () => {
  const { parseCleanupFilePath: parse } = await import('../src/utils/orphanCleanup.ts')
  for (const path of ['other/post/images/a.jpg', 'memiBoardPostsExtra/post/images/a.jpg', 'memiBoardPosts/post/private/key', 'memiBoardPosts/post/images/../secret', 'memiBoardPosts/post/comment-images/file.jpg', 'memiBoardPosts/post/images//file.jpg', 'memiBoardPosts/post/attachments/nested/file']) {
    assert.equal(parse(path, 'memiBoardPosts'), null, path)
  }
  assert.deepEqual(parse('memiBoardPosts/post/images/a.jpg', 'memiBoardPosts'), { postId: 'post' })
  assert.deepEqual(parse('memiBoardPosts/post/images/thumbnails/a.jpg', 'memiBoardPosts'), { postId: 'post' })
  assert.deepEqual(parse('memiBoardPosts/post/comment-images/comment/a.jpg', 'memiBoardPosts'), { postId: 'post', commentId: 'comment' })
  assert.deepEqual(parse('tenant/customPosts/post/attachments/a.pdf', 'tenant/customPosts'), { postId: 'post' })
})

test('cleanup document paths only allow direct children of their own collection', async () => {
  const { isCleanupDocumentPath: valid } = await import('../src/utils/orphanCleanup.ts')
  const cfg = { commentsCollection: 'comments', likesCollection: 'likes' }
  assert.equal(valid('comments/id', 'comment', cfg), true)
  assert.equal(valid('likes/id', 'like', cfg), true)
  for (const path of ['users/admin', 'comments/id/subcollection/id', 'comments/', 'comments/..', 'likes/id']) {
    assert.equal(valid(path, 'comment', cfg), false, path)
  }
})
