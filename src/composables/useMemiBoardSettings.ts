import { computed } from 'vue'
import { useCollection, useFirestore } from 'vuefire'
import {
  deleteDoc,
  doc,
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
  boardCategoriesCol,
  boardPostsCol,
  boardSettingsDoc,
  boardSsrKey,
} from '../utils/boardPaths'
import { useMemiBoardAuth } from './useMemiBoardAuth'
import { slugify } from '../utils/slugify'
import type { BoardCategory, BoardVisibility } from '../types'

/** 필요할 때 호스트가 명시적으로 사용할 수 있는 예시 카테고리. 자동 적용하지 않는다. */
export const DEFAULT_CATEGORIES: BoardCategory[] = [
  { id: 'free', label: '자유', listView: 'default', writeRole: 'user', commentWriteRole: 'user', visibility: 'public', order: 0 },
  { id: 'notice', label: '공지', listView: 'default', writeRole: 'admin', commentWriteRole: 'user', visibility: 'public', order: 1 },
  { id: 'question', label: '질문', listView: 'default', writeRole: 'user', commentWriteRole: 'user', visibility: 'public', order: 2 },
]

function normalizeVisibility(value: unknown): BoardVisibility {
  return value === 'hidden' ? 'hidden' : 'public'
}

/** 게시판 카테고리 — memiBoards/{boardId}/settings/config/categories/{categoryId} */
export function useMemiBoardSettings() {
  const cfg = () => useBoardPathConfig()
  const db = useFirestore()
  const { isSignedIn } = useMemiBoardAuth()

  const settingsRef = computed(() => boardSettingsDoc(db, cfg()))
  const categoriesRef = computed(() => boardCategoriesCol(db, cfg()))
  const categoriesQuery = computed(() => query(categoriesRef.value, orderBy('order', 'asc')))
  const { data: categoryDocs, pending: settingsPending } = useCollection<BoardCategory>(categoriesQuery, {
    ssrKey: boardSsrKey(cfg(), 'settings/config/categories'),
  })
  const categories = computed<BoardCategory[]>(() => categoryDocs.value.map((item, index) => ({
    ...item,
    id: item.id,
    order: typeof item.order === 'number' ? item.order : index,
    description: item.description ?? (item as { desc?: string }).desc ?? '',
    visibility: normalizeVisibility(item.visibility),
    listView: item.listView ?? 'default',
    writeRole: item.writeRole ?? 'user',
    commentWriteRole: item.commentWriteRole ?? 'user',
    allowedStaffUids: item.allowedStaffUids ?? [],
  })))

  /** 공개 카테고리만 (칩·전체 필터용) */
  const publicCategories = computed(() =>
    categories.value.filter(category => category.visibility !== 'hidden'),
  )

  function categoryLabel(id: string | undefined): string | undefined {
    if (!id) return undefined
    return categories.value.find(category => category.id === id)?.label ?? id
  }

  function categoryDescription(id: string | undefined): string | undefined {
    if (!id) return undefined
    const value = categories.value.find(category => category.id === id)?.description?.trim()
    return value || undefined
  }

  function categoryVisibility(id: string | undefined): BoardVisibility {
    if (!id) return 'public'
    return categories.value.find(category => category.id === id)?.visibility ?? 'public'
  }

  function isCategoryHidden(id: string | undefined): boolean {
    return categoryVisibility(id) === 'hidden'
  }

  /** 숨김 전환 시 해당 카테고리 글의 listed 를 일괄 맞춤 (rules·목록 쿼리용). */
  async function syncPostsListedForCategory(categoryId: string, listed: boolean): Promise<void> {
    const postsCol = boardPostsCol(db, cfg())
    let cursor: QueryDocumentSnapshot | undefined
    for (;;) {
      const page = await getDocs(query(
        postsCol,
        where('category', '==', categoryId),
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

  async function saveCategory(category: BoardCategory, order = category.order ?? 0): Promise<void> {
    if (!isSignedIn.value) throw new Error('로그인이 필요합니다.')
    const id = category.id.trim()
    const label = category.label.trim()
    if (!id || !label) throw new Error('카테고리 ID와 이름을 입력해 주세요.')
    const visibility = normalizeVisibility(category.visibility)
    const previous = categories.value.find(item => item.id === id)
    const previousVisibility = previous?.visibility ?? 'public'

    await setDoc(settingsRef.value, { updatedAt: serverTimestamp() }, { merge: true })
    await setDoc(doc(categoriesRef.value, id), {
      label,
      description: (category.description ?? '').trim(),
      visibility,
      listView: category.listView ?? 'default',
      writeRole: category.writeRole ?? 'user',
      commentWriteRole: category.commentWriteRole ?? 'user',
      allowedStaffUids: category.allowedStaffUids ?? [],
      order,
      updatedAt: serverTimestamp(),
    }, { merge: true })

    // 숨김 전환 시뿐 아니라 공개 저장 때도 listed 를 맞춰 레거시 글(필드 없음)을 복구한다.
    if (previousVisibility !== visibility || visibility === 'public') {
      await syncPostsListedForCategory(id, visibility !== 'hidden')
    }
  }

  async function saveCategories(next: BoardCategory[]): Promise<void> {
    if (!isSignedIn.value) throw new Error('로그인이 필요합니다.')
    const previousById = new Map(categories.value.map(item => [item.id, item.visibility ?? 'public']))
    const batch = writeBatch(db)
    batch.set(settingsRef.value, { updatedAt: serverTimestamp() }, { merge: true })
    const visibilityChanges: Array<{ id: string, listed: boolean }> = []
    next.forEach((category, order) => {
      const id = category.id.trim()
      const label = category.label.trim()
      if (!id || !label) throw new Error('카테고리 ID와 이름을 입력해 주세요.')
      const visibility = normalizeVisibility(category.visibility)
      batch.set(doc(categoriesRef.value, id), {
        label,
        description: (category.description ?? '').trim(),
        visibility,
        listView: category.listView ?? 'default',
        writeRole: category.writeRole ?? 'user',
        commentWriteRole: category.commentWriteRole ?? 'user',
        allowedStaffUids: category.allowedStaffUids ?? [],
        order,
        updatedAt: serverTimestamp(),
      }, { merge: true })
      const prev = previousById.get(id) ?? 'public'
      if (prev !== visibility) visibilityChanges.push({ id, listed: visibility !== 'hidden' })
    })
    await batch.commit()
    for (const change of visibilityChanges) {
      await syncPostsListedForCategory(change.id, change.listed)
    }
  }

  async function deleteCategory(id: string): Promise<void> {
    if (!isSignedIn.value) throw new Error('로그인이 필요합니다.')
    await deleteDoc(doc(categoriesRef.value, id))
  }

  async function ensureSettings(): Promise<void> {
    return Promise.resolve()
  }

  async function addCategory(label: string): Promise<string> {
    const trimmed = label.trim()
    if (!trimmed) throw new Error('카테고리 이름을 입력해 주세요.')
    if (!isSignedIn.value) throw new Error('로그인이 필요합니다.')
    const existing = categories.value.find(category => category.label === trimmed)
    if (existing) return existing.id

    const base = slugify(trimmed) || `cat-${Date.now()}`
    let id = base
    let suffix = 2
    const used = new Set(categories.value.map(category => category.id))
    while (used.has(id)) id = `${base}-${suffix++}`
    await saveCategory({
      id,
      label: trimmed,
      visibility: 'public',
      listView: 'default',
      writeRole: 'user',
      commentWriteRole: 'user',
      order: categories.value.length,
    })
    return id
  }

  return {
    categories,
    publicCategories,
    categoryLabel,
    categoryDescription,
    categoryVisibility,
    isCategoryHidden,
    settingsPending,
    ensureSettings,
    addCategory,
    saveCategory,
    saveCategories,
    deleteCategory,
    DEFAULT_CATEGORIES,
  }
}
