/**
 * 글 목록을 "더보기"로 여러 페이지 불러온 상태를 메모리에 잠깐 보관한다.
 * 글을 읽고 뒤로 가기로 돌아왔을 때 처음 한 페이지로 줄어들지 않고, 보던 자리로 돌아가게 하려는 용도다.
 * 새로고침하면 사라지고, 글을 쓰거나 고치거나 지우면 비운다.
 */
export interface PostListSnapshot<Post = unknown, Cursor = unknown> {
  /** 첫 페이지(실시간 구독) 뒤로 "더보기"로 이어 불러온 글 */
  olderPosts: Post[]
  olderCursor: Cursor | null
  hasMore: boolean
  scrollY: number
  savedAt: number
}

/** 이 시간이 지난 보관분은 낡은 것으로 보고 쓰지 않는다. */
export const POST_LIST_CACHE_TTL_MS = 5 * 60 * 1000
/** 뒤로 가기(popstate) 직후 이 시간 안에 열린 목록만 복원한다. */
export const POST_LIST_BACK_WINDOW_MS = 2000
const MAX_ENTRIES = 12

const store = new Map<string, PostListSnapshot>()
let lastPopAt = 0
let listening = false

/** 브라우저 뒤로/앞으로 가기를 감지한다. 라우터에 의존하지 않도록 popstate 만 본다. */
export function watchHistoryNavigation() {
  if (listening || typeof window === 'undefined') return
  listening = true
  window.addEventListener('popstate', () => { lastPopAt = Date.now() })
}

/** 방금 뒤로/앞으로 가기로 들어왔는지. 목록 메뉴를 새로 눌러 들어온 경우는 false. */
export function arrivedByHistory(now = Date.now()): boolean {
  return lastPopAt > 0 && now - lastPopAt < POST_LIST_BACK_WINDOW_MS
}

export function postListCacheKey(boardId: string, publicOnly: boolean, uid: string): string {
  return `${boardId}|${publicOnly ? 'public' : 'all'}|${uid}`
}

export function savePostListSnapshot(key: string, snapshot: Omit<PostListSnapshot, 'savedAt'>, now = Date.now()) {
  store.delete(key)
  store.set(key, { ...snapshot, savedAt: now })
  while (store.size > MAX_ENTRIES) store.delete(store.keys().next().value as string)
}

/** 복원할 보관분을 꺼낸다. 한 번 꺼내면 지운다. 오래됐으면 버리고 null. */
export function takePostListSnapshot<Post, Cursor>(key: string, now = Date.now()): PostListSnapshot<Post, Cursor> | null {
  const entry = store.get(key)
  store.delete(key)
  if (!entry || now - entry.savedAt > POST_LIST_CACHE_TTL_MS) return null
  return entry as PostListSnapshot<Post, Cursor>
}

/** 글이 바뀌었으니 모든 보관분을 버린다. */
export function clearPostListCache() {
  store.clear()
}
