import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { initializeApp, deleteApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth'
import { collection, connectFirestoreEmulator, doc, getDocs, getFirestore, query, terminate, where, writeBatch } from 'firebase/firestore'

const projectId = 'demo-memi-profile-rules'
const enabled = process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST
const clients = {}
const apps = []

async function seed(path, fields) {
  const response = await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${projectId}/databases/(default)/documents/${path}`, {
    method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  assert.equal(response.ok, true, await response.text())
}
const str = stringValue => ({ stringValue })
const bool = booleanValue => ({ booleanValue })

before(async () => {
  if (!enabled) return
  for (const name of ['author', 'other']) {
    const app = initializeApp({ apiKey: 'demo-key', projectId }, `profile-${name}`)
    apps.push(app)
    const auth = getAuth(app)
    connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true })
    const db = getFirestore(app)
    const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':')
    connectFirestoreEmulator(db, host, Number(port))
    await signInAnonymously(auth)
    await seed(`memiBoardUsers/${auth.currentUser.uid}`, { role: str('user') })
    clients[name] = { auth, db, uid: auth.currentUser.uid }
  }
  const { author, other } = clients
  await seed('memiBoardSettings/board', {})
  await seed('memiBoardPosts/post', { boardId: str('board'), authorUid: str(author.uid), listed: bool(true), isPublished: bool(true) })
  const comment = { postId: str('post'), boardId: str('board'), body: str('b') }
  await seed('memiBoardComments/mine', { ...comment, authorUid: str(author.uid), listed: bool(true) })
  await seed('memiBoardComments/reply', { ...comment, authorUid: str(other.uid), replyToUid: str(author.uid), listed: bool(true) })
  await seed('memiBoardComments/hidden-reply', { ...comment, authorUid: str(other.uid), replyToUid: str(author.uid), listed: bool(false) })
}, { timeout: 30000 })

after(async () => {
  for (const app of apps) { await terminate(getFirestore(app)); await deleteApp(app) }
})

const rulesTest = (name, fn) => test(name, { skip: !enabled }, fn)
const denied = error => error.code === 'permission-denied'

// Mirrors updateProfileReferences in ProfileEditModal.vue.
rulesTest('a regular user cannot list replies to them without the listed filter', async () => {
  const { db, uid } = clients.author
  await assert.rejects(getDocs(query(collection(db, 'memiBoardComments'), where('replyToUid', '==', uid))), denied)
})

rulesTest('a regular user can propagate a new profile name to posts, comments, and replies', async () => {
  const { db, uid } = clients.author
  const comments = collection(db, 'memiBoardComments')
  const [posts, mine, replies] = await Promise.all([
    getDocs(query(collection(db, 'memiBoardPosts'), where('authorUid', '==', uid))),
    getDocs(query(comments, where('authorUid', '==', uid))),
    getDocs(query(comments, where('replyToUid', '==', uid), where('listed', '==', true))),
  ])
  assert.deepEqual(replies.docs.map(d => d.id), ['reply'])
  const batch = writeBatch(db)
  for (const d of [...posts.docs, ...mine.docs]) batch.update(d.ref, { authorName: 'New name', authorPhoto: null })
  for (const d of replies.docs) batch.update(d.ref, { replyToName: 'New name' })
  batch.update(doc(db, 'memiBoardUsers', uid), { displayName: 'New name' })
  await batch.commit()
})
