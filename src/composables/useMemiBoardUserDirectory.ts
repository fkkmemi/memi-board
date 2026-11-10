import { computed, onScopeDispose, ref, shallowRef, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { documentId, getDocs, limit, orderBy, query, serverTimestamp, startAfter, updateDoc, where } from 'firebase/firestore'
import type { DocumentData, QueryConstraint, QueryDocumentSnapshot } from 'firebase/firestore'
import { useFirestore } from 'vuefire'
import { useBoardPathConfig } from '../config'
import { boardUserDoc, boardUsersCol } from '../utils/boardPaths'
import { readUserDirectoryPage } from '../utils/userDirectoryPage'
import type { UserDirectoryCursor, UserDirectoryDirection, UserDirectorySort } from '../utils/userDirectoryPage'
import type { BoardUserModel, BoardUserRole } from '../types'
import { BOARD_USER_ROLES } from './useMemiBoardUsers'
import { useMemiBoardI18n } from '../i18n/useMemiBoardI18n'

type Cursor = UserDirectoryCursor<QueryDocumentSnapshot<DocumentData>>

/** Bounded, cursor-based directory. Assignment pickers keep useMemiBoardUsers. */
export function useMemiBoardUserDirectory(options: { enabled?: MaybeRefOrGetter<boolean> } = {}) {
  const db = useFirestore()
  const { t } = useMemiBoardI18n()
  const sort = ref<UserDirectorySort>('role')
  const direction = ref<UserDirectoryDirection>('asc')
  const pageSize = ref(25)
  const page = ref(1)
  const users = shallowRef<BoardUserModel[]>([])
  const pending = ref(false)
  const error = ref('')
  const hasNext = ref(false)
  const enabled = computed(() => toValue(options.enabled) ?? true)
  const size = computed(() => [10, 25, 50].includes(pageSize.value) ? pageSize.value : 25)
  const collectionName = computed(() => useBoardPathConfig().usersCollection)
  let starts: Array<Cursor | null> = [null]
  let nextCursor: Cursor | null = null
  let generation = 0
  let disposed = false

  async function load(target: number, cursor: Cursor | null) {
    if (disposed || !enabled.value) return
    const request = ++generation
    pending.value = true
    error.value = ''
    const selectedSort = sort.value
    const selectedDirection = direction.value
    const col = boardUsersCol(db, useBoardPathConfig())
    try {
      const result = await readUserDirectoryPage({
        sort: selectedSort, direction: selectedDirection, pageSize: size.value, cursor,
        readBatch: async (role, after, count) => {
          const constraints: QueryConstraint[] = selectedSort === 'role'
            ? [where('role', '==', role), orderBy(documentId(), selectedDirection)]
            : [orderBy('displayName', selectedDirection), orderBy(documentId(), selectedDirection)]
          if (after) constraints.push(startAfter(after))
          const snapshot = await getDocs(query(col, ...constraints, limit(count)))
          return snapshot.docs
        },
      })
      if (request !== generation) return
      users.value = result.documents.filter(item => !item.data().deletionPending).map(item => ({ ...item.data(), id: item.id }) as BoardUserModel)
      page.value = target
      starts[target - 1] = cursor
      starts.length = target
      nextCursor = result.cursor
      hasNext.value = result.hasNext
    }
    catch (cause) {
      if (request === generation) error.value = cause instanceof Error ? cause.message : String(cause)
    }
    finally {
      if (request === generation) pending.value = false
    }
  }

  function reset() {
    generation++
    users.value = []
    page.value = 1
    starts = [null]
    nextCursor = null
    hasNext.value = false
    error.value = ''
    pending.value = false
    if (enabled.value) void load(1, null)
  }
  function nextPage() {
    if (enabled.value && !pending.value && hasNext.value) void load(page.value + 1, nextCursor)
  }
  function previousPage() {
    if (enabled.value && !pending.value && page.value > 1) void load(page.value - 1, starts[page.value - 2] ?? null)
  }
  function refresh() {
    if (enabled.value) return load(page.value, starts[page.value - 1] ?? null)
  }
  async function updateUserRole(uid: string, role: BoardUserRole) {
    if (!BOARD_USER_ROLES.some(item => item.value === role)) throw new Error(t('boardUsers.unsupportedRole'))
    await updateDoc(boardUserDoc(db, useBoardPathConfig(), uid), { role, updatedAt: serverTimestamp() })
    await refresh()
  }

  watch([enabled, sort, direction, size, collectionName], reset, { immediate: true, flush: 'sync' })
  onScopeDispose(() => { disposed = true; generation++ })
  return { users, usersPending: pending, loadError: error, sort, direction, pageSize, page, hasNext, nextPage, previousPage, refresh, updateUserRole }
}
