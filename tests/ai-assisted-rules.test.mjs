import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { initializeApp, deleteApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth'
import { connectFirestoreEmulator, doc, getFirestore, terminate, updateDoc } from 'firebase/firestore'

const projectId = 'demo-memi-ai-assisted-rules'
const enabled = process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST
const apps = []
let db
let uid

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
  const app = initializeApp({ apiKey: 'demo-key', projectId }, 'ai-assisted-user')
  apps.push(app)
  const auth = getAuth(app)
  connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true })
  db = getFirestore(app)
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':')
  connectFirestoreEmulator(db, host, Number(port))
  await signInAnonymously(auth)
  uid = auth.currentUser.uid
  await seed(`memiBoardUsers/${uid}`, { role: str('user') })
  await seed('memiBoardSettings/board', {})
  const owned = { boardId: str('board'), authorUid: str(uid), listed: bool(true) }
  // 예전 글·댓글: aiAssisted 필드가 없다.
  await seed('memiBoardPosts/legacy', { ...owned, isPublished: bool(true), title: str('t') })
  await seed('memiBoardComments/legacy', { ...owned, postId: str('legacy'), body: str('b') })
}, { timeout: 30000 })

after(async () => {
  for (const app of apps) { await terminate(getFirestore(app)); await deleteApp(app) }
})

const rulesTest = (name, fn) => test(name, { skip: !enabled }, fn)
const denied = error => error.code === 'permission-denied'

rulesTest('authors can mark legacy posts and comments as AI-assisted', async () => {
  await updateDoc(doc(db, 'memiBoardPosts', 'legacy'), { aiAssisted: true })
  await updateDoc(doc(db, 'memiBoardPosts', 'legacy'), { aiAssisted: false })
  await updateDoc(doc(db, 'memiBoardComments', 'legacy'), { aiAssisted: true })
})

rulesTest('aiAssisted must be a boolean', async () => {
  await assert.rejects(updateDoc(doc(db, 'memiBoardPosts', 'legacy'), { aiAssisted: 'yes' }), denied)
  await assert.rejects(updateDoc(doc(db, 'memiBoardComments', 'legacy'), { aiAssisted: 1 }), denied)
})
