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
  let stored = { status: 'open' }
  const firestore = {
    documentId: () => '__name__', getDocs: async () => ({ docs: [] }), limit: value => ({ limit: value }),
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
    '../utils/boardPaths': { reportDoc: (_db, _cfg, post, uid) => `${post}_${uid}`, reportsCol: () => 'reports' },
    '../i18n/translate': { translate: (_locale, key) => key },
    '../i18n/useMemiBoardI18n': { useMemiBoardI18n: () => ({ t: key => key }) },
  }
  const js = ts.transpile(source, { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 })
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', js)(name => { if (!(name in deps)) throw Error(name); return deps[name] }, mod, mod.exports)
  const scope = vue.effectScope()
  return { api: mod.exports, run: fn => scope.run(fn), stop: () => scope.stop(), user, listeners, writes, stored: value => { stored = value } }
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
