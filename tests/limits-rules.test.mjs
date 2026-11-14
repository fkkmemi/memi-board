import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { initializeApp, deleteApp } from 'firebase/app'
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, doc, getFirestore, increment, runTransaction, serverTimestamp, setDoc, terminate, updateDoc, writeBatch } from 'firebase/firestore'
import { connectStorageEmulator, getStorage, ref, uploadBytes } from 'firebase/storage'

// Boundary checks for the content limits in docs/firestore.rules.example and docs/storage.rules.example:
// exactly at a limit is allowed, one past it is denied.
const projectId = 'demo-memi-limits'
const enabled = !!(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST && process.env.FIREBASE_STORAGE_EMULATOR_HOST)
const apps = []
const clients = {}
const str = stringValue => ({ stringValue })
const int = n => ({ integerValue: String(n) })
const time = date => ({ timestampValue: date.toISOString() })
const denied = error => ['permission-denied', 'storage/unauthorized'].includes(error.code)
const LOCALES = ['ko', 'en', 'ja', 'de', 'fr', 'es', 'pt', 'zh', 'ar', 'id']

async function seed(path, fields) {
  const response = await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${projectId}/databases/(default)/documents/${path}`, {
    method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }),
  })
  assert.equal(response.ok, true, await response.text())
}

before(async () => {
  if (!enabled) return
  const now = Date.now()
  const users = {
    writer: { role: str('user') },
    banned: { role: str('user'), moderationBlockCount: int(10), moderationBlockAt: time(new Date(now)) },
    decayed: { role: str('user'), moderationBlockCount: int(10), moderationBlockAt: time(new Date(now - 25 * 60 * 60 * 1000)) },
    nodoc: null,
  }
  for (const [name, fields] of Object.entries(users)) {
    const app = initializeApp({ apiKey: 'demo-key', projectId, storageBucket: `${projectId}.appspot.com` }, `limits-${name}`)
    apps.push(app)
    const auth = getAuth(app)
    connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true })
    await createUserWithEmailAndPassword(auth, `limits-${name}@example.com`, 'test-password-123')
    const db = getFirestore(app)
    const [dbHost, dbPort] = process.env.FIRESTORE_EMULATOR_HOST.split(':')
    connectFirestoreEmulator(db, dbHost, Number(dbPort))
    const storage = getStorage(app)
    const [storageHost, storagePort] = process.env.FIREBASE_STORAGE_EMULATOR_HOST.split(':')
    connectStorageEmulator(storage, storageHost, Number(storagePort))
    if (fields) await seed(`memiBoardUsers/${auth.currentUser.uid}`, fields)
    clients[name] = { db, storage, uid: auth.currentUser.uid }
  }
  await seed('memiBoardSettings/board', { visibility: str('public') })
  await seed('memiBoardPostsSlugs/__migration', { ready: { booleanValue: true } })
}, { timeout: 30000 })

after(async () => { for (const app of apps) { await terminate(getFirestore(app)); await deleteApp(app) } })

const rulesTest = (name, fn) => test(name, { skip: !enabled }, fn)
let serial = 0

/** Creates a post the way the app does: URL reservation, metadata and body in one transaction. */
function createPost(client, fields = {}, { slug, content = 'body' } = {}) {
  const id = `p${++serial}`
  const postSlug = slug ?? `post-${serial}`
  return runTransaction(client.db, async (transaction) => {
    transaction.set(doc(client.db, 'memiBoardPostsSlugs', 'board', 'slugs', postSlug), { postId: id })
    transaction.set(doc(client.db, 'memiBoardPosts', id), {
      boardId: 'board', slug: postSlug, title: 'title', authorUid: client.uid,
      moderationStatus: 'approved', listed: true, isPublished: false, ...fields,
    })
    transaction.set(doc(client.db, 'memiBoardPosts', id, 'body', 'main'), { content })
  }).then(() => id)
}
const attachment = (postId, n, overrides = {}) => ({
  name: `a${n}.pdf`, url: `https://example.com/a${n}`, path: `memiBoardPosts/${postId}/attachments/${n}-a.pdf`, size: 10, type: 'application/pdf', ...overrides,
})

rulesTest('profile name and bio', async () => {
  const { db, uid } = clients.writer
  const me = doc(db, 'memiBoardUsers', uid)
  await updateDoc(me, { displayName: '가'.repeat(50), bio: 'b'.repeat(200) })
  await assert.rejects(updateDoc(me, { displayName: '가'.repeat(51) }), denied)
  await assert.rejects(updateDoc(me, { bio: 'b'.repeat(201) }), denied)
})

rulesTest('author memo text, sentiment and fields', async () => {
  const { db, uid } = clients.writer
  const memo = doc(db, 'memiBoardUsers', uid, 'memos', 'someone')
  await setDoc(memo, { text: 'm'.repeat(100), sentiment: 'good', updatedAt: serverTimestamp() })
  await setDoc(memo, { text: '', sentiment: null, updatedAt: serverTimestamp() })
  await assert.rejects(setDoc(memo, { text: 'm'.repeat(101), sentiment: 'bad', updatedAt: serverTimestamp() }), denied)
  await assert.rejects(setDoc(memo, { text: 'x', sentiment: 'great', updatedAt: serverTimestamp() }), denied)
  await assert.rejects(setDoc(memo, { text: 'x', sentiment: 'bad', updatedAt: serverTimestamp(), extra: 1 }), denied)
})

rulesTest('post title, translated titles, URL and author name', async () => {
  const client = clients.writer
  const i18n = Object.fromEntries(LOCALES.map(locale => [locale, { title: 't'.repeat(300), summary: 's' }]))
  await createPost(client, { title: '제'.repeat(150), i18n, authorName: '이'.repeat(50) }, { slug: 'u'.repeat(80) })
  await assert.rejects(createPost(client, { title: '제'.repeat(151) }), denied)
  await assert.rejects(createPost(client, { i18n: { ...i18n, id: { title: 't'.repeat(301) } } }), denied)
  await assert.rejects(createPost(client, { authorName: '이'.repeat(51) }), denied)
  await assert.rejects(createPost(client, {}, { slug: 'u'.repeat(81) }), denied)
})

rulesTest('body length', async () => {
  const client = clients.writer
  await createPost(client, {}, { content: 'x'.repeat(50000) })
  await assert.rejects(createPost(client, {}, { content: 'x'.repeat(50001) }), denied)
})

rulesTest('tags: count, length and line breaks', async () => {
  const client = clients.writer
  const tags = Array.from({ length: 10 }, (_, i) => `${i}`.padEnd(30, 'x'))
  const id = await createPost(client, { tags })
  await createPost(client, { tags: [] })
  await createPost(client, { tags: ['', 'a'] })
  await assert.rejects(createPost(client, { tags: [...tags, 'x'] }), denied, '11 tags')
  await assert.rejects(createPost(client, { tags: ['x'.repeat(31)] }), denied, '31 chars')
  await assert.rejects(createPost(client, { tags: ['a\nb'] }), denied, 'line break')
  await assert.rejects(createPost(client, { tags: [Array.from({ length: 10 }, () => 'x'.repeat(30)).join('\n')] }), denied, 'joined long tag')
  // join() turns non-string items into text, so they are held to the same 30-char limit in that form.
  await createPost(client, { tags: [1] })
  await assert.rejects(createPost(client, { tags: [{ a: 'x'.repeat(40) }] }), denied, 'map item over the limit')
  await assert.rejects(createPost(client, { extend: { f0: { a: 'x'.repeat(250) } } }), denied, 'map value over the limit')
  await assert.rejects(updateDoc(doc(client.db, 'memiBoardPosts', id), { tags: ['a\nb'] }), denied, 'update line break')
})

rulesTest('custom field values: count, length and line breaks', async () => {
  const client = clients.writer
  const extend = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`f${i}`, 'v'.repeat(200)]))
  const id = await createPost(client, { extend })
  await createPost(client, { extend: {} })
  await assert.rejects(createPost(client, { extend: { ...extend, f20: 'v' } }), denied)
  await assert.rejects(createPost(client, { extend: { f0: 'v'.repeat(201) } }), denied)
  await assert.rejects(createPost(client, { extend: { f0: 'x\ny' } }), denied)
  await assert.rejects(createPost(client, { extend: { f0: Array.from({ length: 2 }, () => 'v'.repeat(200)).join('\n') } }), denied)
  await assert.rejects(updateDoc(doc(client.db, 'memiBoardPosts', id), { extend: { f0: 'x\ny' } }), denied)
})

rulesTest('attachments: count and where each entry points', async () => {
  const client = clients.writer
  const id = `p${serial + 1}`
  await createPost(client, { attachments: [0, 1, 2, 3, 4].map(n => attachment(id, n)) })
  const next = () => `p${serial + 1}`
  await assert.rejects(createPost(client, { attachments: [0, 1, 2, 3, 4, 5].map(n => attachment(next(), n)) }), denied)
  await assert.rejects(createPost(client, { attachments: [attachment('another-post', 0)] }), denied)
  await assert.rejects(createPost(client, { attachments: [attachment(next(), 0, { url: 'http://example.com/a' })] }), denied)
  await assert.rejects(createPost(client, { attachments: [attachment(next(), 0, { path: `memiBoardPosts/${next()}/attachments/sub/a.pdf` })] }), denied)
})

rulesTest('a post with every limited field at its maximum', async () => {
  const client = clients.writer
  const id = `p${serial + 1}`
  await createPost(client, {
    title: '제'.repeat(150), authorName: '이'.repeat(50),
    i18n: Object.fromEntries(LOCALES.map(locale => [locale, { title: 't'.repeat(300), summary: 's' }])),
    tags: Array.from({ length: 10 }, (_, i) => `${i}`.padEnd(30, 'x')),
    extend: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`f${i}`, 'v'.repeat(200)])),
    attachments: [0, 1, 2, 3, 4].map(n => attachment(id, n)),
  }, { content: 'x'.repeat(50000) })
  await updateDoc(doc(client.db, 'memiBoardPosts', id), { title: '다'.repeat(150), tags: ['changed'], extend: { f0: 'w' } })
})

rulesTest('existing documents with older, longer values stay editable', async () => {
  const client = clients.writer
  await seed('memiBoardPosts/legacy-long', {
    boardId: str('board'), slug: str('legacy-long'), title: str('긴'.repeat(200)), authorUid: str(client.uid),
    moderationStatus: str('approved'), listed: { booleanValue: true }, isPublished: { booleanValue: false },
  })
  const legacy = doc(client.db, 'memiBoardPosts', 'legacy-long')
  await updateDoc(legacy, { tags: ['a'] })
  await assert.rejects(updateDoc(legacy, { title: '긴'.repeat(151) }), denied)
  await updateDoc(legacy, { title: '짧게' })
})

rulesTest('moderation ban blocks new posts and comments until it decays', async () => {
  const postId = await createPost(clients.writer)
  const comment = (client, id) => setDoc(doc(client.db, 'memiBoardComments', id), {
    postId, boardId: 'board', authorUid: client.uid, body: 'hello', moderationStatus: 'approved', listed: true,
  })
  await assert.rejects(createPost(clients.banned), denied)
  await assert.rejects(comment(clients.banned, 'c-banned'), denied)
  await createPost(clients.decayed)
  await comment(clients.decayed, 'c-decayed')
  await createPost(clients.nodoc)
})

rulesTest('counters and creation time cannot be set by hand', async () => {
  const author = clients.writer
  const reader = clients.nodoc
  const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
  for (const fields of [{ likeCount: 5 }, { viewCount: 5 }, { commentCount: 5 }, { createdAt: future }]) {
    await assert.rejects(createPost(author, fields), denied, JSON.stringify(fields))
  }
  const postId = await createPost(author, { likeCount: 0, viewCount: 0, commentCount: 0, createdAt: serverTimestamp() })
  const post = doc(author.db, 'memiBoardPosts', postId)
  // The author's own edit cannot touch counters or the creation time.
  for (const fields of [{ likeCount: 9 }, { viewCount: 9 }, { commentCount: 9 }, { createdAt: future }]) {
    await assert.rejects(updateDoc(post, { title: 'edited', ...fields }), denied, JSON.stringify(fields))
  }
  // A like count moves only together with the caller's own like document.
  const readerPost = doc(reader.db, 'memiBoardPosts', postId)
  const like = doc(reader.db, 'memiBoardLikes', `${postId}_${reader.uid}`)
  await assert.rejects(updateDoc(readerPost, { likeCount: increment(1) }), denied)
  const likeBatch = writeBatch(reader.db)
  likeBatch.set(like, { uid: reader.uid, postId, boardId: 'board', createdAt: serverTimestamp() })
  likeBatch.update(readerPost, { likeCount: increment(1) })
  await likeBatch.commit()
  await assert.rejects(updateDoc(readerPost, { likeCount: increment(1) }), denied)
  await assert.rejects(updateDoc(readerPost, { likeCount: increment(-1) }), denied)
  const unlikeBatch = writeBatch(reader.db)
  unlikeBatch.delete(like)
  unlikeBatch.update(readerPost, { likeCount: increment(-1) })
  await unlikeBatch.commit()

  const comment = (id, fields = {}) => setDoc(doc(author.db, 'memiBoardComments', id), {
    postId, boardId: 'board', authorUid: author.uid, body: 'hello', moderationStatus: 'approved', listed: true, ...fields,
  })
  await assert.rejects(comment('c-liked', { likeCount: 3 }), denied)
  await assert.rejects(comment('c-replied', { replyCount: 3 }), denied)
  await assert.rejects(comment('c-future', { createdAt: future }), denied)
  await comment('c-fresh', { likeCount: 0, replyCount: 0, createdAt: serverTimestamp() })
  const fresh = doc(author.db, 'memiBoardComments', 'c-fresh')
  await assert.rejects(updateDoc(fresh, { likeCount: 9 }), denied)
  await assert.rejects(updateDoc(fresh, { createdAt: future }), denied)
  await assert.rejects(updateDoc(doc(reader.db, 'memiBoardComments', 'c-fresh'), { likeCount: 1 }), denied)
})

rulesTest('comment body length is also checked on edits', async () => {
  const client = clients.writer
  const postId = await createPost(client)
  const ref = doc(client.db, 'memiBoardComments', 'c-edit')
  await setDoc(ref, { postId, boardId: 'board', authorUid: client.uid, body: 'hello', moderationStatus: 'approved', listed: true })
  await updateDoc(ref, { body: '가'.repeat(1000) })
  await assert.rejects(updateDoc(ref, { body: '가'.repeat(1001) }), denied)
  await assert.rejects(updateDoc(ref, { body: '' }), denied)
})

rulesTest('attachment files: blocked types and size', async () => {
  const client = clients.writer
  const postId = await createPost(client)
  const put = (name, bytes = 1, contentType = 'application/octet-stream') => uploadBytes(
    ref(client.storage, `memiBoardPosts/${postId}/attachments/${name}`), new Uint8Array(bytes), { contentType },
  )
  for (const name of ['a.html', 'A.HTML', 'a.svg', 'a.js', 'a.exe', 'a.msi', 'a.bat', 'a.jar']) {
    await assert.rejects(put(name), denied, name)
  }
  await assert.rejects(put('a.txt', 1, 'text/html'), denied)
  await assert.rejects(put('a.png', 1, 'image/svg+xml'), denied)
  for (const name of ['a.pdf', 'a.apk', 'a.bin', 'a.zip']) await put(name)
  await put('big.bin', 20 * 1024 * 1024 - 1)
  await assert.rejects(put('too-big.bin', 20 * 1024 * 1024), denied)
})
