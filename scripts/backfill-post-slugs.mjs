/**
 * Run from a host with firebase-admin installed (or set MEMI_ADMIN_ROOT to that host).
 * Dry-run by default; --apply reserves all existing URLs, including private drafts.
 * Deploy reservation rules first, run this script, then update the client package.
 * Old auto-ID clients remain compatible except during the initial backfill scan.
 * Uses ADC. Set GCLOUD_PROJECT explicitly. Custom collections: MEMI_POSTS_COLLECTION.
 */
import { createRequire } from 'node:module'
const require = createRequire(`${process.env.MEMI_ADMIN_ROOT || process.cwd()}/package.json`)
const { initializeApp, applicationDefault } = require('firebase-admin/app')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const projectId = process.env.GCLOUD_PROJECT
if (!projectId) throw new Error('Set GCLOUD_PROJECT explicitly')
initializeApp({ projectId, ...(process.env.FIRESTORE_EMULATOR_HOST ? {} : { credential: applicationDefault() }) })
const db = getFirestore()
const apply = process.argv.includes('--apply')
const postsCollection = process.env.MEMI_POSTS_COLLECTION || 'memiBoardPosts'
const reservations = db.collection(`${postsCollection}Slugs`)
const marker = reservations.doc('__migration')
// Do not interrupt a completed migration. Reservations are permanent; this is safe to rerun.
const ready = (await marker.get()).get('ready') === true
if (apply && !ready) await marker.set({ ready: false, startedAt: FieldValue.serverTimestamp() })
const posts = await db.collection(postsCollection).select('boardId', 'slug').get()
const seen = new Map()
for (const post of posts.docs) {
  const { boardId, slug } = post.data()
  if (typeof boardId !== 'string' || !boardId || typeof slug !== 'string' || !slug || boardId.includes('/') || slug.includes('/')) {
    throw new Error(`Invalid legacy URL on ${post.id}; fix it before enabling new URLs`)
  }
  const ref = reservations.doc(boardId).collection('slugs').doc(slug)
  if (seen.has(ref.path)) throw new Error(`Duplicate legacy URL: ${post.id} and ${seen.get(ref.path)}`)
  seen.set(ref.path, post.id)
  const existing = await ref.get()
  if (existing.exists && existing.get('postId') !== post.id) throw new Error(`Reservation conflict on ${post.id}`)
  if (apply && !existing.exists) await ref.create({ postId: post.id })
}
if (apply) await marker.set({ ready: true, completedAt: FieldValue.serverTimestamp() })
console.log(JSON.stringify({ projectId, apply, posts: posts.size, alreadyReady: ready }))
