import { computed } from 'vue'
import { useCollection, useFirestore } from 'vuefire'
import {
  deleteDoc,
  getDocs,
  limit as fbLimit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  where,
  writeBatch,
} from 'firebase/firestore'
import type { QueryDocumentSnapshot } from 'firebase/firestore'
import { useBoardPathConfig } from '../config'
import {
  postsCol,
  settingsCol,
  settingsDoc,
  boardSsrKey,
} from '../utils/boardPaths'
import { useMemiBoardAuth } from './useMemiBoardAuth'
import { slugify } from '../utils/slugify'
import type { BoardModel, BoardVisibility } from '../types'

/** 필요할 때 호스트가 명시적으로 시드할 수 있는 예시 보드. 자동 적용하지 않는다. */
export const DEFAULT_BOARDS: BoardModel[] = [
  { id: 'free', label: '자유', listView: 'default', writeRole: 'user', commentWriteRole: 'user', visibility: 'public', order: 0 },
  { id: 'notice', label: '공지', listView: 'default', writeRole: 'admin', commentWriteRole: 'user', visibility: 'public', order: 1 },
  { id: 'question', label: '질문', listView: 'default', writeRole: 'user', commentWriteRole: 'user', visibility: 'public', order: 2 },
]

/** @deprecated DEFAULT_BOARDS */
export const DEFAULT_CATEGORIES = DEFAULT_BOARDS

function normalizeVisibility(value: unknown): BoardVisibility {
  return value === 'hidden' ? 'hidden' : 'public'
}

function mapBoardDoc(id: string, data: Record<string, unknown>, index: number): BoardModel {
  return {
    id,
    label: typeof data.label === 'string' && data.label.trim() ? data.label.trim() : id,
    order: typeof data.order === 'number' ? data.order : index,
    description: (typeof data.description === 'string' ? data.description : '') || '',
    visibility: normalizeVisibility(data.visibility),
    listView: (data.listView as BoardModel['listView']) ?? 'default',
    writeRole: (data.writeRole as BoardModel['writeRole']) ?? 'user',
    commentWriteRole: (data.commentWriteRole as BoardModel['commentWriteRole']) ?? 'user',
    allowedStaffUids: Array.isArray(data.allowedStaffUids) ? data.allowedStaffUids as string[] : [],
  }
}

/**
 * 보드 목록·설정.
 * memiBoardSettings/{boardId} 하나가 목록 렌더링과 권한 검사를 모두 겸한다
 * (구버전은 부모 문서 + settings/config 이중 문서였다).
 */
export function useMemiBoardSettings() {
  const cfg = () => useBoardPathConfig()
  const db = useFirestore()
  const { isSignedIn } = useMemiBoardAuth()

  const boardsQuery = computed(() => query(settingsCol(db, cfg()), orderBy('order', 'asc')))
  const { data: boardDocs, pending: settingsPending } = useCollection(boardsQuery, {
    ssrKey: boardSsrKey(cfg(), 'boards'),
  })

  const boards = computed<BoardModel[]>(() =>
    boardDocs.value.map((item, index) =>
      mapBoardDoc(item.id, item as unknown as Record<string, unknown>, index),
    ),
  )

  /** @deprecated boards — 카테고리 개념 제거 */
  const categories = boards

  const publicBoards = computed(() =>
    boards.value.filter(board => board.visibility !== 'hidden'),
  )
  /** @deprecated publicBoards */
  const publicCategories = publicBoards

  function boardLabel(id: string | undefined): string | undefined {
    if (!id) return undefined
    return boards.value.find(board => board.id === id)?.label ?? id
  }
  /** @deprecated boardLabel */
  const categoryLabel = boardLabel

  function boardDescription(id: string | undefined): string | undefined {
    if (!id) return undefined
    const value = boards.value.find(board => board.id === id)?.description?.trim()
    return value || undefined
  }
  /** @deprecated boardDescription */
  const categoryDescription = boardDescription

  function boardVisibility(id: string | undefined): BoardVisibility {
    if (!id) return 'public'
    return boards.value.find(board => board.id === id)?.visibility ?? 'public'
  }
  /** @deprecated boardVisibility */
  const categoryVisibility = boardVisibility

  function isBoardHidden(id: string | undefined): boolean {
    return boardVisibility(id) === 'hidden'
  }
  /** @deprecated isBoardHidden */
  const isCategoryHidden = isBoardHidden

  function getBoard(id: string | undefined): BoardModel | undefined {
    if (!id) return undefined
    return boards.value.find(board => board.id === id)
  }

  /** 숨김 전환 시 해당 보드 글 listed 일괄 맞춤 */
  async function syncPostsListedForBoard(boardId: string, listed: boolean): Promise<void> {
    let cursor: QueryDocumentSnapshot | undefined
    for (;;) {
      const page = await getDocs(query(
        postsCol(db, cfg()),
        where('boardId', '==', boardId),
        orderBy('__name__'),
        ...(cursor ? [startAfter(cursor)] : []),
        fbLimit(400),
      ))
      if (page.empty) break
      const batch = writeBatch(db)
      for (const item of page.docs) {
        batch.update(item.ref, { listed })
      }
      await batch.commit()
      cursor = page.docs[page.docs.length - 1]
      if (page.docs.length < 400) break
    }
  }

  function settingsPayload(board: BoardModel, order: number) {
    return {
      label: board.label.trim(),
      description: (board.description ?? '').trim(),
      visibility: normalizeVisibility(board.visibility),
      listView: board.listView ?? 'default',
      writeRole: board.writeRole ?? 'user',
      commentWriteRole: board.commentWriteRole ?? 'user',
      allowedStaffUids: board.allowedStaffUids ?? [],
      order,
      updatedAt: serverTimestamp(),
    }
  }

  async function saveBoard(board: BoardModel, order = board.order ?? 0): Promise<void> {
    if (!isSignedIn.value) throw new Error('로그인이 필요합니다.')
    const id = board.id.trim()
    const label = board.label.trim()
    if (!id || !label) throw new Error('보드 ID와 이름을 입력해 주세요.')
    const visibility = normalizeVisibility(board.visibility)
    const previous = boards.value.find(item => item.id === id)
    const previousVisibility = previous?.visibility ?? 'public'
    const payload = settingsPayload({ ...board, label, visibility }, order)
    await setDoc(settingsDoc(db, cfg(), id), payload, { merge: true })

    if (previousVisibility !== visibility || visibility === 'public') {
      await syncPostsListedForBoard(id, visibility !== 'hidden')
    }
  }

  /** @deprecated saveBoard */
  const saveCategory = saveBoard

  async function saveBoards(next: BoardModel[]): Promise<void> {
    if (!isSignedIn.value) throw new Error('로그인이 필요합니다.')
    const previousById = new Map(boards.value.map(item => [item.id, item.visibility ?? 'public']))
    const batch = writeBatch(db)
    const visibilityChanges: Array<{ id: string, listed: boolean }> = []
    next.forEach((board, order) => {
      const id = board.id.trim()
      const label = board.label.trim()
      if (!id || !label) throw new Error('보드 ID와 이름을 입력해 주세요.')
      const visibility = normalizeVisibility(board.visibility)
      const payload = settingsPayload({ ...board, label, visibility }, order)
      batch.set(settingsDoc(db, cfg(), id), payload, { merge: true })
      const prev = previousById.get(id) ?? 'public'
      if (prev !== visibility) visibilityChanges.push({ id, listed: visibility !== 'hidden' })
    })
    await batch.commit()
    for (const change of visibilityChanges) {
      await syncPostsListedForBoard(change.id, change.listed)
    }
  }

  /** @deprecated saveBoards */
  const saveCategories = saveBoards

  async function deleteBoard(id: string): Promise<void> {
    if (!isSignedIn.value) throw new Error('로그인이 필요합니다.')
    // 설정 문서만 삭제 (posts 는 호스트/관리 작업으로 별도 정리)
    await deleteDoc(settingsDoc(db, cfg(), id))
  }

  /** @deprecated deleteBoard */
  const deleteCategory = deleteBoard

  async function ensureSettings(): Promise<void> {
    return Promise.resolve()
  }

  async function addBoard(label: string): Promise<string> {
    const trimmed = label.trim()
    if (!trimmed) throw new Error('보드 이름을 입력해 주세요.')
    if (!isSignedIn.value) throw new Error('로그인이 필요합니다.')
    const existing = boards.value.find(board => board.label === trimmed)
    if (existing) return existing.id

    const base = slugify(trimmed) || `board-${Date.now()}`
    let id = base
    let suffix = 2
    const used = new Set(boards.value.map(board => board.id))
    while (used.has(id)) id = `${base}-${suffix++}`
    await saveBoard({
      id,
      label: trimmed,
      visibility: 'public',
      listView: 'default',
      writeRole: 'user',
      commentWriteRole: 'user',
      order: boards.value.length,
    })
    return id
  }

  /** @deprecated addBoard */
  const addCategory = addBoard

  return {
    boards,
    publicBoards,
    boardLabel,
    boardDescription,
    boardVisibility,
    isBoardHidden,
    getBoard,
    categories,
    publicCategories,
    categoryLabel,
    categoryDescription,
    categoryVisibility,
    isCategoryHidden,
    settingsPending,
    ensureSettings,
    addBoard,
    addCategory,
    saveBoard,
    saveCategory,
    saveBoards,
    saveCategories,
    deleteBoard,
    deleteCategory,
    DEFAULT_BOARDS,
    DEFAULT_CATEGORIES,
  }
}
