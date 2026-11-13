import assert from 'node:assert/strict'
import { test, before, after } from 'node:test'
import { initializeApp, deleteApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, createUserWithEmailAndPassword } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, terminate } from 'firebase/firestore'
import { choosePostSlug, postSlugBase, createPostWithSlug, postSlugRef } from '../src/utils/postSlug.ts'

const enabled = !!(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST)
const projectId = 'demo-memi-post-slugs'
const cfg = { postsCollection: 'memiBoardPosts' }
const apps = []
const clients = []
const str = stringValue => ({ stringValue })
const bool = booleanValue => ({ booleanValue })
async function seed(path, fields) {
  const response = await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${projectId}/databases/(default)/documents/${path}`, {
    method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }),
  })
  assert.equal(response.ok, true, await response.text())
}
before(async () => {
  if (!enabled) return
  for (let n = 0; n < 2; n++) {
    const app = initializeApp({ projectId, apiKey: 'demo-key' }, `slugs-${n}`)
    apps.push(app)
    const auth = getAuth(app)
    connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true })
    await createUserWithEmailAndPassword(auth, `slug-${n}@example.com`, 'test-password-123')
    const db = getFirestore(app)
    const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':')
    connectFirestoreEmulator(db, host, Number(port))
    clients.push({ db, uid: auth.currentUser.uid })
    await seed(`memiBoardUsers/${auth.currentUser.uid}`, { role: str('user') })
  }
  for (const board of ['board', 'other']) await seed(`memiBoardSettings/${board}`, { visibility: str('public') })
  await seed('memiBoardPostsSlugs/__migration', { ready: bool(true) })
  await seed('memiBoardPosts/legacy', { boardId: str('board'), slug: str('옛날-주소'), authorUid: str(clients[1].uid), listed: bool(true), isPublished: bool(false) })
  await seed('memiBoardPostsSlugs/board/slugs/옛날-주소', { postId: str('legacy') })
})
after(async () => { for (const app of apps) { await terminate(getFirestore(app)); await deleteApp(app) } })
const integration = (name, fn) => test(name, { skip: !enabled }, fn)
function save(client, id, base, { board = 'board', failBody = false } = {}) {
  return createPostWithSlug(client.db, cfg, board, id, base, (transaction, slug) => {
    transaction.set(doc(client.db, 'memiBoardPosts', id), {
      boardId: board, slug, title: base, authorUid: client.uid, moderationStatus: 'approved', listed: true, isPublished: false,
    })
    transaction.set(doc(client.db, 'memiBoardPosts', failBody ? 'someone-else' : id, 'body', 'main'), { content: '본문' })
  })
}
test('title URL, numeric suffixes and bounded Unicode document IDs', async () => {
  const occupied = new Set(['제목', '제목-2'])
  assert.equal(await choosePostSlug('제목', async s => !occupied.has(s)), '제목-3')
  assert.equal(await choosePostSlug('새-제목', async () => true), '새-제목')
  assert.equal(await choosePostSlug('new', async () => true), 'new-2')
  assert.equal(postSlugBase(''), 'post')
  assert.ok(Buffer.byteLength(postSlugBase('가'.repeat(1000))) <= 1400)
  assert.equal([...postSlugBase('가'.repeat(100))].length, 60)
  assert.equal(postSlugBase('a'.repeat(59) + '-b'), 'a'.repeat(59))
})
integration('simultaneous authors get distinct title URLs, including private drafts', async () => {
  const results = await Promise.all([save(clients[0], 'parallel-a', '동시-작성'), save(clients[1], 'parallel-b', '동시-작성')])
  assert.deepEqual(results.sort(), ['동시-작성', '동시-작성-2'])
  assert.equal(await save(clients[0], 'parallel-c', '동시-작성'), '동시-작성-3')
})
integration('backfilled private legacy URL is preserved; board namespaces are independent', async () => {
  assert.equal(await save(clients[0], 'legacy-new', '옛날-주소'), '옛날-주소-2')
  assert.equal(await save(clients[0], 'other-board', '옛날-주소', { board: 'other' }), '옛날-주소')
  await assert.rejects(getDoc(doc(clients[0].db, 'memiBoardPosts', 'legacy')), e => e.code === 'permission-denied')
})
integration('failed save rolls back the reservation and metadata; retry uses the bare title', async () => {
  await assert.rejects(save(clients[0], 'failed-save', '실패-재시도', { failBody: true }), e => e.code === 'permission-denied')
  assert.equal((await getDoc(postSlugRef(clients[0].db, cfg, 'board', '실패-재시도'))).exists(), false)
  assert.equal((await getDoc(doc(clients[0].db, 'memiBoardPosts', 'failed-save'))).exists(), false)
  assert.equal(await save(clients[0], 'failed-save', '실패-재시도'), '실패-재시도')
})
integration('draft editing, publishing and post reload preserve URL and body', async () => {
  const client = clients[0]
  assert.equal(await save(client, 'draft-flow', '초안-흐름'), '초안-흐름')
  const post = doc(client.db, 'memiBoardPosts', 'draft-flow')
  await updateDoc(post, { title: '수정한 제목' })
  await setDoc(doc(client.db, 'memiBoardPosts', 'draft-flow', 'body', 'main'), { content: '수정한 본문' })
  await updateDoc(post, { isPublished: true })
  assert.equal((await getDoc(post)).data().slug, '초안-흐름')
  assert.equal((await getDoc(doc(client.db, 'memiBoardPosts', 'draft-flow', 'body', 'main'))).data().content, '수정한 본문')
  await assert.rejects(updateDoc(post, { slug: '주소-변경' }), e => e.code === 'permission-denied')
  await assert.rejects(save(client, 'draft-flow', '덮어쓰기'), /already been saved/)
})
integration('reservations cannot be forged, overwritten or reused after deletion', async () => {
  const client = clients[0]
  await assert.rejects(setDoc(postSlugRef(client.db, cfg, 'board', '가짜'), { postId: 'missing' }), e => e.code === 'permission-denied')
  await save(client, 'permanent', '영구-주소')
  await deleteDoc(doc(client.db, 'memiBoardPosts', 'permanent'))
  assert.equal(await save(client, 'replacement', '영구-주소'), '영구-주소-2')
  await assert.rejects(setDoc(postSlugRef(client.db, cfg, 'board', '영구-주소'), { postId: 'replacement' }), e => e.code === 'permission-denied')
})
integration('legacy auto-ID clients still save; unreserved title-only writes are denied', async () => {
  const client = clients[0]
  const fields = { boardId: 'board', title: '호환', authorUid: client.uid, moderationStatus: 'approved', listed: true, isPublished: false }
  await setDoc(doc(client.db, 'memiBoardPosts', 'old-client'), { ...fields, slug: '호환-AbCdEfGhIjKlMnOpQrSt' })
  await assert.rejects(setDoc(doc(client.db, 'memiBoardPosts', 'bypass'), { ...fields, slug: '예약-없음' }), e => e.code === 'permission-denied')
})

integration('image board ID URLs remain supported; uninitialized migration cannot steal legacy URLs', async () => {
  assert.equal(await save(clients[0], 'image-url-id', 'image-url-id'), 'image-url-id')
  await seed('memiBoardPostsSlugs/__migration', { ready: bool(false) })
  try {
    await assert.rejects(save(clients[0], 'not-ready', '이전-미완료'), /not initialized/)
    assert.equal((await getDoc(postSlugRef(clients[0].db, cfg, 'board', '이전-미완료'))).exists(), false)
  } finally {
    await seed('memiBoardPostsSlugs/__migration', { ready: bool(true) })
  }
})
