import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import * as vue from 'vue'

// Exercise the actual composable with a controllable Firestore boundary.
const source = readFileSync(new URL('../src/composables/useMemiBoardReports.ts', import.meta.url), 'utf8')
function harness() {
  const user = vue.ref({ uid: 'reporter', displayName: 'Reporter' })
  const listeners = []
  const writes = []
  const reads = []
  let stored = { status: 'open' }
  const firestore = {
    documentId: () => '__name__', getDoc: async target => { reads.push(target); return { id: target, exists: () => false } }, getDocs: async () => ({ docs: [] }), limit: value => ({ limit: value }),
    onSnapshot: (target, success, error) => { const sub = { target, success, error }; listeners.push(sub); return () => { sub.stopped = true } },
    orderBy: (...values) => ({ orderBy: values }), query: (...values) => values,
    serverTimestamp: () => 'server-time', setDoc: async (target, data) => { writes.push({ target, data }) },
    startAfter: value => ({ startAfter: value }), where: (...values) => ({ where: values }),
    runTransaction: async (_db, action) => action({ get: async () => ({ exists: () => !!stored, data: () => stored }), update: (target, data) => { writes.push({ target, data }); stored = { ...stored, ...data } } }),
  }
  const admin = vue.ref(true)
  const deps = {
    vue, 'firebase/firestore': firestore, vuefire: { useCurrentUser: () => user, useFirestore: () => 'db' },
    '../config': { useBoardPathConfig: () => ({}) },
    './useMemiBoardAuth': { useMemiBoardAuth: () => ({ isAdmin: admin, canManageContent: vue.ref(true), canManageBoard: () => true }) },
    '../utils/boardPaths': {
      reportDoc: (_db, _cfg, post, uid) => `${post}_${uid}`,
      commentReportDoc: (_db, _cfg, comment, uid) => `c_${comment}_${uid}`,
      reportDocById: (_db, _cfg, id) => id,
      commentDoc: (_db, _cfg, id) => `comment:${id}`,
      reportsCol: () => 'reports',
    },
    '../i18n/translate': { translate: (_locale, key) => key },
    '../i18n/useMemiBoardI18n': { useMemiBoardI18n: () => ({ t: key => key }) },
  }
  const js = ts.transpile(source, { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 })
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', js)(name => { if (!(name in deps)) throw Error(name); return deps[name] }, mod, mod.exports)
  const scope = vue.effectScope()
  return { api: mod.exports, run: fn => scope.run(fn), stop: () => scope.stop(), user, listeners, writes, reads, stored: value => { stored = value } }
}

test('Other requires a non-whitespace description before any write', async () => {
  const h = harness(); const r = h.run(() => h.api.useMemiBoardReports('board', 'post'))
  for (const detail of ['', ' \n\t ']) await assert.rejects(r.submitReport({ reason: 'other', detail }), /otherDetailRequired/)
  assert.equal(h.writes.length, 0)
  await r.submitReport({ reason: 'other', detail: ' QA reason ' })
  assert.equal(h.writes[0].data.detail, 'QA reason')
  await assert.rejects(r.submitReport({ reason: 'spam' }), /alreadyReported/)
  h.stop()
})
test('reporter receives status and reason updates and does not leak a previous account snapshot', async () => {
  const h = harness(); const r = h.run(() => h.api.useMemiBoardReports('board', 'post'))
  h.listeners[0].success({ id: 'post_reporter', exists: () => true, data: () => ({ status: 'dismissed', reviewNote: 'QA only' }) })
  assert.equal(r.report.value.reviewNote, 'QA only'); assert.equal(r.hasReported.value, true)
  h.user.value = null; await vue.nextTick()
  h.listeners[0].success({ exists: () => true, data: () => ({ status: 'open' }) })
  assert.equal(r.report.value, null); assert.equal(r.hasReported.value, false)
  h.stop()
})
test('review requires a reason, records reviewer details and cannot overwrite an earlier decision', async () => {
  const h = harness(); const q = h.run(() => h.api.useMemiBoardReportQueue())
  const report = { id: 'post_reporter', postId: 'post', uid: 'reporter', boardId: 'board' }
  await assert.rejects(q.dismissReport(report, ' \n '), /reviewNoteRequired/)
  await assert.rejects(q.dismissReport(report, 'x'.repeat(201)), /detailTooLong/)
  await q.dismissReport(report, ' No violation ')
  assert.equal(h.writes[0].data.reviewNote, 'No violation')
  assert.equal(h.writes[0].data.reviewedBy, 'reporter')
  assert.equal(h.writes[0].data.reviewedByName, 'Reporter')
  await assert.rejects(q.actionReport(report, 'Attempted overwrite'), /alreadyReviewed/)
  assert.equal(h.writes.length, 1); h.stop()
})
test('history query includes both processed statuses and discards an outdated subscription response', async () => {
  const h = harness(); const status = vue.ref('open')
  const q = h.run(() => h.api.useMemiBoardReportQueue({ status }))
  assert.ok(h.listeners[0].target.some(x => x?.where?.[0] === 'status' && x.where[2] === 'open'))
  status.value = 'processed'; await vue.nextTick()
  assert.ok(h.listeners[1].target.some(x => x?.where?.[0] === 'status' && x.where[1] === 'in' && x.where[2].includes('dismissed') && x.where[2].includes('actioned')))
  h.listeners[0].success({ docs: [{ id: 'old', data: () => ({ boardId: 'board' }) }] })
  assert.equal(q.reports.value.length, 0)
  h.listeners[1].success({ docs: [{ id: 'history', data: () => ({ boardId: 'board', status: 'actioned' }) }] })
  assert.equal(q.reports.value[0].id, 'history'); h.stop()
})
test('comment report loads status on demand and writes a comment-keyed document with an excerpt', async () => {
  const h = harness(); const r = h.run(() => h.api.useMemiBoardCommentReport('board', 'post', 'comment'))
  assert.equal(h.listeners.length, 0)
  await r.loadReport()
  assert.deepEqual(h.reads, ['c_comment_reporter'])
  await assert.rejects(r.submitReport({ reason: 'spam', authorUid: 'reporter' }), /cannotReportOwnComment/)
  await r.submitReport({ reason: 'spam', authorUid: 'author', commentBody: ' ' + 'x'.repeat(300) })
  assert.equal(h.writes[0].target, 'c_comment_reporter')
  assert.equal(h.writes[0].data.target, 'comment')
  assert.equal(h.writes[0].data.commentId, 'comment')
  assert.equal(h.writes[0].data.commentExcerpt.length, 200)
  await assert.rejects(r.submitReport({ reason: 'spam', authorUid: 'author' }), /alreadyReportedComment/)
  h.stop()
})
test('reviewing a comment report targets its stored document ID', async () => {
  const h = harness(); const q = h.run(() => h.api.useMemiBoardReportQueue())
  h.stored({ status: 'open' })
  await q.actionReport({ id: 'c_comment_reporter', target: 'comment', postId: 'post', commentId: 'comment', uid: 'reporter', boardId: 'board' }, 'Hidden', { blindComment: true })
  assert.deepEqual(h.writes.map(w => w.target).sort(), ['c_comment_reporter', 'comment:comment'])
  assert.equal(h.writes.find(w => w.target === 'comment:comment').data.isBlinded, true); h.stop()
})
test('global admin queue includes post and comment reports', () => {
  const h = harness(); h.run(() => h.api.useMemiBoardReportQueue())
  assert.ok(h.listeners[0].target.some(x => x?.where?.[0] === 'target' && x.where[1] === 'in' && x.where[2].includes('comment')))
  h.stop()
})
