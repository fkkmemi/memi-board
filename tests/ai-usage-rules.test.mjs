import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { initializeApp, deleteApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth'
import { connectFirestoreEmulator, doc, getFirestore, serverTimestamp, terminate, updateDoc } from 'firebase/firestore'

const projectId = 'demo-memi-ai-usage'
const enabled = process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST
let app, db, uid

before(async () => {
  if (!enabled) return
  app = initializeApp({ apiKey: 'demo-key', projectId }, 'ai-usage')
  const auth = getAuth(app)
  connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true })
  db = getFirestore(app)
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':')
  connectFirestoreEmulator(db, host, Number(port))
  await signInAnonymously(auth)
  uid = auth.currentUser.uid
  const response = await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${projectId}/databases/(default)/documents/memiBoardUsers/${uid}`, {
    method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { role: { stringValue: 'user' } } }),
  })
  assert.equal(response.ok, true, await response.text())
}, { timeout: 30000 })

after(async () => {
  if (app) { await terminate(db); await deleteApp(app) }
})

const rulesTest = (name, fn) => test(name, { skip: !enabled }, fn)
const denied = error => error.code === 'permission-denied'
const update = fields => updateDoc(doc(db, 'memiBoardUsers', uid), { ...fields, updatedAt: serverTimestamp() })

rulesTest('image quota: the first call opens a window with one reservation', async () => {
  await assert.rejects(update({ aiImageCount: 3, aiImagePending: 0, aiImageWindowAt: serverTimestamp() }), denied)
  await update({ aiImageCount: 0, aiImagePending: 1, aiImageWindowAt: serverTimestamp() })
})

rulesTest('image quota: confirming moves one reservation to the count and nothing else', async () => {
  await assert.rejects(update({ aiImageCount: 2, aiImagePending: 0 }), denied)
  await update({ aiImageCount: 1, aiImagePending: 0 })
})

rulesTest('image quota: the count cannot be lowered or reset inside the window', async () => {
  await assert.rejects(update({ aiImageCount: 0 }), denied)
  await assert.rejects(update({ aiImageCount: 0, aiImagePending: 0, aiImageWindowAt: serverTimestamp() }), denied)
})

rulesTest('image quota: reservations stop at three in total', async () => {
  for (let used = 1; used < 3; used++) {
    await update({ aiImagePending: 1 })
    await update({ aiImageCount: used + 1, aiImagePending: 0 })
  }
  await assert.rejects(update({ aiImagePending: 1 }), denied)
  await assert.rejects(update({ aiImageCount: 4, aiImagePending: 0 }), denied)
})

rulesTest('image quota does not touch the writing quota', async () => {
  await update({ aiWritingCount: 0, aiWritingPending: 1, aiWritingWindowAt: serverTimestamp() })
  await update({ aiWritingCount: 1, aiWritingPending: 0 })
  // Mixed writes of both quotas in one update are not allowed.
  await assert.rejects(update({ aiWritingPending: 1, aiImagePending: 1 }), denied)
})

rulesTest('a reservation cannot be released below zero', async () => {
  await assert.rejects(update({ aiImagePending: -1 }), denied)
})
