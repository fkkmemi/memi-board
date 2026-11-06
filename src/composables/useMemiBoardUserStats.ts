import { computed, ref, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { getCountFromServer, query, where } from 'firebase/firestore'
import { useFirestore } from 'vuefire'
import { useBoardPathConfig } from '../config'
import { commentsCol, postsCol } from '../utils/boardPaths'

/**
 * Public post and comment counts for one user, using the same public filters as the
 * user post and comment lists (`listed`, published). Uses count aggregation, so no
 * documents are downloaded. A count that cannot be read stays `null`.
 */
export function useMemiBoardUserStats(uid: MaybeRefOrGetter<string>) {
  const db = useFirestore()
  const uidValue = computed(() => toValue(uid)?.trim() || '')
  const postCount = ref<number | null>(null)
  const commentCount = ref<number | null>(null)

  async function refresh() {
    const id = uidValue.value
    postCount.value = null
    commentCount.value = null
    if (!id) return
    const cfg = useBoardPathConfig()
    const [posts, comments] = await Promise.allSettled([
      getCountFromServer(query(postsCol(db, cfg), where('authorUid', '==', id), where('isPublished', '==', true), where('listed', '==', true))),
      getCountFromServer(query(commentsCol(db, cfg), where('authorUid', '==', id), where('listed', '==', true))),
    ])
    if (uidValue.value !== id) return
    if (posts.status === 'fulfilled') postCount.value = posts.value.data().count
    if (comments.status === 'fulfilled') commentCount.value = comments.value.data().count
  }

  watch(uidValue, () => { void refresh() }, { immediate: true })

  return { postCount, commentCount, refresh }
}
