import assert from 'node:assert/strict'
import { after, beforeEach, test } from 'node:test'
import { createSSRApp, defineComponent, effectScope, h, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { initializeApp, deleteApp } from 'firebase/app'
import { terminate, getFirestore } from 'firebase/firestore'
import { VueFire, VueFireAuthWithDependencies } from 'vuefire'
import { inMemoryPersistence } from 'firebase/auth'
import {
  configureMemiBoard, useMemiBoardConfig,
  isMemiBoardI18nEnabled, isMemiBoardTranslationEnabled,
  useMemiBoardI18n, memiBoardHostLocaleKey,
  localizedText, displayStoredField, displayPostTitle, displayPostSummary, displayPostContent,
  hashText, useMemiBoardAutoTranslate, useMemiBoardWritingAssistant,
} from '../dist/index.js'

const firebaseApp = initializeApp({ projectId: 'demo-memi-i18n-options', apiKey: 'demo-key', appId: 'demo-app' })
const i18n = { ko: { label: '원문', title: '제목', summary: '요약', content: '<p>본문</p>' }, en: { label: 'Translated', title: 'Title', summary: 'Summary', content: '<p>Body</p>' } }
const source = { locale: 'ko', label: '원문', title: '제목', summary: '요약' }
const post = { title: '제목', summary: '요약', i18n, i18nSource: source, content: '<p>본문</p>', contentI18n: i18n, contentI18nSource: { locale: 'ko', hash: hashText('<p>본문</p>') } }

beforeEach(() => configureMemiBoard({ locale: 'ko', i18n: { enabled: true }, translation: { enabled: true } }))
after(async () => { await terminate(getFirestore(firebaseApp)); await deleteApp(firebaseApp) })

async function renderLocale({ host = 'en', board, fixed = 'ko', enabled = true, translation = true } = {}) {
  configureMemiBoard({ locale: fixed, i18n: { enabled }, translation: { enabled: translation } })
  let api
  const app = createSSRApp(defineComponent({
    setup() {
      api = useMemiBoardI18n({ boardLocale: ref(board) })
      return () => h('div', { dir: api.dir.value }, [api.locale.value, ':', api.t('common.role.user')])
    },
  }))
  app.provide(memiBoardHostLocaleKey, ref(host))
  const html = await renderToString(app)
  return { api, html }
}

function inFirebaseContext(fn) {
  const scope = effectScope()
  const app = createSSRApp({ render: () => null })
  app.use(VueFire, { firebaseApp, modules: [VueFireAuthWithDependencies({ dependencies: { persistence: inMemoryPersistence } })] })
  try { return app.runWithContext(() => scope.run(fn)) }
  finally { scope.stop() }
}

test('existing services keep host and board locale selection by default', async () => {
  delete useMemiBoardConfig().i18n
  delete useMemiBoardConfig().translation
  assert.equal(isMemiBoardI18nEnabled(), true)
  assert.equal(isMemiBoardTranslationEnabled(), true)
  assert.equal((await renderLocale()).api.locale.value, 'en')
  assert.equal((await renderLocale({ board: 'ja' })).api.locale.value, 'ja')
})

test('i18n off fixes the locale even when host and board request other languages', async () => {
  const { api, html } = await renderLocale({ enabled: false, host: 'ar', board: 'ja', fixed: 'en-US' })
  assert.equal(api.locale.value, 'en')
  assert.equal(api.i18nEnabled.value, false)
  assert.equal(api.translationEnabled.value, false)
  assert.equal(api.t('common.role.user'), 'User')
  assert.match(html, /dir="ltr"/)
  assert.equal((await renderLocale({ enabled: false, fixed: 'unsupported' })).api.locale.value, 'ko')
})

test('translation off keeps localized UI and original content', async () => {
  const { api } = await renderLocale({ translation: false, board: 'ar' })
  assert.equal(api.locale.value, 'ar')
  assert.equal(api.dir.value, 'rtl')
  assert.equal(api.i18nEnabled.value, true)
  assert.equal(api.translationEnabled.value, false)
  assert.equal(displayStoredField(i18n, source, 'label', '원문', 'en'), '원문')
  assert.equal(localizedText(i18n, 'en', 'label', '원문', 'ko'), '원문')
  assert.equal(displayPostTitle(post, 'en'), '제목')
  assert.equal(displayPostSummary(post, 'en'), '요약')
  assert.equal(displayPostContent(post, 'en'), '<p>본문</p>')
})

test('disabling and re-enabling restores stored translations without changing data', () => {
  const original = JSON.stringify(post)
  assert.equal(displayPostTitle(post, 'en'), 'Title')
  configureMemiBoard({ i18n: { enabled: false } })
  assert.equal(displayPostTitle(post, 'en'), '제목')
  assert.equal(displayPostContent(post, 'en'), '<p>본문</p>')
  configureMemiBoard({ i18n: { enabled: true } })
  assert.equal(displayPostTitle(post, 'en'), 'Title')
  assert.equal(displayPostContent(post, 'en'), '<p>Body</p>')
  assert.equal(JSON.stringify(post), original)
})

test('independent flags survive partial configuration updates', () => {
  configureMemiBoard({ translation: { enabled: false } })
  configureMemiBoard({ seo: { siteName: 'Single language service' } })
  configureMemiBoard({ i18n: { enabled: false } })
  configureMemiBoard({ i18n: { enabled: true } })
  assert.equal(isMemiBoardTranslationEnabled(), false)
  assert.equal(useMemiBoardConfig().translation.enabled, false)
})

test('existing locale and feature flags react when host configuration changes', async () => {
  const { api } = await renderLocale({ host: 'en', fixed: 'ko' })
  assert.equal(api.locale.value, 'en')
  configureMemiBoard({ i18n: { enabled: false } })
  assert.equal(api.locale.value, 'ko')
  assert.equal(api.i18nEnabled.value, false)
  assert.equal(api.translationEnabled.value, false)
  configureMemiBoard({ i18n: { enabled: true }, translation: { enabled: false } })
  assert.equal(api.locale.value, 'en')
  assert.equal(api.i18nEnabled.value, true)
  assert.equal(api.translationEnabled.value, false)
})

test('low-level translation calls are blocked before Firebase AI is invoked', async () => {
  const translator = inFirebaseContext(useMemiBoardAutoTranslate)
  for (const options of [{ translation: { enabled: false } }, { i18n: { enabled: false }, translation: { enabled: true } }]) {
    configureMemiBoard(options)
    await assert.rejects(translator.translateEntries([{ id: 'board', fields: { label: '원문' } }]), { code: 'memi-board/translation-disabled' })
    await assert.rejects(translator.translateHtml('<p>본문</p>'), { code: 'memi-board/translation-disabled' })
    await assert.rejects(translator.detectSourceLocale('한국어 원문'), { code: 'memi-board/translation-disabled' })
  }
})

test('post translation and legacy translation actions stop before usage accounting', async () => {
  configureMemiBoard({ translation: { enabled: false } })
  const assistant = inFirebaseContext(useMemiBoardWritingAssistant)
  await assert.rejects(assistant.translatePost({ title: '제목', content: '<p>본문</p>' }), { code: 'memi-board/translation-disabled' })
  for (const action of ['translate-en', 'translate-ko']) {
    await assert.rejects(assistant.assist({ action, content: '<p>본문</p>' }), { code: 'memi-board/translation-disabled' })
  }
})
