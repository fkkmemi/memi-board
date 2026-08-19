import type { BoardListView, BoardSection, BoardSectionCols, BoardSectionHeight, BoardSectionKind, BoardSectionSort, CommentModel, PostModel } from '../types'

export const BOARD_SECTION_COLS: BoardSectionCols[] = [3, 4, 5, 6, 7, 8, 9, 12]
export const BOARD_SECTION_KINDS: { value: BoardSectionKind, label: string }[] = [
  { value: 'list', label: '게시목록' },
  { value: 'post', label: '게시물' },
  { value: 'comments', label: '댓글모음' },
]
export const BOARD_SECTION_SORTS: { value: BoardSectionSort, label: string }[] = [
  { value: 'latest', label: '최신순' },
  { value: 'likes', label: '좋아요순' },
]

export function defaultSectionCount(kind: BoardSectionKind) {
  return kind === 'list' ? 5 : 4
}

export function clampSectionCount(kind: BoardSectionKind, value: unknown) {
  const n = Math.floor(Number(value))
  if (!Number.isFinite(n)) return defaultSectionCount(kind)
  return Math.min(kind === 'list' ? 20 : 10, Math.max(1, n))
}

export function pairSectionCols(cols: BoardSectionCols): BoardSectionCols | null {
  if (cols === 12) return null
  return (12 - cols) as BoardSectionCols
}

export function sectionColClass(cols: BoardSectionCols): string {
  return {
    3: 'col-span-12 md:col-span-3',
    4: 'col-span-12 md:col-span-4',
    5: 'col-span-12 md:col-span-5',
    6: 'col-span-12 md:col-span-6',
    7: 'col-span-12 md:col-span-7',
    8: 'col-span-12 md:col-span-8',
    9: 'col-span-12 md:col-span-9',
    12: 'col-span-12',
  }[cols]
}

export function sectionMinHeight(height: BoardSectionHeight) {
  if (height === 'sm') return 'min-h-40'
  if (height === 'lg') return 'min-h-80'
  return 'min-h-56'
}

export function miniPostLink(post: Pick<PostModel, 'boardId' | 'slug' | 'category'>) {
  const boardId = post.boardId || post.category || 'free'
  if (!post.slug) return `/board/${boardId}`
  return `/board/${boardId}/${post.slug}`
}

export function miniMoreLink(section: Pick<BoardSection, 'kind' | 'boardId' | 'sort'>) {
  if (section.kind === 'comments') {
    return section.sort === 'likes' ? '/boardComments?sort=likes' : '/boardComments'
  }
  if (section.kind === 'list' && section.boardId) return `/board/${section.boardId}`
  return '/board'
}

export function miniCommentLink(comment: Pick<CommentModel, 'boardId' | 'postId'>) {
  if (!comment.boardId || !comment.postId) return undefined
  return `/board/${comment.boardId}/post/${comment.postId}`
}

export function miniPostImage(post: PostModel): string | undefined {
  return post.previewImage
    || post.attachments?.find(item => item.type.startsWith('image/'))?.url
}

export function miniPostTitle(post: PostModel) {
  return post.title?.trim() || post.summary || '게시물'
}

export type MiniViewGroup = 'list' | 'media'

export function miniViewGroup(view: BoardListView): MiniViewGroup {
  return view === 'image' || view === 'video' ? 'media' : 'list'
}

export function miniViewLabel(view: BoardListView) {
  return miniViewGroup(view) === 'media' ? '미디어' : '목록'
}

export function miniBoardView(
  boardId: string | null | undefined,
  getBoard: (id: string) => { listView?: BoardListView } | undefined,
): BoardListView {
  if (!boardId) return 'default'
  return getBoard(boardId)?.listView ?? 'default'
}

export function miniPostsView(
  posts: Array<{ boardId?: string }>,
  getBoard: (id: string) => { listView?: BoardListView } | undefined,
): BoardListView {
  const views = posts.map(post => miniBoardView(post.boardId, getBoard))
  if (!views.length) return 'default'
  if (views.every(view => view === views[0])) return views[0]!
  const image = views.filter(view => view === 'image').length
  const video = views.filter(view => view === 'video').length
  if (image >= views.length / 2) return 'image'
  if (video >= views.length / 2) return 'video'
  return 'default'
}