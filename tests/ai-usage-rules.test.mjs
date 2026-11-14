import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { initializeApp, deleteApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth'
import { connectFirestoreEmulator, deleteField, doc, getFirestore, serverTimestamp, terminate, updateDoc } from 'firebase/firestore'

const projectId = 'demo-memi-ai-usage'
const enabled = process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST
let app, db, uid
let adminApp, adminDb

async function seedUser(id, role) {
  const response = await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${projectId}/databases/(default)/documents/memiBoardUsers/${id}`, {
    method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { role: { stringValue: role } } }),
  })
  assert.equal(response.ok, true, await response.text())
}

async function connect(name) {
  const clientApp = initializeApp({ apiKey: 'demo-key', projectId }, name)
  const auth = getAuth(clientApp)
  connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true })
  const firestore = getFirestore(clientApp)
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':')
  connectFirestoreEmulator(firestore, host, Number(port))
  await signInAnonymously(auth)
  return { clientApp, firestore, id: auth.currentUser.uid }
}

before(async () => {
  if (!enabled) return
  const user = await connect('ai-usage')
  app = user.clientApp
  db = user.firestore
  uid = user.id
  await seedUser(uid, 'user')
  const admin = await connect('ai-usage-admin')
  adminApp = admin.clientApp
  adminDb = admin.firestore
  await seedUser(admin.id, 'admin')
}, { timeout: 30000 })

after(async () => {
  if (app) { await terminate(db); await deleteApp(app) }
  if (adminApp) { await terminate(adminDb); await deleteApp(adminApp) }
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

const COUNTERS = ['aiWritingCount', 'aiWritingPending', 'aiWritingWindowAt', 'aiImageCount', 'aiImagePending', 'aiImageWindowAt']
const erase = () => Object.fromEntries(COUNTERS.map(name => [name, deleteField()]))

rulesTest('a regular user cannot erase their own counters', async () => {
  await assert.rejects(update(erase()), denied)
})

rulesTest('an admin can set a counter to a value but cannot only lower it', async () => {
  const adminUpdate = fields => updateDoc(doc(adminDb, 'memiBoardUsers', uid), { ...fields, updatedAt: serverTimestamp() })
  await assert.rejects(adminUpdate({ aiImageCount: 0 }), denied)
  await assert.rejects(adminUpdate({ aiImageCount: 0, aiWritingCount: 0 }), denied)
})

rulesTest('an admin can reset all six counters of a user, and nothing else', async () => {
  const ref = doc(adminDb, 'memiBoardUsers', uid)
  await assert.rejects(updateDoc(ref, { ...erase(), role: 'admin', updatedAt: serverTimestamp() }), denied)
  await updateDoc(ref, { ...erase(), updatedAt: serverTimestamp() })
  // After the reset the user starts a fresh window again.
  await update({ aiImageCount: 0, aiImagePending: 1, aiImageWindowAt: serverTimestamp() })
})

rulesTest('an admin can clear content warnings, a regular user cannot clear their own', async () => {
  // Seed the warning with the emulator's owner token: clients cannot raise it for someone else.
  const seeded = await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${projectId}/databases/(default)/documents/memiBoardUsers/${uid}?updateMask.fieldPaths=moderationBlockCount`, {
    method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { moderationBlockCount: { integerValue: '3' } } }),
  })
  assert.equal(seeded.ok, true, await seeded.text())
  const clear = { moderationBlockCount: deleteField(), moderationBlockAt: deleteField(), updatedAt: serverTimestamp() }
  await assert.rejects(updateDoc(doc(db, 'memiBoardUsers', uid), clear), denied)
  await assert.rejects(updateDoc(doc(adminDb, 'memiBoardUsers', uid), { ...clear, role: 'admin' }), denied)
  await updateDoc(doc(adminDb, 'memiBoardUsers', uid), clear)
})
