import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { initializeApp, deleteApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth'
import { connectStorageEmulator, deleteObject, getBytes, getStorage, ref, uploadBytes } from 'firebase/storage'

const projectId = 'demo-memi-banners'
const enabled = process.env.FIREBASE_STORAGE_EMULATOR_HOST
  && process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST
const clients = {}
const apps = []
const str = stringValue => ({ stringValue })

async function seed(path, fields) {
  const response = await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${projectId}/databases/(default)/documents/${path}`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  assert.equal(response.ok, true, await response.text())
}

before(async () => {
  if (!enabled) return
  for (const role of ['admin', 'manager', 'otherManager', 'staff', 'user', 'deleting', 'guest']) {
    const app = initializeApp({ apiKey: 'demo-key', projectId, storageBucket: `${projectId}.appspot.com` }, `banner-${role}`)
    apps.push(app)
    const auth = getAuth(app)
    connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true })
    const storage = getStorage(app)
    const [host, port] = process.env.FIREBASE_STORAGE_EMULATOR_HOST.split(':')
    connectStorageEmulator(storage, host, Number(port))
    if (role !== 'guest') {
      await signInAnonymously(auth)
      await seed(`memiBoardUsers/${auth.currentUser.uid}`, {
        role: str(role === 'otherManager' ? 'manager' : role === 'deleting' ? 'admin' : role),
        deletionPending: { booleanValue: role === 'deleting' },
      })
    }
    clients[role] = { storage, uid: auth.currentUser?.uid }
  }
  await seed('memiBoardSettings/banner-test', {
    allowedManagerUids: { arrayValue: { values: [str(clients.manager.uid)] } },
  })
}, { timeout: 30000 })

after(async () => { for (const app of apps) await deleteApp(app) })
const rulesTest = (name, fn) => test(name, { skip: !enabled }, fn)
const fileRef = (role, name) => ref(clients[role].storage, `memiBoardSettings/banner-test/banners/${name}.jpg`)
const jpeg = { contentType: 'image/jpeg' }
const denied = error => error.code === 'storage/unauthorized'

rulesTest('admin and assigned manager can create banners; public readers can view them', async () => {
  for (const role of ['admin', 'manager']) {
    await uploadBytes(fileRef(role, role), new Uint8Array([1, 2, 3]), jpeg)
    assert.equal((await getBytes(fileRef('guest', role))).byteLength, 3)
    await deleteObject(fileRef(role, role))
  }
})

rulesTest('unassigned managers, staff, users, deleting accounts and guests cannot upload banners', async () => {
  for (const role of ['otherManager', 'staff', 'user', 'deleting', 'guest']) {
    await assert.rejects(uploadBytes(fileRef(role, role), new Uint8Array([1]), jpeg), denied)
  }
})

rulesTest('banner rules reject non-JPEG, oversized files and overwrites', async () => {
  await assert.rejects(uploadBytes(fileRef('admin', 'png'), new Uint8Array([1]), { contentType: 'image/png' }), denied)
  await assert.rejects(uploadBytes(fileRef('admin', 'large'), new Uint8Array(3 * 1024 * 1024), jpeg), denied)
  await uploadBytes(fileRef('admin', 'immutable'), new Uint8Array([1]), jpeg)
  await assert.rejects(uploadBytes(fileRef('admin', 'immutable'), new Uint8Array([2]), jpeg), denied)
  await assert.rejects(deleteObject(fileRef('otherManager', 'immutable')), denied)
  await deleteObject(fileRef('admin', 'immutable'))
})
