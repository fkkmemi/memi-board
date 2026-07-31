import { collection, doc, orderBy, query, serverTimestamp, writeBatch, increment } from 'firebase/firestore'
import { useCollection } from 'vuefire'
import type { Ref } from 'vue'
import type { CommentModel } from '../types'

export interface AddCommentInput {
  body: string
  authorUid: string
  authorName: string | null
  authorPhoto: string | null
}

/** postId 서브컬렉션 댓글을 실시간(onSnapshot)으로 구독하고, 작성/삭제 시 부모 글의 commentCount를 같은 batch로 증감한다. */
export function useMemiBoardComments(postId: string | Ref<string>) {
  const config = useRuntimeConfig().public.memiBoard as { collectionPrefix: string }
  const db = useFirestore()
  const prefix = config.collectionPrefix

  const id = computed(() => (typeof postId === 'string' ? postId : postId.value))

  const commentsQuery = computed(() =>
    query(collection(db, `${prefix}Posts`, id.value, 'comments'), orderBy('createdAt', 'asc')),
  )

  const comments = useCollection<CommentModel>(commentsQuery)

  async function addComment(input: AddCommentInput): Promise<void> {
    const batch = writeBatch(db)
    const commentRef = doc(collection(db, `${prefix}Posts`, id.value, 'comments'))
    batch.set(commentRef, {
      postId: id.value,
      body: input.body,
      authorUid: input.authorUid,
      authorName: input.authorName,
      authorPhoto: input.authorPhoto,
      moderationStatus: 'approved',
      createdAt: serverTimestamp(),
    })
    batch.update(doc(db, `${prefix}Posts`, id.value), { commentCount: increment(1) })
    await batch.commit()
  }

  async function deleteComment(commentId: string): Promise<void> {
    const batch = writeBatch(db)
    batch.delete(doc(db, `${prefix}Posts`, id.value, 'comments', commentId))
    batch.update(doc(db, `${prefix}Posts`, id.value), { commentCount: increment(-1) })
    await batch.commit()
  }

  return { comments, addComment, deleteComment }
}
