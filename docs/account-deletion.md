# Account deletion in a host application

`MemiBoardAccountDeletion` provides confirmation and progress UI. The host owns reauthentication, server processing, and Firebase Auth deletion. The package never deletes a shared host account just because a profile component is mounted.

Place this feature on a sign-in-protected, `noindex` `/board-account` page. Do not place it in a public profile or admin user directory. This flow deletes the **whole Firebase sign-in account**, including access to other host features sharing that identity. A host offering board-only withdrawal needs a separate flow and matching explanations.

```vue
<MemiBoardAccountDeletion
  :state="deletionState"
  :processed="processedItems"
  :error="deletionError"
  :is-owner="role === 'owner'"
  :account-label="user.email"
  :locked-policy="previouslyConfirmedPolicy"
  @confirm="({ deleteContent }) => deleteOwnAccount({ deleteContent })"
/>
```

`state` is `idle`, `authenticating`, `working`, or `error`. `processed` is a monotonically increasing work count, not an estimated percentage or a total. `lockedPolicy` is `null` before starting and the previously confirmed boolean when resuming. Opening the dialog performs no deletion. The confirm action requires an acknowledgement and exact `DELETE` input; controls and dismissal are disabled while processing. The host must also reject duplicate calls.

## User-selected content handling

- **Unchecked, by default:** keep posts, comments, and content files; remove author names, photos, account links, reply-target names, and file ownership metadata. Information the user wrote into retained content can remain, and the dialog explains this.
- **Checked:** delete the user's posts, body documents, comments, and uploaded files. Deleting a post also removes other people's comments and files beneath it; disclose this in the confirmation. On other people's posts, retain content-free anonymous placeholders only where needed to preserve their reply threads, and remove translated copies and images from those placeholders.
- In either mode, remove profile/email/provider information, avatar files, private memos, likes, reporter details, and board assignments. Update affected like/comment/reply counters atomically with deletions. Scrub author/moderator/creator references. Host-specific and legacy account data require an explicit host cleanup stage.

## Required server safeguards

1. Reauthenticate with the current sign-in provider. The server must verify the ID token with revocation checking, require a recent `auth_time`, reject anonymous users, and derive the deletion UID from that verified token. A client-supplied UID or `isOwner` prop is not authorization.
2. Reject owners on the server before changing any data. Ownership must be transferred through a trusted process first.
3. Save a private server job and a protected `deletionPending` marker before removing data. Freeze the content policy after confirmation. Do not allow clients to read or write job checkpoints or secrets.
4. Process one bounded stage per request, using limited queries and transaction/batch sizes comfortably below 500 writes. Bound Storage listing and deletion concurrency too. Account size must not result in an unbounded `Promise.all` or a single giant client batch.
5. Commit Firestore changes and their progress checkpoint together. Decrement counters in the same transaction that removes their corresponding records. Storage deletion must ignore only missing files; other errors must stop the stage, preserve progress, and allow retry.
6. Use a server lease to serialize duplicate requests. Check that lease again when committing a checkpoint. Bind any continuation key to one preconfirmed job, hash it server-side, expire it, and keep it out of URLs and logs. A continuation may only finish the scope already confirmed; it must not change the target or policy.
7. Delete Firebase Auth **last**, after all required data/file stages succeed. Treat `auth/user-not-found` as success when retrying this final stage. A scoped continuation permits finalizing a lost response even after the user is signed out. Without it, the host can strand a cleanup job by requiring an account it has just deleted.
8. Show loading and processed counts; protect against accidental navigation. Keep a browser-session continuation for refresh/retry. On a signed-out continuation page, render no private profile or email data and still verify the continuation server-side.

The memi-dev reference implementation uses 100-record pages, at most 201 Firestore writes per main step, an additional approximate 2 MiB payload budget, Storage concurrency of five, a 90-second request lease, and a 24-hour continuation key. Large legacy subtrees use Admin SDK `recursiveDelete`/BulkWriter. It retains no names or emails in job records.

## Rules and activation

Merge the deletion protections in the current [Firestore rules](firestore.rules.example) and [Storage rules](storage.rules.example) into the host's actual rules. They block writes by pending/deleted members and new content beneath posts/comments currently being removed. The Storage check shares the existing user-document lookup to remain within the two-document read budget.

A minimal `memiBoardUsers/{uid}` document containing only `deletionPending: true` remains after profile erasure. It contains no profile or contact fields. This marker blocks still-valid cached tokens and automatic profile recreation. Public profile/directory components omit these records. Removing this marker immediately would reopen that race until old tokens expire. Do not let clients remove it.

The host server job collection `memiBoardAccountDeletionJobs` is server-only. Collection names and Storage prefixes must match the host's configured board collections. Do not use a request body or a document's arbitrary download URL as an unrestricted Storage deletion path.

In memi-dev, actual deletion is **disabled until deployment** through `runtimeConfig.boardAccountDeletionEnabled`. Deploy the reviewed Firestore/Storage rules, verify server Admin credentials and bucket configuration, then set `NUXT_BOARD_ACCOUNT_DELETION_ENABLED=true`. Keep it disabled if those prerequisites have not been verified. Installing/building the package does not deploy rules or activate the endpoint.

## Verification

Run against a dedicated `demo-...` emulator project, never production accounts. Cover more than 500 posts/comments/likes/files, retention and full-content modes, owner rejection, expired/incorrect continuation keys, cached-token write attempts, duplicate requests, Storage failures, Auth response loss, and preservation of unrelated users' data. Test the exact host rules used for deployment and the UI acknowledgement/confirmation gate.

The memi-dev regression command is:

```sh
firebase emulators:exec --config firebase.account-deletion-tests.json \
  --only firestore,auth,storage --project demo-memi-account-deletion \
  'node --experimental-strip-types scripts/test-account-deletion.mjs'
```
