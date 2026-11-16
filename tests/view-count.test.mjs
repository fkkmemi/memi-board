import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

// Load the real composable with its Firebase/config imports replaced by stubs that record updateDoc calls.
async function loadViews() {
  const source = await readFile(new URL('../src/composables/useMemiBoardViews.ts', import.meta.url), 'utf8')
  const stubbed = source
    .replace(/import \{ increment, updateDoc \} from 'firebase\/firestore'/, `const increment = n => ({ inc: n }); const updateDoc = async (ref, data) => { globalThis.__updates.push(data) }`)
    .replace(/import \{ useFirestore \} from 'vuefire'/, 'const useFirestore = () => ({})')
    .replace(/import \{ useBoardPathConfig \} from '..\/config'/, `const useBoardPathConfig = () => ({ postsCollection: 'memiBoardPosts' })`)
    .replace(/import \{ postDoc \} from '..\/utils\/boardPaths'/, 'const postDoc = (db, cfg, id) => ({ id })')
  const { outputText } = ts.transpileModule(stubbed, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } })
  const url = `data:text/javascript;base64,${Buffer.from(outputText.replace(/import\.meta\.dev/g, 'false')).toString('base64')}`
  return (await import(url)).useMemiBoardViews
}

function memoryStorage() {
  const map = new Map()
  return { getItem: k => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k) }
}

test('server rendering never counts a view', async () => {
  globalThis.__updates = []
  delete globalThis.window
  delete globalThis.sessionStorage
  const useMemiBoardViews = await loadViews()
  const { recordView } = useMemiBoardViews()
  await recordView('fromAI', 'post-1')
  await recordView('fromAI', 'post-1')
  assert.equal(globalThis.__updates.length, 0)
})

test('in the browser a post is counted once per session, even across reloads', async () => {
  globalThis.__updates = []
  globalThis.window = {}
  globalThis.sessionStorage = memoryStorage()
  try {
    const useMemiBoardViews = await loadViews()
    await useMemiBoardViews().recordView('fromAI', 'post-1')
    // A reload creates a new composable but keeps the same sessionStorage.
    await useMemiBoardViews().recordView('fromAI', 'post-1')
    await useMemiBoardViews().recordView('fromAI', 'post-2')
    assert.equal(globalThis.__updates.length, 2)
    assert.deepEqual(globalThis.__updates[0], { viewCount: { inc: 1 } })
  }
  finally {
    delete globalThis.window
    delete globalThis.sessionStorage
  }
})
