import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import {
  documentId,
  limit as fbLimit,
  orderBy,
  query,
  where,
  type QueryConstraint,
} from 'firebase/firestore'
import { useCollection, useFirestore } from 'vuefire'
import { useBoardPathConfig } from '../config'
import { boardSsrKey, postsCol } from '../utils/boardPaths'
import type { PostModel } from '../types'

/**
 * SSR과 클라이언트 첫 렌더의 pending 상태가 갈리면(서버는 즉시 완료, 클라이언트는
 * 로딩 중) MiniList.vue가 서버에선 빈 상태(<p>), 클라이언트에선 스켈레톤(<div>)을
 * 그려 노드 자체가 달라지는 하이드레이션 mismatch가 난다. 쿼리가 where/orderBy/limit을
 * 쓰는 복합 쿼리라 ssrKey 없인 vuefire가 경로를 못 찾는 것도 같은 원인이라, 두 컴포저블
 * 모두 서버에서도 쿼리를 실행하고 ssrKey로 하이드레이션시킨다.
 */
export function useMemiBoardMiniLatest(
  boardId: MaybeRefOrGetter<string | null>,
  count: MaybeRefOrGetter<number>,
) {
  const db = useFirestore()
  const cfg = () => useBoardPathConfig()
  const boardKey = toValue(boardId)?.trim() || 'all'
  const postsQuery = computed(() => {
    const take = Math.max(1, Math.floor(Number(toValue(count)) || 5))
    const board = toValue(boardId)?.trim() || ''
    const constraints: QueryConstraint[] = [
      where('isPublished', '==', true),
      where('listed', '==', true),
    ]
    if (board) constraints.unshift(where('boardId', '==', board))
    return query(
      postsCol(db, cfg()),
      ...constraints,
      orderBy('createdAt', 'desc'),
      fbLimit(take),
    )
  })
  const { data, pending, error } = useCollection<PostModel>(postsQuery, {
    ssrKey: boardSsrKey(cfg(), `mini-list/${boardKey}`),
  })
  const posts = computed(() => data.value ?? [])
  return { posts, pending, error }
}

export function useMemiBoardMiniPicked(postIds: MaybeRefOrGetter<string[]>) {
  const db = useFirestore()
  const cfg = () => useBoardPathConfig()
  const ids = computed(() =>
    [...new Set(toValue(postIds).map(id => id.trim()).filter(Boolean))].slice(0, 10),
  )
  const idsKey = ids.value.join(',') || 'none'
  const postsQuery = computed(() => {
    if (!ids.value.length) return null
    return query(
      postsCol(db, cfg()),
      where(documentId(), 'in', ids.value),
    )
  })
  const { data, pending, error } = useCollection<PostModel>(postsQuery, {
    ssrKey: boardSsrKey(cfg(), `mini-picked/${idsKey}`),
  })
  const posts = computed(() => {
    const byId = new Map((data.value ?? []).map(post => [post.id, post]))
    const ordered: PostModel[] = []
    for (const id of ids.value) {
      const item = byId.get(id)
      if (item && item.isPublished !== false) ordered.push(item)
    }
    return ordered
  })
  return { posts, pending, error }
}