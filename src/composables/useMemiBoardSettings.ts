import { computed } from 'vue'
import { useCollection, useFirestore } from 'vuefire'
import { collection, deleteDoc, doc, orderBy, query, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore'
import { useMemiBoardConfig } from '../config'
import { useMemiBoardAuth } from './useMemiBoardAuth'
import { slugify } from '../utils/slugify'
import type { BoardCategory } from '../types'

/** 필요할 때 호스트가 명시적으로 사용할 수 있는 예시 카테고리. 자동 적용하지 않는다. */
export const DEFAULT_CATEGORIES: BoardCategory[] = [
  { id: 'free', label: '자유', listView: 'default', order: 0 },
  { id: 'notice', label: '공지', listView: 'default', order: 1 },
  { id: 'question', label: '질문', listView: 'default', order: 2 },
]

/** 게시판 카테고리 — `{prefix}Settings/config/categories/{categoryId}` 개별 문서. */
export function useMemiBoardSettings() {
  const config = useMemiBoardConfig()
  const db = useFirestore()
  const { isSignedIn } = useMemiBoardAuth()

  const settingsRef = computed(() => doc(db, `${config.collectionPrefix}Settings`, 'config'))
  const categoriesRef = computed(() =>
    collection(db, `${config.collectionPrefix}Settings`, 'config', 'categories'),
  )
  const categoriesQuery = computed(() => query(categoriesRef.value, orderBy('order', 'asc')))
  const { data: categoryDocs, pending: settingsPending } = useCollection<BoardCategory>(categoriesQuery)
  const categories = computed<BoardCategory[]>(() => categoryDocs.value.map((item, index) => ({
    ...item,
    id: item.id,
    order: typeof item.order === 'number' ? item.order : index,
    listView: item.listView ?? 'default',
  })))

  function categoryLabel(id: string | undefined): string | undefined {
    if (!id) return undefined
    return categories.value.find(category => category.id === id)?.label ?? id
  }

  async function saveCategory(category: BoardCategory, order = category.order ?? 0): Promise<void> {
    if (!isSignedIn.value) throw new Error('로그인이 필요합니다.')
    const id = category.id.trim()
    const label = category.label.trim()
    if (!id || !label) throw new Error('카테고리 ID와 이름을 입력해 주세요.')
    await setDoc(settingsRef.value, { updatedAt: serverTimestamp() }, { merge: true })
    await setDoc(doc(categoriesRef.value, id), {
      label,
      listView: category.listView ?? 'default',
      order,
      updatedAt: serverTimestamp(),
    }, { merge: true })
  }

  /** 호환용 일괄 저장. 각 카테고리는 독립 문서로 batch 저장한다. */
  async function saveCategories(next: BoardCategory[]): Promise<void> {
    if (!isSignedIn.value) throw new Error('로그인이 필요합니다.')
    const batch = writeBatch(db)
    batch.set(settingsRef.value, { updatedAt: serverTimestamp() }, { merge: true })
    next.forEach((category, order) => {
      const id = category.id.trim()
      const label = category.label.trim()
      if (!id || !label) throw new Error('카테고리 ID와 이름을 입력해 주세요.')
      batch.set(doc(categoriesRef.value, id), {
        label,
        listView: category.listView ?? 'default',
        order,
        updatedAt: serverTimestamp(),
      }, { merge: true })
    })
    await batch.commit()
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
    await saveCategory({ id, label: trimmed, listView: 'default', order: categories.value.length })
    return id
  }

  return {
    categories,
    categoryLabel,
    settingsPending,
    ensureSettings,
    addCategory,
    saveCategory,
    saveCategories,
    deleteCategory,
    DEFAULT_CATEGORIES,
  }
}
