import type { BoardVisibility, BoardWriteRole } from '../types'

/** 스태프가 이 보드 담당인지. 목록에 있는 uid만. 비어 있으면 담당 없음(관리자만). */
export function isAssignedStaff(
  uid: string | undefined,
  board: { allowedStaffUids?: string[] } | null | undefined,
): boolean {
  if (!uid || !board) return false
  return (board.allowedStaffUids ?? []).includes(uid)
}

export function canManageBoardByRole(
  uid: string | undefined,
  isAdmin: boolean,
  isStaff: boolean,
  board: { allowedStaffUids?: string[] } | null | undefined,
): boolean {
  if (!uid) return false
  if (isAdmin) return true
  if (!isStaff) return false
  return isAssignedStaff(uid, board)
}

/**
 * 댓글 작성 권한. 숨김 보드는 commentWriteRole 과 무관하게 관리자·담당 스태프만.
 * board 가 아직 없으면 공개 보드(일반 이상)와 같이 취급한다.
 */
export function canWriteCommentByRole(
  uid: string | undefined,
  isAdmin: boolean,
  isStaff: boolean,
  board: {
    visibility?: BoardVisibility
    commentWriteRole?: BoardWriteRole
    allowedStaffUids?: string[]
  } | null | undefined,
): boolean {
  if (!uid) return false
  if (board?.visibility === 'hidden') {
    return canManageBoardByRole(uid, isAdmin, isStaff, board)
  }
  const required = board?.commentWriteRole ?? 'user'
  if (required === 'admin') return isAdmin
  if (required === 'staff') return canManageBoardByRole(uid, isAdmin, isStaff, board)
  return true
}