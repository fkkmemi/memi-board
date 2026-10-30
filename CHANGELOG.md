# Changelog

This project follows the [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format and uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- Saving the board profile (`ProfileEditModal`) failed with `permission-denied` for regular users. The reply-target lookup queried `replyToUid` alone, which the rules cannot allow without `listed == true` in the query. It now adds that filter, so name and photo changes reach the user's posts, comments, and replies again. Reply-target names on hidden boards are not updated. Added `tests/profile-rules.test.mjs`.

## [0.52.3] - 2026-10-30

### Changed
- Raised the AI writing assistant daily limit from 10 to 20 (`WRITING_ASSISTANT_DAILY_LIMIT`). Automatic translation of posts and comments counts toward the same limit, so active multilingual conversations no longer run out after a few comments.

### Fixed
- When automatic translation fails, including when the daily limit is reached, posts and comments are now saved with the original text only instead of failing to save. The comment form shows that the comment was posted without translation; it can be translated later from the edit form.
- The daily limit message is now translated into all 10 languages instead of falling back to English.

### Host app steps
- Update the AI usage limit in the host's Firestore rules from `10` to `20` in the three `aiWritingCount`/`aiWritingPending` checks under `memiBoardUsers` (see `docs/firestore.rules.example`), then deploy the rules. Until the rules are updated, the client allows 20 uses but the rules reject anything above 10.
- If the host app uses a copy of the SEO composables (e.g. `app/composables/useMemiBoardSeo.ts`), pass `locale.value` to `fetchPublicPostForSeo`/`fetchPublicListForSeo` and include `locale` in the `useAsyncData` key and `watch`, as the package has done since 0.46.1. Without it, translated posts keep the original title in the page title and OG tags. See the detail page section of [docs/host-integration.md](docs/host-integration.md).

## [0.52.2] - 2026-10-30

### Added
- Comments and replies now include an AI writing assistant in creation and edit forms, with proofreading, polishing, continuation, summarization, custom instructions, and translation into the board’s selected languages.
- The existing automatic post translation setting also translates comments and replies when saving. Translations preserve the original text and follow the viewer’s language in threads, feeds, mini lists, and user comment lists.
- Added `translateComment`, `CommentTranslationSet`, and `displayCommentBody` runtime APIs. Stale translations are hidden after the original comment changes.

### Host app steps
- Upgrade to 0.52.2. Existing boards with automatic post translation enabled also translate newly saved comments and replies. Existing comments can be translated from their edit form. No security rule changes are required.

## [0.52.1] - 2026-10-30

### Fixed
- Post translation now detects the original language from the actual text instead of using the current UI language. Translating a Korean post while viewing the English UI no longer stores the Korean original as English or skips the English translation.
- Manual translation and automatic translation of new posts share the detected source language. Detection is included in the same daily writing-assistant use; an explicit `translatePost({ source })` still takes precedence.

### Host app steps
- Upgrade to 0.52.1 and translate affected posts again. Previously mislabeled source-language data does not contain the missing translation and cannot be repaired by changing the display language alone.

## [0.52.0] - 2026-10-29

### Added
- Added "Translation languages" to board settings (`BoardModel.translationLocales`). Board name/description translation and post translation (auto-translate and the writing assistant's "Translate and save") now translate only the selected languages. When empty, all supported languages are used (same as before). Selecting all languages saves an empty array so languages added later are included too.
- Added an "Apply to all boards" card above the global board settings (`MemiBoardSettings`). Only the checked items among translation languages, translate on save, auto-translate on post creation, and board language are written over the saved settings (other values being edited are not saved). The "Translate untranslated boards" button translates and saves only boards with no name/description translation or whose source or translation languages changed.
- `boardTranslationLocales(board)` — the list of a board's translation target languages. `translatePost({ targets })` and `coversLocales(i18n, fields, locales)` also accept target languages.

### Changed
- Translation-related text now shows the actual number of translation languages instead of "10 languages".
- Filled the intro sentence of the board info modal in 10 languages (added Japanese, Chinese, German, French, Spanish, Portuguese, Indonesian, Arabic).
- Version history is now written in Korean and English. Added `highlightsEn` and `noteEn` to `VersionHistoryEntry`; English is shown for UI languages other than Korean.

### Host app steps
- Bump the package: `pnpm add memi-board@^0.52.0`. Existing boards have empty translation languages, so they keep translating into 10 languages as now.
- No Firestore rules changes (the `translationLocales` field in `memiBoardSettings` is saved under the existing rules).
- If the host app calls `translatePost` directly, pass `targets: boardTranslationLocales(board)` to follow the board settings.

## [0.51.2] - 2026-10-29

### Changed
- Aligned the author name on default list cards to the right edge.
- Removed the memo icon next to the author and moved it into the author menu as a "Private memo" item. Clicking it opens a modal to write the memo; good/bad ratings show as the item color. Memos are loaded when the menu opens instead of being prefetched for every card in the list.
- Removed the notice-only list (`ListNotices`). Notices are now shown before regular posts using the board's list view component, with a pin icon before the title. The detail view also uses a pin icon instead of a badge. The pin is baseline-aligned within the title text.
- Notice posts in lists now have a primary-colored border and a subtle shadow. The compact view distinguishes them with a light background.

## [0.51.1] - 2026-10-29

### Added
- Added a "Pin as notice" switch to the post edit view. It is visible only to board managers when editing a published post, and pinning/unpinning is applied on save. New posts are pinned from the detail or edit view after publishing.

### Changed
- Replaced the notice area above the list with a vertical Nuxt UI `UNavigationMenu`. It follows the theme's default look instead of custom styles.

## [0.51.0] - 2026-10-29

### Added
- Notices. Board managers (admins and assigned staff) can click "Pin/unpin as notice" on a published post's detail view. The post gets `pinned` and `pinnedAt` fields.
- `useMemiBoardPostList` subscribes to notices in a separate concurrent query (up to 10, most recently pinned first) and returns them as `notices`. Notices are excluded from the regular `posts`, and `postsPending` becomes false once both queries have arrived. If the notice query fails, the regular list is still shown.
- `MemiBoardList` shows notices at the top, one per line, regardless of list view type. Added `setPostPinned(id, pinned)` to `useMemiBoardPosts`.

### Security
- Authors' regular edits and post creation cannot change `pinned`/`pinnedAt`. Manager updates change only those two fields, and pinning is allowed only on published posts with the server timestamp. Added emulator permission tests.

### Host app steps
- Merge the `memiBoardPosts` rule changes in `docs/firestore.rules.example` (`postPinUnchanged`, `isValidPostPinUpdate`, create condition) into the host app rules and deploy.
- Deploy the 2 new `memiBoardPosts` composite indexes added to `docs/firestore.indexes.json.example` (`boardId`, `isPublished`, [`listed`], `pinned`, `pinnedAt` desc). Until the indexes are built, notices are not shown and only the regular list appears.

## [0.50.0] - 2026-10-29

### Added
- Added owner/admin-only orphan lookup and selective deletion to the global board settings. Cleans up files and comments without a parent post, images of deleted comments, and likes without a target. Report records and body subdocuments without a parent are kept.
- Protects files updated within the last 24 hours, files referenced from bodies, translations, attachments and comments, and documents whose link was restored. Shows counts of deleted, skipped and failed items, and failed items can be retried.

### Security
- The deletion plan is kept as an internal immutable snapshot and only allowed collections and file paths are processed. If the account or settings change after lookup, or a file's generation changes, that deletion is aborted.
- Firestore document deletions re-check the parent in a transaction. Replaced the `listed` default-value branch, which allowed listing all private comments, with an explicit field check.
- Narrowed Storage's public `read` to `get` so anonymous users, regular users and assigned staff cannot list all files. Admins and the post's author can list the folders they need, and existing public file downloads still work.
- Added Firebase emulator permission tests and regression tests for cleanup paths and the grace period.

### Host app steps
- Merge the changes in `docs/firestore.rules.example` and `docs/storage.rules.example` into the host app rules and deploy. Pushing the package or updating npm alone does not change production Firebase rules. Custom collection paths must also match the host app configuration.
- Firestore and Storage cannot be deleted atomically, so run this during low usage. It reads all bodies and files, which incurs read costs.

## [0.49.0] - 2026-10-29

### Added
- Added an `autoTranslatePosts` board setting, off by default. When on, new posts have their title, summary and body translated into 10 languages and saved together.
- On translation failure, input is kept and saving is aborted. When saving is retried with the same content, the prepared translations are reused.

## [0.48.1] - 2026-10-29

### Added
- Clipboard images can be pasted with Ctrl+V or ⌘V to attach them in the comment, reply and comment edit inputs. Plain text pasting still works.

## [0.48.0] - 2026-10-29

### Added
- Comments and replies can have one attached image. Text is required, and images may be jpg, png, gif or webp. Large files are reduced to 5MB or less before upload.
- Comment editing can add, replace or remove the image. Images are not shown on blinded comments.

### Changed
- Post deletion and board deletion delete the `comment-images/` folder and the image paths recorded in comments while the post document still exists, then delete the comment documents.

### Host app steps
- Merge the `comment-images` rule in `docs/storage.rules.example` and the comment `images` check in `docs/firestore.rules.example` into the host app rules and deploy the Storage and Firestore rules for uploads to work. If only the package is updated, comment image uploads fail with `storage/unauthorized`.

## [0.47.1] - 2026-10-29

### Fixed
- The AI writing assistant now only reserves `aiWritingPending` before the call and commits it to `aiWritingCount` on success. Failed calls such as App Check rejections or empty responses roll back the reservation and do not count toward the 10 per day. Committed counts cannot be decreased by the client.

### Documentation
- Changed the App Check guide to a reCAPTCHA Enterprise score key and a one-time token exchange after mount. Noted that enabling Storage/Firestore enforcement causes uploads and post saves to be rejected because of that token.

### Host app steps
- With the 0.47.1 package, merge the `memiBoardUsers` reservation branch from `docs/firestore.rules.example` and deploy the Firestore rules. Under the old rules, reservation writes are rejected and the writing AI does not work. Packages 0.47.0 and below keep working with the existing count-increment rule.

## [0.47.0] - 2026-10-23

### Added
- `i18n.enabled` pins a single UI language and turns off the internationalized UI and content translation. `translation.enabled` turns off content translation only.
- When translation is disabled, saved translations are kept and the original text is shown, and automatic board/section translation, AI translation requests and usage updates are blocked.
- Regression checks for the i18n options' default behavior, language priority, original-text display, translation re-enabling and AI call blocking.

### Documentation
- Split the installation guide for other sites from the i18n/translation guide and linked them from the README. Corrected the guidance on the required boardId, slug and document ID, the initial owner, and current file permissions.
- Documented the 0.45.1 rules migration procedure, `ownerUid` and cross-service IAM, retrying visibility changes, file management permissions and the report retention policy, and corrected earlier upload/deletion guidance.

## [0.46.2] - 2026-10-23

### Changed
- The translate button next to the board display label translates the name and description into 10 languages, which can then be saved. Available in both per-board and global board settings.
- Automatic translation of board names and descriptions in board settings is now turned on with a switch, off by default.


## [0.46.1] - 2026-10-22

### Added
- Saving board settings translates the name and description into the 10 supported languages and stores them in the `i18n` of the `memiBoardSettings` document. Unchanged text is not retranslated.
- Replaced the two per-language translation items in the writing AI menu with a single "Translate into 10 languages and save". Title and summary go in the post document, the body in `body/main`, and only 1 use is deducted from the daily count.
- Saving a section also stores its changed title in the same 10 languages in `settings/homeLayout`. Lists, details, sections and SEO use the translation for the viewing language, and when the original is edited, the original is shown instead of the stale translation.

## [0.46.0] - 2026-10-21

- Added `owner` and `manager`, and separated the scope of board settings and staff assignment with `allowedManagerUids`.
- `roleLabels` changes role display names per host app. `canConfigureBoard()` is used for settings and the existing `canManageBoard()` for content management.
- Only the top admin can change other admins' roles. Changing one's own role and the owner role is blocked on the client.
- Restricted report reads to the assigned boards. Non-admin report lists require a boardId.
- Removed the global staff edit permission in Storage. Only admin/owner can modify or delete others' files; file management by assigned managers requires server-side handling in the host app.
- Migration procedure for existing admin → owner, staff → manager and assignment lists: `docs/roles-migration.md`.

## [0.45.1] - 2026-10-15

### Fixed
- Aligned the rules example so authors and assigned managers can clean up related likes when deleting a post, while keeping report records.
- Blocked others from overwriting or deleting existing post images and unsaved files, and recorded `ownerUid` on uploads.
- Restricted changes to the board, author and public visibility fields when editing a post, and validated simultaneous creation of the post and body with `getAfter()`.
- Visibility changes are handled as a retryable transition: creation and publishing are locked, content is hidden, and the completed state is saved last.
- Split post/draft slug lookups for regular accounts to match read permissions. New post URLs use the title and an auto-ID so they don't collide with private drafts or concurrent writes. Existing URLs are kept.
- Fixed pressing Enter after typing a tag triggering a post save.
- Subscribes to the full range of loaded comments and replies so edits, likes and deletions of earlier items are reflected in real time for other accounts.

### Host app steps
- Along with the package update, apply the Firestore and Storage rules examples to the host app rules. Pushing to App Hosting alone does not deploy the rules.

## [0.45.0] - 2026-10-01

### Added
- i18n: the board UI is shown in 10 languages (`ko` `en` `ja` `de` `fr` `es` `pt` `zh` `ar` `id`). ko and en are fully translated; the rest translate only short UI strings, and long guidance text falls back to English. Each language's translations are loaded on demand as a separate chunk.
- Added "Board language" to board settings. It can be automatic (follow the site language) or pinned to one of the 10 languages (`BoardModel.locale`, empty = automatic).
- If the host app has `@nuxtjs/i18n`, the current locale is followed automatically. Otherwise `memiBoard.locale` (default `'ko'`).
- Split the AI moderation and writing assistant prompts by board language. ko uses the existing Korean prompt; others use an English prompt with responses in that language.
- Arabic boards add `dir="rtl"` to the list, detail and write roots.
- `useMemiBoardAutoTranslate().translateEntries(entries, { targets })` — translates short strings such as menu and board names into several languages with Firebase AI Logic and returns them (the caller decides how to save). `localizedText(i18n, locale, field, fallback)` picks the value for the current language.
- API: `useMemiBoardI18n()` (`t`, `locale`, `dir`, date/number formatting), `translate`, `loadMemiBoardLocale`, `MEMI_BOARD_LOCALES`, `normalizeMemiBoardLocale`, `boardSectionKinds`/`boardSectionSorts`, `buildModerationPrompt`.

### Changed
- Switched date display from dayjs to `Intl`. Korean relative times change slightly to numeric forms, e.g. "하루 전" → "1일 전". Removed the `dayjs` peer dependency.
- Added an optional `locale` argument to `formatDate`/`formatRelativeDate`/`formatFullDate`/`formatTimestampDetails`, `reportReasonLabel`, `formatRestrictedUntilLabel`, `compressImage`, the boardSeo helpers and `miniPostTitle`/`miniViewLabel`. When omitted, Korean is used as before.
- `useMemiBoardModeration` and `useMemiBoardWritingAssistant` accept a `{ locale }` option.
- The confirmation text for deleting all data follows the UI language (English: "delete board data").

### Host app steps
- Bump the package: `pnpm add memi-board@^0.45.0`. With just this, the Korean UI stays the same.
- To use i18n, run `pnpm add @nuxtjs/i18n`, put `'@nuxtjs/i18n'` before `'memi-board'` in `modules` in `nuxt.config.ts`, and set the `code` values in `i18n.locales` to `ko`/`en`/`ja`/`de`/`fr`/`es`/`pt`/`zh`/`ar`/`id` (README "i18n" section).
- Optional: in `app.vue`, match `<UApp :locale>` and `<html lang dir>` to the site language (README example). Add a language switcher menu (`useI18n().setLocale`) to the site header.
- Optional: to pin a single language without `@nuxtjs/i18n`, use `memiBoard: { locale: 'en' }`.
- If the host app uses `dayjs` directly, just keep it in the host app's `package.json` (memi-board no longer requires it to be installed).
- No Firestore rules changes (the `locale` field in `memiBoardSettings` is saved under the existing rules).

## [0.44.1] - 2026-10-01

### Fixed
- Fixed the submit button needing two clicks in macOS Safari right after Korean input (while the last character is still composing). The first click was consumed by committing the composition; mouse input now commits the composition on press (`pointerdown`) and submits immediately. Touch input still uses click. Applied to: write "Next: Preview"/"Save changes", comment/reply submission, comment edit save, report, and email sign-in.
- The submit handlers of the buttons above ignore repeated calls while processing to prevent duplicate saves.

### Added
- `imeSafeSubmitPointerDown`/`imeSafeSubmitClick` — exported so the same handling can be added to host app forms. `<UButton type="submit" @pointerdown="imeSafeSubmitPointerDown" @click="imeSafeSubmitClick" />`

### Host app steps
- Bump the package: `pnpm add memi-board@^0.44.1`. This alone fixes the package components.
- Optional: if the host app has its own forms where users type Korean and immediately press the submit button, attach the two handlers above to the `type="submit"` button (the form's `@submit.prevent` handler is still called).

## [0.44.0] - 2026-10-01

### Added
- `useMemiBoardPosts().resolvePostIdBySlug(slug)` — looks up only the post id by slug. Where only the id is needed, such as detail and edit pages, it takes fewer round trips than `getPostBySlug`, which also reads the body, and a post just created in the same tab is returned without a lookup.
- `useMemiBoardPosts().resolveUniqueSlug(title)` and `CreatePostInput.slug` — a precomputed slug can be passed to `createPost`.

### Changed
- Post saving is faster. The slug uniqueness check runs concurrently with AI moderation, and the meta and body documents are committed in a single `writeBatch`.
- `useMemiBoardPostSeo`/`useMemiBoardListSeo` wait for data only during SSR and hydration. On client navigation they no longer block the page transition and update the meta afterward. This was the main cause of the slow entry into preview after saving, especially in environments with slow round trips such as Safari.

### Host app steps
- Bump the package: `pnpm add memi-board@^0.44.0`. The bump alone applies the faster saving and non-blocking navigation in the built-in `useMemiBoardPostSeo`/`useMemiBoardListSeo`.
- If the post detail (`[category]/[id]/index.vue`) and edit (`[category]/[id]/edit.vue`) pages resolve slug → id with `getPostBySlug`, switch to `resolvePostIdBySlug`. The result is `result.id` instead of `result.post.id`. The status values (`ok`/`not-found`/`permission-denied`/`error`) are the same. Entering preview right after saving takes 2 fewer Firestore round trips.
- If the host app uses a copy of the SEO composables (e.g. `app/composables/useMemiBoardSeo.ts`), make it match the package. Add `const nuxtApp = useNuxtApp()` and change the trailing `await postAsync`/`await listAsync` to `if (import.meta.server || nuxtApp.isHydrating) await …`. Otherwise 2 SEO lookup round trips block the transition on every page navigation.
- If a page was shortcutting the id lookup with the `post` from `await useMemiBoardPostSeo()`, this value may initially be `null` on client navigation. With a `resolvePostIdBySlug` fallback it keeps working.

## [0.43.0] - 2026-09-19

### Changed
- Removed the `heic2any` dependency and the in-browser bundle conversion code. Photos picked from the iPhone photo library are normally delivered as JPEG; when a HEIC/HEIF original is picked from the Files app or similar, a message asks the user to convert it to JPG, PNG or WebP.
- Updated dev and build dependencies to the latest compatible versions, including Nuxt 4.5.2, Nuxt UI 4.11.1, Firebase 12.19.0 and Vite 8.3.0. TypeScript uses 6.0.2, the latest version supported by `vue-tsc`.

### Fixed
- Removed the failure where Nuxt 4.5.2's Nitro prerender step failed while parsing `heic2any`'s Emscripten bundle.

## [0.42.1] - 2026-09-18

### Fixed
- Fixed mini lists (`useMemiBoardMiniLatest`/`useMemiBoardMiniPicked`) skipping the query on the server, which made the server render an empty state (`<p>`) and the client a loading skeleton (`<div>`), causing a hydration mismatch and the `[VueFire SSR]: Could not get the path of the data source` warning. The query now runs on the server too with an `ssrKey`, so the first render always matches.

## [0.42.0] - 2026-08-27

### Added
- Added `+` and `/` block insertion menus to the post editor, following the official Nuxt UI template. Paragraph, headings, lists, quote, code, image, YouTube, divider and AI continue-writing can be inserted quickly.
- The paragraph drag handle menu supports changing block type, duplicating, moving up/down and deleting.

## [0.41.0] - 2026-08-27

### Added
- Added a confirmation modal that shows AI writing assistant results side by side with the before/after instead of applying them immediately. Changes reach the editor only after clicking "Apply"; "Cancel" closes it with no changes.

## [0.40.0] - 2026-08-27

### Added
- Added a "Rewrite in a custom style" item to the AI writing assistant menu. When the user enters their own instruction (e.g. "in Gyeongsang dialect style"), the body is rewritten in that style while keeping its meaning.

## [0.39.1] - 2026-08-27

### Added
- Admins can turn on the "Ignore profanity filter" switch at the bottom of the write form to skip the local banned-word list and AI moderation when posting. Exposed as `useMemiBoardModeration().checkText(text, { skipFilter })`.

## [0.39.0] - 2026-08-21

### Added
- In the image input form, an uploaded photo can be chosen with the "Set as cover" button. The chosen photo moves to the first position and is saved as the cover image for lists and share previews.
- Added an `editorType` (`default`/`image`) input form choice to board settings. It can be set independently of the `listView` display mode.

### Compatibility
- Existing boards without an `editorType` field keep the image input form when `listView === 'image'` and use the regular input form otherwise. No data migration is needed.

## [0.38.1] - 2026-08-21

### Fixed
- Fixed Storage `listAll(memiBoardPosts/{postId})` failing with `storage/unauthorized` on post deletion. The package empties only `images/` and `attachments/`.
- `docs/storage.rules.example`: the list prefix is `memiBoardPosts/{postId}/`, so a single-segment `{postId}` `allow list` returns 403. The host app must copy the `list`/`get`/`delete` block for `{postId}/{allPaths=**}` and run `firebase deploy --only storage`. Do not put `write` in this block.

## [0.38.0] - 2026-08-21

### Changed
- **Comments on hidden boards can only be written by assigned staff (or admins).** Rules and UI block it regardless of `commentWriteRole`. Private posts effectively have no comments, and if a staff memo is needed, only designated staff can leave one.
- **Comments on hidden boards are excluded from the public feed and author comment lists.** `memiBoardComments.listed` is copied from the post, and comment reads in `docs/firestore.rules.example` are narrowed to `canReadComment` (listed, or author/admin/assigned staff/read permission on the parent post). The old `allow read: if true` was a hole that leaked comments on hidden posts.
- Saving a board syncs `listed` on that board's posts and comments (skipped when the value already matches). Old comments on public boards have no `listed` and may drop out of the feed, so the host app can backfill by saving each public board once.

### Breaking
- The host app must redeploy `docs/firestore.rules.example` and `docs/firestore.indexes.json.example`. Comment creation now requires `listed`, the public feed and author comment lists need a `listed==true` composite index, and reply lookups need a `postId+rootId+isReply` index.

## [0.37.2] - 2026-08-19

### Fixed
- `MiniPicker.vue` imported `../utils/boardPaths` with a relative path, breaking the build in host apps installed from dist (registry versions); it only passed by accident in `link:` local development. Switched `postsCol` to the existing `memi-board/runtime` export. The bug existed since 0.35.0 (when `MiniPicker` was introduced).

## [0.37.1] - 2026-08-19

### Fixed
- The README's read-post indicator example used `:visited { color: var(...) }`, which doesn't actually work. `:visited` ignores `var()` and alpha values, so the example now uses literal light/dark colors.

## [0.37.0] - 2026-08-19

### Added
- Read-post indicator hook. Post links in list and mini components (`ListDefault`/`ListDense`/`ListVideo`/`MiniCard`/`MiniPosts`) get a `.memi-board-post-link` class, and the title text follows the parent color with `text-inherit`. If the host app sets a color on `.memi-board-post-link:visited`, read posts are dimmed using the browser's native visit history (the package does not force a color).

## [0.36.0] - 2026-08-19

### Added
- Post reports. A reason and memo are stored in `memiBoardReports/{postId}_{uid}`, handled via the report button on the post detail and the staff `<MemiBoardReportList>`. Contents are readable only by the reporter and staff.

### Changed
- Staff manage only the boards they are listed on in `allowedStaffUids`. If the list is empty, only admins manage the board.

## [0.35.0] - 2026-08-19

### Added
- Main section layout components. `<MemiBoardMini>` reads `settings/homeLayout` and lays out `<MemiBoardSection>`s, whose contents are `<MemiBoardMiniList>` / `<MemiBoardMiniPost>`. Admin post picking is `<MemiBoardMiniPicker>`.
- Section kind `comments` (comment collection). 4 by default, newest or most liked. "More" goes to `/boardComments`.

## [0.34.0] - 2026-08-19

### Added
- Global comment feed `useMemiBoardCommentFeed` / `<MemiBoardCommentFeed>`. Supports newest (`createdAt`) and most liked (`likeCount`). Most liked only includes comments that have a `likeCount` field.

## [0.33.0] - 2026-08-19

### Added
- Likes on comments and replies. Uses the same flat `memiBoardLikes` collection as posts; comment likes use document ID `${commentId}_{uid}` + `target: 'comment'`. The post detail subscribes to the user's likes with a single `uid + postId + target` query instead of a listener per comment.
- Comment documents have a `likeCount` updated ±1 in a transaction. Existing comments without the field show 0.
- Deleting a comment or cascade-deleting a post also deletes the related like documents.

### Compatibility
- The host app must merge and deploy the comment `isLikeCountUpdate` and comment like create rules from `docs/firestore.rules.example`.
- Comment like creation checks the parent post's `boardId` instead of relying on the empty `boardId` of old comments. `get` on a nonexistent like document is allowed for signed-in users.
- Showing the user's comment likes on a post requires the `memiBoardLikes` composite index `uid + postId + target`.

## [0.32.0] - 2026-08-14

### Added
- The editor image button can choose between uploading a file from the device and an external HTTPS image URL. Image URLs are checked to actually display before saving and are previewed, and linked images can also be added to the image board gallery. As before, the first linked image is used as the cover image for lists and sharing.

### Changed
- Deleting a board in board settings now permanently deletes all of the board's posts, bodies, comments and replies, body images and attachments, not just the settings document. A warning about the scope and irreversibility is shown before deletion, and the board settings are deleted last after all linked data is gone so a failure can be retried.
- On post deletion, only Firebase Storage hosts are treated as deletion targets so external image URLs in the body are not mistaken for Firebase Storage object paths.

## [0.31.0] - 2026-08-14

### Added
- AI writing assistant in the editor (spelling, polish, continue writing, summarize, translate, title).
- AI writing limited to 10 uses per signed-in user per 24 hours (`aiWritingCount` / `aiWritingWindowAt`). The host app must merge and deploy `docs/firestore.rules.example`.

## [0.30.2] - 2026-08-14

### Changed
- Changed the `ListDefault` (default view) thumbnail from a `size-[4.5rem]` circle to a `size-[3rem]` rounded square (`rounded-lg`).
- Slimmed the editor toolbar so it isn't cut off on narrow screens. Headings, emphasis, lists and quote moved into a "Format" dropdown; the bar keeps only link, image, YouTube and undo. Same on mobile and desktop.

### Fixed
- Fixed `ensureUserDoc` overwriting the `memiBoardUsers` profile with the Firebase Auth name and photo on every sign-in. Existing values are kept and Auth values fill in only when empty.

## [0.30.1] - 2026-08-13

### Changed
- Simplified the list button at the top of the post detail to show only a left arrow icon without text. The `aria-label` for screen readers is kept.
- Changed the npm publish workflow from GitHub Release-based to push-to-`main`-based. Republishing an already published version is stopped by a pre-check.

## [0.30.0] - 2026-08-13

### Added
- On regular boards with a title, posts can be written with only image attachments and no body text. Image list view boards can also post gallery photos without a description. Empty posts and posts with only non-image attachments are still blocked.

### Changed
- Commented out the list view switcher at the top of the list, which was a test UI for checking per-board display modes. The actual list uses the board setting's `listView` as is.
- Storage example rules: body image writes require sign-in + 5MB + `image/*`. This avoids `firestore.exists()` turning the whole request into `unauthorized` in the write screen and for pasted PNGs, where the post document doesn't exist yet.
- Docs: match the Storage `bucket` in `firebase.json` with the app's `storageBucket`. Added steps for resolving `*.appspot.com` / `*.firebasestorage.app` mismatches in older projects and `storage/unauthorized` to the README and firebase-setup.

## [0.29.1] - 2026-08-13

### Fixed
- Fixed changes to the name or photo in the profile updating only `memiBoardUsers/{uid}` while existing posts and comments kept showing the values from when they were written. Saving the profile now also updates `authorName`/`authorPhoto` on the user's `memiBoardPosts`, the same fields on the user's `memiBoardComments`, and `replyToName` on replies pointing to that user, in Firestore batches of 450. The Firebase Auth profile remains the host app's responsibility and is not changed.

### Compatibility
- Added a narrow rule to `docs/firestore.rules.example` that allows only the `replyToName` field copied into replies written by others to be updated by the user themselves. It must be merged into the host project's Firestore Rules and deployed for the bulk profile update to work.

## [0.27.0] - 2026-08-12

### Breaking
- **Removed the `avatarSize` prop from `AuthorMenu`.** The trigger changed from a hand-built `<button>`+`UAvatar` to `UButton` (`:avatar`, `size="xs"`), so instead of setting the avatar size directly, Nuxt UI now picks it automatically to match the button size (`size="xs"` → `leadingAvatarSize: "3xs"`); passing `size` directly would make it larger than this automatic size and defeat the purpose. Nothing internal used this prop, but if the host app was passing it, remove it.

### Changed
- **Reworked the `ListDefault` (default view) card layout.** Removed the fixed square thumbnail on the left (post image/placeholder); if the post has an image, a large circular thumbnail (`size-[4.5rem]`) is placed between the title block and the right meta column, and otherwise that slot isn't rendered at all. Widened the right meta column from `w-[5.5rem]/w-24` (88–96px) to `w-[120px]` so the avatar and name fit comfortably. Moved the attachment count (📎) right next to the view count (👁) with the same icon+number style.
- **Fully redesigned `ListDense` (compact view).** Dropped the rail+circular-node timeline concept for a single-line list in the style of Korean community boards: the comment count uses the same green pill badge as `ListDefault`, the attachment count sits next to the view count in the same icon style, the meta line is pipe-separated in the order `time | author | views | likes | [category]`, and posts with an image show a small square thumbnail on the right (`size-12`, `rounded-md`). Added `divide-y` dividers between rows.
- **Replaced the `AuthorMenu` trigger with `UButton`.** Uses the `label`/`avatar` props with `size="xs"`, relying on the Nuxt UI preset instead of custom padding (`px-1 py-1 gap-1.5`). The `truncate` built into the `label` slot was always applied even in contexts where the `truncate` prop is off (wide columns), so it is explicitly countered there with `whitespace-normal overflow-visible text-clip`, preserving yesterday's (`f0a348d`) "wrap instead of truncating" intent. Name alignment is set explicitly to `text-left` instead of the `<button>` default (`text-align: center`).
- `buildPostPreview` in `postPreview.ts` now keeps paragraph boundaries such as `</p>`/`<br>`/`</div>` as `\n` instead of spaces; otherwise posts written in two paragraphs were collapsed into one line in the summary, and the list's 2-line clamp (`line-clamp-2`) only kicked in when text overflowed rather than at line breaks. Added `whitespace-pre-line` to the summary `<p>` in `ListDefault`/`ListVideo` so line breaks actually show. The `summary` field of already saved posts stays in the old format until they are saved again.

## [0.26.0] - 2026-08-12

### Added
- **Private author memo + good/bad rating** — leave a private memo while viewing another author (the "memo on this user" feature common on Korean community sites). Added the `useMemiBoardAuthorMemo(targetUid)` composable and a memo icon next to the name in `AuthorMenu` (`UPopover`, loaded on open). There is no separate "Save" button; the "Good" (`primary`) / "Bad" (`error`) buttons are the save buttons and save the text and rating together. The icon color reflects the rating (good=`text-primary`, bad=`text-error`, none=`text-muted`). Added a `sentiment: 'good' | 'bad'` field to `AuthorMemoModel`. Stored at `memiBoardUsers/{myUid}/memos/{targetUid}`; since the document ID is targetUid there is always one memo per target (overwritten on resave), and the delete button deletes the document itself. 100-character limit (`AUTHOR_MEMO_MAX_LENGTH`), no profanity filter (unnecessary since only the user reads it). The icon is not shown on the user's own card.
  - **Migration**: `docs/firestore.rules.example` adds `match /memos/{targetUid} { allow read, write: if isSignedIn() && request.auth.uid == uid; }` inside `memiBoardUsers/{uid}`; even admins can't read it (it's purely a personal reference, not for moderation). The host app must apply it to the deployed rules for saving and loading to actually work.
  - `useMemiBoardAuthorMemo` shares a module-scoped cache keyed by targetUid (+viewerUid), because when the same author appears multiple times in a list (having written several posts), separate state per `AuthorMenu` instance meant saving in one left the other cards stale.

### Fixed
- **Fixed `AuthorMenu` in `truncate` mode (ListDefault's narrow meta column) cutting text far shorter than needed, e.g. the "Admin" role label reduced to its first character plus "…".** `f0a348d` had narrowed truncate to opt-in, but the root cause remained: the wrapper stayed `inline-flex` (shrink-to-fit) while only the name span got `flex-1 basis-0`, and `truncate` reduces min-content to nearly 0, so the whole shrink-to-fit chain collapsed far below the actual content (measured in the browser: the wrapper computed to 31px even though the label itself fit in the 76px column). Fixed by giving the wrapper and button `w-full`/`flex-1` in truncate mode so the full column width (76px) is truly available; re-measuring confirmed `scrollWidth === clientWidth` (no truncation).

## [0.25.0] - 2026-08-12

### Added
- **`useMemiBoardUserComments(uid)` + `<MemiBoardUserCommentList>`** — same pattern as "View posts" (`useMemiBoardUserPosts`/`UserPostList`), collecting comments across all boards by a single author uid. Added an `authorCommentsTo` prop to `AuthorMenu` so a "View comments" menu item can be wired up (threaded through `List`/`ListDefault`/`ListDense`/`ListVideo`/`Detail`/`UserPostList`).
- `<MemiBoardUserCommentList>` attaches a host-app-built link (`getPostLink`) to each comment to navigate to the original post. Since it doesn't hold the post's slug, the host app is advised to build a permalink from `boardId`+`postId` and decide the post's actual access state (not found/private, etc.) at click time.

### Changed
- **`docs/firestore.rules.example`: `allow read` on `memiBoardComments` no longer `get()`s the parent post and always allows (`allow read: if true`).** `useMemiBoardUserComments` queries comments across many posts at once with `where('authorUid','==',uid)`, and the old rule (`canReadPost(get(postPath(resource.data.postId)).data)`) only held for queries with postId fixed by an equality (`==`) filter, so this cross-post query was rejected with permission-denied. Comment text is now always exposed regardless of the parent post's visibility, and the access state is expressed when navigating to the actual post instead (the post detail page's existing not-found/permission-denied handling).
  - **Migration**: to use this feature, the host app must update its deployed Firestore rules to match this example; without it, the new composable/component get permission-denied. Reading comment threads on the existing post detail page keeps working (permissions widen rather than narrow).
  - Added a `memiBoardComments(authorUid asc, createdAt desc)` composite index to `docs/firestore.indexes.json.example`; without deploying it, the query fails with "The query requires an index".

## [0.24.0] - 2026-08-11

### Breaking
- **Moved `useMemiBoardStorage` (+ `compressImage`, `EDITOR_IMAGE_MAX_BYTES`, `EDITOR_IMAGE_SOURCE_MAX_BYTES`) from `memi-board/runtime` to the new `memi-board/storage` subpath.**
  - Cause: `useMemiBoardStorage` has a dynamic `import('heic2any')`, and heic2any embeds its WASM glue code as a whole string, so when that chunk ended up in `dist/index.js` (also loaded for SSR), Nitro's rollup commonjs parser broke the production build while parsing it — failing at build time even though it's never actually called at runtime.
  - `dist/index.js` no longer references any heic2any/canvas code (verified with grep after building). The heavy browser-only code (`storage.js`, ~1.36MB) is loaded dynamically by `Editor.vue`/`Attachments.vue` on the client only.
  - Migration: `import { useMemiBoardStorage } from 'memi-board/runtime'` → `from 'memi-board/storage'`. If the host app used this composable directly (uncommon, as it's meant for the package's internal components), only the import path needs to change.
  - If the host app had a temporary workaround forcing heic2any external via Nitro `rollupConfig.external`, it can now be removed (it no longer ends up in the SSR bundle).

## [0.23.0] - 2026-08-11

### Breaking
- **Fully flattened the Firestore schema — removed the nested `memiBoards/{boardId}/…` structure.** No migration — assumes existing data is deleted.
  - `memiBoardPosts/{postId}` (+ subcollection `body/main`), `memiBoardComments/{commentId}`, `memiBoardLikes/{postId}_{uid}` — all top-level flat collections. `memiBoardSettings/{boardId}` merges the old `memiBoards/{boardId}` stub + `settings/config` double document into one.
  - Added `PostModel.boardId` and `CommentModel.boardId` fields (required) — boards/posts are scoped by field instead of path. All per-board/per-post queries became `where('boardId','==',…)` / `where('postId','==',…)` equality filters.
  - `useMemiBoardUserPosts()` no longer uses `collectionGroup('posts')`; with a flat collection, a regular `where('authorUid',...)` query is enough. `UserPostModel` became a deprecated alias of `PostModel` (both already have the `boardId` field).
  - Fully rewrote `docs/firestore.rules.example`/`docs/storage.rules.example`; the old collectionGroup carve-out (`match /{path=**}/posts/{postId}`) is gone. On comment creation, the client-supplied `boardId` is checked against the parent post's actual `boardId` (preventing spoofing to bypass `commentWriteRole`). The rules enforce the `${postId}_${uid}` document ID convention for likes.
  - New `docs/firestore.indexes.json.example` — the list of composite indexes based on the queries the package actually runs. The host app must merge this file into `firestore.indexes.json` and deploy it.
  - `MemiBoardConfig`: removed the `boardsCollection` option and added `postsCollection`/`commentsCollection`/`likesCollection`/`settingsCollection` options (all with defaults, customization optional).
  - Simplified Storage paths: `memiBoards/{boardId}/posts/{postId}/…` → `memiBoardPosts/{postId}/…` (postId is globally unique, so the boardId prefix is unnecessary). Removed the `boardId` argument from the `useMemiBoardStorage().uploadAttachment()`/`uploadEditorImage()` signatures.
  - New flat `memiBoardLikes` collection — for uid-based cross queries such as "posts I liked". Popularity sorting still uses the `likeCount` counter field on the post document (unchanged).
  - `docs/firestore.rules.example`: added an `isBoardWriter()` (= `isSignedIn() && sign_in_provider != 'anonymous'`) guard so anonymous sign-in accounts cannot create posts, comments or likes; even if the host app enables anonymous sign-in for other features (e.g. a guest queue), only board content creation is blocked by default. Reads and `isSignedIn()` in general are unaffected.
  - `docs/firestore.indexes.json.example`: added 2 ascending indexes needed by the "next post" (`endBefore`+`limitToLast`) query in `getAdjacentPosts()`. Firestore runs `limitToLast()` by reversing the order, so even a query written with `orderBy('createdAt','desc')` actually needs a `createdAt` **ascending** index. Previously only descending existed, causing `failed-precondition` errors in real use.

### Changed
- Switched the detailed-time tooltip on post and comment dates from hover (`UTooltip`) to click (`UPopover`, mode default `click`) so it works the same with a single tap on mobile touch, where there is no hover. 5 places: `CommentItem.vue`/`ListVideo.vue`/`ListDense.vue`/`Detail.vue`/`ListDefault.vue`. The board title description tooltip (`List.vue`) is a separate feature and was left as is.

## [0.22.0] - 2026-08-11

### Breaking
- Added a write → draft (preview) → publish flow. No migration — assumes existing data is deleted.
  - Added the required field `PostModel.isPublished: boolean` (+ `publishedAt?`). `createPost()` always creates the document with `isPublished: false`; posts are no longer public immediately on writing.
  - New `publishPost(id)` — switches to `isPublished: true`. `Editor.vue` still only handles writing (label "Publish" → "Next: Preview"); publishing is handled by the "Publish" button in the preview banner that `Detail.vue` shows for drafts (shown only to the author; likes and comments are hidden before publishing).
  - Added `where('isPublished','==',true)` to the `getPosts()` / `useMemiBoardPostList()` / `getAdjacentPosts()` queries — **existing documents without the `isPublished` field are not returned in lists or adjacent posts.**
  - `docs/firestore.rules.example`: added an `isPublished == true` condition to `canReadPost` (reads by non-authors), and `posts` `create` enforces `isPublished == false` (always a draft at creation).
  - The host app must add and deploy `isPublished` composite indexes in `firestore.indexes.json` (e.g. `isPublished+listed+createdAt`, `isPublished+createdAt`, including `__name__` tie-break variants).
  - `useMemiBoardPostList()` adds the signed-in author's own unpublished drafts to the list via a separate subscription; otherwise, leaving to the list before publishing left no way to find the draft again. Added a "Draft" badge to the 4 `List*.vue` components (Default/Dense/Image/Video). The host app must add and deploy an `authorUid+isPublished+createdAt` composite index.

## [0.21.1] - 2026-08-07

### Fixed
- Regression in the comment `update` rule in `docs/firestore.rules.example`: when v0.21.0 cleaned it up to `isOwner(resource) || isBoardStaff()`, the `isReplyCountUpdate()` carve-out that allowed the reply batch (top-level comment `replyCount` +1 on create, -1 on delete) was dropped entirely. When a user other than the top-level comment's author or staff replied, the whole batch was rejected (`permission-denied`) and replying was blocked — always reproducible when a regular user replied to a top-level comment written by an admin. Restored `isReplyCountUpdate()` and OR'd it back into `allow update`

## [0.21.0] - 2026-08-06

### Breaking
- **Removed the category concept** — the old category id is now the `boardId`
  - `memiBoards/{boardId}/posts/{postId}` (+ body/comments/likes)
  - `memiBoards/{boardId}/settings/config` (board settings/meta)
  - `memiBoardUsers/{uid}` (roles, top-level — outside boards)
- Removed the `boardId` config key → the active board is a composable/component argument
- Changed signatures such as `useMemiBoardPosts(boardId)`, `useMemiBoardPostList(boardId)`, `useMemiBoardLikes(boardId, postId)`
- `boardId` prop is required on `MemiBoardList` / `Detail` / `Editor`

### Added
- `BoardModel` type (`BoardCategory` is a deprecated alias)

## [0.20.0] - 2026-08-06

### Breaking
- Changed Firestore/Storage paths to a multi-board tree (no migration — assumes existing data is deleted)
  - `memiBoards/{boardId}/posts/{postId}` (+ `body/main`, `comments`, `likes`)
  - `memiBoards/{boardId}/settings/config` (+ `categories`) — formerly `boardSettings`
  - `memiBoards/{boardId}/users/{uid}` — formerly `{prefix}Users`
  - Storage: `memiBoards/{boardId}/posts/{postId}/…`
- Removed the `collectionPrefix` config key → `boardsCollection` (default `memiBoards`) + **`boardId`** (default `default`)
- Overhauled all paths in `docs/firestore.rules.example` · `storage.rules.example`
- Composite index collection group: `posts` (dropped the prefixed collection IDs such as the old `boardPosts`)

### Added
- `src/utils/boardPaths.ts` — path helpers + `useBoardPathConfig()`
- runtime export: path helpers (`boardPostsCol`, `boardSettingsDoc`, …)

## [0.19.3] - 2026-08-06

### Added
- Category `listView: 'image'` — Instagram-style writing (no title input, **image + text required**, slug = document ID)
- Image boards: **multi-image gallery** (drop, paste, add; up to 20 images; first = cover)
- **Drag to reorder** the gallery (no file re-upload/copy)
- No photo or YouTube embedding in the TipTap body (photos go in the gallery only)
- `hasBodyImage` / `titleFromBody` — whether there is an image; auto-generates the title from the first 40 characters of the body

### Changed
- Image boards: hide the Editor title and file attachments; on save, `title` = start of the plain-text body

## [0.19.2] - 2026-08-06

### Fixed
- Blocked writing/editing posts whose body has **only images and no text** (with a guidance message)
- `hasBodyText` / `plainTextFromHtml` — a body with only images, iframes or YouTube is treated as empty

## [0.19.1] - 2026-08-06

### Changed
- Share OG image: uses the Storage **thumbnail** (`images/thumbnails/*`, about 400px) instead of the original body image
- `toBoardOgImageUrl` — Firebase download URL → public `?alt=media` thumbnail URL

## [0.19.0] - 2026-08-06

### Added
- Board SEO without a host app API — `useMemiBoardPostSeo` / `useMemiBoardListSeo`
- Direct Firestore lookups `fetchPublicPostForSeo` / `fetchPublicListForSeo` (`listed` only)
- `memiBoard.seo` config: `siteName`, `siteUrl`, `defaultOgImage`, `basePath`
- OG helpers: title, description, absolute URL (`previewImage` → og:image)

### Notes
- The host app only needs SSR on for public board routes + `seo.siteUrl`/`siteName` set (no custom `/api/board/**` needed)
- The SEO composables are compiled from source by the host app's Nuxt (`#imports`) — no double Nuxt loading even with monorepo `link:`

## [0.18.0] - 2026-08-06

### Added
- Category visibility `visibility: public | hidden` (diaries, private boards)
- Copied the post `listed` field — when hidden, list queries and rules block regular viewing
- Show/hide in the settings UI, `publicCategories` / `isCategoryHidden` helpers
- `getPostBySlug` returns distinct `ok | not-found | permission-denied | error` results

### Security
- Reading hidden posts: only the author, admins, and staff with write permission on that category (no viewing by all staff)

## [0.17.0] - 2026-08-06

### Added
- Post view count (`viewCount`) — +1 on entering the detail without sign-in, once per session (`useMemiBoardViews`)
- View count shown in lists (default, compact, video) and detail; the comment count is unified as a pill next to the title in all list views
- `docs/firestore.rules.example` allows anonymous `viewCount` +1

## [0.16.0] - 2026-08-06

### Added
- Compact (`dense`) list view — single-line rows without card gaps (likes, category, title, image icon, comment count, author, time)
- YouTube cover first in video lists (`videoListCoverUrl`) — if there is a `videoUrl`, its thumbnail is used before body/attachment images

### Changed
- Image list view — the whole card is the image, with a title overlay at the top left and likes at the top right
- `:delay-duration="0"` on all `UTooltip`s — shown immediately on hover

## [0.15.0] - 2026-08-06

### Added
- Category description field (`BoardCategory.description`) — entered and saved in the settings screen, `categoryDescription()` helper
- If there is a description, it is shown as a hover tooltip on the list header title (takes no space, same pattern as the time field)
- `docs/firestore.rules.example` allows the category `description` key

### Changed
- `ListDefault` card — thumbnail flush to the card's left, top and bottom (stretched to row height), title and summary up to 2 lines with overflow prevented, adjusted horizontal text padding
- Strengthened the watch in `CategorySettings` so the draft isn't cleared by a snapshot right after saving

## [0.14.1] - 2026-08-06

### Changed
- Reworked the `ListDefault` (default list view) card layout — square thumbnail on the left (icon placeholder if no image), author, time, likes and comment count stacked vertically on the right, reduced card inner padding
- `List` passes `show-category` to the child list views so the category badge is hidden in lists already filtered to a specific category (removing the same badge repeated on every post inside a category page)

## [0.14.0] - 2026-08-06

### Added
- Changed the write permission, comment permission and list view choices in `Settings`/`CategorySettings` from `USelect` to card-style options (`OptionCards`) — the 3 options can be compared and chosen on one screen, with the label fixed above the field
- Added `title`/`settingsTo`/`canManageSettings`/`writeTo`/`canWrite` props so `List` draws the header above the list itself (title, "Board settings" and "New post" buttons) — the host app only passes links and permission values and doesn't need to assemble the button layout
- Added default/image/video view switch icon buttons (`ListViewSwitch`) to `List` — the category's `listView` setting is only the default on first entry, and the view can be switched on screen immediately (it reverts to the setting on refresh)

## [0.13.3] - 2026-08-06

### Fixed
- The responsive YouTube `iframe` style in `Detail`/`Editor` actually applied only to the `youtube.com` domain and not to `youtube-nocookie.com`/`youtu.be` — Vue `:deep()` can't take multiple comma-separated selectors at once, so only the first selector was effective. Fixed by wrapping each selector in its own `:deep()`

## [0.13.2] - 2026-08-06

### Fixed
- YouTube embeds inserted in the write screen (`Editor`) overflowed on mobile at a fixed 640px width — applied the responsive `iframe` style (`board-content` class + `width:100%; aspect-ratio:16/9`), previously only in the detail screen (`Detail`), to `Editor` as well

## [0.13.1] - 2026-08-06

### Fixed
- `useMemiBoardUsers()` subscribed to the entire `boardUsers` collection without a filter as soon as it was called, so when a non-admin user or one whose role was still being checked opened `Users`/`Settings`/`CategorySettings`, the screen crashed with `permission-denied` (reproduced and confirmed in local testing). Added an `enabled` option so the query starts only when the user actually has permission to view — all three components now pass their own `canManage`/`canManageStaff` value

## [0.13.0] - 2026-08-06

### Added
- Per-category "allowed staff" (`BoardCategory.allowedStaffUids`) — when `writeRole`/`commentWriteRole` is 'staff' and the list is set, only staff in that uid list can post/comment in that category (if empty, all staff are allowed as before). Meant for having different sub-operators per board (e.g. A has staff1·staff2, B has staff2·staff3). Added a staff multi-select UI to `Settings`/`CategorySettings` (staff list loaded with `useMemiBoardUsers`)
- Added `isAllowedStaffForCategory` to `docs/firestore.rules.example` — checked together in the 'staff' branch of `canWriteCategory`/`canWriteComment` (admins always pass)

### Fixed
- Split the category document `update` rule into admin/staff so staff can't widen their own `allowedStaffUids` (their own access scope) — staff can't actually change this field's value (it passes only if unchanged). `Settings`/`CategorySettings` also hide this field from staff entirely unless the `canManageStaff` prop is set (defaults to whether the user is a board-role admin)

## [0.12.0] - 2026-08-06

### Added
- Per-category comment permission (`BoardCategory.commentWriteRole`) — sets the minimum role for writing comments and replies using the same levels as the write permission (`writeRole`) (user/staff/admin). Added a "Comment permission" field to `Settings`/`CategorySettings`, and `canWriteComment`/`canCommentOnPost` rules to `docs/firestore.rules.example` (validated by looking up the category of the comment's parent post)
- `CommentForm` now takes a `category` prop and shows a guidance message instead of the form on the client too when the user lacks permission for the category (actual server-side enforcement is done by the rules; the UI is a convenience) — also updated `Detail`/`CommentList`/`CommentThread` to pass `category`

## [0.11.1] - 2026-08-05

### Changed
- Changed how the post list (`List`) loads — the latest `pageSize` (default 10) posts are subscribed in real time with `onSnapshot` so like and comment counts update immediately while visible, and older posts are loaded with one-time queries only when "Load more" is clicked
- Added the same `IntersectionObserver` auto-loading as `CommentList` to "Load more", loading only when the trigger stays visible for 500ms after appearing, to prevent repeated requests while scrolling
- Changed the post detail (`Detail`) to a real-time subscription with VueFire `useDocument` instead of a one-time query (`useMemiBoardPost`) — like and comment counts show on screen immediately without separate local updates

## [0.11.0] - 2026-08-05

### Added
- Post like button (`LikeButton`, `useMemiBoardLikes`) — the `likes/{uid}` subcollection guarantees one like per person, and toggling in a transaction keeps the counter consistent with the actual document count even with large numbers (1000+) of likes
- `PostModel.likeCount` field, like count badge shown in the post list (`ListDefault`)

### Compatibility
- Added `isLikeCountUpdate()` and `memiBoardPosts/{postId}/likes/{uid}` rules to `docs/firestore.rules.example` — they must also be merged into the `firestore.rules` the installing project actually deploys for likes to work

## [0.10.1] - 2026-08-05

### Added
- Post list, detail and comment timestamps are shown as Day.js Korean relative times and updated every minute
- Added an optional `updatedAt` field to the comment model for a future edit feature; it is initialized when new comments and replies are created
- Common `formatTimestampDetails` runtime utility that shows the created and updated times separately when they differ

### Changed
- Unified the post list, detail and comment time tooltips to the same default Nuxt UI tooltip presentation
- When the created and updated times are the same, or existing data has no updated time, only one full date/time is shown

### Fixed
- Multi-line time tooltips overflowed past the border beyond Nuxt UI's default fixed height

## [0.10.0] - 2026-08-05

### Added
- The package root `memi-board` is provided as the Nuxt module entry point, with the runtime API split into `memi-board/runtime`
- Generates a Nuxt plugin that automatically wires the `memiBoard` options in `nuxt.config.ts` into the runtime config
- The module automatically applies the needed Day.js optimization and Vue/Firebase/TipTap dependency deduplication settings
- Tech stack cards and a version history tab in the `powered by memi` info panel at the bottom of the board
- `pnpm release` command that builds, type-checks, checks the package and publishes with a single OTP

### Changed
- Simplified installation and configuration of the board to one place in `nuxt.config.ts`, without a separate `configureMemiBoard` plugin
- Unified post list navigation on NuxtLink so it behaves the same in SSR and CSR
- Made the core TipTap packages internal dependencies so installing projects don't have to install matching versions themselves
- Fully overhauled the README and Firebase setup docs for Nuxt 4 installation, admin initialization and the local link development flow

### Fixed
- Navigation to the detail page could hang due to duplicate Day.js instances in the installing project

### Compatibility
- The existing `memi-board/nuxt` module path is kept as a compatibility alias

## [0.9.1] - 2026-08-04

### Fixed
- In npm-installed environments, `MemiBoardUsers` referenced a relative-path composable not included in the package, failing the host app build

## [0.9.0] - 2026-08-04

### Added
- Comment reply threads: shows the target user, up to 2 levels of indentation, auto-expanded
- After cursor pagination of comments and replies ends, the latest 1 item is subscribed in real time
- A real "load more comments" button that triggers automatically when it enters the viewport, with loading skeletons

### Changed
- Regular comments are loaded 10 at a time and replies 5 at a time, in chronological order
- Live data is accumulated only after all existing pages are read, so it doesn't get out of order with page data
- Split the comment and reply forms, items and thread components into maintainable units

### Fixed
- The latest-1 real-time result replaced existing comments
- Only the browser that wrote a reply was reset to the first page
- Chronological order of live replies and load-more replies, and an unnecessary load-more button being shown

## [0.8.0] - 2026-08-04

### Added
- Hybrid list combining a real-time subscription to the 5 latest comments with cursor queries for 5 older comments at a time
- Day.js Korean relative times and full date/time tooltips
- Individual comment and loading skeleton components

### Changed
- Moved the comment form below the chronological list
- Placed load-older-comments and 5 skeletons at the top of the list
- Improved the rules example so regular users' comment batches can update only the parent post's `commentCount` by ±1

### Fixed
- Regular users' comment create/delete batches were rejected by post update permissions

## [0.7.0] - 2026-08-04

### Added
- Per-category minimum write role: user and above, staff and above, admins only
- Explicit SSR key for VueFire category queries

### Fixed
- Hydration warning in board settings caused by differing loading states on server and client
- Non-portable type inference warning when generating the Nuxt module declarations

## [0.6.0] - 2026-08-04

### Added
- `MemiBoardUsers` admin user list and role change UI
- `useMemiBoardUsers()` real-time user subscription and role change API
- Permission descriptions per `admin`, `staff` and `user` role

### Changed
- Extended the permission model so `staff` can manage all posts, comments and related Storage files
- Syncs email and profile photo metadata to the boardUsers document on sign-in
- Restricted reading the user list to admins or the user's own document

## [0.5.0] - 2026-08-04

### Added
- Dedicated default, image and video list view components with automatic switching based on category settings
- Official TipTap YouTube extension: toolbar input, automatic embedding on URL paste, responsive read view
- Previous / list / next navigation at the bottom of the detail
- Summary, cover image and video URL metadata for the post list
- Per-panel save, delete and reorder in category settings, plus a shortcut to that board

### Changed
- The Firestore auto ID is used as the permanent internal ID for posts and Storage, and public URLs are looked up by `category + slug`
- Categories are stored as individual documents at `{prefix}Settings/config/categories/{categoryId}` and sorted in real time by `order`
- The detail body is shown in Nuxt UI Editor read-only mode so paragraph spacing and formatting match the write screen
- Cleaned up the fixed category write/edit UI and the layout of the author and management buttons in the detail
- Removed automatic creation of default categories and the frontend fallback

### Fixed
- Images and attachments of new posts were permanently left in the `new-{timestamp}` temporary folder
- Internal document and Storage identifiers could change when the title was edited

## [0.4.15] - 2026-08-03

### Fixed
- In npm-installed environments, `MemiBoardSettings` referenced an unpublished relative-path module, failing the host app build

## [0.4.14] - 2026-08-03

### Added
- `MemiBoardSettings` admin settings component: category expansion panels by ID, managing labels, order and deletion
- Per-category `listView`: `default` (default), `image` (image), `video` (video)
- `useMemiBoardSettings().saveCategories()` bulk save API

## [0.4.13] - 2026-08-03

### Fixed
- `deletePost`: besides comments, the body and the `posts/{id}` Storage folder, also deletes attachment paths and body image URLs (including the temporary `new-*` namespace)

## [0.4.12] - 2026-08-03

### Changed
- **Slimmed the editor down around Nuxt UI / shineb** (maintainability)
  - `UEditor` + `UEditorToolbar` + `UEditorDragHandle`, `content-type="html"`
  - Images: official `handlers.image` + app-level paste/drop (no TipTap Extension)
  - Detail: keeps static HTML rendering (no read-only UEditor)
  - Removed the textarea fallback / PluginKey Extension

## [0.4.11] - 2026-08-03

### Added
- Editor image upload (same model as shineb)
  - Original + 400px JPEG thumbnail → Storage `{prefix}/posts/{id}/images/` · `.../thumbnails/`
  - Toolbar image button · paste · drag and drop
  - `uploadEditorImage` / `deleteEditorImage` / `extractEditorImageUrls`
  - Orphan files removed from the body are to be cleaned up by a host app scheduler
- storage.rules example: `images/{allPaths=**}` (5MB, image/*)

## [0.4.10] - 2026-08-03

### Changed
- Post body: `UTextarea` → **Nuxt UI `UEditor`** (TipTap, markdown)
  - Toolbar and drag handle (shineb `PostEditor` pattern)
  - Detail view: renders markdown with a read-only `UEditor`
  - Existing plain-text posts are also displayed compatibly as markdown

## [0.4.9] - 2026-08-03

### Changed
- Moderation block messages show **what the problem is**
  - Local banned words: points out the matched expression (e.g. expressions like 「시발」 are…)
  - AI: user-facing text based on reason/category + a warning n/3 suffix

## [0.4.8] - 2026-08-03

### Added
- Cumulative limit on content moderation blocks: `{prefix}Users.moderationBlockCount` / `moderationBlockAt`
  - +1 on local or AI `flagged` (API errors excluded)
  - 3 or more by default → posting and commenting restricted for about 24 hours (lazy decrement after 24h, same model as the store contentWarning)
  - `moderation.blockBanThreshold` / `blockBanDecayMs` (0 turns it off)
- Rules example: warning fields allow only +1; decreasing/resetting is admin-only

## [0.4.7] - 2026-08-03

### Changed
- Fully cleaned up the README — reuse checklist for other Nuxt host apps, removed the incorrect `import { MemiBoardEditor }`, List/Editor props, moderation options and model, actual App Check procedure
- Included `docs/` in the npm package (rules examples, firebase-setup)
- firebase-setup: expanded the AI model, App Check and category index sections

## [0.4.6] - 2026-08-03

### Removed
- Per-step moderation console spam (`[memi-board:moderation] start/local-pass/ai-raw`, etc.)
- The **moderation debug** line in the editor screen (via/flagged summary)

### Changed
- Only a single `console.warn` line on AI failure; user messages avoid technical terms

## [0.4.5] - 2026-08-03

### Changed
- Default AI moderation model: `gemini-2.5-flash` → `gemini-3.5-flash-lite` (2.5 Flash is not available for new projects)
- `moderation.useLimitedUseAppCheckTokens` — App Check limited-use tokens on/off (default true)

### Fixed
- Expanded the local banned word list (`시이발`, etc.)

## [0.4.4] - 2026-08-03

### Added
- Moderation debugging: `via` (local/ai/ai-error-allow, etc.), per-step console `[memi-board:moderation]` logs, moderation result summary in the editor screen

### Fixed
- Confirm before deleting a comment
- AI Logic moderation also when adding a category

## [0.4.3] - 2026-08-03

### Added
- `getPosts({ category })` — list query filtered by category
- `MemiBoardList`: `category`, `postLinkBase`, `getPostLink(post)` (the host app freely builds routes such as `/board/:cat/:id`)
- `MemiBoardEditor` `fixedCategory` — when the category is fixed by path, hides the selection UI and saves with that value

### Deprecated
- `linkBase` on `MemiBoardList` — use `getPostLink` / `postLinkBase` instead

## [0.4.2] - 2026-08-03


### Added
- **Category management (`boardSettings` / `{prefix}Settings/config`)**: `useMemiBoardSettings().addCategory()` · `ensureSettings()` — signed-in users can add options
- Post write/edit editor: categories can only be chosen from the settings document list, with an **Add category** UI (arbitrary values not in the list can't be saved)

### Changed
- Settings document seeding: default categories are created not only by admins but also when signed-in users visit/add
- `docs/firestore.rules.example` — relaxed boardSettings writes to signed-in users + restricted to the categories field

## [0.4.1] - 2026-08-03


### Fixed
- **Loading a post for editing**: changed the `postId` prop from being read only once in `onMounted` to `watch(..., { immediate: true })`, fixing cases where the post wasn't loaded due to route/prop timing
- **Edit save error message**: `permission-denied` is explained in Korean
- **updatePost**: `merge: true` on the body `setDoc`, and cleans up with `deleteField()` when no category is selected

## [0.4.0] - 2026-08-03

### Changed (Breaking)

- **Redesigned how the UI is delivered**: dropped prebundling the Vue SFCs into a single file with Vite. The prebundled `resolveComponent('UButton')` didn't work with Nuxt UI auto-imports, causing a blank screen in the host app
- **Added a thin Nuxt module** (`memi-board/nuxt`): `addComponentsDir` puts only the source SFCs into the host app pipeline → the host app compiles them, so `<UButton>` and other auto-imports work. **Does not touch vuefire / routes / middleware / Firebase config**
- The main entry (`memi-board`) is **core only** (configure / composables / types). Removed the component named exports — use Nuxt module auto-imports (`MemiBoardList`, etc.)
- Runtime configuration still uses only `configureMemiBoard()` in a host app plugin, as before (not absorbed into module options)
- Tailwind `@source` target: `node_modules/memi-board/dist/runtime/components`

### Migration

```ts
// nuxt.config.ts
modules: ['@nuxt/ui', 'nuxt-vuefire', 'memi-board/nuxt']
// No U* global hooks / transpile hacks needed
```

```css
@source "../../../node_modules/memi-board/dist/runtime/components";
```

```vue
<script setup>
// Components are auto-imported by the module — don't import them from 'memi-board'
import { useMemiBoardAuth } from 'memi-board'
</script>
<template>
  <MemiBoardList link-base="/board" />
</template>
```

## [0.3.1] - 2026-08-03

Findings from merging after history diverged from a commit (`abd8ef0`) made independently in another session toward the same goal (removing the Nuxt module). Comparing the two implementations found and fixed 2 real bugs, and adopted a few better design choices.

### Fixed

- **`permission-denied` on comments written by others when deleting a post**: the comment delete rule allowed only the comment author and admins, but `deletePost()` has the post author delete other users' comments too — added an `isOwner(parent post)` condition to `docs/firestore.rules.example` so the post author can delete them
- **Deleting posts with more than 500 comments failed**: Firestore write batches are limited to 500 operations, but `deletePost()` put all comments in one batch — now commits in chunks of 450
- **permission-denied caused by post deletion order**: the body (`body`) and attachment Storage rules look up ownership on the parent post document, but `deletePost()` deleted the parent document concurrently (in parallel) with the rest, so the lookup could fail depending on order — fixed the order to body → Storage → parent document
- Tailwind v4 doesn't scan `node_modules` by default, so memi-board components' utility classes could be entirely missing from the host app CSS — added `@source` setup guidance to the README, also reflected in the playground/README examples

### Changed

- Changed internal links in `List.vue` from `resolveComponent('NuxtLink')` (Nuxt-only) to `vue-router`'s `RouterLink` — removing one more layer of Nuxt dependency
- Removed `nuxt`/`nuxt-vuefire` from `peerDependencies` (never imported directly in code, so unnecessary) and added `vue-router` (now actually needed by the direct RouterLink import). Also added `vue-router` to the external list in `vite.config.ts` — omitting it bundles vue-router in, creating a different router instance from the host app's, the same class of bug as with vuefire/firebase
- Replaced `tsconfig.json`, which extended the playground's Nuxt-generated tsconfig, with a standalone config covering only `src/` — `pnpm typecheck` now actually checks the library source (previously only the playground app code was being checked)
- Added `sideEffects: false` and `keywords` to `package.json`

## [0.3.0] - 2026-07-31

### Changed (Breaking)

- **Removed the entire Nuxt module structure and switched to a pure Vue 3 component/composable package**. Deleted `src/module.ts` (`defineNuxtModule`), `installModule('nuxt-vuefire', ...)`, the custom `memiBoard` key in `nuxt.config`, automatic route registration via `pages: true`, and the `memi-board-auth` route middleware
- Goal: when reusing the board across multiple projects on the same platform (Nuxt+Firebase), eliminate the chance of the host app's existing nuxt-vuefire config and memi-board's config conflicting at different points (module installation vs nuxt.config key) — Firebase/nuxt-vuefire config now always lives only in the host project
- Configuration change: instead of `memiBoard: {...}` in `nuxt.config.ts`, the host app calls `configureMemiBoard({ collectionPrefix, auth, moderation })` once at app boot from a Nuxt plugin it writes itself
- Routing change: removed automatic page registration (`pages: true`) — only the approach where the host app places components in its own `pages/` remains (already supported before). The host app also writes the write/edit route guards itself (the README includes an example middleware using `vuefire`'s `getCurrentUser()`)
- Replaced the build tool: `@nuxt/module-builder` (`nuxt-module-build`) → plain Vite library build (`@vitejs/plugin-vue` + `vite-plugin-dts`). `dist/module.mjs` → `dist/index.js`
- Flattened the `src/runtime/*` directory structure to `src/*` (removed the `runtime/` prefix, a Nuxt module convention)
- Switched all components/composables to explicit `import`s so they don't depend on Nuxt auto-imports (`useRuntimeConfig`, `ref`/`computed`/`watch`, `useFirestore`, etc.) — the library can now be built with plain Vite and is guaranteed to behave the same under any Nuxt project configuration

## [0.2.4] - 2026-07-31

### Fixed

- Moved `firebase`/`vuefire`/`nuxt-vuefire` from `dependencies` to `peerDependencies` — when memi-board bundled these packages itself, module instances separate from the versions installed by the host project were created, and the problem of `useCurrentUser()` always returning `undefined` or the error `useCurrentUser() called before the VueFireAuth module was added` was actually reproduced (because vuefire's auth state is managed in a per-module-instance WeakMap). Added a troubleshooting section to the installation guide and README

## [0.2.3] - 2026-07-31

### Changed

- Reviewed the fresh installation scenario from scratch and filled 6 gaps in the README's installation guide: preparing the Firebase CLI/`.firebaserc`/`firebase.json`, enabling Firestore/Storage/Auth in a new project, where to find the `firebaseConfig` values, AI Logic possibly requiring the Blaze plan, App Check not being enforced just by turning on the option (Enforce must be turned on separately in the console), and Node/Nuxt version requirements
- To keep the README concise, the detailed explanations above (Firebase console click paths, Apple sign-in setup steps, etc.) were split into a new document [`docs/firebase-setup.md`](docs/firebase-setup.md), leaving only a short summary + link in the README

## [0.2.2] - 2026-07-31

### Added

- Post categories — a category list in the `{prefix}Settings/config` document, selected and shown in write/list/detail (`useMemiBoardSettings`, `BoardCategory`/`BoardSettingsModel` types, `PostModel.category`)
- Without a settings document, it keeps working with built-in default categories (Free/Notice/Question) until an admin (`role: 'admin'`) first enters the board, at which point the document is created automatically with those defaults — regular users never write this document
- Added `{prefix}Settings` rules to `docs/firestore.rules.example` (public read, admin-only write)

## [0.2.1] - 2026-07-31

### Fixed

- If the host project already used `nuxt-vuefire` (e.g. apps with their own Admin SDK server features), the module called `installModule('nuxt-vuefire', ...)` again and setup() ran twice — `nuxt-vuefire` has no duplicate-install guard, so plugins and server routes (`/api/__session`, etc.) could be registered twice. Now checks with `hasNuxtModule()` whether it's already registered and reuses it if so; otherwise installs as before

### Changed

- Added a "Adding to a project that already uses nuxt-vuefire" section to the README — states that the host app config needs `auth.enabled: true`
- Made it clear in the README that Security Rules must be **deployed** — the mistake of only merging the example rules into the project files without running `firebase deploy --only firestore:rules,storage`, resulting in `permission-denied` when posting, was actually reproduced, so a warning was added at the top of the installation section along with the explicit deploy command

## [0.2.0] - 2026-07-31

### Added

- Nuxt module scaffolding: `src/module.ts` + `src/runtime/` structure based on `@nuxt/module-builder`, with a separate `playground/` development app
- `defineNuxtModule` options schema (`MemiBoardModuleOptions`): `firebaseConfig`, `appCheck`, `collectionPrefix`, `auth`, `moderation`, `pages`, `emulators`
- Firebase Auth/Firestore/Storage integration by calling `installModule('nuxt-vuefire', ...)` in `setup()` (no Admin SDK, client-only)
- Post CRUD — `useMemiBoardPosts`
  - Separate `{prefix}Posts/{slug}` (meta) + `{prefix}Posts/{slug}/body/main` (body) documents
  - `slugify()`-based document IDs, with `-2`, `-3`… suffixes on collision
  - List cursor pagination (`getPosts`), cascade deletion (batch-delete the comments subcollection → delete meta/body → recursively delete the Storage folder)
- Attachments — `useMemiBoardStorage`, `MemiBoardAttachments`
  - `uploadBytesResumable`-based upload/progress, inline image previews, download links for non-images
- Comments — `useMemiBoardComments`, `MemiBoardCommentList`, `MemiBoardCommentForm`
  - `{prefix}Posts/{slug}/comments/{commentId}` subcollection, reflected in real time with `vuefire`'s `useCollection`
  - The parent post's `commentCount` is incremented/decremented in the same `writeBatch` on comment create/delete
- Auth/permissions — `useMemiBoardAuth`, `MemiBoardSignIn`
  - Google / email-password sign-in
  - Roles (`user`/`admin`) based on the `{prefix}Users/{uid}.role` document, auto-created with `role: 'user'` on first sign-in; the module never promotes to `admin`
  - `canEdit`/`canDelete`/`canDeleteComment` — allowed only for the author or admin
- AI moderation — `useMemiBoardModeration`
  - First-pass filter with a local profanity blocklist (built-in + extendable via `moderation.localBlocklist`)
  - Second-pass moderation with structured JSON responses (`flagged`/`category`/`reason`) from Firebase AI Logic (`firebase/ai`, Gemini)
  - `moderation.onError` (`'allow' | 'block'`) chooses the policy when the moderation API fails, default `'allow'`
  - Blocking check before submitting both posts and comments (blocked before any Firestore/Storage writes)
- `pages: true` option — automatically registers `/board`, `/board/new`, `/board/:id`, `/board/:id/edit` with `extendPages`, applying the `memi-board-auth` middleware to the write/edit routes
- Security Rules examples — `docs/firestore.rules.example`, `docs/storage.rules.example`
- Firebase Local Emulator Suite integration — `emulators: true` option, `firebase.json`
- Version history — `MemiBoardVersionHistory` component (`src/runtime/data/versionHistory.ts` is the single source), automatically registered at `${base}/version-history` when `pages: true`. So that non-developers on sites with the board installed can view it directly without markdown

### Fixed

- Computing `base` by string slicing broke for paths containing Korean slugs in `pages: true` routes → replaced with the module directly injecting `route.meta.memiBoardBase` into each page
- In `MemiBoardList`, specifying a dynamic component by string like `<component :is="'NuxtLink'">` didn't resolve Nuxt's compile-time auto-imported component, so no actual link was rendered → `NuxtLink` is imported directly from `#components` and passed as a component reference
- `vuefire` existed only as a transitive dependency of `nuxt-vuefire`, breaking type checking when importing it directly in `src/runtime/*` → added `vuefire` as a direct dependency

## [0.1.0] - 2026-07-27

- Initial project creation with `nuxi init` (default Nuxt 4 starter, no board features)
