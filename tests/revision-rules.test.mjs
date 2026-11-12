import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { initializeApp, deleteApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth'
import {
  collection, connectFirestoreEmulator, deleteDoc, doc, getDoc, getDocs, getFirestore, query,
  runTransaction, serverTimestamp, setDoc, terminate, updateDoc, where, writeBatch,
} from 'firebase/firestore'

const projectId = 'demo-memi-revisions'
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
const arr = (...values) => ({ arrayValue: { values } })

async function seedPost(id, title = 'original', content = '<p>original</p>') {
  await seed(`memiBoardPosts/${id}`, {
    boardId: str('board'), authorUid: str(clients.user.auth.currentUser.uid), listed: bool(true),
    isPublished: bool(true), title: str(title), tags: arr(str('a')), attachments: arr(),
  })
  await seed(`memiBoardPosts/${id}/body/main`, { content: str(content) })
}

async function setRequired(required) {
  await seed('memiBoardPostsSlugs/__migration', { ready: bool(true), revisionsRequired: bool(required) })
}

/** Mirrors useMemiBoardPosts.updatePost: archive the previous state and bump the revision in one commit. */
async function editWithRevision(db, id, next, override = {}) {
  const uid = getAuth(db.app).currentUser.uid
  await runTransaction(db, async (transaction) => {
    const postRef = doc(db, 'memiBoardPosts', id)
    const bodyRef = doc(db, 'memiBoardPosts', id, 'body', 'main')
    const [postSnap, bodySnap] = await Promise.all([transaction.get(postRef), transaction.get(bodyRef)])
    const before = postSnap.data()
    const revision = before.revision ?? 0
    transaction.set(doc(db, 'memiBoardPosts', id, 'revisions', String(revision)), {
      boardId: before.boardId, revision, title: before.title, content: bodySnap.data()?.content ?? '',
      tags: before.tags ?? [], attachments: before.attachments ?? [], authorUid: before.authorUid,
      editedBy: uid, editedByName: null, createdAt: serverTimestamp(), ...override,
    })
    transaction.update(postRef, { title: next.title, updatedAt: serverTimestamp(), revision: revision + 1, editedAt: serverTimestamp() })
    transaction.set(bodyRef, { content: next.content }, { merge: true })
  })
}

before(async () => {
  if (!enabled) return
  for (const role of ['admin', 'staff', 'user', 'other']) {
    const app = initializeApp({ apiKey: 'demo-key', projectId }, `revision-${role}`)
    apps.push(app)
    const auth = getAuth(app)
    connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true })
    const db = getFirestore(app)
    const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':')
    connectFirestoreEmulator(db, host, Number(port))
    await signInAnonymously(auth)
    await seed(`memiBoardUsers/${auth.currentUser.uid}`, { role: str(role === 'other' ? 'user' : role) })
    clients[role] = { auth, db }
  }
  await seed('memiBoardSettings/board', { allowedStaffUids: arr(str(clients.staff.auth.currentUser.uid)) })
  await setRequired(false)
}, { timeout: 30000 })

after(async () => {
  for (const app of apps) { await terminate(getFirestore(app)); await deleteApp(app) }
})

const rulesTest = (name, fn) => test(name, { skip: !enabled }, fn)
const denied = error => error.code === 'permission-denied'

rulesTest('authors archive the previous version when they edit', async () => {
  await seedPost('p1')
  await editWithRevision(clients.user.db, 'p1', { title: 'v1', content: '<p>v1</p>' })
  await editWithRevision(clients.user.db, 'p1', { title: 'v2', content: '<p>v2</p>' })
  const revisions = await getDocs(query(collection(clients.staff.db, 'memiBoardPosts', 'p1', 'revisions'), where('boardId', '==', 'board')))
  const byId = Object.fromEntries(revisions.docs.map(item => [item.id, item.data()]))
  assert.equal(byId['0'].title, 'original')
  assert.equal(byId['0'].content, '<p>original</p>')
  assert.equal(byId['1'].title, 'v1')
  assert.equal(byId['1'].content, '<p>v1</p>')
  const post = await getDoc(doc(clients.user.db, 'memiBoardPosts', 'p1'))
  assert.equal(post.data().revision, 2)
})

rulesTest('managers can edit with a revision too', async () => {
  await seedPost('p-staff')
  await editWithRevision(clients.staff.db, 'p-staff', { title: 'fixed', content: '<p>fixed</p>' })
})

rulesTest('revision snapshots must match the stored post and body', async () => {
  await seedPost('p2')
  const db = clients.user.db
  await assert.rejects(editWithRevision(db, 'p2', { title: 'x', content: '<p>x</p>' }, { content: '<p>forged</p>' }), denied)
  await assert.rejects(editWithRevision(db, 'p2', { title: 'x', content: '<p>x</p>' }, { title: 'forged' }), denied)
  await assert.rejects(editWithRevision(db, 'p2', { title: 'x', content: '<p>x</p>' }, { editedBy: clients.other.auth.currentUser.uid }), denied)
  await assert.rejects(editWithRevision(db, 'p2', { title: 'x', content: '<p>x</p>' }, { createdAt: new Date(0) }), denied)
})

rulesTest('a revision bump needs the archived revision document', async () => {
  await seedPost('p3')
  await assert.rejects(updateDoc(doc(clients.user.db, 'memiBoardPosts', 'p3'), {
    title: 'x', revision: 1, editedAt: serverTimestamp(),
  }), denied)
})

rulesTest('nobody can change or delete a revision, and only managers can read it', async () => {
  await seedPost('p4')
  await editWithRevision(clients.user.db, 'p4', { title: 'v1', content: '<p>v1</p>' })
  for (const role of ['user', 'staff', 'admin']) {
    const ref = doc(clients[role].db, 'memiBoardPosts', 'p4', 'revisions', '0')
    await assert.rejects(updateDoc(ref, { content: 'rewritten' }), denied)
    await assert.rejects(deleteDoc(ref), denied)
  }
  await assert.rejects(getDoc(doc(clients.user.db, 'memiBoardPosts', 'p4', 'revisions', '0')), denied)
  await assert.rejects(getDoc(doc(clients.other.db, 'memiBoardPosts', 'p4', 'revisions', '0')), denied)
  await getDoc(doc(clients.admin.db, 'memiBoardPosts', 'p4', 'revisions', '0'))
  await getDoc(doc(clients.staff.db, 'memiBoardPosts', 'p4', 'revisions', '0'))
})

rulesTest('other users cannot add revisions to someone else\'s post', async () => {
  await seedPost('p5')
  await assert.rejects(editWithRevision(clients.other.db, 'p5', { title: 'x', content: '<p>x</p>' }), denied)
})

rulesTest('compatibility mode still accepts edits without a revision', async () => {
  await seedPost('p6')
  await updateDoc(doc(clients.user.db, 'memiBoardPosts', 'p6'), { title: 'legacy edit' })
  await setDoc(doc(clients.user.db, 'memiBoardPosts', 'p6', 'body', 'main'), { content: '<p>legacy</p>' }, { merge: true })
})

rulesTest('once required, edits without a revision are denied', async () => {
  await seedPost('p7')
  await setRequired(true)
  try {
    const db = clients.user.db
    await assert.rejects(updateDoc(doc(db, 'memiBoardPosts', 'p7'), { title: 'silent edit' }), denied)
    await assert.rejects(setDoc(doc(db, 'memiBoardPosts', 'p7', 'body', 'main'), { content: '<p>silent</p>' }, { merge: true }), denied)
    // Deleting the body alone would clear the content without a revision.
    await assert.rejects(deleteDoc(doc(db, 'memiBoardPosts', 'p7', 'body', 'main')), denied)
    // Edits that archive the previous version still work.
    await editWithRevision(db, 'p7', { title: 'v1', content: '<p>v1</p>' })
    // Translation-only and counter updates do not need a revision.
    await updateDoc(doc(db, 'memiBoardPosts', 'p7'), { i18n: {}, updatedAt: serverTimestamp() })
    await setDoc(doc(db, 'memiBoardPosts', 'p7', 'body', 'main'), { i18n: {} }, { merge: true })
    await updateDoc(doc(clients.other.db, 'memiBoardPosts', 'p7'), { likeCount: 1 })
    // Deleting the post together with its body is allowed, and the history stays.
    const batch = writeBatch(db)
    batch.delete(doc(db, 'memiBoardPosts', 'p7', 'body', 'main'))
    batch.delete(doc(db, 'memiBoardPosts', 'p7'))
    await batch.commit()
    const kept = await getDoc(doc(clients.admin.db, 'memiBoardPosts', 'p7', 'revisions', '0'))
    assert.equal(kept.data().title, 'original')
  }
  finally {
    await setRequired(false)
  }
})

async function seedComment(id, postId = 'p1', body = 'original comment') {
  await seed(`memiBoardComments/${id}`, {
    postId: str(postId), boardId: str('board'), authorUid: str(clients.user.auth.currentUser.uid),
    body: str(body), listed: bool(true), moderationStatus: str('approved'),
  })
}

/** Mirrors useMemiBoardComments.updateComment. */
async function editCommentWithRevision(db, id, body, override = {}) {
  const uid = getAuth(db.app).currentUser.uid
  await runTransaction(db, async (transaction) => {
    const ref = doc(db, 'memiBoardComments', id)
    const before = (await transaction.get(ref)).data()
    const revision = before.revision ?? 0
    transaction.set(doc(db, 'memiBoardComments', id, 'revisions', String(revision)), {
      boardId: before.boardId, postId: before.postId, revision, body: before.body, images: before.images ?? [],
      authorUid: before.authorUid, editedBy: uid, editedByName: null, createdAt: serverTimestamp(), ...override,
    })
    transaction.update(ref, { body, updatedAt: serverTimestamp(), revision: revision + 1, editedAt: serverTimestamp() })
  })
}

rulesTest('comment edits archive the previous body', async () => {
  await seedPost('pc')
  await seedComment('c1', 'pc')
  await editCommentWithRevision(clients.user.db, 'c1', 'edit one')
  await editCommentWithRevision(clients.user.db, 'c1', 'edit two')
  const revisions = await getDocs(query(collection(clients.staff.db, 'memiBoardComments', 'c1', 'revisions'), where('boardId', '==', 'board')))
  const byId = Object.fromEntries(revisions.docs.map(item => [item.id, item.data()]))
  assert.equal(byId['0'].body, 'original comment')
  assert.equal(byId['1'].body, 'edit one')
})

rulesTest('comment revisions must match, cannot change, and are staff-only', async () => {
  await seedPost('pc2')
  await seedComment('c2', 'pc2')
  const db = clients.user.db
  await assert.rejects(editCommentWithRevision(db, 'c2', 'x', { body: 'forged' }), denied)
  await assert.rejects(editCommentWithRevision(clients.other.db, 'c2', 'x'), denied)
  await assert.rejects(updateDoc(doc(db, 'memiBoardComments', 'c2'), { body: 'x', revision: 1, editedAt: serverTimestamp() }), denied)
  await editCommentWithRevision(db, 'c2', 'real edit')
  for (const role of ['user', 'staff', 'admin']) {
    const ref = doc(clients[role].db, 'memiBoardComments', 'c2', 'revisions', '0')
    await assert.rejects(updateDoc(ref, { body: 'rewritten' }), denied)
    await assert.rejects(deleteDoc(ref), denied)
  }
  await assert.rejects(getDoc(doc(db, 'memiBoardComments', 'c2', 'revisions', '0')), denied)
  await getDoc(doc(clients.staff.db, 'memiBoardComments', 'c2', 'revisions', '0'))
})

rulesTest('comment edits without a revision depend on the required flag', async () => {
  await seedPost('pc3')
  await seedComment('c3', 'pc3')
  const ref = doc(clients.user.db, 'memiBoardComments', 'c3')
  await updateDoc(ref, { body: 'legacy edit', updatedAt: serverTimestamp() })
  await setRequired(true)
  try {
    await assert.rejects(updateDoc(ref, { body: 'silent edit', updatedAt: serverTimestamp() }), denied)
    await editCommentWithRevision(clients.user.db, 'c3', 'tracked edit')
    // Blinding and likes do not need a revision.
    await updateDoc(doc(clients.staff.db, 'memiBoardComments', 'c3'), {
      isBlinded: true, moderatedAt: serverTimestamp(), moderatedBy: clients.staff.auth.currentUser.uid,
    })
    await updateDoc(doc(clients.other.db, 'memiBoardComments', 'c3'), { likeCount: 1 })
    // Deleting the comment keeps its history.
    await deleteDoc(ref)
    const kept = await getDoc(doc(clients.admin.db, 'memiBoardComments', 'c3', 'revisions', '0'))
    assert.equal(kept.data().body, 'legacy edit')
  }
  finally {
    await setRequired(false)
  }
})
