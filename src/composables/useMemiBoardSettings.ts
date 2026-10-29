import { computed } from 'vue'
import { useCollection, useFirebaseApp, useFirestore } from 'vuefire'
import { getStorage } from 'firebase/storage'
import {
  deleteDoc,
  getDocs,
  limit as fbLimit,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import { isMemiBoardTranslationEnabled, useBoardPathConfig } from '../config'
import {
  postsCol,
  settingsCol,
  settingsDoc,
  boardSsrKey,
} from '../utils/boardPaths'
import { useMemiBoardAuth } from './useMemiBoardAuth'
import { registerBoardLookup } from './boardLookup'
import { canManageBoardByRole } from '../utils/boardAccess'
import { slugify } from '../utils/slugify'
import { deletePostCascade } from '../utils/deletePostCascade'
import { saveBoardWithVisibility } from '../utils/saveBoardVisibility'
import { normalizeMemiBoardLocale } from '../i18n/locales'
import { useMemiBoardI18n } from '../i18n/useMemiBoardI18n'
import type { BoardModel, BoardVisibility } from '../types'
import {
  boardCopyIsTranslated,
  boardTranslationLocales,
  coversLocales,
  displayStoredField,
  mergeSourceFields,
  readI18nSource,
  readLocalizedFields,
  readTranslationLocales,
} from '../utils/localizedFields'
import { useMemiBoardAutoTranslate } from './useMemiBoardAutoTranslate'

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
    visibilityTransition: data.visibilityTransition === 'hidden' || data.visibilityTransition === 'public'
      ? data.visibilityTransition : undefined,
    listView: (data.listView as BoardModel['listView']) ?? 'default',
    editorType: (data.editorType as BoardModel['editorType'])
      ?? (data.listView === 'image' ? 'image' : 'default'),
    writeRole: (data.writeRole as BoardModel['writeRole']) ?? 'user',
    commentWriteRole: (data.commentWriteRole as BoardModel['commentWriteRole']) ?? 'user',
    allowedStaffUids: Array.isArray(data.allowedStaffUids) ? data.allowedStaffUids as string[] : [],
    allowedManagerUids: Array.isArray(data.allowedManagerUids) ? data.allowedManagerUids as string[] : [],
    locale: normalizeMemiBoardLocale(data.locale) ?? '',
    autoTranslate: data.autoTranslate === true,
    autoTranslatePosts: data.autoTranslatePosts === true,
    translationLocales: readTranslationLocales(data.translationLocales),
    i18n: readLocalizedFields(data.i18n),
    i18nSource: readI18nSource(data.i18nSource),
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
  const app = useFirebaseApp()
  const { isSignedIn, isAdmin, isStaff, user } = useMemiBoardAuth()
  const { t, locale } = useMemiBoardI18n()
  const { translateEntries } = useMemiBoardAutoTranslate()

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

  function boardLabel(id: string | undefined, localeOverride?: string | null): string | undefined {
    if (!id) return undefined
    const board = boards.value.find(item => item.id === id)
    if (!board) return id
    return displayStoredField(board.i18n, board.i18nSource, 'label', board.label, localeOverride ?? locale.value) || board.label
  }
  /** @deprecated boardLabel */
  const categoryLabel = boardLabel

  function boardDescription(id: string | undefined, localeOverride?: string | null): string | undefined {
    if (!id) return undefined
    const board = boards.value.find(item => item.id === id)
    const value = board?.description?.trim()
    if (!board || !value) return undefined
    return displayStoredField(board.i18n, board.i18nSource, 'description', value, localeOverride ?? locale.value) || undefined
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

  registerBoardLookup(id => getBoard(id))

  function canManageBoard(boardId: string | undefined | null) {
    return canManageBoardByRole(user.value?.uid, isAdmin.value, isStaff.value, boardId ? getBoard(boardId) : undefined)
  }

  const managedBoards = computed(() => boards.value.filter(board => canManageBoard(board.id)))

  function settingsPayload(board: BoardModel, order: number) {
    return {
      label: board.label.trim(),
      description: (board.description ?? '').trim(),
      visibility: normalizeVisibility(board.visibility),
      listView: board.listView ?? 'default',
      editorType: board.editorType ?? (board.listView === 'image' ? 'image' : 'default'),
      writeRole: board.writeRole ?? 'user',
      commentWriteRole: board.commentWriteRole ?? 'user',
      allowedStaffUids: board.allowedStaffUids ?? [],
      allowedManagerUids: board.allowedManagerUids ?? [],
      locale: normalizeMemiBoardLocale(board.locale) ?? '',
      autoTranslate: board.autoTranslate === true,
      autoTranslatePosts: board.autoTranslatePosts === true,
      // 빈 배열 = 지원 언어 전체. 전체로 되돌릴 때도 이전 목록을 지우도록 항상 쓴다.
      translationLocales: readTranslationLocales(board.translationLocales),
      ...(board.i18n ? { i18n: board.i18n } : {}),
      ...(board.i18nSource ? { i18nSource: board.i18nSource } : {}),
      order,
      updatedAt: serverTimestamp(),
    }
  }

  /**
   * 이름·설명이 바뀌었거나 번역 언어가 늘었으면 보드의 번역 언어로 번역해 붙인다.
   * 문구가 같으면 기존 번역을 그대로 둔다. 저장은 호출한 쪽이 한다.
   */
  async function translateBoard(board: BoardModel): Promise<BoardModel> {
    if (!isMemiBoardTranslationEnabled()) return board
    const label = board.label.trim()
    const description = (board.description ?? '').trim()
    if (!label) return board
    if (boardCopyIsTranslated({ ...board, label, description })) return { ...board, label, description }

    const source = locale.value
    const targets = boardTranslationLocales(board)
    const fields: Record<string, string> = { label }
    if (description) fields.description = description
    const translated = await translateEntries([{
      id: board.id || 'board',
      fields,
      context: board.id,
    }], {
      source,
      targets,
      purpose: 'board name and short description shown in navigation and page headers',
    })
    const i18n = mergeSourceFields(source, fields, translated[board.id || 'board'])
    if (!coversLocales(i18n, Object.keys(fields), [...targets, source])) {
      throw new Error(t('settings.autoTranslate.failed', { count: targets.length }))
    }
    return {
      ...board,
      label,
      description,
      i18n,
      i18nSource: { locale: source, label, description },
    }
  }

  async function saveBoard(board: BoardModel, order = board.order ?? 0): Promise<void> {
    if (!isSignedIn.value) throw new Error(t('boardSettings.signInRequired'))
    const id = board.id.trim()
    const label = board.label.trim()
    if (!id || !label) throw new Error(t('boardSettings.idAndNameRequired'))
    const visibility = normalizeVisibility(board.visibility)
    const payload = settingsPayload({ ...board, label, visibility }, order)

    await saveBoardWithVisibility(db, cfg(), id, payload)
  }

  /** @deprecated saveBoard */
  const saveCategory = saveBoard

  async function saveBoards(next: BoardModel[]): Promise<void> {
    if (!isSignedIn.value) throw new Error(t('boardSettings.signInRequired'))
    // Validate the whole input before starting any writes.
    for (const board of next) {
      if (!board.id.trim() || !board.label.trim()) throw new Error(t('boardSettings.idAndNameRequired'))
    }
    for (const [order, board] of next.entries()) await saveBoard(board, order)
  }

  /** @deprecated saveBoards */
  const saveCategories = saveBoards

  async function deleteBoard(id: string): Promise<void> {
    if (!isSignedIn.value) throw new Error(t('boardSettings.signInRequired'))
    const boardId = id.trim()
    if (!boardId) throw new Error(t('boardSettings.deleteIdRequired'))

    // 설정은 마지막에 삭제한다. 중간 실패 시 게시판을 남겨 두어 관리자가 재시도할 수 있다.
    for (;;) {
      const page = await getDocs(query(
        postsCol(db, cfg()),
        where('boardId', '==', boardId),
        fbLimit(25),
      ))
      if (page.empty) break
      for (const post of page.docs) {
        await deletePostCascade(db, getStorage(app), cfg(), post.id)
      }
    }
    await deleteDoc(settingsDoc(db, cfg(), id))
  }

  /** @deprecated deleteBoard */
  const deleteCategory = deleteBoard

  async function ensureSettings(): Promise<void> {
    return Promise.resolve()
  }

  async function addBoard(label: string): Promise<string> {
    const trimmed = label.trim()
    if (!trimmed) throw new Error(t('boardSettings.nameRequired'))
    if (!isSignedIn.value) throw new Error(t('boardSettings.signInRequired'))
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
      editorType: 'default',
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
    canManageBoard,
    managedBoards,
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
    translateBoard,
    saveBoards,
    saveCategories,
    deleteBoard,
    deleteCategory,
    DEFAULT_BOARDS,
    DEFAULT_CATEGORIES,
  }
}
