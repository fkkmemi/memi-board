import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { compileScript, parse } from 'vue/compiler-sfc'
import ts from 'typescript'
import { createRenderer, nextTick } from 'vue'

// Compile the actual editor setup; stub only its external image service and cropper.
async function editorComponent(generateBanner) {
  const source = await readFile(new URL('../src/components/BannerEditor.vue', import.meta.url), 'utf8')
  const mocked = source
    .replace(/import \{ Cropper \} from 'vue-advanced-cropper'/, 'const Cropper = {}')
    .replace(/import 'vue-advanced-cropper\/dist\/style.css'/, '')
    .replace(/import \{ useMemiBoardBannerGeneration, useMemiBoardI18n \} from 'memi-board\/runtime'/,
      `const useMemiBoardBannerGeneration = () => ({ generateBanner: testGenerateBanner });
       const useMemiBoardI18n = () => ({ t: key => key, aiEnabled: ref(true) })`)
  const { descriptor } = parse(mocked)
  const script = compileScript(descriptor, { id: 'banner-editor-test' }).content
  const { outputText } = ts.transpileModule(script, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } })
  const code = outputText.replace(/from ['"]vue['"]/g, `from '${import.meta.resolve('vue')}'`)
  const fixture = `${code}\nlet testGenerateBanner; export function setService(service) { testGenerateBanner = service }`
  const { default: component, setService } = await import(`data:text/javascript;base64,${Buffer.from(fixture).toString('base64')}`)
  setService(generateBanner)
  return { ...component, render: () => null }
}

const renderer = createRenderer({
  createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
  setText() {}, setElementText() {}, patchProp() {},
  parentNode: () => null, nextSibling: () => null, insert() {}, remove() {},
})

test('generated banners survive modal closure and switching slots, and release URLs on replacement/unmount', async () => {
  let finish
  const component = await editorComponent(() => new Promise(resolve => { finish = resolve }))
  const events = []
  const app = renderer.createApp(component, { boardId: 'travel', title: 'Travel', onBusy: value => events.push(value) })
  const vm = app.mount({})
  const state = vm.$.setupState
  const revoke = URL.revokeObjectURL
  const released = []
  URL.revokeObjectURL = url => { released.push(url); revoke(url) }
  try {
    const pending = state.generate('desktop')
    assert.equal(state.generating, 'desktop')
    finish(new Blob(['desktop'], { type: 'image/png' }))
    await pending
    await nextTick()
    const desktop = state.source
    assert.equal(state.open, true)
    assert.deepEqual(events, [true, false])
    state.open = false
    await nextTick()
    assert.equal(state.source, desktop)
    assert.deepEqual(released, [])
    state.resumeCrop('desktop')
    assert.equal(state.open, true)
    assert.equal(state.source, desktop)

    state.openCrop('mobile', new Blob(['mobile']))
    const mobile = state.source
    state.open = false
    await nextTick()
    state.resumeCrop('desktop')
    assert.equal(state.source, desktop)
    state.openCrop('desktop', new Blob(['replacement']))
    const replacement = state.source
    assert.deepEqual(released, [desktop])
    state.remove('mobile')
    assert.deepEqual(released, [desktop, mobile])
    app.unmount()
    assert.deepEqual(released, [desktop, mobile, replacement])
  }
  finally {
    if (!vm.$.isUnmounted) app.unmount()
    URL.revokeObjectURL = revoke
  }
})
