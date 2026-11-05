import assert from 'node:assert/strict'
import { test } from 'node:test'
import en from '../src/i18n/messages/en/footer.ts'
import ko from '../src/i18n/messages/ko/footer.ts'

function leafKeys(value, prefix = '') {
  return Object.entries(value).flatMap(([key, entry]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return typeof entry === 'string' ? [path] : leafKeys(entry, path)
  })
}

function lookup(value, path) {
  return path.split('.').reduce((node, key) => node?.[key], value)
}

for (const locale of ['ko', 'en', 'ja', 'de', 'fr', 'es', 'pt', 'zh', 'ar', 'id']) {
  test(`about popup has every translation in ${locale}, without relying on fallbacks`, async () => {
    const footer = locale === 'ko' ? ko : locale === 'en' ? en
      : (await import(`../src/i18n/messages/${locale}.ts`)).default.footer
    for (const key of leafKeys(en)) {
      assert.equal(typeof lookup(footer, key), 'string', `${locale}: missing footer.${key}`)
      assert.ok(lookup(footer, key).trim(), `${locale}: empty footer.${key}`)
    }
    assert.equal(footer.info.title, 'memi-board')
    assert.ok(footer.info.about.includes('memi-board'))
  })
}
