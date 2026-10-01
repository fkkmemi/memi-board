import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { serverTimestamp, updateDoc } from 'firebase/firestore'
import { useCollection, useFirestore } from 'vuefire'
import { useBoardPathConfig } from '../config'
import { boardSsrKey, boardUserDoc, boardUsersCol } from '../utils/boardPaths'
import type { BoardUserModel, BoardUserRole } from '../types'
import { translate } from '../i18n/translate'
import { useMemiBoardI18n } from '../i18n/useMemiBoardI18n'

/**
 * 역할 목록. label·description 은 기본 언어(ko) 문구다 —
 * 화면에서는 t('common.role.<value>') / t('boardUsers.roleDescription.<value>') 로 현재 언어 문구를 쓴다.
 */
export const BOARD_USER_ROLES: Array<{
  value: BoardUserRole
  label: string
  description: string
}> = (['admin', 'staff', 'user'] as const).map(value => ({
  value,
  label: translate('ko', `common.role.${value}`),
  description: translate('ko', `boardUsers.roleDescription.${value}`),
}))

/**
 * memiBoardUsers/{uid}는 이메일만 빼면 공개 프로필이라 목록 읽기 자체는 누구나 할 수
 * 있다(rules) — 이 컴포저블은 관리 화면(역할 변경)에서만 쓰라고 있는 것뿐이다.
 * enabled가 false인 동안은 쿼리 자체를 시작하지 않는다 — role 확인이 끝나기 전에
 * 미리 구독을 걸어두면 화면이 불필요하게 로딩 상태로 오래 머문다.
 *
 * 경로: memiBoardUsers/{uid} (flat)
 */
export function useMemiBoardUsers(options: { enabled?: MaybeRefOrGetter<boolean> } = {}) {
  const cfg = () => useBoardPathConfig()
  const db = useFirestore()
  const { t } = useMemiBoardI18n()
  const usersQuery = computed(() => (toValue(options.enabled) ?? true) ? boardUsersCol(db, cfg()) : null)
  const users = useCollection<BoardUserModel>(usersQuery, {
    ssrKey: boardSsrKey(cfg(), 'users-management'),
  })

  async function updateUserRole(uid: string, role: BoardUserRole) {
    if (!BOARD_USER_ROLES.some(item => item.value === role)) throw new Error(t('boardUsers.unsupportedRole'))
    await updateDoc(boardUserDoc(db, cfg(), uid), { role, updatedAt: serverTimestamp() })
  }

  return { users, usersPending: users.pending, updateUserRole }
}
