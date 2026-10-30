# Internationalization and content translation

[Installation guide](host-integration.md) · [README](../README.md) · [Firebase setup](firebase-setup.md)

`i18n.enabled` and `translation.enabled` are supported in **memi-board 0.47.0 or later**. Existing host apps should update with `pnpm add memi-board@^0.47.0` and commit the lockfile as well.

## 1. Choose a mode for your service

**UI language** is the language of on-screen text such as save, cancel, help messages, and dates. **Content translation** generates and displays board names and descriptions, section titles, and post titles, summaries, and bodies in other languages.

| Purpose | `i18n.enabled` | `translation.enabled` | Behavior |
|---|---|---|---|
| Site that uses only Korean or only English | `false` | Not needed | UI fixed by `locale`, content shown in the original, translation features hidden |
| Site that needs only a multilingual UI | `true` | `false` | UI language switching, content shown in the original, translation features hidden |
| Site that needs a multilingual UI and content translation | `true` | `true` | Both UI language switching and content translation |
| Keep existing behavior | Omitted | Omitted | Both options default to `true` |

`i18n.enabled: false` takes precedence. In that case, content translation does not run even if `translation.enabled: true` is set. Turning off either feature does not delete existing translation data.

## 2. Ready-to-copy configurations

Put the `memiBoard` block below inside the host's `defineNuxtConfig({ ... })`. For the rest, such as Firebase initialization, follow the [installation guide](host-integration.md).

### Single language only

```ts
memiBoard: {
  locale: 'ko', // 'en' for English-only
  i18n: { enabled: false }
}
```

- Uses `locale`, ignoring the host's current language and per-board languages. If omitted or unsupported, it is `ko`.
- Hides the board language selector, translate buttons, the auto-translate toggle, and the translate menu in the writing AI.
- Content is shown in the original even if saved translations exist.
- Even if a board's auto-translate toggle was previously on, nothing is translated when the settings are saved.
- `@nuxtjs/i18n` does not need to be installed. Even if the host app already uses it, the board stays fixed to the specified language.

### Multilingual UI, original content

```ts
memiBoard: {
  locale: 'ko',
  i18n: { enabled: true },
  translation: { enabled: false }
}
```

Keeps the board language selector and hides only the translation-related UI. Menus, buttons, and dates follow the current screen language, while board labels, descriptions, section titles, and posts are shown as originally written.

### Multilingual UI and content translation

```ts
memiBoard: {
  locale: 'ko',
  i18n: { enabled: true },
  translation: { enabled: true }
}
```

To generate translations, the host's Firebase project must have an AI Logic connection set up. Simply displaying UI language files does not trigger AI requests.

## 3. Connect the host app's language switching

Supported languages are `ko`, `en`, `ja`, `de`, `fr`, `es`, `pt`, `zh`, `ar`, and `id`. Values such as `en-US` and `pt_BR` are normalized to supported codes. When `i18n.enabled` is on, the language is resolved in this order:

1. The fixed language in the board settings
2. The language passed from the parent board screen
3. The current language of the host's `@nuxtjs/i18n`
4. `memiBoard.locale`
5. `ko`

To follow the site's language switching, set the board's language to **Auto** in the board settings. A language fixed per board takes precedence over the site language.

If the host app uses `@nuxtjs/i18n`:

```ts
// nuxt.config.ts — merge into the existing config
modules: ['@nuxt/ui', '@nuxtjs/i18n', 'nuxt-vuefire', 'memi-board'],
i18n: {
  locales: [
    { code: 'ko', language: 'ko-KR', name: '한국어', file: 'ko.json' },
    { code: 'en', language: 'en-US', name: 'English', file: 'en.json' }
  ],
  defaultLocale: 'ko',
  strategy: 'no_prefix',
  langDir: 'locales/'
},
memiBoard: {
  i18n: { enabled: true },
  translation: { enabled: false }
}
```

This example uses only Korean and English UI. Create messages for the host UI in the host's `i18n/locales/ko.json` and `en.json` (`{}` is fine to start). The package ships the board's own translation files, so don't copy them. Add other languages to the host list as needed.

The host app wires up Nuxt UI's internal strings and the site's `<html>` language. For example, a Korean/English host can set this in `app/app.vue`:

```vue
<script setup lang="ts">
import { en, ko } from '@nuxt/ui/locale'
const { locale } = useI18n()
const uiLocale = computed(() => locale.value === 'en' ? en : ko)
useHead({ htmlAttrs: { lang: () => uiLocale.value.code, dir: () => uiLocale.value.dir } })
</script>

<template>
  <UApp :locale="uiLocale">
    <NuxtPage />
  </UApp>
</template>
```

Sites that use layouts keep their existing `<NuxtLayout>` structure. If the board is single-language and the host is multilingual, the site-wide `<html>` and `UApp` language are determined by the host's policy.

## 4. When translations run and are saved

| Target | When it runs | When it is saved |
|---|---|---|
| Board label and description: manual | Click **Translate into 10 languages** | Click **Save** in the settings after translating |
| Board label and description: auto | Turn on the auto-translate toggle and click **Save** | Saved with the settings after translation completes |
| Home section titles | Saving the section layout | Saved with the layout after translation |
| Title, summary, and body of an existing post | Click **Translate and save in 10 languages** in the writing AI | Saved to the post immediately after translation completes |
| New post: auto | Turn on **Automatically translate new posts** in the board settings, then save a new post | Title, summary, and body are translated and saved with the post |
| New post not yet saved | Click **Translate and save in 10 languages** in the writing AI | Saved together when the new post is saved |

The 10 languages include the source language. If the original is Korean, it is translated into the other 9 languages and combined with the Korean original. Typing alone does not send translation requests until you click a translate button or save.

If the board name, description, and section titles are the same as when they were translated and all translations exist, retranslation is skipped. The board's auto-translate toggle is off by default. `i18n.enabled` and `translation.enabled` being on by default means the service can use translation; it does not automatically turn on a board's auto-translate toggle.

`autoTranslatePosts` applies only to writing new posts and defaults to `false`. Existing boards without the field are treated as off. Posts are not auto-translated on edit. Manually prepared translations are reused if they match the current content. If auto-translation fails, the input is kept, an error is shown, and saving the post is aborted. If translation is turned off service-wide, posts are saved without translation regardless of this option.

Calling `translateBoard()` directly from code translates regardless of the board's current auto-translate toggle. If the service-wide internationalization or translation option is off, it returns the original as-is.

## 5. AI connection and failure handling

Apply the AI Logic and App Check steps from the [Firebase setup guide](firebase-setup.md) to the host project. The Firebase web app's `projectId`, `appId`, and App Check registration must match. The translation model and App Check token options share the existing `memiBoard.moderation.model` and `moderation.useLimitedUseAppCheckTokens`.

`moderation.enabled: false` turns off **moderation**. To also turn off translation, use `translation.enabled: false` or `i18n.enabled: false`. Conversely, turning off translation leaves writing assistants such as spell checking and sentence polishing, and moderation, governed by their own settings.

| Situation | Handling |
|---|---|
| Manual board translation fails | Input is kept and an error is shown. The user decides whether to save the settings |
| Automatic board translation fails | Settings and the original are saved, and a translation failure notice is shown |
| Section translation fails | The original layout is saved, with a console warning |
| Post translation fails | An error is shown. It does not proceed to saving the translation result |
| Translation turned off by service option | Auto-translation is skipped and saving proceeds normally. Calling AI translation directly throws a `memi-board/translation-disabled` error |

AI post translation counts as 1 use of the daily writing assistant quota regardless of the number of languages. Calls rejected because translation is disabled are rejected before any AI request or usage update. When enabled, a request that has already started and then fails may still be counted against usage.

## 6. Existing data and re-enabling

Translations are stored in the existing documents' `i18n` and `i18nSource`, and post body translations are stored in the corresponding body document. You don't need to migrate data or delete translation fields to turn the feature off.

If the original differs from what it was at translation time, the original is shown instead of that translation. This check stays in place after re-enabling. For example, if you renamed a board while translation was off, the translations of the old name are not shown until you translate again.

## 7. UI built by the host app

The package hides only its own UI. Language selectors or translate buttons built by the host app should be controlled in the host using the state below.

```vue
<script setup lang="ts">
import { useMemiBoardI18n } from 'memi-board/runtime'
const { i18nEnabled, translationEnabled } = useMemiBoardI18n()
</script>

<template>
  <span v-if="i18nEnabled">Language switching available</span>
  <span v-if="translationEnabled">Content translation available</span>
</template>
```

Outside components, use `isMemiBoardI18nEnabled()` and `isMemiBoardTranslationEnabled()`. Import both explicitly from `memi-board/runtime`. `configureMemiBoard()` accepts the same options, but in a Nuxt host app you only need to set `memiBoard` in `nuxt.config.ts`.

## 8. Checklist

- Single language: verify that the board's buttons and dates keep the specified language even when the host switches to another language.
- Content translation off only: verify that the UI changes and that posts with existing translations still show the original.
- Verify that saving a board with auto-translate on makes no AI requests while translation is disabled.
- Re-enabling: verify that unchanged originals use the saved translations and changed originals don't use stale translations.
- Verify that input and settings are preserved when translation fails.

Run the package's regression tests in the development environment with `pnpm test:i18n`.

### 게시글 원문 언어 (0.52.1+)

게시글 수동·자동 번역은 화면 언어 대신 제목·본문의 실제 언어를 판별해 원문 언어로 저장한다. 영어 화면에서 한국어 글을 번역해도 한국어 원문을 유지하고 영어 번역을 생성한다. 호스트에서 `translatePost({ source })`를 명시하면 그 값을 사용한다. 언어 판별은 번역과 같은 일일 사용 1회 안에서 실행된다. 이전 버전에서 화면 언어와 원문 언어가 다른 상태로 번역해 잘못 저장된 글은 재번역해야 한다.
