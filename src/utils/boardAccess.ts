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