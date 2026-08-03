import { computed } from 'vue'
import type { Ref } from 'vue'
import { useCollection, useFirestore } from 'vuefire'
import { collection, doc, orderBy, query, serverTimestamp, writeBatch, increment } from 'firebase/firestore'
import { useMemiBoardConfig } from '../config'
import type { CommentModel } from '../types'

export interface AddCommentInput {
  body: string
  authorUid: string
  authorName: string | null
  authorPhoto: string | null
}

/** postId 서브컬렉션 댓글을 실시간(onSnapshot)으로 구독하고, 작성/삭제 시 부모 글의 commentCount를 같은 batch로 증감한다. */
export function useMemiBoardComments(postId: string | Ref<string>) {
  const config = useMemiBoardConfig()
  const db = useFirestore()
  const prefix = () => config.collectionPrefix

  const id = computed(() => (typeof postId === 'string' ? postId : postId.value))

  const commentsQuery = computed(() =>
    query(collection(db, `${prefix()}Posts`, id.value, 'comments'), orderBy('createdAt', 'asc')),
  )

  const comments = useCollection<CommentModel>(commentsQuery)

  async function addComment(input: AddCommentInput): Promise<void> {
    const batch = writeBatch(db)
    const p = prefix()
    const commentRef = doc(collection(db, `${p}Posts`, id.value, 'comments'))
    batch.set(commentRef, {
      postId: id.value,
      body: input.body,
      authorUid: input.authorUid,
      authorName: input.authorName,
      authorPhoto: input.authorPhoto,
      moderationStatus: 'approved',
      createdAt: serverTimestamp(),
    })
    batch.update(doc(db, `${p}Posts`, id.value), { commentCount: increment(1) })
    await batch.commit()
  }

  async function deleteComment(commentId: string): Promise<void> {
    const batch = writeBatch(db)
    const p = prefix()
    batch.delete(doc(db, `${p}Posts`, id.value, 'comments', commentId))
    batch.update(doc(db, `${p}Posts`, id.value), { commentCount: increment(-1) })
    await batch.commit()
  }

  return { comments, addComment, deleteComment }
}
