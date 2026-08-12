import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { useDocument, useFirestore } from 'vuefire'
import { useBoardPathConfig } from '../config'
import { boardUserDoc } from '../utils/boardPaths'
import type { BoardUserModel } from '../types'

/**
 * 다른 사용자의 공개 프로필. memiBoardUsers/{uid}는 이메일만 빼면 전부 공개라
 * 누구나 조회할 수 있다(rules) — email 필드는 애초에 이 문서에 없다.
 */
export function useMemiBoardUserProfile(uid: MaybeRefOrGetter<string>) {
  const db = useFirestore()
  const cfg = () => useBoardPathConfig()
  const uidValue = computed(() => toValue(uid))
  const profileRef = computed(() => {
    const value = uidValue.value
    return value ? boardUserDoc(db, cfg(), value) : null
  })

  const { data: profile, pending } = useDocument<BoardUserModel>(profileRef)

  return { profile, profilePending: pending }
}
