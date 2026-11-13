# Firebase project setup (first-time install)

If this is the first time you are adding this module to a project, especially one that has never used Firebase, the README's "Installation" section is not enough. Follow the steps below in order.

[Host installation guide](host-integration.md) · [Internationalization and translation](internationalization.md) · [Role migration](roles-migration.md)

## 1. Prerequisites

- Node.js + pnpm (or npm/yarn)
- Nuxt **4.0 or later**, `@nuxt/ui` **4.0 or later**
- Firebase CLI: `npm i -g firebase-tools`, then `firebase login`

## 2. Create a Firebase project (if you don't have one)

1. Create a new project in the [Firebase console](https://console.firebase.google.com).
2. Enable **Firestore Database** (Native mode).
3. Enable **Storage**.
4. Enable **Authentication**, and turn on the providers you need (Google/Apple/Email/Password) under Sign-in method.

If you are adding the board to an existing Firebase project, skip this step and just confirm that the three services above are enabled.

## 3. Get the `firebaseConfig` values

Firebase console → Project settings (gear icon) → **General** tab → "Your apps" section → add a web app if there is none → under "SDK setup and configuration", copy the `apiKey`/`authDomain`/`projectId`/`storageBucket`/`messagingSenderId`/`appId` values as-is into `vuefire.config` in `nuxt.config.ts` (this is the host app's nuxt-vuefire config, not memi-board's — see README [Installation](../README.md#installation)).

## 4. Connect the host project to the Firebase CLI

If the project root does not have `firebase.json`/`.firebaserc` yet:

```bash
firebase init firestore storage
```

Or create them manually:

```json
// .firebaserc
{ "projects": { "default": "<your-project-id>" } }
```

```json
// firebase.json
{
  "firestore": { "rules": "firestore.rules", "indexes": "firestore.indexes.json" },
  "storage": {
    "bucket": "<same value as vuefire.config.storageBucket>",
    "rules": "storage.rules"
  }
}
```

`storage.bucket` **must match** the host's `vuefire.config.storageBucket`. Example: `my-app.appspot.com`.

If the project already uses the Firebase CLI, don't just check that `firebase.json` has the `firestore.rules`/`storage.rules` paths — check the **bucket name** too.

Older projects may have two buckets:

- `*.appspot.com` — the `storageBucket` from the older web app SDK snippet
- `*.firebasestorage.app` — the console/CLI default bucket

If `firebase deploy --only storage` has no `bucket`, the rules are deployed only to the **default bucket**. If the app uploads to `appspot.com` but the rules exist only on `firebasestorage.app`, editor images fail with `storage/unauthorized`. If you use both, deploy the same rules as an array:

```json
"storage": [
  { "bucket": "my-app.appspot.com", "rules": "storage.rules" },
  { "bucket": "my-app.firebasestorage.app", "rules": "storage.rules" }
]
```

If deleting a post fails with `storage/unauthorized` (`access 'memiBoardPosts/{postId}'`), the problem is the **list path**, not the bucket. The `listAll` prefix is `memiBoardPosts/{postId}/`, so `match /memiBoardPosts/{postId} { allow list }` alone is not enough. Copy the `{postId}/{allPaths=**}` block from `docs/storage.rules.example` as-is and run `firebase deploy --only storage`.

## 5. Merge and deploy the board Security Rules

Merge `docs/firestore.rules.example`/`docs/storage.rules.example` into the project's rules files as described in the README's [Security Model](../README.md#security-model) section, then:

```bash
firebase deploy --only firestore:rules,storage
```

**If you merge but don't deploy, writing posts and comments fails with `permission-denied`** — this is the most common installation mistake.

### Initialize post URL reservations

**Required once before the first post when installing 0.57.0+ on a new project.**
This section assumes the configured posts collection is empty. It initializes the
URL reservation feature; it does not move, rename, or rewrite any post documents.
An already initialized project does not need this step again for a package upgrade.

Deploy the Firestore rules above first, then use either of the following methods.
Firebase Admin is optional: the console method needs no Admin SDK in the host app.

**Firebase console:**

1. Open the intended Firebase project → Firestore Database → Data. Confirm that
   `memiBoardPosts` has no documents.
2. Create the collection `memiBoardPostsSlugs` and document `__migration`.
3. Add `ready` with type **Boolean** and value **true**, then save. The spelling
   `__migration` is an internal setup marker name; no post migration is being run.
   Do not use the string `"true"`.

**Optional command:** Run from the host project root with a trusted account that
can read/write this Firestore database. The command rejects a nonempty posts
collection and never updates post documents. Keep Admin credentials outside the
repository and outside browser/public configuration.

```bash
pnpm add -D firebase-admin

GCLOUD_PROJECT=YOUR_FIREBASE_PROJECT_ID \
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json \
node --input-type=module <<'NODE'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const projectId = process.env.GCLOUD_PROJECT
if (!projectId || projectId === 'YOUR_FIREBASE_PROJECT_ID') {
  throw new Error('Set the intended Firebase project ID first')
}
initializeApp({ projectId, credential: applicationDefault() })
const db = getFirestore()
const postsCollection = process.env.MEMI_POSTS_COLLECTION || 'memiBoardPosts'
const marker = db.doc(`${postsCollection}Slugs/__migration`)
await db.runTransaction(async transaction => {
  const current = await transaction.get(marker)
  if (current.get('ready') === true) return
  const posts = await transaction.get(db.collection(postsCollection).limit(1))
  if (!posts.empty) throw new Error('Fresh-project setup requires an empty posts collection')
  if (current.exists) throw new Error('Setup marker already exists; inspect it instead of overwriting it')
  transaction.create(marker, { ready: true, completedAt: FieldValue.serverTimestamp() })
})
console.log(`Post URL reservations ready: ${projectId}/${postsCollection}Slugs`)
NODE
```

If using Application Default Credentials already configured on the machine, omit
`GOOGLE_APPLICATION_CREDENTIALS`. For a custom posts collection, prefix the command
with `MEMI_POSTS_COLLECTION=yourPostsCollection`; the marker then belongs at
`yourPostsCollectionSlugs/__migration`. Update **every** reservation path in the
Firestore rule example to match. This marker is shared by the boards using that
posts collection, so creating another board does not require another initialization.

The rules let signed-in writers check individual reservations and create a reservation
only alongside their own matching new post. Clients cannot list, overwrite, or delete
reservations, or write the setup marker. Reservations contain only `postId`, not a
draft's title, body, or author profile. Their document paths contain the URL slug.
Post read permissions still protect unpublished/private content.

After setup, save a test draft, create another post with the same title, and check
`title` then `title-2`. Refresh the draft, edit it, and publish it; its address should
stay the same. The number counts conflicting addresses **within that board**, not
all posts in the project.

If saving reports `Post URL reservations are not initialized`, check the correct
project, posts collection, marker path, and Boolean field. If it reports
`permission-denied`, confirm that the reservation rules were deployed and the user
has write access to that board. Do not remove the readiness check or allow public
reservation writes to work around setup errors.

### 0.45.1 rule changes and migrating existing hosts

From 0.46 onward, the global roles for the file management described below are **admin/owner**. staff/manager manage their assigned content, but the default rules do not let them modify or delete other users' files. For a new install, set the first role to `owner`; migrate existing admin and staff accounts using the [role migration](roles-migration.md) procedure.


0.45.1 requires updating the client and the Firestore and Storage rules together. Automatic site deployment does not replace deploying the Firebase rules.

| Target | Change |
|------|-----------|
| Post updates | Changing `boardId` or `authorUid` is forbidden, and changing `listed` is limited to visibility transitions. |
| Creating a post and its body together | The body write uses `getAfter()` to check ownership of the parent post after the batch is applied. |
| Visibility transitions | While the board settings have `visibilityTransition`, creating new posts and comments and regular post edits are locked. Assigned managers may still sync `listed`. |
| Deletion and audit records | Content authors and assigned managers can clean up related likes. Report records remain even when the post is deleted. |
| Image and attachment uploads | For existing posts, only the author or a global admin/owner can write. Before the post is saved, the uploaded file's `customMetadata.ownerUid` must equal the signed-in UID. Overwrites also check the existing file's `ownerUid`. |
| File deletion | If the post document exists, only the author or a global admin/owner can delete; otherwise only the user recorded in the file's `ownerUid`. |

Rollout order:

1. In the host app, install `memi-board@^0.45.1` or later and update the lockfile. Any custom upload code must also set `customMetadata: { ownerUid: user.uid }` on images, thumbnails, and attachments.
2. Merge all functions and per-collection/per-path rules from the example of the version you installed into the host. If you renamed collections, update the Firestore paths inside the functions too. Remove old conditions that allow file writes or deletes based only on `!postExists(postId)`. Access is granted if any overlapping `match` in the rules allows it, so don't leave a broad `allow write` in place.
3. In the emulator, with two accounts, verify: saving a new post and body together, image and attachment uploads, rejection of overwriting or deleting another user's files, comment like cleanup, and retrying a hide transition.
4. Deploy the new client and the rules in the same deployment, and apply them to every bucket the app uses. Once the new rules are live, old clients in existing browsers may be rejected because their pre-save uploads lack `ownerUid`; reload the new version and retry. Also check the cross-service IAM setup below.

Files on existing posts are authorized by the parent post's author and roles even without `ownerUid`, so no bulk metadata update is needed. However, old orphaned files that have neither a parent post document nor an `ownerUid` cannot be modified or deleted from the client. Do any necessary cleanup from a trusted Admin SDK or the console.

If a visibility transition fails, don't manually clear `visibilityTransition` or switch it to the opposite visibility; instead, **save again with the same target visibility** in the settings screen to complete the sync. A hide transition first lowers the content's `listed`, then finalizes `visibility: 'hidden'` last. Returning to public first allows the board to be public, then syncs the content, then clears the transition marker.

Storage rules can read at most 2 distinct Firestore documents, so the example reads only the post document and the user role document. As a result, admin/owner in Storage keep global file management rights regardless of board assignment. Don't confuse this with the assigned-staff scope in Firestore. See the [official access limits](https://firebase.google.com/docs/storage/security/rules-conditions#enhance_with_firestore).

File reads and listing in the example remain public. Services that need files of hidden boards or private drafts to be stored privately must design a separate Storage read policy.

### Board banner Storage rules

Board settings support an optional 8:1 desktop banner and an optional 3:1 phone banner. The crop editor exports a 2400 × 300 (desktop) or 1200 × 400 (phone) JPEG, previews it locally, and uploads only when settings are saved. The saved board document contains `banner: { url, path }` and `mobileBanner: { url, path }`; removing one stores `null`. The list shows the phone banner below 640px and the desktop banner above it; when only one is set, it is used on both.

Banner files use `memiBoardSettings/{boardId}/banners/{uuid}.jpg`. Merge **both** `canConfigureBanner(boardId)` and its `match /memiBoardSettings/{boardId}/banners/{fileName}` block from [storage.rules.example](storage.rules.example) into the host's existing `match /b/{bucket}/o` block. Keep the existing `isSignedIn()` helper, including its account-deletion check, and retain other application rules. The Storage path uses the configured settings collection; if `memiBoard.settingsCollection` or `usersCollection` is customized, update the corresponding paths in the rules too.

The banner editor also offers **Generate with AI**. An optional **Style and additional requests** field accepts up to 1,000 characters describing colors, mood, style or desired elements. It sends the current board title (label), description and this request to Firebase AI Logic, receives a raster image, and opens it in the same crop/preview dialog. Confirming a crop stages the image locally; settings must still be saved before upload. Generation does not publish a banner automatically. The site's AI-off setting hides the button and prevents requests.

Image generation uses a dedicated model, separate from the moderation/writing model. The default is `gemini-nano-banana-2.1`, with image-only output, an 8:1 aspect ratio and 2K image size. Override the model in the host's `nuxt.config.ts` when needed:

```ts
memiBoard: {
  bannerGeneration: { model: 'gemini-nano-banana-2.1' },
}
```

Use an image-capable model that supports the configured 8:1 ratio and 2K size. Per the [Firebase AI Logic image-generation guide](https://firebase.google.com/docs/ai-logic/generate-images-gemini), Nano Banana image generation requires the Blaze plan. The host must have Firebase AI Logic's Gemini Developer API backend configured, permit the selected model if model access is restricted, and initialize App Check before generation. The request reuses `moderation.useLimitedUseAppCheckTokens` (enabled unless explicitly false). No browser Gemini API key or new server endpoint is added. Generation makes a billed AI request only after the button is clicked, with no automatic retries; Storage permissions are unchanged. Existing deployed banner rules also cover generated JPEG crops.

The banner rules enforce:

- Public file reads. Banners are public decoration even for hidden boards; do not use them for private images.
- Creation, listing and deletion by `owner`/`admin`, or a `manager` listed in that board's `allowedManagerUids`. An assigned `staff` role alone does not grant banner upload rights.
- JPEG content type and a file size **below 3 MiB**. The editor accepts JPG, PNG and WebP source images up to 25 MiB, then crops and converts them before upload.
- New object paths only: `resource == null` prevents overwrites. Replacements use a fresh UUID. After settings are committed, the previous banner is deleted; if saving settings fails, the newly uploaded file is cleaned up.

The permission check reads at most the user-role document and the board-settings document. It requires the cross-service Firestore permission described below. The existing Firestore board-settings rules already allow administrators and assigned configuration managers to save the banner field; a separate Firestore rule change is not needed when using the current examples.

Deploy from the **host app root**, where its `firebase.json`, `.firebaserc` and `storage.rules` live:

```bash
firebase deploy --only storage --project YOUR_FIREBASE_PROJECT_ID
```

Confirm `firebase.json` includes every bucket used by the app, and that its `rules` entry points to the edited file. For a host using both bucket names, the configuration is:

```json
{
  "storage": [
    { "bucket": "YOUR_FIREBASE_PROJECT_ID.appspot.com", "rules": "storage.rules" },
    { "bucket": "YOUR_FIREBASE_PROJECT_ID.firebasestorage.app", "rules": "storage.rules" }
  ]
}
```

Include only buckets that exist in the intended project. Deploying the package, restarting the dev server, or publishing the host website does not deploy Storage rules. The CLI must report successful rule compilation and release for every configured bucket. In CI, `--non-interactive` can be added after the initial cross-service IAM setup is complete.

After deployment, select a banner in a board's settings, move/zoom the crop, confirm it and save. Reload the board to verify persistence and the 8:1 display. Check replacement and removal using a disposable test board, and check that an unassigned manager or ordinary user cannot upload. A `storage/unauthorized` error usually means the wrong bucket was deployed, a missing role/assignment, or missing cross-service IAM access.

For automated rules verification, run `tests/banner-rules.test.mjs` in this package with the Auth, Firestore and Storage emulators and the example rules loaded. The test uses project `demo-memi-banners`; set the three emulator host variables via `firebase emulators:exec`. It verifies permitted roles, public reads, denied roles, MIME/size restrictions, overwrite denial and deletion permissions without writing to production.

### Content limits (recommended defaults)

`firestore.rules.example` and `storage.rules.example` cap what a client can write, so a direct API call cannot go past the limits the editor shows. **These values are recommendations.** Keep them, or adjust them to what your site actually needs. The full list, with where each limit is enforced, is in the **Spec** tab of the "About memi-board™" popup.

| Item | Default | Enforced in | Notes |
|---|---|---|---|
| Profile name / bio | 50 / 200 chars | Firestore rules + app | `PROFILE_NAME_MAX`, `PROFILE_BIO_MAX` |
| Post title / translated title | 150 / 300 chars | Firestore rules + app | `POST_TITLE_MAX`, `POST_TITLE_TRANSLATION_MAX` |
| Post URL (slug) | 60 chars | Firestore rules (80) + app | room for a `-2` suffix |
| Post body | 50,000 HTML chars | Firestore rules + app | on auto-translated boards the app lowers it to `min(10,000, 50,000 ÷ target languages)` |
| Tags | 10 × 30 chars | Firestore rules + app | `POST_TAG_MAX`, `POST_TAG_LENGTH_MAX` |
| Attachments per post | 5 | Firestore rules + app | `POST_ATTACHMENT_MAX`; each entry must point into the post's own `attachments/` folder |
| Attachment file | 20 MB, no HTML/SVG/script/executable | Storage rules only | see below |
| Author memo | 100 chars | Firestore rules + app | |
| Moderation ban | 10 blocks, −1 every 24 h | Firestore rules + app | rules refuse new posts and comments; keep `10` and `86400000.0` in `notModerationBanned` in sync with `moderation.blockBanThreshold` / `blockBanDecayMs`. The block count is reported by the client |
| Custom field values on a post | 20 × 200 chars | Firestore rules + app | keys must match `^[a-z][A-Za-z0-9_]{0,31}$`; whether a key is declared by the board is checked by the app only |

**Attachments are the limit most likely to differ per site.** The default blocks formats that open straight from the public Storage URL and are easy to abuse for phishing or malware (HTML, SVG, JavaScript, `.exe`/`.msi`/`.bat` and similar), and caps files at 20 MB. The app itself does not limit attachment size or type, so you only need to edit `storage.rules`:

- An app distribution site that ships `.apk` or firmware `.bin` files: `.apk` and `.bin` are not blocked by default, so only raise the size, for example to `100 * 1024 * 1024`.
- A site that must accept a blocked format: remove that extension and MIME type from `isBlockedAttachment`.
- A site that only needs documents and images: replace the blocklist with an allowlist of content types.

Storage rules cannot count the files in a folder, so a client can still upload files without attaching them to a post. Those files are removed by the orphan cleanup in board settings after 24 hours; keep App Check enforced and set a Storage budget alert as well.

### Firestore read access for Storage rules (required host app setup)

On image/attachment uploads and file deletion, the example Storage rules use `firestore.exists()` / `firestore.get()` to look up whether the post exists, its `authorUid`, and the user's `role`. The **Storage service account of the host app's Firebase project** therefore needs a Firestore read role. Installing the package or deploying the Firestore rules does not complete this IAM setup.

An administrator of the host project sets this up as follows:

1. Run the deploy command above interactively from the host repository. When the Firebase CLI asks whether to add the IAM role for cross-service rules, approve it. You can also grant it from the connection permission prompt shown when saving Storage Rules in the Firebase console.
2. In the Google Cloud Console → **IAM & Admin → IAM**, select the same Firebase project and turn on **Include Google-provided role grants**.
3. Find the `service-<PROJECT_NUMBER>@gcp-sa-firebasestorage.iam.gserviceaccount.com` account and confirm it has the **Firebase Rules Firestore Service Agent** (`roles/firebaserules.firestoreServiceAgent`) role. `<PROJECT_NUMBER>` is the numeric project number from the Firebase Project settings, not the project ID. If the role is missing, a host administrator with permission to change IAM adds it to this service account.
4. After the permission takes effect, verify by uploading a small attachment (under 20 MiB) to a new post while signed in. On existing posts, also verify attachment operations by the author and staff.

This role allows reading Firestore documents in the project (`datastore.entities.get`). It is not a role for regular user accounts, and it does not include Firestore write or delete permissions. The ownership and role checks in the Storage rules remain in place.

**Do not assume IAM setup is complete just because a `--non-interactive` deploy in CI succeeded.** The host administrator must do the initial setup via an interactive deploy or the IAM console, and confirm the role on the service account above.

Even when the size limit is met, as with a 2 MB ZIP, uploads to `memiBoardPosts/{postId}/attachments/...` can fail with `storage/unauthorized` without this permission. Even if the new post document doesn't exist yet, the `firestore.exists()` lookup itself requires the permission. Body image uploads in 0.45.1 need the same Firestore read permission.

Official references: [Managing permissions for cross-service Storage Rules](https://firebase.google.com/docs/rules/manage-deploy#manage_permissions_for_cross-service_cloud_storage_security_rules), [Permissions included in the role](https://docs.cloud.google.com/iam/docs/roles-permissions/firebaserules#firebaserules.firestoreServiceAgent).

## 6. Sign-in provider setup

### Google

Just enable Google in Firebase console → Authentication → Sign-in method. No further setup.

### Apple

This takes more work than Google:

1. Enable Apple sign-in in the Firebase console.
2. Create a new **Services ID** in your [Apple Developer](https://developer.apple.com/account) account.
3. Register the callback domain in that Services ID's "Web Authentication Configuration" — under Domains, `{authDomain}` (the Firebase project's authDomain, usually `<project-id>.firebaseapp.com`); under Return URL, `https://{authDomain}/__/auth/handler`.
4. Create a new "Sign in with Apple" key under **Keys** in Apple Developer (even if you already have keys for other purposes, you must create a separate new one).
5. Enter the Team ID, the Key ID of the key you just created, and its private key (the contents of the `.p8` file) in the Apple sign-in settings in the Firebase console.

For details, follow the [official Firebase guide](https://firebase.google.com/docs/auth/web/apple). Without this setup, clicking the Apple sign-in button results in an error.

## 7. Enable Firebase AI Logic (Gemini) for AI moderation

1. Enable it in Firebase console → **AI Logic**, and configure it to use the **Gemini Developer API**.
2. **Pricing plan**: it may work on Spark, but there may be limits and quotas. If they are insufficient, use Blaze.
3. Model: `gemini-3.5-flash-lite` is recommended for `memiBoard.moderation.model` in the host's `nuxt.config.ts`.
   `gemini-2.5-flash` may return a 404 with **"no longer available to new users" on new projects**.
4. `moderation.enabled` defaults to `true`, so once enabled it is called automatically when posts are written. To turn it off, set `enabled: false`.

## 8. App Check setup (effectively required when AI Logic is enforced)

If AI Logic / `firebaseml` is set to **Enforce**, the moderation API fails without an App Check token. memi-board does not initialize App Check. **That is the host app's responsibility.** The default uses limited-use tokens (`useLimitedUseAppCheckTokens: true`), which don't fit the reCAPTCHA v3 provider. For a plugin example, follow the [README App Check section](../README.md#app-check-effectively-required-with-ai-enforce).

1. Create a reCAPTCHA Enterprise **score-based** web key and register that site key for the web app in App Check in the Firebase console. The **appId** of the registered web app must match the host's `vuefire.config.appId`. Never put the secret key in the client.
2. Include the **Firebase App Check API** in the browser API key restrictions. Keep the APIs that are already allowed.
3. In an SPA, after `app:mounted`, create a token with `enterprise.execute` and exchange it via `exchangeRecaptchaEnterpriseToken` with `limited_use: true`. `ReCaptchaEnterpriseProvider` renders a hidden widget into an empty `document.body` before mounting and fails with `appCheck/recaptcha-error`.
4. **Local:** `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true` (prints a UUID to the console; register it under App Check → debug tokens) or a registered fixed UUID.
5. **Production:** never use debug tokens. Register the real host domain in the reCAPTCHA domains.
6. Enforce **only AI Logic**. Leave Cloud Storage and Cloud Firestore on monitoring. Only AI Logic accepts limited-use tokens. If you enforce Storage or Firestore, image uploads and post writes are rejected.

## 9. Firestore composite indexes

`memiBoardPosts`/`memiBoardComments`/`memiBoardLikes` are all top-level flat collections, and board/post scoping is done with `where` equality filters on the `boardId`/`postId` fields. Merge [docs/firestore.indexes.json.example](firestore.indexes.json.example) into the host's `firestore.indexes.json`, then:

```bash
firebase deploy --only firestore:indexes
```

If a console error shows an index creation link, you can follow it too — the example file above is prepared in advance based on the queries the package actually runs. If you customized collection names (`memiBoard.postsCollection`, etc.), update the `collectionGroup` values to match.


## Safari: slow post navigation or delayed comments

On some macOS Safari and iPhone/iPad browser environments, Firestore reads and realtime updates can stall for about **30 seconds** while Chrome on macOS responds normally. Symptoms include a skeleton that stays visible after Previous/Next navigation, delayed comments, and late like/report state updates. Sequential reads can make the visible delay approach a minute. Both `getDocs()` and `onSnapshot()` can be affected; switching from VueFire to direct Firebase calls does not necessarily avoid it.

If you reproduce this pattern, **the host app may need to force Firestore long polling for the affected browsers**. memi-board uses the host's Firestore instance and does not change its transport automatically. Updating memi-board alone does not enable this setting.

### Evidence and limits

In local testing on 2026-10-30 with Firebase JS SDK 12.19.0, VueFire 3.2.3, and nuxt-vuefire 1.1.2:

- Mac Safari reported post/comment reads and auxiliary subscriptions completing after roughly 29.9–30.2 seconds. Omitting like/report subscriptions still left a post lookup stalled for 30.1 seconds.
- With all subscriptions enabled and forced long polling, five round trips between the same two posts did not reproduce the 30-second stalls. Initial server reads took roughly 0.1–0.7 seconds; later subscription callbacks could use cached data.
- The tester also confirmed improvement on iPhone Safari. This is evidence for a transport compatibility problem in the tested environments, not a guarantee for every Safari version or every loading failure.

Related reports and API details: [Firebase JS SDK issue #9789](https://github.com/firebase/firebase-js-sdk/issues/9789), [WebKit streaming regression #322545](https://bugs.webkit.org/show_bug.cgi?id=322545), and [FirestoreSettings](https://firebase.google.com/docs/reference/js/firestore.firestoresettings). A WebKit source fix does not by itself establish which installed Safari versions include it. Recheck the actual devices before removing a host workaround.

### Nuxt / VueFire host configuration

Create the following **client-only host plugin**, or merge the settings into the host's existing early Firestore initialization. It must run **before any `getFirestore()`, `useFirestore()`, Firestore read, or subscription**. Do not put it in a page's `onMounted()` hook. The early order also precedes the standard nuxt-vuefire app plugin; if your host has an earlier custom Firebase plugin, coordinate its initialization instead of initializing Firestore twice with different settings.

```ts
// app/plugins/00.firestore-transport.client.ts
import { initializeApp, type FirebaseOptions } from 'firebase/app'
import { initializeFirestore } from 'firebase/firestore'

export default defineNuxtPlugin({
  name: 'host-firestore-transport',
  order: -100,
  setup() {
    const ua = navigator.userAgent
    const isIOSOrIPadOS = /iPad|iPhone|iPod/.test(ua)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    const isSafari = /Safari/i.test(ua)
      && !/Chrome|Chromium|CriOS|Edg|OPR|FxiOS|Android/i.test(ua)
    if (!isIOSOrIPadOS && !isSafari) return

    // Reuse exactly the same web app config as nuxt-vuefire.
    const { config } = useRuntimeConfig().public.vuefire as {
      config: FirebaseOptions
    }
    const app = initializeApp(config)
    initializeFirestore(app, {
      experimentalAutoDetectLongPolling: false,
      experimentalForceLongPolling: true,
    })
  },
})
```

This example targets Safari and iOS/iPadOS browser user agents, including desktop-style iPad user agents. Browser detection is a heuristic: adapt it to the devices and engines your service actually supports. The code assumes the default Firebase app/database used by the host's standard nuxt-vuefire setup; named apps or databases must initialize their matching instance instead. Keep it client-only so it does not change the server's Admin SDK configuration.

Automatic long-polling detection is already enabled by default in recent Firebase JS SDKs; explicitly setting `experimentalAutoDetectLongPolling: true` alone is not the same experiment. The example disables auto-detection and forces long polling. Firestore documents a possible performance cost, so compare on the affected devices and avoid enabling it for every browser without evidence. Realtime subscriptions continue to work; there is no need to remove comments or likes subscriptions to use this transport.

### Verify the change

1. Before changing transport, measure slug-to-ID lookup, post metadata/body readiness, initial comment reads, and first realtime callbacks separately. Distinguish cached callbacks from server reads.
2. Apply the host plugin and fully reload the page. Transport settings cannot be switched on an already-running Firestore instance using hot reload alone.
3. On both Mac and iPhone Safari, navigate Previous/Next repeatedly through the same posts and additional uncached posts. Compare server-read timings against the default configuration.
4. Use another browser to add a comment and toggle a like, then check that Safari receives the updates. Also check reconnecting after backgrounding and restoring the app.
5. If long polling does not improve the result, investigate authentication/App Check readiness, offline state, permissions, missing indexes, and application errors separately. A loading skeleton is not proof of this specific transport issue.

No Firebase rule or index deployment is needed for this transport setting. Deploy the plugin with the **host app**, then have existing tabs reload. Temporary diagnostic panels and test switches are not part of the package.
