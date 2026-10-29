import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { initializeApp, deleteApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth'
import { connectFirestoreEmulator, deleteField, doc, getFirestore, serverTimestamp, setDoc, terminate, updateDoc } from 'firebase/firestore'

const projectId = 'demo-memi-notice-rules'
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
  for (const role of ['admin', 'staff', 'user']) {
    const app = initializeApp({ apiKey: 'demo-key', projectId }, `notice-${role}`)
    apps.push(app)
    const auth = getAuth(app)
    connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true })
    const db = getFirestore(app)
    const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':')
    connectFirestoreEmulator(db, host, Number(port))
    await signInAnonymously(auth)
    await seed(`memiBoardUsers/${auth.currentUser.uid}`, { role: str(role) })
    clients[role] = { auth, db }
  }
  await seed('memiBoardSettings/board', { allowedStaffUids: { arrayValue: { values: [str(clients.staff.auth.currentUser.uid)] } } })
  const post = { boardId: str('board'), authorUid: str(clients.user.auth.currentUser.uid), listed: bool(true) }
  await seed('memiBoardPosts/published', { ...post, isPublished: bool(true), title: str('t') })
  await seed('memiBoardPosts/draft', { ...post, isPublished: bool(false), title: str('t') })
}, { timeout: 30000 })

after(async () => {
  for (const app of apps) { await terminate(getFirestore(app)); await deleteApp(app) }
})

const rulesTest = (name, fn) => test(name, { skip: !enabled }, fn)
const denied = error => error.code === 'permission-denied'
const pin = { pinned: true, pinnedAt: serverTimestamp() }
const unpin = { pinned: deleteField(), pinnedAt: deleteField() }

rulesTest('authors cannot pin their own posts', async () => {
  const ref = doc(clients.user.db, 'memiBoardPosts', 'published')
  await assert.rejects(updateDoc(ref, pin), denied)
  await assert.rejects(updateDoc(ref, { title: 'changed', ...pin }), denied)
})

rulesTest('authors cannot create pinned posts', async () => {
  await assert.rejects(setDoc(doc(clients.user.db, 'memiBoardPosts', 'new-pinned'), {
    boardId: 'board', authorUid: clients.user.auth.currentUser.uid, moderationStatus: 'approved',
    listed: true, isPublished: false, title: 't', pinned: true, pinnedAt: serverTimestamp(),
  }), denied)
})

rulesTest('assigned staff and admins can pin and unpin published posts', async () => {
  for (const role of ['staff', 'admin']) {
    const ref = doc(clients[role].db, 'memiBoardPosts', 'published')
    await updateDoc(ref, pin)
    await updateDoc(ref, unpin)
  }
})

rulesTest('pins require a published post, server time, and only pin fields', async () => {
  const db = clients.staff.db
  await assert.rejects(updateDoc(doc(db, 'memiBoardPosts', 'draft'), pin), denied)
  await assert.rejects(updateDoc(doc(db, 'memiBoardPosts', 'published'), { pinned: true, pinnedAt: new Date(0) }), denied)
  await assert.rejects(updateDoc(doc(db, 'memiBoardPosts', 'published'), { pinned: false, pinnedAt: serverTimestamp() }), denied)
})

rulesTest('authors keep editing pinned posts without changing the pin', async () => {
  await updateDoc(doc(clients.staff.db, 'memiBoardPosts', 'published'), pin)
  const ref = doc(clients.user.db, 'memiBoardPosts', 'published')
  await updateDoc(ref, { title: 'edited' })
  await assert.rejects(updateDoc(ref, unpin), denied)
})
