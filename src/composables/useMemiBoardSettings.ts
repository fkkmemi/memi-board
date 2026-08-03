import { computed, watch } from 'vue'
import { useFirestore, useDocument } from 'vuefire'
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { useMemiBoardConfig } from '../config'
import { useMemiBoardAuth } from './useMemiBoardAuth'
import { slugify } from '../utils/slugify'
import type { BoardCategory, BoardSettingsModel } from '../types'

/** 설정 문서가 없을 때 UI·시드에 쓰는 기본 카테고리. */
export const DEFAULT_CATEGORIES: BoardCategory[] = [
  { id: 'free', label: '자유' },
  { id: 'notice', label: '공지' },
  { id: 'question', label: '질문' },
]

/**
 * 게시판 설정({prefix}Settings/config) — 카테고리 옵션 목록.
 *
 * - 읽기: 전체 공개 (useDocument 실시간)
 * - 문서 없음: DEFAULT 로 보여 주고, 로그인 사용자가 처음 쓰거나 추가할 때 시드 생성
 * - 카테고리 추가: 로그인 사용자 (글쓰기 폼에서 즉시 추가)
 */
export function useMemiBoardSettings() {
  const config = useMemiBoardConfig()
  const db = useFirestore()
  const { isSignedIn, isAdmin } = useMemiBoardAuth()

  const settingsRef = computed(() => doc(db, `${config.collectionPrefix}Settings`, 'config'))
  const { data: settingsDoc, pending: settingsPending } = useDocument<BoardSettingsModel>(settingsRef)

  const categories = computed<BoardCategory[]>(() => {
    const list = settingsDoc.value?.categories
    return list && list.length > 0 ? list : DEFAULT_CATEGORIES
  })

  function categoryLabel(id: string | undefined): string | undefined {
    if (!id) return undefined
    return categories.value.find(c => c.id === id)?.label ?? id
  }

  /** 설정 문서가 없으면 기본 카테고리로 한 번 생성. 로그인 필요. */
  async function ensureSettings(): Promise<void> {
    if (!isSignedIn.value) return
    const ref = settingsRef.value
    const snap = await getDoc(ref).catch(() => null)
    if (!snap || snap.exists()) return
    await setDoc(ref, {
      categories: DEFAULT_CATEGORIES,
      updatedAt: serverTimestamp(),
    })
  }

  /**
   * 카테고리 추가. label 로 id(slug) 생성, 중복 id 면 접미사.
   * @returns 추가된(또는 기존 동일 label 의) category id
   */
  async function addCategory(label: string): Promise<string> {
    const trimmed = label.trim()
    if (!trimmed) throw new Error('카테고리 이름을 입력해 주세요.')
    if (!isSignedIn.value) throw new Error('로그인이 필요합니다.')

    await ensureSettings()

    const existing = categories.value.find(
      c => c.label === trimmed || c.id === slugify(trimmed),
    )
    if (existing) return existing.id

    let id = slugify(trimmed) || `cat-${Date.now()}`
    const used = new Set(categories.value.map(c => c.id))
    if (used.has(id)) {
      let n = 2
      while (used.has(`${id}-${n}`)) n++
      id = `${id}-${n}`
    }

    const next: BoardCategory[] = [...categories.value, { id, label: trimmed }]
    const ref = settingsRef.value
    const snap = await getDoc(ref)
    if (snap.exists()) {
      await updateDoc(ref, {
        categories: next,
        updatedAt: serverTimestamp(),
      })
    }
    else {
      await setDoc(ref, {
        categories: next,
        updatedAt: serverTimestamp(),
      })
    }
    return id
  }

  // 관리자 방문 시 문서 없으면 시드 (기존 동작 유지 + 로그인 일반 사용자 ensure 와 병행)
  watch(
    [isAdmin, isSignedIn, settingsPending],
    async ([admin, signedIn, pending]) => {
      if (pending || settingsDoc.value) return
      if (!admin && !signedIn) return
      await ensureSettings().catch(() => {})
    },
    { immediate: true },
  )

  return {
    categories,
    categoryLabel,
    settingsPending,
    ensureSettings,
    addCategory,
    DEFAULT_CATEGORIES,
  }
}
