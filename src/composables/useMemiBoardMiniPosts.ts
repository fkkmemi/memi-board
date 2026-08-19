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
import { postsCol } from '../utils/boardPaths'
import type { PostModel } from '../types'

export function useMemiBoardMiniLatest(
  boardId: MaybeRefOrGetter<string | null>,
  count: MaybeRefOrGetter<number>,
) {
  const db = useFirestore()
  const cfg = () => useBoardPathConfig()
  const postsQuery = computed(() => {
    if (!import.meta.client) return null
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
  const { data, pending, error } = useCollection<PostModel>(postsQuery)
  const posts = computed(() => data.value ?? [])
  return { posts, pending, error }
}

export function useMemiBoardMiniPicked(postIds: MaybeRefOrGetter<string[]>) {
  const db = useFirestore()
  const cfg = () => useBoardPathConfig()
  const ids = computed(() =>
    [...new Set(toValue(postIds).map(id => id.trim()).filter(Boolean))].slice(0, 10),
  )
  const postsQuery = computed(() => {
    if (!import.meta.client || !ids.value.length) return null
    return query(
      postsCol(db, cfg()),
      where(documentId(), 'in', ids.value),
    )
  })
  const { data, pending, error } = useCollection<PostModel>(postsQuery)
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