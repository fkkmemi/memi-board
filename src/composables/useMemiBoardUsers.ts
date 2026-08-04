import { collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { useCollection, useFirestore } from 'vuefire'
import { useMemiBoardConfig } from '../config'
import type { BoardUserModel, BoardUserRole } from '../types'

export const BOARD_USER_ROLES: Array<{
  value: BoardUserRole
  label: string
  description: string
}> = [
  { value: 'admin', label: '관리자', description: '사용자 역할, 게시판 설정과 모든 콘텐츠를 관리합니다.' },
  { value: 'staff', label: '스태프', description: '모든 게시글과 댓글을 관리하지만 사용자 역할과 게시판 설정은 바꿀 수 없습니다.' },
  { value: 'user', label: '사용자', description: '글과 댓글을 작성하고 본인이 작성한 콘텐츠만 수정·삭제할 수 있습니다.' },
]

export function useMemiBoardUsers() {
  const config = useMemiBoardConfig()
  const db = useFirestore()
  const collectionName = `${config.collectionPrefix}Users`
  const users = useCollection<BoardUserModel>(collection(db, collectionName), {
    ssrKey: `${collectionName}-management`,
  })

  async function updateUserRole(uid: string, role: BoardUserRole) {
    if (!BOARD_USER_ROLES.some(item => item.value === role)) throw new Error('지원하지 않는 역할입니다.')
    await updateDoc(doc(db, collectionName, uid), { role, updatedAt: serverTimestamp() })
  }

  return { users, usersPending: users.pending, updateUserRole }
}
