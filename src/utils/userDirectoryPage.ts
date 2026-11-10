export type UserDirectorySort = 'name' | 'role'
export type UserDirectoryDirection = 'asc' | 'desc'

export interface UserDirectoryCursor<T> {
  document: T
  roleIndex: number
}

export const USER_DIRECTORY_ROLES = ['owner', 'admin', 'manager', 'staff', 'user'] as const

/** Fetch one bounded page, including a lookahead across role boundaries. */
export async function readUserDirectoryPage<T>(options: {
  sort: UserDirectorySort
  direction: UserDirectoryDirection
  pageSize: number
  cursor: UserDirectoryCursor<T> | null
  readBatch: (role: typeof USER_DIRECTORY_ROLES[number] | null, after: T | null, count: number) => Promise<T[]>
}) {
  const { sort, direction, pageSize, cursor, readBatch } = options
  const roles = direction === 'asc' ? [...USER_DIRECTORY_ROLES] : [...USER_DIRECTORY_ROLES].reverse()
  const entries: UserDirectoryCursor<T>[] = []
  if (sort === 'name') {
    const docs = await readBatch(null, cursor?.document ?? null, pageSize + 1)
    entries.push(...docs.map(document => ({ document, roleIndex: 0 })))
  }
  else {
    for (let index = cursor?.roleIndex ?? 0; index < roles.length && entries.length <= pageSize; index++) {
      const docs = await readBatch(roles[index]!, index === cursor?.roleIndex ? cursor.document : null, pageSize + 1 - entries.length)
      entries.push(...docs.map(document => ({ document, roleIndex: index })))
    }
  }
  const page = entries.slice(0, pageSize)
  return {
    documents: page.map(item => item.document),
    cursor: page.at(-1) ?? cursor,
    hasNext: entries.length > pageSize,
  }
}
