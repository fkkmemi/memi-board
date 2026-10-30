# memi-board

An npm package that adds a board to Nuxt 4 + Nuxt UI + Firebase projects.

- Post CRUD · comments · Storage attachments · categories · view counts
- Author/admin permissions (Firestore Rules)
- Local profanity filter + Firebase AI Logic (Gemini) moderation (optional)
- **Share previews (OG)** — list and detail meta without a host SEO API (`useMemiBoard*Seo`)

**No server or Firebase Admin required** (permissions live in Rules, moderation runs in the browser — it can be bypassed; see the limitations below).  
Only the public list and post detail pages need SSR to fill OG tags; writing and settings pages can stay CSR.

Any host app on the same stack (Nuxt 4 · `@nuxt/ui` · `nuxt-vuefire` · Firebase) **can reuse it as is**. Each host can use its own Firebase project, and within one project board instances are separated by `boardId` — `memiBoardPosts`/`memiBoardComments`/`memiBoardLikes` are all top-level flat collections, and `boardId` is a field on each document (not a path segment).

## Guides

| Task | Guide |
|---|---|
| First install on another site | [Host integration guide](docs/host-integration.md) — minimal setup, routes, first board |
| Single language, or choosing multilingual UI and translation | [Internationalization and content translation](docs/internationalization.md) — per-mode setup and when translations are saved |
| Connecting Firebase and deploying rules and indexes | [Firebase setup](docs/firebase-setup.md) |
| Per-store/organization assigned permissions, migrating existing roles | [Roles and migration](docs/roles-migration.md) |
| Configuration, API, and troubleshooting details | This README's [host setup](#host-app-setup), [API](#provided-api), [troubleshooting](#troubleshooting) |

`i18n.enabled` and `translation.enabled` are supported in **0.47.0 and later**. Hosts that use these options should install or update with `pnpm add memi-board@^0.47.0`.

## Platform requirements

| Item | Requirement |
|------|------|
| Runtime | Nuxt **4+** |
| UI | `@nuxt/ui` **4+** (components assume auto-imports such as `UButton`) |
| Data | Firebase **Firestore + Auth + Storage** |
| Vue | `vue` 3.5+, `vuefire` 3.2+, `firebase` 12+ |
| Module | `nuxt-vuefire` (installed and configured by the host) |

**Intentionally out of scope:** Firebase initialization, registering routes/middleware, App Check initialization, server-side moderation.

## Structure

| Entry | Role |
|--------|------|
| `memi-board` | **Nuxt module** — configuration, SFC auto-import, peer dedupe |
| `memi-board/runtime` | composables, types, utilities (**no Vue component exports**) |

Most users only configure `memiBoard` in `nuxt.config.ts`. No separate Nuxt plugin is needed.

```
Host Nuxt app
├── nuxt-vuefire + firebaseConfig     ← auth · Firestore
├── (optional) App Check plugin       ← practically required with AI Logic Enforce
├── memi-board                        ← Nuxt module + runtime config
├── pages/board/*                     ← routes are owned by the host (+ one SEO line)
└── firestore.rules + storage.rules   ← merge the docs examples, then deploy
```

## Installation

**Prerequisites:** Node + pnpm, a Firebase project (Firestore · Storage · Auth). Starting from scratch → [docs/firebase-setup.md](docs/firebase-setup.md).

```bash
pnpm add memi-board @nuxt/ui nuxt-vuefire vuefire firebase
```

Install `vuefire` / `firebase` / `nuxt-vuefire` **directly in the host**. TipTap is managed by `@nuxt/ui` and `memi-board`, so the host does not need to install it or align its version. Dates are formatted with `Intl`, so `dayjs` is not needed.

---

## Host app setup

This covers only what the host does. **No host-specific SEO API or server routes are needed.**  
The package reads public posts (`listed === true`) from Firestore directly and fills OG tags with `useSeoMeta`.

### 1. `nuxt.config.ts` — modules + `memiBoard` + vuefire + routeRules

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: [
    '@nuxt/ui',
    'nuxt-vuefire',
    'memi-board',
  ],

  memiBoard: {
    // Single-language example. For multilingual services, see the internationalization guide below
    locale: 'ko',
    i18n: { enabled: false },
    // Firestore: memiBoardPosts / memiBoardComments / memiBoardLikes / memiBoardSettings / memiBoardUsers
    // (all flat collections — boardId is a field on each document. Pass it as the boardId argument when calling composables)
    auth: { providers: ['google', 'apple'] }, // + 'emailPassword'
    moderation: {
      enabled: true,
      model: 'gemini-3.5-flash-lite',
      onError: 'block', // 'allow' | 'block'
      moderateImages: false,
      useLimitedUseAppCheckTokens: false,
      // localBlocklist: ['banned-word'],
      // blockBanThreshold: 10,
      // blockBanDecayMs: 24 * 60 * 60 * 1000,
    },
    // Share previews (OG) — use the package composables, no host API
    seo: {
      enabled: true,
      siteName: 'My App',                           // og:site_name · title suffix
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL
        || 'https://example.com',                   // absolute URL origin (no trailing slash)
      defaultOgImage: '/images/og-default.jpg',     // when the post has no previewImage
      basePath: '/board',                           // canonical path prefix
    },
  },

  // (optional) host-wide siteUrl — SEO may fall back to it after memiBoard.seo.siteUrl
  runtimeConfig: {
    public: {
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'https://example.com',
    },
  },

  vuefire: {
    // Must match Console → Project settings → Your apps → web app SDK snippet
    // (if it is a web app with a different appId, App Check / AI Logic fails)
    config: {
      apiKey: '...',
      authDomain: '...',
      projectId: '...',
      storageBucket: '...',
      messagingSenderId: '...',
      appId: '...',
    },
    auth: { enabled: true },
  },

  routeRules: {
    // Public list and post detail: keep SSR (default) → link preview / OG crawlers read the HTML meta
    // Only writing and settings pages are CSR
    '/board/**/new': { ssr: false },
    '/board/**/**/edit': { ssr: false },
    '/board/version-history': { ssr: false },
    '/board-settings/**': { ssr: false },
    '/board-users': { ssr: false },
  },
})
```

The Nuxt module passes the `memiBoard` options to the runtime plugin automatically. **Do not create `app/plugins/memi-board.ts`.**

#### `memiBoard` options summary

| Key | Default | Description |
|----|------|------|
| `postsCollection` | `'memiBoardPosts'` | Posts collection name |
| `commentsCollection` | `'memiBoardComments'` | Comments collection name |
| `likesCollection` | `'memiBoardLikes'` | Likes collection name |
| `reportsCollection` | `'memiBoardReports'` | Reports collection name |
| `settingsCollection` | `'memiBoardSettings'` | Board settings collection name |
| `usersCollection` | `'memiBoardUsers'` | Role documents collection name |
| `auth.providers` | `['google','apple']` | Sign-in providers |
| `moderation.*` | (AI section below) | Local · Gemini moderation |
| `seo.enabled` | `true` | When `false`, the SEO composables are no-ops |
| `seo.siteName` | `'Board'` | OG site name · title suffix |
| `seo.siteUrl` | `''` | Absolute URL origin. If empty, falls back to `runtimeConfig.public.siteUrl` → request origin |
| `seo.defaultOgImage` | `''` | Used when there is no preview image (relative path or `https://…`) |
| `seo.basePath` | `'/board'` | canonical: `{base}`, `{base}/{category}`, `{base}/{category}/{slug}` |
| `i18n.enabled` | `true` | When `false`, fixes the UI to `locale` and disables language selection and content translation |
| `translation.enabled` | `true` | When `false`, keeps UI language switching but disables generating and showing content translations |
| `locale` | `'ko'` | With internationalization on, the fallback after the board and host languages. With it off, the fixed UI language |
| `roleLabels` | Default names per language | Per-service role display names. Does not change permissions or assignment scope |

#### routeRules principles

| Path | SSR | Reason |
|------|-----|------|
| `/board`, `/board/{category}`, `/board/{category}/{slug}` | **on** (default) | OG / link previews (e.g. KakaoTalk, Slack) |
| `/board/**/new`, `…/edit`, settings · user management | **off** | Sign-in and permission UI, no SEO needed |

> The older guide's all-CSR `/board/**: { ssr: false }` **leaves share previews empty.** Keep SSR on for public read paths.

### 2. One SEO line per page (auto-import)

The module auto-imports `useMemiBoardListSeo` / `useMemiBoardPostSeo`.  
**Do not create host `/server/api/board/**` SEO endpoints.**

```vue
<!-- app/pages/board/index.vue — full list -->
<script setup lang="ts">
await useMemiBoardListSeo({ path: '/board' })
// … MemiBoardList, etc.
</script>
```

```vue
<!-- app/pages/board/[category]/index.vue — category list -->
<script setup lang="ts">
const route = useRoute()
const categoryId = computed(() => String(route.params.category || ''))

await useMemiBoardListSeo({
  category: categoryId,
  path: computed(() => `/board/${encodeURIComponent(categoryId.value)}`),
})
</script>
```

```vue
<!-- app/pages/board/[category]/[id]/index.vue — post detail (the id slot = slug) -->
<script setup lang="ts">
const route = useRoute()
const categoryId = computed(() => String(route.params.category || ''))
const id = computed(() => String(route.params.id || ''))

const { post: postSeo } = await useMemiBoardPostSeo({
  category: categoryId,
  slug: id,
  path: computed(() =>
    `/board/${encodeURIComponent(categoryId.value)}/${encodeURIComponent(id.value)}`,
  ),
})
// postSeo: id · title · previewImage, etc. — filled immediately on the first SSR load.
// On client navigation it is not awaited so page transitions are not blocked, so it may be null at first.

const { resolvePostIdBySlug } = useMemiBoardPosts(categoryId)
const internalId = ref('')
watch([categoryId, id], async ([category, slug]) => {
  if (postSeo.value?.id && postSeo.value.category === category && postSeo.value.slug === slug) {
    internalId.value = postSeo.value.id
    return
  }
  if (import.meta.server) return
  // Look up the id only (MemiBoardDetail subscribes to the body). A just-written post resolves without a lookup.
  const result = await resolvePostIdBySlug(slug)
  internalId.value = result.status === 'ok' ? result.id : ''
}, { immediate: true })
</script>
```

> On detail and edit pages, resolve slug → id with `resolvePostIdBySlug` instead of `getPostBySlug` (which also reads the body). Opening the preview right after saving becomes faster by two Firestore round trips.

| composable | Target | OG summary |
|------------|------|---------|
| `useMemiBoardListSeo` | List | Category label · description, image from the latest public post |
| `useMemiBoardPostSeo` | Detail | Title · summary · author, **`previewImage` → og:image** |

- Only public (`listed`) posts are queried. **Hidden boards** leave the meta empty and behave closer to `noindex`.
- Post detail `og:type` = `article`, list = `website`.
- Local check:  
  `curl -sL 'http://localhost:3000/board/…' | grep og:title`  
  or the browser's **View Page Source** (`view-source:`). Looking only at DevTools Elements can be confused with the post-hydration DOM.
- Check link previews (e.g. KakaoTalk, Slack) with the **deployed URL** (localhost cannot be crawled).

### 3. Host setup checklist

- [ ] `@nuxt/ui`, `nuxt-vuefire`, `memi-board` in `modules`
- [ ] `memiBoard.auth` · `moderation` · **`seo`**
- [ ] `seo.siteUrl` / `seo.siteName` / `seo.defaultOgImage` / `seo.basePath`
- [ ] **SSR on** for public board paths, `ssr: false` only for writing and settings
- [ ] One `await useMemiBoard*Seo(…)` line on list and detail pages
- [ ] **No** host SEO API
- [ ] CSS `@source` (below)
- [ ] (optional) Read-post styling CSS (below)
- [ ] **Deploy** Rules and indexes
- [ ] Initial owner + first board

### 4. Tailwind `@source` (required)

So classes inside the package SFCs are not purged:

```css
/* app/assets/css/main.css */
@import "tailwindcss";
@import "@nuxt/ui";
@source "../../../node_modules/memi-board/dist/runtime/components";
```

### 5. Internationalization and content translation (optional)

The [internationalization and translation guide](docs/internationalization.md) covers copy-paste examples per mode, connecting the host language, when translations are saved, error handling, and the policy for keeping existing data.

| Goal | `memiBoard` config |
|---|---|
| Korean only | `locale: 'ko', i18n: { enabled: false }` |
| Multilingual UI only | `i18n: { enabled: true }, translation: { enabled: false }` |
| Multilingual UI and content | `i18n: { enabled: true }, translation: { enabled: true }` |

If omitted, both options are `true`; with `i18n.enabled: false`, content translation is also off. The UI is fixed to `locale` and content is shown in the original. Existing translation data is kept. Add `@nuxtjs/i18n` only when connecting the host's language switcher.

The board setting **Auto-translate posts on write** (`autoTranslatePosts`) is off by default. When on, the title, summary, and body of new posts are translated and saved together.

The translate button translates labels and descriptions as a temporary change; press **Save** to apply. The auto-translate toggle is off by default; when on, it translates **when settings are saved** and then saves. Retranslation is skipped when the text is unchanged and all translations exist. If internationalization or translation is turned off service-wide, auto-translation does not run either.

### 6. Read-post styling (optional)

Post links in the list and mini components carry the `.memi-board-post-link` class, and the title text uses `text-inherit` to follow the link color. The package does not force a color, so to dim visited posts, just add a `:visited` style to the host CSS.

```css
/* app/assets/css/main.css */
a.memi-board-post-link:visited {
  color: #737373;
}

.dark a.memi-board-post-link:visited {
  color: #a3a3a3;
}
```

**`:visited` only allows `color`, and browsers even ignore `var()` and alpha values there** (to prevent history sniffing). So Nuxt UI tokens (`var(--ui-text-muted)`) cannot be used directly; specify literal colors for light and dark separately (the values above are Tailwind `neutral-500`/`neutral-400`).

Because it is the browser's native `:visited`, no server or DB storage is needed. However, navigation only via SPA client routing (`NuxtLink`) may not be recorded by the browser as a "real visit", so it is not fully reliable — if you need accurate read tracking, implement a separate mechanism that stores visited post IDs.

### 7. Deploying Security Rules + indexes

1. Merge [docs/firestore.rules.example](docs/firestore.rules.example) → host `firestore.rules`  
   (`memiBoardPosts`/`memiBoardComments`/`memiBoardLikes`/`memiBoardReports`/`memiBoardSettings`/`memiBoardUsers` — all top-level flat collections)
2. Merge [docs/storage.rules.example](docs/storage.rules.example) → `storage.rules`
3. Check that the Storage `bucket` in `firebase.json` matches `vuefire.config.storageBucket`
   (`*.appspot.com` vs `*.firebasestorage.app` — see [firebase-setup.md](docs/firebase-setup.md))
4. Deploy the composite indexes needed for list and per-author queries (below)
5. Deploy:
   ```bash
   firebase deploy --only firestore:rules,storage,firestore:indexes
   ```
6. Grant Storage permission to read Firestore: approve the prompt to add the cross-service IAM role during deploy, and check that the Storage service account of the host Firebase project has `roles/firebaserules.firestoreServiceAgent`. See the [host setup procedure](docs/firebase-setup.md#firestore-read-access-for-storage-rules-required-host-app-setup). A successful CI deploy alone does not guarantee this permission.

Hosts updating to 0.45.1 should also check the [procedure for applying the new rules and migrating](docs/firebase-setup.md#0451-rule-changes-and-migrating-existing-hosts). Installing the package or pushing the site does not deploy Firebase rules.

**If Rules are only in the file and not deployed**, writing posts fails with `permission-denied` — the most common installation mistake.
**If Storage rules are deployed to a bucket other than the one the app uses**, body images fail with `storage/unauthorized`.

#### Composite indexes

Merge [docs/firestore.indexes.json.example](docs/firestore.indexes.json.example) into the host `firestore.indexes.json`. If you customized collection names (`memiBoard.postsCollection`, etc.), change the indexes' `collectionGroup` values to match.

> ⚠️ The npm package tarball also includes `docs/` (0.4.7+). For older versions, see `docs/` on GitHub.

### 8. Creating the initial admin and categories

Rules prevent regular users from making themselves admins. So the first time, follow these steps:

1. After creating the board pages below, sign in with Google or Apple.
2. In Firebase Console → Firestore, find the `memiBoardUsers/{uid}` document.
3. Change that document's `role` to the string `owner`.
   - You can also find the UID in Firebase Console → Authentication → Users.
4. Create the first category at `/board-settings`. Posts cannot be written without a category.
5. After that, change roles in `MemiBoardUsers` at `/board-users`.

> Only a trusted project operator should assign the initial admin, and only in Firebase Console. Do not put admin UIDs or bypass rules in client code.

## Usage

Routing and middleware are **owned by the host**. Components are auto-imported by the module (`MemiBoardList`, etc.).  
`import { MemiBoardEditor } from 'memi-board/runtime'` **does not work**. Components are auto-imported by the module; only composables and types can be imported explicitly from `memi-board/runtime`.

Complete per-route examples are in the [host integration guide](docs/host-integration.md#7-list-new-post-and-detail-pages). Pass `boardId` to the list, editor, and detail.

```vue
<!-- free board list: create "free" in the board settings first -->
<template>
  <MemiBoardList
    board-id="free"
    :get-post-link="post => `/board/free/${encodeURIComponent(post.slug)}`"
  />
</template>
```

```vue
<!-- New post: saved emits the new post's slug -->
<template>
  <MemiBoardEditor
    board-id="free"
    @saved="slug => navigateTo(`/board/free/${encodeURIComponent(slug)}`)"
  />
</template>
```

For the detail page, use `<MemiBoardDetail :board-id="boardId" :post-id="postId" />`. Convert the URL slug to the Firestore document ID with `resolvePostIdBySlug()`. When editing an existing post, the `saved` event emits the document ID, so keep the slug of the current detail URL. Follow the installation guide for the full wiring order, including SEO for public pages and guards for sign-in and admin pages.

### Admin pages

Global settings and user management use the `owner` or `admin` role. In a default install, do not pass `authorized`. Only the owner can assign the admin role, and changing the owner itself is done from a trusted server or the console. For per-board settings by an assigned manager, use `MemiBoardCategorySettings` and `canConfigureBoard(boardId)`.

```vue
<!-- app/pages/board-settings.vue -->
<template>
  <MemiBoardSettings />
</template>
```

The global board settings show an admin-only (`owner`/`admin`) **orphaned file and document cleanup**. Pressing **Find orphaned items** reads all posts, comments, likes, and Storage, and lists comments and files whose parent post is missing, images of deleted comments, and likes whose target post or comment is missing. After reviewing the path, type, and file size, you can delete items individually or select all. Files updated within the last 24 hours and files referenced by existing bodies, translations, attachments, or comments are preserved. Report records and `body` subdocuments without a post are not cleaned up by this feature.

To use it, apply the admin read and delete permissions from the [Firestore rules example](docs/firestore.rules.example) and the [Storage rules example](docs/storage.rules.example) to the host project. If you use custom collections, update the rule paths as well. The scan reads all data including bodies, so it incurs read costs and time depending on data size. Deletion targets are pinned to an internal snapshot, and deletion stops if the account, settings, or file generation changes after the scan. Items are re-fetched from the server right before deletion, and documents check for the parent's existence in a transaction. File deletion and Firestore writes are not atomic, so run it when board usage is low. Failed items stay in the list and can be retried.

```vue
<!-- app/pages/board-users.vue -->
<template>
  <MemiBoardUsers />
</template>
```

Use `authorized` only when integrating the host's own site-admin system. This prop only allows the UI to be shown and does not bypass Firestore Rules. Even then, you must register those users as board admin/owner or change the host Rules to match the same admin system. Adding host route guards is recommended so admin URLs are not exposed to regular users.

### Provided API

**Components (auto-import):**  
`MemiBoardList`, `MemiBoardDetail`, `MemiBoardEditor`, `MemiBoardCommentList`, `MemiBoardCommentForm`, `MemiBoardAttachments`, `MemiBoardSignIn`, `MemiBoardSettings`, `MemiBoardUsers`, `MemiBoardVersionHistory`

**List props:** `boardId` (required), `pageSize`, `category` (former name), `postLinkBase`, `getPostLink(post)`, `linkBase` (deprecated)

**Editor props:** `boardId`, `postId` (edit), `fixedCategory` (hides the selector when the path fixes it)
The body uses Nuxt UI **`UEditor`** (TipTap, `content-type="html"`). The host's `@nuxt/ui` 4.x must include Editor.

**Editor images:** From the toolbar you can add a file from the device or an external HTTPS image URL; pasted and dropped files are uploaded to Firebase Storage. External URLs are not copied to Storage and stop displaying if the original is deleted or hotlinking is blocked. The first body image, whether uploaded or external, is used as the list and share preview image.

`memiBoardPosts/{postId}/images/*` + `.../images/thumbnails/*` (optimized image + thumbnail).
The post document may not exist yet, and pastes arrive as `image/png` and similar. The example Storage rules limit writes to **signed-in + under 5MiB + `image/*` + ownership check**. Existing posts can only be modified by the author or a global admin/owner. Before the post is saved, the file's `customMetadata.ownerUid` must equal the signed-in UID, and when overwriting an existing file, the existing metadata must match too. Image uploads also check the post's existence and ownership in Firestore. The rules must be deployed to **the same bucket as the app's `storageBucket`**.

Body images can be selected up to 25MB, based on phone originals. Over 5MB, the browser optimizes them to at most 2560px · JPEG 85%; if the result is still over 5MB, it shrinks once more to 2048px · 75% before uploading. Images of 5MB or less are kept as is.
The body HTML holds the original URL. Clean up files abandoned during editing with a host scheduler (compare body references with `extractEditorImageUrls`).

**composables:**  
`useMemiBoardAuth`, `useMemiBoardPosts`, `useMemiBoardComments`, `useMemiBoardStorage`, `useMemiBoardModeration`, `useMemiBoardSettings`, `useMemiBoardUsers`, `useMemiBoardViews`  
**SEO (auto-import, host pipeline):**  
`useMemiBoardListSeo`, `useMemiBoardPostSeo`  
**SEO fetch (when needed):**  
`fetchPublicListForSeo`, `fetchPublicPostForSeo`, `resolvePublicSeoDb`

Comments are fetched chronologically, 10 at a time with a cursor; when the actual `More comments` button enters the viewport, the next page is loaded automatically after 1 second. Only after all existing comments are loaded does it subscribe in real time to the single latest comment. Replies are fetched 5 at a time, and after all are loaded it subscribes in real time to the single latest reply; nesting is displayed up to 2 levels deep.

### Boards (formerly categories)

- Document: `memiBoardSettings/{boardId}` → `{ label, listView, editorType, writeRole, commentWriteRole, visibility, allowedStaffUids, allowedManagerUids, locale, autoTranslate, autoTranslatePosts, i18n, i18nSource, order, updatedAt }`
- With no settings, the list is empty; no default board is created automatically
- In `MemiBoardSettings`, admins save, delete, reorder boards and manage the list view and minimum write role per board
- `boardId` is both the document ID and the `boardId` reference on each post (`memiBoardPosts`), so changing it after creation is not recommended

### Sign-in providers

`auth.providers` defaults to `['google', 'apple']`; `'emailPassword'` can be added.

- **Google:** enable it under Sign-in method in the console
- **Apple:** needs extra setup such as a Services ID and key → [docs/firebase-setup.md#apple](docs/firebase-setup.md#apple)

### Version history

Place `<MemiBoardVersionHistory />` on a page to show package feature changes to visitors.

## Security Model

With no server, **Rules are everything**.

Permission summary:

| Action | Condition |
|------|------|
| Read post | Public (`listed` · published), or author · admin · assigned staff. Hidden boards: author · admin · assigned staff only |
| Read comment | Public (`listed`), or author · admin · assigned staff · anyone who can read the parent post |
| Create post | Signed in + meets the board's `writeRole` + `moderationStatus == 'approved'` |
| Create comment | Signed in + meets the board's `commentWriteRole`. **Hidden boards: assigned staff only** (`commentWriteRole` ignored) |
| Edit/delete post | Author, or that board's admin · assigned staff |
| Delete comment | Comment author · post author · that board's admin · assigned staff |
| Clean up related likes | Like author, or parent post author · that board's admin · assigned staff. Comment likes can also be cleaned up by the comment author |
| Upload/delete file | For existing posts, the post author or a global admin/owner. If there is no post document, verified by the file's `ownerUid` |
| Role management | The owner can assign other admins. Admins manage manager · staff · user. Changing your own role or the owner is forbidden from the client |

When editing a post, `boardId` and `authorUid` cannot change, and `listed` follows the visibility transition rules. A visibility change records `visibilityTransition`, which locks new post/comment creation and regular post edits, and then completes. On failure, save again with the same target visibility. So that the post and its body can be created in one batch, body writes verify the parent post with `getAfter()`. Report records are kept even after a post is deleted.

File reads and listing in the Storage example are public. The Firestore read restrictions for hidden boards and private drafts do not extend to attachments. Storage admin/owner permissions are global, regardless of board assignment. Managing other users' files as assigned staff/manager requires a separate server API. For the detailed reasoning and how to migrate, see the [rule change notes](docs/firebase-setup.md#0451-rule-changes-and-migrating-existing-hosts).

**Known limitation:** AI moderation is client-only. Writing directly via the SDK bypasses it. For critical services, the host should add Cloud Functions validation (outside the package's scope).

## Firebase AI Logic (moderation)

Flow: **local blocklist → Gemini structured JSON** → if flagged, nothing is saved.

| Option | Default | Description |
|------|------|------|
| `enabled` | `true` | When off, local only / or close to letting everything through |
| `model` | `gemini-3.5-flash-lite` | A model name supported by Firebase AI Logic |
| `onError` | `'allow'` | On AI failure, `'block'` rejects the save |
| `localBlocklist` | `[]` | Strings added to the default list |
| `useLimitedUseAppCheckTokens` | `true` | When `false`, uses regular App Check session tokens |
| `blockBanThreshold` | `10` | Restricts posts and comments once accumulated content blocks (local/ai) reach this. `0` = off |
| `blockBanDecayMs` | `86400000` | Interval for removing one warning (default 24h) |

As content blocks accumulate, `moderationBlockCount` / `moderationBlockAt` are recorded in `memiBoardUsers/{uid}`.  
At 10, the user cannot write for about a day (one is removed every 24h). In the example Rules, users can only **+1** their own count; decreasing or resetting is for admins.

### Admin moderation bypass

At the bottom of the post form (`Editor.vue`), above the submit button, a "Ignore profanity filter" switch is shown only to `isAdmin` users. Submitting with it on skips both the local blocklist and AI moderation and saves (`via: 'admin-override'`; the warning count does not increase either). The comment form (`CommentForm.vue`) does not have it.

When calling directly, bypass with `useMemiBoardModeration().checkText(text, { skipFilter: true })`. `skipFilter` trusts whatever value the host passes, so deciding whether the user is an admin is the caller's (host's) responsibility.

### AI writing assistant usage limit

The editor's AI writing assistant can be used up to **10 times** per signed-in user in each 24-hour window. Before the call, only an `aiWritingPending` reservation is made; when the model call succeeds, it is committed to `aiWritingCount`. If the call fails, only the reservation is rolled back. Committed counts never go down. Reservation and commit update `memiBoardUsers/{uid}` in a Firestore transaction, so the total cannot exceed 10 even when several tabs run at once.

The host must merge and deploy the `memiBoardUsers/{uid}` rules from the latest `docs/firestore.rules.example` into its actual Firestore Rules. Reservation fields were added in 0.47.1. Without deploying the rules, the new package's AI writing count updates are rejected, or, while only the old rules are in place, clients can modify the counter arbitrarily and bypass the limit.

Enable **AI Logic (Gemini Developer API)** in the console. New projects may get 404 for the old `gemini-2.5-flash` → use 3.x Flash / Flash-Lite.

### App Check (effectively required with AI Enforce)

If `firebaseml` / AI Logic is **Enforced**, `generateContent` fails without an App Check token. memi-board does not initialize App Check. The default `moderation.useLimitedUseAppCheckTokens: true` requires **limited-use tokens**. reCAPTCHA v3's `ReCaptchaV3Provider` does not produce these tokens.

1. Create a **score-based** web key in reCAPTCHA Enterprise. Do not use checkbox keys or the v3 provider. Add only the real site addresses as domains. The site key is a public value, so keep it in client config. Never put the secret key in the client. Firebase exchanges the token.
2. Firebase console → App Check → register that site key on the web app. The registered web app's `appId` must equal `vuefire.config.appId`.
3. Include **Firebase App Check API** in the browser API key's API restrictions. Do not remove previously allowed APIs.
4. Exchange the Enterprise token in a host plugin after mount. In an SPA, `document.body` is empty before the first paint, so the hidden widget of `ReCaptchaEnterpriseProvider` fails with `appCheck/recaptcha-error`.

```ts
// app/plugins/app-check.client.ts
import { initializeAppCheck, CustomProvider } from 'firebase/app-check'
import type { FirebaseApp } from 'firebase/app'
import { useFirebaseApp } from 'vuefire'

export default defineNuxtPlugin((nuxtApp) => {
  const siteKey = String(useRuntimeConfig().public.recaptchaSiteKey || '').trim()
  if (!siteKey) return
  const app = useFirebaseApp()

  nuxtApp.hook('app:mounted', () => {
    initializeAppCheck(app, {
      provider: new CustomProvider({
        getToken: () => exchangeEnterpriseToken(app, siteKey),
      }),
      // Limited-use tokens are not refreshed as a session. The AI SDK calls getToken per request.
      isTokenAutoRefreshEnabled: false,
    })
  })
})

declare global {
  interface Window {
    grecaptcha?: {
      enterprise?: {
        ready: (callback: () => void) => void
        execute: (siteKey: string, options: { action: string }) => Promise<string>
      }
    }
  }
}

let enterpriseReady: Promise<void> | undefined

function loadEnterprise(siteKey: string) {
  enterpriseReady ??= new Promise((resolve, reject) => {
    const ready = () => {
      const enterprise = window.grecaptcha?.enterprise
      if (!enterprise) {
        reject(new Error('reCAPTCHA Enterprise failed to load.'))
        return
      }
      enterprise.ready(() => resolve())
    }
    if (window.grecaptcha?.enterprise) {
      ready()
      return
    }
    const script = document.createElement('script')
    script.src = `https://www.google.com/recaptcha/enterprise.js?render=${encodeURIComponent(siteKey)}`
    script.async = true
    script.onload = ready
    script.onerror = () => reject(new Error('Failed to load the reCAPTCHA Enterprise script.'))
    document.head.appendChild(script)
  })
  return enterpriseReady
}

async function exchangeEnterpriseToken(app: FirebaseApp, siteKey: string) {
  await loadEnterprise(siteKey)
  const enterprise = window.grecaptcha?.enterprise
  if (!enterprise) throw new Error('reCAPTCHA Enterprise failed to load.')
  const recaptchaToken = await enterprise.execute(siteKey, { action: 'fire_app_check' })
  const { projectId, appId, apiKey } = app.options
  const response = await fetch(
    `https://content-firebaseappcheck.googleapis.com/v1/projects/${projectId}/apps/${appId}:exchangeRecaptchaEnterpriseToken?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recaptcha_enterprise_token: recaptchaToken, limited_use: true }),
    },
  )
  if (!response.ok) throw new Error(`App Check token exchange failed (${response.status})`)
  const data = await response.json() as { token: string, ttl?: string }
  const seconds = Number(/^([\d.]+)s$/.exec(data.ttl ?? '')?.[1])
  return {
    token: data.token,
    expireTimeMillis: Date.now() + (Number.isFinite(seconds) ? seconds * 1000 : 60 * 60 * 1000),
  }
}
```

To use regular session tokens, change to `useLimitedUseAppCheckTokens: false` and remove `limited_use` from the exchange body.

5. Enable App Check enforcement **only for Firebase AI Logic**. Leave Cloud Storage and Cloud Firestore on monitoring. Only AI Logic accepts limited-use tokens. If you enforce it on Storage or Firestore, image uploads and post saves are rejected with `storage/unauthorized` or permission errors.
6. Locally, register the UUID printed by `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true` as a debug token in the console. Do not enable the debug token in production builds.

## Checklist for adding it to another project

- [ ] Same stack: Nuxt 4 + `@nuxt/ui` 4 + `nuxt-vuefire` + Firebase
- [ ] `pnpm add memi-board @nuxt/ui nuxt-vuefire vuefire firebase`
- [ ] `@nuxt/ui`, `nuxt-vuefire`, `memi-board` in `modules`
- [ ] `memiBoard` (`boardId` · `auth` · `moderation` · **`seo`**)
- [ ] **SSR on** for public list and detail, `ssr: false` only for writing and settings (no all-CSR routes)
- [ ] `await useMemiBoardListSeo` / `useMemiBoardPostSeo` on list and detail pages
- [ ] No host SEO API
- [ ] CSS `@source` …/memi-board/dist/runtime/components
- [ ] (optional) `.memi-board-post-link:visited` read-post styling CSS
- [ ] Merge the Rules examples + **deploy**
- [ ] Check the Firestore read IAM role on the Storage service account ([host setup](docs/firebase-setup.md#firestore-read-access-for-storage-rules-required-host-app-setup))
- [ ] Deploy indexes when using category / listed queries
- [ ] Write pages and middleware yourself (or copy from the playground)
- [ ] After the first sign-in, set `memiBoardUsers/{uid}.role = 'owner'` in Firebase Console
- [ ] Create the first category on the settings page
- [ ] (moderation) Enable AI Logic + recommended model + App Check
- [ ] Check for duplicate instances with `pnpm why vuefire`

It is fine if the same Firebase project has a host app user collection — board roles are **exclusive to `memiBoardUsers`**.

## Troubleshooting

### Safari post skeletons or comments delayed by about 30 seconds

Some Mac/iPhone Safari environments may need **forced Firestore long polling** in the host app. Post lookups, comments, and realtime like/report state can be delayed even when macOS Chrome works normally. See the [Safari troubleshooting guide and early Nuxt/VueFire initialization example](docs/firebase-setup.md#safari-slow-post-navigation-or-delayed-comments). memi-board does not enable this automatically; compare on affected devices and configure the host before Firestore is first used.

### `useCurrentUser() called before the VueFireAuth module...`

`vuefire.auth.enabled` is not set, or `vuefire`/`firebase` is installed twice. `pnpm why vuefire` → reduce to one. The module adds vue/vuefire/firebase to `vite.resolve.dedupe`, but **the host's peer installation** takes precedence.

### Category filter query error / index link

Create the composite index the console suggests, or deploy the `firestore.indexes.json` above.

### AI moderation fails / post not published (`onError: 'block'`)

Check the App Check token, matching `appId`, model name (3.x), AI Logic enabled, and network. Look for the `moderation AI failed` warning in the browser console.

### Editor images `storage/unauthorized`

If body pastes or uploads fail with `User does not have permission to access 'memiBoardPosts/…/images/…'`:

1. Check that you are signed in
2. Check that `vuefire.config.storageBucket` and `firebase.json` `storage.bucket` have **the same name**. Older projects may split between `*.appspot.com` (app) and `*.firebasestorage.app` (CLI default) — deploy the rules to the one the app uses.
3. Check that the host `storage.rules` has the `memiBoardPosts/{postId}/images` rules from `docs/storage.rules.example`. Writes must be `image/*` (pasted PNG).
4. Check that the file has `customMetadata.ownerUid` before the post is saved. Packages 0.45.1 and later add it automatically. For existing posts, check that the user is the author or a global admin/owner.
5. Image rules also query Firestore, so check the [cross-service IAM role](docs/firebase-setup.md#firestore-read-access-for-storage-rules-required-host-app-setup), run `firebase deploy --only storage`, and try uploading again.

### `storage/unauthorized` on attachments such as ZIP

If `memiBoardPosts/{postId}/attachments/...` fails, first check the sign-in state, that the attachment rules are deployed to the bucket the app uses, and the **under 20MiB per file** condition. The example rules do not block ZIP MIME types or `.exe.zip` names.

If it still fails with those conditions met, check that **the Storage service account of the host Firebase project has the Firestore read role**. Image and attachment rules query Firestore in `canWritePostFile` via `postExists` · `isPostOwner` · `isBoardStaff`. Without read permission, even the existence check for a new post's document can fail. Set `roles/firebaserules.firestoreServiceAgent` following the [host setup procedure](docs/firebase-setup.md#firestore-read-access-for-storage-rules-required-host-app-setup).

### Post deletion `storage/unauthorized`

If an author deleting their own post fails with `User does not have permission to access 'memiBoardPosts/{postId}'`, it is not the file deletion but **folder listing (`listAll`)** that is blocked.

The request is `prefix=memiBoardPosts/{postId}/` (trailing slash). `match /memiBoardPosts/{postId} { allow list }` alone does not match this prefix. The host `storage.rules` needs a block like the example:

```
match /memiBoardPosts/{postId}/{allPaths=**} {
  allow list, get: if true;
  allow delete: if canDeletePostFile(postId);
}
```

Also merge `canDeletePostFile` and related functions from the latest `docs/storage.rules.example`. Do not use the old condition (`!postExists`) that allowed deletion with just a sign-in when the post document is missing.

Do not put `write` in this block (size and `image/*` limits are handled by the `images`/`attachments`/`comment-images` matches). Run `firebase deploy --only storage` and delete again. The package empties only `images/` · `attachments/` · `comment-images/` by listing. Comment images are deleted while the post document still exists. If the post document disappears first, the post author can no longer delete comment files uploaded by other commenters.

If listing succeeds but **individual file deletion** is denied, also check the same Firestore read IAM role as in the [attachment error](#storageunauthorized-on-attachments-such-as-zip) above. Deletion rules also read post ownership and user roles from Firestore.

### Developing with monorepo `link:` / `file:`

Prepare the package dependencies and `dist` before linking.

```bash
# memi-board repository
pnpm install
pnpm build

# host repository
pnpm add link:../memi-board
```

| What you change | When it takes effect |
|-----------|------|
| `src/components/*` | The module reads the linked source directly → **immediately** (dev HMR) |
| `useMemiBoard*Seo` (`src/composables/useMemiBoardSeo.ts`) | The host Nuxt compiles the source → **immediately** (may need a dev restart) |
| `src/module.ts` · other core composables (`dist`) | After **`pnpm build`**, restart the host dev server |

The SEO composables use the host Nuxt instance via `#imports`. `nuxt/app` is not bundled into `dist/index.js`, so linking does not cause duplicate Nuxt loading (E1001).

The module automatically dedupes Vue · Vue Router · VueFire · Firebase · TipTap. Before deploying, switch dependencies back to **npm versions**.

To try new Tailwind classes right away while linked, add one more source path to the host CSS.

```css
@source "../../../node_modules/memi-board/src/components";
@source "../../../node_modules/memi-board/dist/runtime/components";
```

### OG meta is empty or link previews do not work

1. Check that public paths are not turned off with `ssr: false` (`routeRules`)
2. Check that the page calls `await useMemiBoardListSeo` / `useMemiBoardPostSeo`
3. `memiBoard.seo.siteUrl` · `siteName` · `defaultOgImage`
4. Check that `og:title` is in `curl` / view-source (don't look only at Elements)
5. Check that the post is `listed` / not on a hidden board (hidden boards are noindex)
6. Re-scrape with the deployed URL (KakaoTalk / Facebook caches)

## Local development (this repo)

```bash
pnpm install
pnpm build
pnpm dev:prepare
pnpm dev           # playground
pnpm build:watch   # rebuild dist when src changes
```

Emulators:

```bash
firebase emulators:start --project demo-memi-board
NUXT_PUBLIC_USE_EMULATORS=1 pnpm dev
```

Permission regression tests for the cleanup feature (requires Java 21+ and the Firebase CLI):

```bash
pnpm build
pnpm test:cleanup
firebase emulators:exec --project demo-memi-cleanup-security --only auth,firestore,storage 'node --test tests/cleanup-rules.test.mjs'
```

Notice (pinned) permission regression tests:

```bash
firebase emulators:exec --project demo-memi-notice-rules --only auth,firestore 'node --test tests/notice-rules.test.mjs'
```

Profile edit permission regression tests:

```bash
firebase emulators:exec --project demo-memi-profile-rules --only auth,firestore 'node --test tests/profile-rules.test.mjs'
```

## Publishing to npm

npm Trusted Publishing (OIDC) is used. No long-lived `NPM_TOKEN` or local OTP is stored.

1. Update the version in `package.json`, `CHANGELOG.md`, and the in-app `versionHistory`, then push to `main`.
2. Pushing to `main` runs `.github/workflows/publish.yml`.
3. After checking whether the version is already published, it builds, type-checks, runs regression tests, Firebase security rules tests, and a package dry-run, then publishes to npm.

In the npm package settings, register the Trusted Publisher as GitHub repository `fkkmemi/memi-board`, workflow `publish.yml`. If you assign approvers to the GitHub Environment `npm-publish`, you can approve once more after the workflow runs and before the actual npm publish.

## Version · License

- UI: `<MemiBoardVersionHistory />`
- Details: [CHANGELOG.md](CHANGELOG.md)
- **MIT**

### 0.46 roles and per-service names

For the 5 roles, per-board manager scope, `roleLabels`, and the host migration procedure, see [role migration](docs/roles-migration.md). Use `canConfigureBoard()` for settings access.
