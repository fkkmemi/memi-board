# Adding memi-board to another Nuxt site

[README](../README.md) · [Internationalization and translation](internationalization.md) · [Firebase setup](firebase-setup.md) · [Role migration](roles-migration.md)

This is the procedure for adding a board to an existing Nuxt 4 site. The host app handles routes, the Firebase connection, and rule deployment; memi-board provides the board components and composables.

The examples in this guide, including the internationalization and translation options, assume **memi-board 0.47.0 or later**. Required versions: Nuxt 4+, Nuxt UI 4+, Firebase 12+, Vue 3.5+, VueFire 3.2+.

## 1. Install the required packages

Run this from the root of the existing Nuxt project.

```bash
pnpm add memi-board@^0.47.0 @nuxt/ui nuxt-vuefire vuefire firebase
```

`dayjs` is not needed. Add `@nuxtjs/i18n` only if you need site language switching. In production, manage the memi-board version you have verified together with the lockfile.

## 2. Choose a language mode first

| Service | Recommended setting |
|---|---|
| Korean notice/inquiry board | `locale: 'ko', i18n: { enabled: false }` |
| English-only service | `locale: 'en', i18n: { enabled: false }` |
| Multilingual UI, posts shown in the language they were written in | `i18n: { enabled: true }, translation: { enabled: false }` |
| Translate boards and posts into multiple languages | `i18n: { enabled: true }, translation: { enabled: true }` |

If omitted, both features are enabled. Content translation requires a separate Firebase AI Logic setup. For what the auto-translate toggle means and when translation actually runs, see [Internationalization and translation](internationalization.md#4-when-translations-run-and-are-saved).

## 3. Merge into the Nuxt config

The following is a starter example that is **Korean-only and does not use AI moderation or translation**. If you already have `modules`, CSS, or Firebase settings, merge rather than registering them twice.

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@nuxt/ui', 'nuxt-vuefire', 'memi-board'],
  css: ['~/assets/css/main.css'],
  vuefire: {
    config: {
      apiKey: 'FIREBASE_WEB_API_KEY',
      authDomain: 'YOUR_PROJECT.firebaseapp.com',
      projectId: 'YOUR_PROJECT',
      storageBucket: 'YOUR_ACTUAL_BUCKET',
      messagingSenderId: 'YOUR_SENDER_ID',
      appId: 'YOUR_WEB_APP_ID'
    },
    auth: { enabled: true }
  },
  memiBoard: {
    locale: 'ko',
    i18n: { enabled: false },
    auth: { providers: ['google'] },
    moderation: { enabled: false },
    seo: {
      siteName: 'Our Service',
      siteUrl: 'https://example.com',
      basePath: '/board'
    }
  },
  routeRules: {
    '/board/**/new': { ssr: false },
    '/board/**/edit': { ssr: false },
    '/board-settings': { ssr: false },
    '/board-settings/**': { ssr: false },
    '/board-users': { ssr: false }
  }
})
```

Use the **Firebase web app config of the site you are adding the board to**. Storage bucket names can differ per project, so copy the actual value from the console. Never put a Firebase Admin service account key in the client config.

Keep SSR for the public list and detail pages. Even with `moderation.enabled: false`, the default local banned-word check remains. This config has no option to turn off the writing AI's proofreading and sentence polishing; using those AI menus requires an AI Logic connection.

## 4. Styles and UApp

```css
/* app/assets/css/main.css */
@import "tailwindcss";
@import "@nuxt/ui";
@source "../../../node_modules/memi-board/dist/runtime/components";
```

`@source` is relative to the CSS file above. If your CSS lives elsewhere, adjust the relative path.

```vue
<!-- app/app.vue — if a UApp already exists, don't wrap it twice -->
<template>
  <UApp>
    <NuxtPage />
  </UApp>
</template>
```

Apps with layouts keep their existing `<NuxtLayout>` structure. To also pin Nuxt UI's internal strings to Korean, import `ko` from `@nuxt/ui/locale` and set `<UApp :locale="ko">`. The host app also manages `<html lang>`.

## 5. Deploy rules and indexes

Merge the following files from the installed package into the host files. If the site already has rules, don't overwrite them wholesale.

| Package file | Host file |
|---|---|
| `node_modules/memi-board/docs/firestore.rules.example` | `firestore.rules` |
| `node_modules/memi-board/docs/storage.rules.example` | `storage.rules` |
| `node_modules/memi-board/docs/firestore.indexes.json.example` | `firestore.indexes.json` |

```bash
firebase deploy --only firestore:rules,storage,firestore:indexes
```

Also set the index file path in `firebase.json`. The bucket the Storage rules are deployed to must match `vuefire.config.storageBucket`. For the initial setup including cross-service IAM, follow [Firebase setup](firebase-setup.md#firestore-read-access-for-storage-rules-required-host-app-setup). Installing from npm or deploying the website does not replace this deployment.

## 6. Admin pages and the first board

```vue
<!-- app/pages/board-settings.vue -->
<template>
  <MemiBoardSettings />
</template>
```

```vue
<!-- app/pages/board-users.vue -->
<template>
  <MemiBoardUsers />
</template>
```

Add `<MemiBoardSignIn />` to a sign-in page or an existing account screen, then initialize in this order:

1. In Firebase Authentication, set up the Google provider and the site's authorized domains.
2. Sign in with the board's sign-in component to create the `memiBoardUsers/{uid}` document. If the host only has its own sign-in, open a page that also uses the board auth composable.
3. From the trusted Firebase Console or a server-side Admin SDK, set that document's `role` to `owner`.
4. After reloading or signing in again, create a board with the ID `free` in `/board-settings`.
5. In `/board-users`, assign `admin`/`manager`/`staff` roles to the accounts that need them, and assign people in the board settings.

Don't assign the first owner or transfer ownership through the client role selection menu. The host app adds route access guards, and actual data access is enforced by the rules. If the host's sign-in provider uses the same Firebase Auth as the board, sign-in state is shared.

## 7. List, new post, and detail pages

The recommended paths are below. The host app decides the `/board` landing page and menu structure.

| File | URL | Value to pass |
|---|---|---|
| `app/pages/board/[boardId]/index.vue` | `/board/free` | `boardId` for the list |
| `app/pages/board/[boardId]/new.vue` | `/board/free/new` | `boardId` for the editor |
| `app/pages/board/[boardId]/[slug]/index.vue` | `/board/free/post-slug` | Look up the slug and pass it as the detail's `postId` |
| `app/pages/board/[boardId]/[slug]/edit.vue` | `/board/free/post-slug/edit` | Edit the existing post using the looked-up document ID |

Components are auto-imported by the Nuxt module. Import only composables and types from `memi-board/runtime`.

### List

```vue
<!-- app/pages/board/[boardId]/index.vue -->
<script setup lang="ts">
const route = useRoute()
const boardId = computed(() => String(route.params.boardId || ''))
const { isSignedIn, canConfigureBoard } = useMemiBoardAuth()
const { boardLabel } = useMemiBoardSettings()
await useMemiBoardListSeo({
  category: boardId,
  path: computed(() => `/board/${encodeURIComponent(boardId.value)}`)
})
</script>

<template>
  <MemiBoardList
    :board-id="boardId"
    :title="boardLabel(boardId)"
    :get-post-link="post => `/board/${encodeURIComponent(boardId)}/${encodeURIComponent(post.slug)}`"
    :write-to="`/board/${boardId}/new`"
    :can-write="isSignedIn"
    :settings-to="`/board-settings/${boardId}`"
    :can-manage-settings="canConfigureBoard(boardId)"
  />
  <MemiBoardSignIn v-if="!isSignedIn" />
</template>
```

In this example, `canWrite` only reflects whether the user is signed in. For staff- or admin-only boards, the host app should also check the board's `writeRole` and assignment scope before showing the button. The rules enforce write permission independently of whether the button is shown.

Also create the page that the list's per-board settings link points to.

```vue
<!-- app/pages/board-settings/[boardId].vue -->
<script setup lang="ts">
const route = useRoute()
const boardId = computed(() => String(route.params.boardId || ''))
</script>

<template>
  <MemiBoardCategorySettings :category-id="boardId" />
</template>
```

Use `canConfigureBoard(boardId)` for the manager entry guard and `canManageBoard(boardId)` for content management. The settings component also checks assigned settings permission by default.

### New post

```vue
<!-- app/pages/board/[boardId]/new.vue -->
<script setup lang="ts">
const route = useRoute()
const boardId = computed(() => String(route.params.boardId || ''))
const { isSignedIn, rolePending } = useMemiBoardAuth()
</script>

<template>
  <MemiBoardEditor
    v-if="!rolePending && isSignedIn"
    :board-id="boardId"
    @saved="slug => navigateTo(`/board/${boardId}/${encodeURIComponent(slug)}`)"
    @cancel="navigateTo(`/board/${boardId}`)"
  />
  <MemiBoardSignIn v-else-if="!rolePending" />
</template>
```

For a new post, the `saved` event passes the **slug**; when editing an existing post, the `saved` event passes the **Firestore document ID**. On the edit page, navigate using the slug from the current URL. The editor itself applies the board language.

### Detail

```vue
<!-- app/pages/board/[boardId]/[slug]/index.vue -->
<script setup lang="ts">
const route = useRoute()
const boardId = computed(() => String(route.params.boardId || ''))
const slug = computed(() => String(route.params.slug || ''))
const { post: seoPost } = await useMemiBoardPostSeo({
  category: boardId,
  slug,
  path: computed(() => `/board/${encodeURIComponent(boardId.value)}/${encodeURIComponent(slug.value)}`)
})
const { resolvePostIdBySlug } = useMemiBoardPosts(boardId)
const postId = ref('')
const unavailable = ref(false)
watch([boardId, slug, seoPost], async ([board, currentSlug, seo], _, onCleanup) => {
  let active = true
  onCleanup(() => { active = false })
  postId.value = ''
  unavailable.value = false
  if (seo?.id && seo.category === board && seo.slug === currentSlug) {
    postId.value = seo.id
    return
  }
  if (import.meta.server) return
  const result = await resolvePostIdBySlug(currentSlug)
  if (!active) return
  postId.value = result.status === 'ok' ? result.id : ''
  unavailable.value = result.status !== 'ok'
}, { immediate: true })
</script>

<template>
  <MemiBoardDetail
    v-if="postId"
    :board-id="boardId"
    :post-id="postId"
    @edit="navigateTo(`/board/${boardId}/${encodeURIComponent(slug)}/edit`)"
    @navigate="post => navigateTo(`/board/${boardId}/${encodeURIComponent(post.slug)}`)"
    @list="navigateTo(`/board/${boardId}`)"
    @deleted="navigateTo(`/board/${boardId}`)"
  />
  <p v-else-if="unavailable">The post could not be found, or you don't have access to it.</p>
  <p v-else>Loading...</p>
</template>
```

`boardId` is the board settings document ID, `postId` is the post's Firestore document ID, and `slug` is the URL string. Don't pass the slug as `postId` to the detail component. In the example above, SEO for public detail pages is filled in during SSR, while client-side reads of drafts and private posts follow sign-in state and the rules.

### Edit

```vue
<!-- app/pages/board/[boardId]/[slug]/edit.vue -->
<script setup lang="ts">
const route = useRoute()
const boardId = computed(() => String(route.params.boardId || ''))
const slug = computed(() => String(route.params.slug || ''))
const { rolePending, isSignedIn, canEdit } = useMemiBoardAuth()
const { resolvePostIdBySlug, getPost } = useMemiBoardPosts(boardId)
const postId = ref('')
const pending = ref(true)
watch([boardId, slug, rolePending, isSignedIn], async (_, __, onCleanup) => {
  let active = true
  onCleanup(() => { active = false })
  postId.value = ''
  pending.value = true
  if (rolePending.value) return
  if (isSignedIn.value) {
    try {
      const result = await resolvePostIdBySlug(slug.value)
      const post = result.status === 'ok' ? await getPost(result.id) : null
      if (active && post && canEdit(post)) postId.value = post.id ?? ''
    }
    catch {
      // Sign-in, permission, deletion, and network errors are handled by the message below.
    }
  }
  if (active) pending.value = false
}, { immediate: true })
</script>

<template>
  <p v-if="pending">Loading...</p>
  <MemiBoardEditor
    v-else-if="postId"
    :board-id="boardId"
    :post-id="postId"
    @saved="navigateTo(`/board/${boardId}/${encodeURIComponent(slug)}`)"
    @cancel="navigateTo(`/board/${boardId}/${encodeURIComponent(slug)}`)"
  />
  <p v-else>You don't have permission to edit this post, or it could not be loaded.</p>
</template>
```

## 8. Roles and service-specific labels

```ts
memiBoard: {
  roleLabels: {
    user: 'Customer',
    staff: 'Store staff',
    manager: 'Store manager',
    admin: 'Operator',
    owner: 'Super admin'
  }
}
```

Only the labels change; permissions do not. A manager manages the settings and staff assignments of the boards listed in `allowedManagerUids`. Linking stores or organizations to boards and syncing assignments is the host app's responsibility. Simply sharing the same Firebase project does not automatically create organization boundaries.

Under the default file rules, only a global admin/owner can modify or delete other users' files. Services where assigned staff/managers need to replace other users' attachments or clean up files should add a server API that verifies board assignment. Default Storage file reads are public. For details on roles and migrating existing data, see [Role migration](roles-migration.md).

## 9. Separating data from other sites

| Setup | Recommended approach |
|---|---|
| Independent sites for separate services or clients | Use separate Firebase projects too |
| Multiple boards within the same service | Same project, separated by `boardId` |
| Different collection names within one project | Change the 6 names such as `postsCollection` together with the rules, Storage paths, and indexes |

Collection name options and `boardId` do not, by themselves, guarantee tenant isolation for security. The default admin/owner manages the entire collection. If you need independent administrator boundaries, separate the projects or design the host rules separately.

## 10. Pre-deployment checklist

- After the first owner signs in, verify creating the `free` board and writing posts and comments with a regular account.
- On opening a post detail page, verify the slug → document ID lookup and that the original content is shown.
- Verify the language/translation UI and whether AI requests are made, according to the chosen internationalization mode.
- Verify that a manager can configure only their assigned boards and not other boards.
- Verify that the rules are deployed to the Storage bucket the app uses, and test image and attachment uploads.
- Verify on the deployed URL that the public list and detail HTML contain OG meta tags.
- Check the results of the web app deployment and the Firebase rules/index deployment separately.

For troubleshooting steps by error, see [README Troubleshooting](../README.md#troubleshooting).
