import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRenderer, defineComponent, h, nextTick, ref } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { useUnsavedChangesGuard } from '../src/components/useUnsavedChangesGuard.ts'

test('editor guards route changes and browser exits until changes are reverted or saved', async () => {
  const previousWindow = globalThis.window
  const browser = new EventTarget()
  let prompts = 0
  let approve = false
  browser.confirm = () => { prompts++; return approve }
  globalThis.window = browser
  const value = ref('')
  const busy = ref(false)
  let markSaved
  const Editor = defineComponent({
    setup() {
      ;({ markSaved } = useUnsavedChangesGuard(() => value.value, () => busy.value, () => 'Leave?'))
      return () => h('editor')
    },
  })
  const renderer = createRenderer({
    createElement: () => ({ children: [] }),
    createText: () => ({}), createComment: () => ({}),
    setText() {}, setElementText() {}, patchProp() {},
    parentNode: node => node.parent,
    nextSibling: () => null,
    insert(node, parent) { node.parent = parent; parent.children.push(node) },
    remove(node) { node.parent?.children.splice(node.parent.children.indexOf(node), 1) },
  })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/edit/:id', component: Editor },
      { path: '/list', component: { render: () => h('list') } },
    ],
  })
  const app = renderer.createApp({ render: () => h(RouterView) })
  app.use(router)
  function unload() {
    const event = new Event('beforeunload', { cancelable: true })
    browser.dispatchEvent(event)
    return event.defaultPrevented
  }
  try {
    await router.push('/edit/1')
    await router.isReady()
    app.mount({ children: [] })
    await nextTick()
    assert.equal(unload(), false, 'clean editor does not block refresh')
    value.value = 'draft'
    assert.equal(unload(), true, 'draft blocks refresh')
    await router.push('/list')
    assert.equal(router.currentRoute.value.path, '/edit/1', 'cancel keeps the editor open')
    await router.push('/edit/2')
    assert.equal(router.currentRoute.value.path, '/edit/1', 'same-component navigation is also guarded')
    const previousPrompts = prompts
    await router.push('/edit/1?preview=1')
    assert.equal(prompts, previousPrompts, 'query changes do not discard the editor')
    value.value = ''
    assert.equal(unload(), false, 'reverting changes removes the refresh warning')
    busy.value = true
    assert.equal(unload(), true, 'in-flight work is protected')
    busy.value = false
    value.value = 'saved draft'
    markSaved()
    assert.equal(unload(), false, 'successful save clears the warning')
    await router.push('/list')
    assert.equal(prompts, previousPrompts, 'post-save navigation does not prompt')
    await router.push('/edit/3')
    await nextTick()
    value.value = 'another draft'
    approve = true
    await router.push('/list')
    assert.equal(router.currentRoute.value.path, '/list', 'confirm permits leaving')
    assert.equal(unload(), false, 'unmount removes the browser listener')
  }
  finally {
    app.unmount()
    globalThis.window = previousWindow
  }
})
