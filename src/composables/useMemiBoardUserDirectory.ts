import { computed, onScopeDispose, ref, shallowRef, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { deleteField, documentId, getDocs, limit, orderBy, query, serverTimestamp, startAfter, updateDoc, where } from 'firebase/firestore'
import type { DocumentData, QueryConstraint, QueryDocumentSnapshot } from 'firebase/firestore'
import { deleteObject, getStorage, ref as storageRef } from 'firebase/storage'
import { useFirebaseApp, useFirestore } from 'vuefire'
import { useBoardPathConfig } from '../config'
import { boardUserDoc, boardUsersCol } from '../utils/boardPaths'
import { readUserDirectoryPage, USER_DIRECTORY_DATE_FIELDS, isUserDirectoryDateSort } from '../utils/userDirectoryPage'
import type { UserDirectoryCursor, UserDirectoryDirection, UserDirectorySort } from '../utils/userDirectoryPage'
import type { BoardUserModel, BoardUserRole } from '../types'
import { BOARD_USER_ROLES } from './useMemiBoardUsers'
import { AI_USAGE_FIELDS } from '../utils/aiUsage'
import { useMemiBoardI18n } from '../i18n/useMemiBoardI18n'

type Cursor = UserDirectoryCursor<QueryDocumentSnapshot<DocumentData>>

/** Bounded, cursor-based directory. Assignment pickers keep useMemiBoardUsers. */
export function useMemiBoardUserDirectory(options: { enabled?: MaybeRefOrGetter<boolean> } = {}) {
  const db = useFirestore()
  const app = useFirebaseApp()
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
            : [orderBy(isUserDirectoryDateSort(selectedSort) ? USER_DIRECTORY_DATE_FIELDS[selectedSort] : 'displayName', selectedDirection), orderBy(documentId(), selectedDirection)]
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

  /** 관리자: 사용자의 AI 글쓰기·그림 사용 횟수를 모두 지운다(카운터 필드 6개 삭제). */
  async function resetUserAiUsage(uid: string) {
    const cleared = Object.fromEntries(
      Object.values(AI_USAGE_FIELDS).flatMap(fields => Object.values(fields)).map(name => [name, deleteField()]),
    )
    await updateDoc(boardUserDoc(db, useBoardPathConfig(), uid), { ...cleared, updatedAt: serverTimestamp() })
    await refresh()
  }

  /**
   * 관리자: 부적절한 프로필 사진 또는 자기소개를 지운다. 사진은 문서의 photoURL 을 비우고
   * 저장소의 avatar.jpg 도 지워서, 글·댓글에 남아 있는 예전 사진 주소도 더는 열리지 않게 한다.
   */
  async function clearUserProfile(uid: string, fields: { photo?: boolean, bio?: boolean }) {
    const patch: Record<string, unknown> = { updatedAt: serverTimestamp() }
    if (fields.photo) patch.photoURL = null
    if (fields.bio) patch.bio = null
    await updateDoc(boardUserDoc(db, useBoardPathConfig(), uid), patch)
    if (fields.photo) {
      try {
        await deleteObject(storageRef(getStorage(app), `${useBoardPathConfig().usersCollection}/${uid}/avatar.jpg`))
      }
      catch (cause) {
        // 파일이 이미 없으면 그대로 둔다. 그 밖의 오류도 문서는 이미 비웠으니 목록만 새로 고친다.
        if ((cause as { code?: string }).code !== 'storage/object-not-found') console.warn('[memi-board] avatar delete failed', cause)
      }
    }
    await refresh()
  }

  /** 관리자: 사용자의 콘텐츠 경고 횟수와 마지막 경고 시각을 지운다. 글·댓글 작성 차단도 함께 풀린다. */
  async function resetUserWarnings(uid: string) {
    await updateDoc(boardUserDoc(db, useBoardPathConfig(), uid), {
      moderationBlockCount: deleteField(),
      moderationBlockAt: deleteField(),
      updatedAt: serverTimestamp(),
    })
    await refresh()
  }

  watch([enabled, sort, direction, size, collectionName], reset, { immediate: true, flush: 'sync' })
  onScopeDispose(() => { disposed = true; generation++ })
  return { users, usersPending: pending, loadError: error, sort, direction, pageSize, page, hasNext, nextPage, previousPage, refresh, updateUserRole, resetUserAiUsage, resetUserWarnings, clearUserProfile }
}
