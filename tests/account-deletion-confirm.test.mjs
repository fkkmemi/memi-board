import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'
import { computed, ref, watch } from 'vue'

const source = readFileSync(new URL('../src/components/AccountDeletion.vue', import.meta.url), 'utf8').match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
const script = ts.transpileModule(source.replace(/^import .+ from .+$/gm, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
function confirmation(overrides = {}) {
  const props = { state: 'idle', processed: 0, isOwner: false, lockedPolicy: null, ...overrides }
  const bindings = { computed, ref, watch, defineProps: () => props, withDefaults: value => value, defineEmits: () => () => assert.fail('Opening a confirmation must never start deletion'), useMemiBoardI18n: () => ({ t: key => key, formatNumber: String }) }
  return new Function(...Object.keys(bindings), script + '\nreturn { open, deleteContent, acknowledged, confirmation, canConfirm, showConfirmation };')(...Object.values(bindings))
}
test('opening confirmation defaults to retaining content and does not request deletion', () => {
  const c = confirmation()
  c.showConfirmation()
  assert.equal(c.open.value, true)
  assert.equal(c.deleteContent.value, false)
  assert.equal(c.canConfirm.value, false)
})
test('both explicit acknowledgement and exact DELETE are required', () => {
  const c = confirmation()
  c.acknowledged.value = true
  for (const text of ['', 'delete', ' DELETE', 'DELETE ']) {
    c.confirmation.value = text
    assert.equal(c.canConfirm.value, false)
  }
  c.confirmation.value = 'DELETE'
  assert.equal(c.canConfirm.value, true)
  c.acknowledged.value = false
  assert.equal(c.canConfirm.value, false)
})
test('owners and in-flight requests cannot confirm or open another deletion', () => {
  for (const props of [{ isOwner: true }, { state: 'working' }, { state: 'authenticating' }]) {
    const c = confirmation(props)
    c.acknowledged.value = true
    c.confirmation.value = 'DELETE'
    assert.equal(c.canConfirm.value, false)
    c.showConfirmation()
    assert.equal(c.open.value, false)
  }
})
test('resuming uses the previously confirmed content policy', () => {
  const c = confirmation({ lockedPolicy: true })
  c.showConfirmation()
  assert.equal(c.deleteContent.value, true)
  assert.equal(c.confirmation.value, '')
  assert.equal(c.acknowledged.value, false)
})
