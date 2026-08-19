type BoardLookup = (boardId: string) => { allowedStaffUids?: string[] } | undefined

let lookup: BoardLookup | undefined

export function registerBoardLookup(fn: BoardLookup) {
  lookup = fn
}

export function resolveBoardLookup(boardId: string) {
  return lookup?.(boardId)
}