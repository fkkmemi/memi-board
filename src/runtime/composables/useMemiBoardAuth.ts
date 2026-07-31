import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth'
import type { User } from 'firebase/auth'
import type { PostModel, CommentModel } from '../types'

/**
 * 인증 상태 + 게시판 역할(role) 관리.
 * role은 {prefix}Users/{uid} 문서에서만 읽고, 모듈은 절대 'admin'을 쓰지 않는다
 * (관리자 승격은 호스트 프로젝트 소유자가 Firebase 콘솔에서 직접 설정).
 */
export function useMemiBoardAuth() {
  const config = useRuntimeConfig().public.memiBoard as { collectionPrefix: string }
  const db = useFirestore()
  const auth = useFirebaseAuth()
  const user = useCurrentUser()

  const role = ref<'user' | 'admin'>('user')
  const rolePending = ref(true)

  function roleDocRef(uid: string) {
    return doc(db, `${config.collectionPrefix}Users`, uid)
  }

  /** 최초 로그인 시 역할 문서를 생성(role: 'user' 고정)하고, 이후에는 표시용 정보만 갱신한다. */
  async function ensureUserDoc(firebaseUser: User): Promise<'user' | 'admin'> {
    const ref = roleDocRef(firebaseUser.uid)
    const snap = await getDoc(ref)
    if (!snap.exists()) {
      await setDoc(ref, {
        role: 'user',
        displayName: firebaseUser.displayName,
        updatedAt: serverTimestamp(),
      })
      return 'user'
    }
    await updateDoc(ref, {
      displayName: firebaseUser.displayName,
      updatedAt: serverTimestamp(),
    })
    return (snap.data().role as 'user' | 'admin') ?? 'user'
  }

  watch(
    user,
    async (current) => {
      rolePending.value = true
      if (!current) {
        role.value = 'user'
        rolePending.value = false
        return
      }
      try {
        role.value = await ensureUserDoc(current)
      }
      catch {
        role.value = 'user'
      }
      finally {
        rolePending.value = false
      }
    },
    { immediate: true },
  )

  const isSignedIn = computed(() => !!user.value)
  const isAdmin = computed(() => role.value === 'admin')

  function requireAuth() {
    if (!auth) throw new Error('[memi-board] Firebase Auth가 초기화되지 않았습니다.')
    return auth
  }

  async function signInWithGoogle() {
    return signInWithPopup(requireAuth(), new GoogleAuthProvider())
  }

  async function signInWithEmail(email: string, password: string) {
    return signInWithEmailAndPassword(requireAuth(), email, password)
  }

  async function signUpWithEmail(email: string, password: string, displayName?: string) {
    const credential = await createUserWithEmailAndPassword(requireAuth(), email, password)
    if (displayName) await updateProfile(credential.user, { displayName })
    return credential
  }

  async function signOut() {
    await firebaseSignOut(requireAuth())
  }

  function canEdit(post: Pick<PostModel, 'authorUid'>) {
    return isSignedIn.value && (user.value?.uid === post.authorUid || isAdmin.value)
  }

  function canDeleteComment(comment: Pick<CommentModel, 'authorUid'>) {
    return isSignedIn.value && (user.value?.uid === comment.authorUid || isAdmin.value)
  }

  return {
    user,
    isSignedIn,
    isAdmin,
    rolePending,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    canEdit,
    canDelete: canEdit,
    canDeleteComment,
  }
}
