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
