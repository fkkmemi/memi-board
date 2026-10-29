import { readonly, ref } from 'vue'
import { getAuth } from 'firebase/auth'
import { useFirebaseApp, useFirestore } from 'vuefire'
import { collection, doc, getDocsFromServer, getDocFromServer, runTransaction } from 'firebase/firestore'
import { deleteObject, getMetadata, getStorage, list, ref as storageRef } from 'firebase/storage'
import { useBoardPathConfig } from '../config'
import { useMemiBoardAuth } from './useMemiBoardAuth'
import { useMemiBoardI18n } from '../i18n/useMemiBoardI18n'
import { isCleanupDocumentPath, isOldOrphanFile, isOrphanRecord, parseCleanupFilePath, type OrphanItem } from '../utils/orphanCleanup'
import { storagePathFromDownloadUrl } from '../utils/storagePath'

/** Global admin maintenance; no reads or writes until an explicit action. */
export function useMemiBoardCleanup() {
  const db = useFirestore()
  const app = useFirebaseApp()
  const { isAdmin, rolePending } = useMemiBoardAuth()
  const { t } = useMemiBoardI18n()
  const items = ref<OrphanItem[]>([])
  const busy = ref(false)
  const scanned = ref(false)
  const error = ref('')
  const result = ref('')

  let plan: ReadonlyArray<Readonly<OrphanItem>> = []
  let planContext = ''
  const fileGenerations = new Map<string, string>()

  function contextKey() {
    const uid = getAuth(app).currentUser?.uid
    if (!uid) throw new Error(t('settings.noAccess'))
    return JSON.stringify([uid, useBoardPathConfig()])
  }

  function assertContext(expected: string) {
    assertAdmin()
    if (contextKey() !== expected) throw new Error(t('settings.cleanup.contextChanged'))
  }

  function assertAdmin() {
    if (!isAdmin.value || rolePending.value || !getAuth(app).currentUser) throw new Error(t('settings.noAccess'))
  }

  async function readState() {
    const cfg = useBoardPathConfig()
    const [posts, comments, likes] = await Promise.all([
      getDocsFromServer(collection(db, cfg.postsCollection)),
      getDocsFromServer(collection(db, cfg.commentsCollection)),
      getDocsFromServer(collection(db, cfg.likesCollection)),
    ])
    const referenced = new Set<string>()
    function collect(value: unknown): void {
      if (typeof value === 'string') {
        if (value.startsWith(`${cfg.postsCollection}/`)) referenced.add(value)
        const direct = storagePathFromDownloadUrl(value)
        if (direct) referenced.add(direct)
        for (const match of value.matchAll(/https?:\/\/[^\s"'<>]+/g)) {
          const path = storagePathFromDownloadUrl(match[0].replace(/&amp;/g, '&'))
          if (path) referenced.add(path)
        }
      }
      else if (Array.isArray(value)) value.forEach(collect)
      else if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) Object.values(value).forEach(collect)
    }
    posts.docs.forEach(item => collect(item.data()))
    comments.docs.forEach(item => collect(item.data()))
    // Include translated bodies and legacy cross-post image references.
    for (const post of posts.docs) {
      const bodies = await getDocsFromServer(collection(post.ref, 'body'))
      bodies.docs.forEach(item => collect(item.data()))
    }
    // A referenced original also keeps its generated thumbnail alive.
    for (const path of [...referenced]) {
      const match = path.match(/^(.*\/images\/)([^/]+)\.[^/.]+$/)
      if (match) referenced.add(`${match[1]}thumbnails/${match[2]}.jpg`)
    }
    return { cfg, posts: new Set(posts.docs.map(item => item.id)), comments: new Set(comments.docs.map(item => item.id)), commentDocs: comments.docs, likes: likes.docs, referenced }
  }

  async function scan() {
    if (busy.value) return
    busy.value = true
    scanned.value = false
    items.value = []
    plan = []
    planContext = ''
    fileGenerations.clear()
    error.value = ''
    result.value = ''
    try {
      assertAdmin()
      const scanContext = contextKey()
      const state = await readState()
      assertContext(scanContext)
      const found: OrphanItem[] = []
      for (const [kind, records] of [['comment', state.commentDocs], ['like', state.likes]] as const) {
        for (const item of records) {
          const data = item.data()
          if (isOrphanRecord(kind, data, state.posts, state.comments)) {
            found.push({ kind, path: item.ref.path, postId: data.postId, commentId: data.commentId })
          }
        }
      }
      const storage = getStorage(app)
      const folders = [storageRef(storage, state.cfg.postsCollection)]
      while (folders.length) {
        assertContext(scanContext)
        const folder = folders.pop()!
        let pageToken: string | undefined
        do {
          const page = await list(folder, { maxResults: 1000, pageToken })
          folders.push(...page.prefixes)
          for (const file of page.items) {
            const parsed = parseCleanupFilePath(file.fullPath, state.cfg.postsCollection)
            if (!parsed) continue
            const { postId, commentId } = parsed
            if (state.referenced.has(file.fullPath)) continue
            if (state.posts.has(postId) && !(commentId && !state.comments.has(commentId))) continue
            const meta = await getMetadata(file)
            if (!isOldOrphanFile(meta.updated, Date.now())) continue
            fileGenerations.set(file.fullPath, meta.generation)
            found.push({ kind: 'file', path: file.fullPath, postId, commentId, size: meta.size })
          }
          pageToken = page.nextPageToken
        } while (pageToken)
      }
      assertContext(scanContext)
      plan = found.map(item => Object.freeze({ ...item }))
      planContext = scanContext
      items.value = found
      scanned.value = true
    }
    catch (cause) {
      error.value = `${t('settings.cleanup.failed')} ${cause instanceof Error ? cause.message : String(cause)}`
    }
    finally { busy.value = false }
  }

  async function remove(selectedPaths: string[]) {
    if (busy.value || !scanned.value) return
    busy.value = true
    error.value = ''
    result.value = ''
    let deleted = 0
    let skipped = 0
    let failed = 0
    try {
      assertContext(planContext)
      const state = await readState()
      assertContext(planContext)
      const selected = new Set(selectedPaths)
      const pendingPaths = new Set(items.value.map(item => item.path))
      for (const item of plan) {
        if (!selected.has(item.path) || !pendingPaths.has(item.path)) continue
        assertContext(planContext)
        try {
          let removed = false
          if (item.kind === 'file') {
            if (!parseCleanupFilePath(item.path, state.cfg.postsCollection)) throw new Error('Invalid cleanup path')
            const storage = getStorage(app)
            const file = storageRef(storage, item.path)
            const [parent, comment, meta] = await Promise.all([
              getDocFromServer(doc(db, state.cfg.postsCollection, item.postId)),
              item.commentId ? getDocFromServer(doc(db, state.cfg.commentsCollection, item.commentId)) : null,
              getMetadata(file),
            ])
            assertContext(planContext)
            if (meta.generation === fileGenerations.get(item.path) && !state.referenced.has(item.path) && isOldOrphanFile(meta.updated, Date.now())
              && (!parent.exists() || (item.commentId && !comment?.exists()))) {
              await deleteObject(file)
              removed = true
            }
          }
          else {
            const kind = item.kind
            if (!isCleanupDocumentPath(item.path, kind, state.cfg)) throw new Error('Invalid cleanup path')
            removed = await runTransaction(db, async (tx) => {
              const current = await tx.get(doc(db, item.path))
              if (!current.exists()) return true
              const data = current.data()
              if (typeof data.postId !== 'string' || !data.postId || data.postId.includes('/')) return false
              const parent = await tx.get(doc(db, state.cfg.postsCollection, data.postId))
              const comment = item.kind === 'like' && data.target === 'comment'
                && typeof data.commentId === 'string' && data.commentId && !data.commentId.includes('/')
                ? await tx.get(doc(db, state.cfg.commentsCollection, data.commentId)) : null
              if (isOrphanRecord(kind, data, new Set(parent.exists() ? [data.postId] : []), new Set(comment?.exists() ? [data.commentId] : []))) {
                assertContext(planContext)
                tx.delete(current.ref)
                return true
              }
              return false
            })
          }
          if (removed) deleted++
          else skipped++
          items.value = items.value.filter(candidate => candidate.path !== item.path)
        }
        catch { failed++ }
      }
      result.value = t('settings.cleanup.result', { deleted, skipped, failed })
    }
    catch (cause) { error.value = `${t('settings.cleanup.failed')} ${cause instanceof Error ? cause.message : String(cause)}` }
    finally { busy.value = false }
  }

  return { items: readonly(items), busy: readonly(busy), scanned: readonly(scanned), error: readonly(error), result: readonly(result), scan, remove }
}
