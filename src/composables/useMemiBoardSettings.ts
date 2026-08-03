import { computed, watch } from 'vue'
import { useFirestore, useDocument } from 'vuefire'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { useMemiBoardConfig } from '../config'
import { useMemiBoardAuth } from './useMemiBoardAuth'
import type { BoardCategory, BoardSettingsModel } from '../types'

/** 카테고리가 아직 설정되지 않았을 때(설정 문서가 없을 때) 쓰는 기본값. */
const DEFAULT_CATEGORIES: BoardCategory[] = [
  { id: 'free', label: '자유' },
  { id: 'notice', label: '공지' },
  { id: 'question', label: '질문' },
]

/**
 * 게시판 설정({prefix}Settings/config) — 지금은 카테고리 옵션만 다룬다.
 * 문서가 없으면 기본 카테고리를 그대로 보여주고, 관리자가 게시판을 방문하는 순간
 * 그 기본값으로 문서를 한 번 만들어 둔다(이후엔 Firebase 콘솔/향후 관리 UI에서 직접 수정).
 * 일반 사용자는 절대 이 문서를 쓰지 않는다(생성 실패해도 조용히 무시 — 기본값으로 계속 동작).
 */
export function useMemiBoardSettings() {
  const config = useMemiBoardConfig()
  const db = useFirestore()
  const { isAdmin } = useMemiBoardAuth()

  // useDocument 는 ref 를 받으므로 computed 로 prefix 반영
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

  /** 관리자가 게시판을 방문했는데 설정 문서가 아직 없으면 기본 카테고리로 한 번 만든다. */
  watch(
    [isAdmin, settingsPending],
    async ([admin, pending]) => {
      if (!admin || pending || settingsDoc.value) return
      const ref = settingsRef.value
      const snap = await getDoc(ref).catch(() => null)
      if (!snap || snap.exists()) return
      await setDoc(ref, {
        categories: DEFAULT_CATEGORIES,
        updatedAt: serverTimestamp(),
      }).catch(() => {
        // 권한·네트워크 문제로 실패해도 화면은 기본 카테고리로 계속 동작하므로 무시한다.
      })
    },
    { immediate: true },
  )

  return { categories, categoryLabel, settingsPending }
}
