import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createSSRApp, effectScope, nextTick } from 'vue'
import { VueFire, VueFireAuthOptionsFromAuth } from 'vuefire'
import { configureMemiBoard, useMemiBoardAuth, useMemiBoardCleanup } from '../dist/index.js'
import { initializeApp, deleteApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth'
import { collection, connectFirestoreEmulator, deleteDoc, doc, getDocFromServer, getDocsFromServer, getFirestore, terminate } from 'firebase/firestore'
import { connectStorageEmulator, deleteObject, getDownloadURL, getStorage, list, ref, uploadBytes } from 'firebase/storage'

const projectId = 'demo-memi-cleanup-security'
const enabled = process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST && process.env.FIREBASE_STORAGE_EMULATOR_HOST
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

before(async () => {
  if (!enabled) return
  for (const role of ['owner', 'admin', 'manager', 'staff', 'user', 'anonymous']) {
    const app = initializeApp({ apiKey: 'demo-key', projectId, storageBucket: `${projectId}.appspot.com` }, role === 'admin' ? '[DEFAULT]' : `cleanup-${role}`)
    apps.push(app)
    const auth = getAuth(app)
    connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true })
    const db = getFirestore(app)
    const [dbHost, dbPort] = process.env.FIRESTORE_EMULATOR_HOST.split(':')
    connectFirestoreEmulator(db, dbHost, Number(dbPort))
    const storage = getStorage(app)
    const [storageHost, storagePort] = process.env.FIREBASE_STORAGE_EMULATOR_HOST.split(':')
    connectStorageEmulator(storage, storageHost, Number(storagePort))
    if (role !== 'anonymous') {
      await signInAnonymously(auth)
      await seed(`memiBoardUsers/${auth.currentUser.uid}`, { role: str(role) })
    }
    clients[role] = { auth, db, storage }
  }
  await seed('memiBoardComments/orphan', { postId: str('missing'), boardId: str('missing-board'), authorUid: str('someone-else'), listed: { booleanValue: false } })
  await seed('memiBoardLikes/orphan', { postId: str('missing'), boardId: str('missing-board'), uid: str('someone-else') })
  await seed('memiBoardReports/audit', { postId: str('missing'), boardId: str('missing-board'), uid: str('someone-else') })
  await seed('memiBoardPosts/hidden', { boardId: str('hidden-board'), authorUid: str('someone-else'), listed: { booleanValue: false }, isPublished: { booleanValue: false } })
  await seed('memiBoardPosts/hidden/body/main', { content: str('private content') })
  await seed('memiBoardPosts/owned', { boardId: str('board'), authorUid: str(clients.user.auth.currentUser.uid), listed: { booleanValue: true }, isPublished: { booleanValue: true } })
  await uploadBytes(ref(clients.user.storage, 'memiBoardPosts/missing/attachments/orphan.txt'), new Uint8Array([1]), { customMetadata: { ownerUid: clients.user.auth.currentUser.uid } })
}, { timeout: 30000 })

after(async () => {
  for (const app of apps) { await terminate(getFirestore(app)); await deleteApp(app) }
})

const rulesTest = (name, fn) => test(name, { skip: !enabled }, fn)
const denied = error => ['permission-denied', 'storage/unauthorized'].includes(error.code)

rulesTest('only global admins can list the storage root', async () => {
  for (const role of ['owner', 'admin']) await list(ref(clients[role].storage, 'memiBoardPosts'))
  for (const role of ['anonymous', 'user', 'staff', 'manager']) {
    await assert.rejects(list(ref(clients[role].storage, 'memiBoardPosts')), denied, role)
  }
  await list(ref(clients.user.storage, 'memiBoardPosts/owned/images'))
  await assert.rejects(list(ref(clients.staff.storage, 'memiBoardPosts/owned/images')), denied)
  await getDownloadURL(ref(clients.anonymous.storage, 'memiBoardPosts/missing/attachments/orphan.txt'))
})

rulesTest('only global admins can query all private posts, comments, and orphan likes', async () => {
  for (const role of ['owner', 'admin']) {
    for (const col of ['memiBoardPosts', 'memiBoardComments', 'memiBoardLikes', 'memiBoardPosts/hidden/body']) {
      const snapshot = await getDocsFromServer(collection(clients[role].db, col))
      assert.ok(snapshot.size > 0)
    }
  }
  for (const role of ['anonymous', 'user', 'staff', 'manager']) {
    for (const col of ['memiBoardPosts', 'memiBoardComments', 'memiBoardLikes', 'memiBoardPosts/hidden/body']) {
      await assert.rejects(getDocsFromServer(collection(clients[role].db, col)), denied, `${role}: ${col}`)
    }
  }
})

rulesTest('non-admins cannot delete another user’s orphan documents or files', async () => {
  for (const role of ['anonymous', 'staff', 'manager']) {
    for (const col of ['memiBoardComments', 'memiBoardLikes']) {
      await assert.rejects(deleteDoc(doc(clients[role].db, col, 'orphan')), denied, `${role}: ${col}`)
    }
    await assert.rejects(deleteObject(ref(clients[role].storage, 'memiBoardPosts/missing/attachments/orphan.txt')), denied, role)
  }
  for (const col of ['memiBoardComments', 'memiBoardLikes']) {
    await assert.rejects(deleteDoc(doc(clients.user.db, col, 'orphan')), denied)
  }
})

rulesTest('admins can delete orphan documents and another user’s abandoned file; audit reports remain protected', async () => {
  for (const col of ['memiBoardComments', 'memiBoardLikes']) await deleteDoc(doc(clients.admin.db, col, 'orphan'))
  await deleteObject(ref(clients.admin.storage, 'memiBoardPosts/missing/attachments/orphan.txt'))
  for (const role of ['admin', 'owner']) await assert.rejects(deleteDoc(doc(clients[role].db, 'memiBoardReports', 'audit')), denied)
})


rulesTest('cleanup ignores unscanned paths, retains restored parents, and rejects configuration changes', async () => {
  const client = clients.admin
  const vue = createSSRApp({ render: () => null })
  vue.use(VueFire, { firebaseApp: client.auth.app, modules: [VueFireAuthOptionsFromAuth({ auth: client.auth, initialUser: client.auth.currentUser })] })
  await client.auth.authStateReady()
  await nextTick()
  const scope = effectScope()
  let auth
  let cleanup
  vue.runWithContext(() => scope.run(() => {
    auth = useMemiBoardAuth()
    cleanup = useMemiBoardCleanup()
  }))
  try {
    // Allow the auth watcher to finish its initial role document read.
    for (let i = 0; auth.rolePending.value && i < 100; i++) await new Promise(resolve => setTimeout(resolve, 10))
    await auth.refreshBoardUser()
    assert.equal(auth.isAdmin.value, true)
    assert.equal(auth.rolePending.value, false)
    await seed('memiBoardComments/planned', { postId: str('restorable'), boardId: str('board'), authorUid: str('someone-else'), listed: { booleanValue: false } })
    await cleanup.scan()
    assert.equal(cleanup.error.value, '')
    assert.ok(cleanup.items.value.some(item => item.path === 'memiBoardComments/planned'))
    await cleanup.remove(['memiBoardUsers/' + client.auth.currentUser.uid, 'memiBoardPosts/hidden'])
    assert.ok((await getDocFromServer(doc(client.db, 'memiBoardPosts/hidden'))).exists())
    assert.ok((await getDocFromServer(doc(client.db, 'memiBoardUsers', client.auth.currentUser.uid))).exists())
    await seed('memiBoardPosts/restorable', { boardId: str('board'), authorUid: str('someone-else'), listed: { booleanValue: true }, isPublished: { booleanValue: true } })
    await cleanup.remove(['memiBoardComments/planned'])
    assert.equal(cleanup.error.value, '')
    assert.ok((await getDocFromServer(doc(client.db, 'memiBoardComments/planned'))).exists())
    await seed('memiBoardComments/context', { postId: str('missing'), boardId: str('board'), authorUid: str('someone-else'), listed: { booleanValue: false } })
    await cleanup.scan()
    assert.equal(cleanup.error.value, '')
    configureMemiBoard({ commentsCollection: 'otherComments' })
    await cleanup.remove(['memiBoardComments/context'])
    assert.ok(cleanup.error.value)
    assert.ok((await getDocFromServer(doc(client.db, 'memiBoardComments/context'))).exists())
  }
  finally {
    configureMemiBoard({ commentsCollection: 'memiBoardComments' })
    scope.stop()
  }
})
