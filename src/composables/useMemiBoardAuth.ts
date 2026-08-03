import { ref, computed, watch } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import { useFirestore, useFirebaseAuth, useCurrentUser } from 'vuefire'
import { doc, getDoc, setDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore'
import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth'
import type { User } from 'firebase/auth'
import { useMemiBoardConfig } from '../config'
import type { PostModel, CommentModel } from '../types'
import {
  DEFAULT_BLOCK_BAN_DECAY_MS,
  DEFAULT_BLOCK_BAN_THRESHOLD,
  effectiveModerationBlockCount,
  formatRestrictedUntilLabel,
  isModerationWriteRestricted,
  moderationWriteRestrictedUntilMs,
  toBlockAtMs,
} from '../utils/moderation-strike'

export interface UseMemiBoardAuthReturn {
  user: ReturnType<typeof useCurrentUser>
  isSignedIn: ComputedRef<boolean>
  isAdmin: ComputedRef<boolean>
  rolePending: Ref<boolean>
  /** 유효 검열 차단 누적 (lazy decay 반영) */
  moderationBlockCount: ComputedRef<number>
  /** 글·댓글 작성 제한 중 */
  isWriteRestricted: ComputedRef<boolean>
  restrictedUntilLabel: ComputedRef<string | null>
  restrictedMessage: ComputedRef<string | null>
  signInWithGoogle: () => ReturnType<typeof signInWithPopup>
  signInWithApple: () => ReturnType<typeof signInWithPopup>
  signInWithEmail: (email: string, password: string) => ReturnType<typeof signInWithEmailAndPassword>
  signUpWithEmail: (email: string, password: string, displayName?: string) => ReturnType<typeof createUserWithEmailAndPassword>
  signOut: () => Promise<void>
  canEdit: (post: Pick<PostModel, 'authorUid'>) => boolean
  canDelete: (post: Pick<PostModel, 'authorUid'>) => boolean
  canDeleteComment: (comment: Pick<CommentModel, 'authorUid'>) => boolean
  /** 콘텐츠 검열 차단 1회 기록 후 메시지 조각 반환 */
  recordContentModerationBlock: () => Promise<{
    effectiveCount: number
    restricted: boolean
    messageSuffix: string
  }>
  refreshBoardUser: () => Promise<void>
}

const AUTH_STATE_KEY = '__MEMI_BOARD_AUTH_STATE__' as const

type BoardAuthShared = {
  role: Ref<'user' | 'admin'>
  rolePending: Ref<boolean>
  rawBlockCount: Ref<number>
  blockAtMs: Ref<number | null>
  watchStarted: boolean
}

function getSharedAuthState(): BoardAuthShared {
  const g = globalThis as typeof globalThis & { [AUTH_STATE_KEY]?: BoardAuthShared }
  if (!g[AUTH_STATE_KEY]) {
    g[AUTH_STATE_KEY] = {
      role: ref<'user' | 'admin'>('user'),
      rolePending: ref(true),
      rawBlockCount: ref(0),
      blockAtMs: ref<number | null>(null),
      watchStarted: false,
    }
  }
  return g[AUTH_STATE_KEY]
}

/**
 * 인증 상태 + 게시판 역할(role) + 검열 차단 누적.
 * role·경고 카운트는 globalThis 공유 (여러 composable 호출이 같은 상태).
 */
export function useMemiBoardAuth(): UseMemiBoardAuthReturn {
  const config = useMemiBoardConfig()
  const shared = getSharedAuthState()
  const db = useFirestore()
  const auth = useFirebaseAuth()
  const user = useCurrentUser()

  const { role, rolePending, rawBlockCount, blockAtMs } = shared

  function banThreshold(): number {
    const t = config.moderation?.blockBanThreshold
    if (t === 0) return 0
    return typeof t === 'number' && t > 0 ? Math.floor(t) : DEFAULT_BLOCK_BAN_THRESHOLD
  }

  function banDecayMs(): number {
    const d = config.moderation?.blockBanDecayMs
    return typeof d === 'number' && d > 0 ? d : DEFAULT_BLOCK_BAN_DECAY_MS
  }

  function roleDocRef(uid: string) {
    return doc(db, `${config.collectionPrefix}Users`, uid)
  }

  function applyUserData(data: Record<string, unknown> | undefined) {
    if (!data) {
      rawBlockCount.value = 0
      blockAtMs.value = null
      return
    }
    rawBlockCount.value = Math.max(0, Math.floor(Number(data.moderationBlockCount) || 0))
    blockAtMs.value = toBlockAtMs(data.moderationBlockAt)
  }

  async function ensureUserDoc(firebaseUser: User): Promise<'user' | 'admin'> {
    const ref = roleDocRef(firebaseUser.uid)
    const snap = await getDoc(ref)
    if (!snap.exists()) {
      await setDoc(ref, {
        role: 'user',
        displayName: firebaseUser.displayName,
        updatedAt: serverTimestamp(),
      })
      applyUserData({ moderationBlockCount: 0 })
      return 'user'
    }
    const data = snap.data() as Record<string, unknown>
    applyUserData(data)
    await updateDoc(ref, {
      displayName: firebaseUser.displayName,
      updatedAt: serverTimestamp(),
    })
    return (data.role as 'user' | 'admin') ?? 'user'
  }

  async function refreshBoardUser() {
    const uid = user.value?.uid
    if (!uid) {
      applyUserData(undefined)
      return
    }
    const snap = await getDoc(roleDocRef(uid))
    applyUserData(snap.exists() ? snap.data() as Record<string, unknown> : undefined)
  }

  if (!shared.watchStarted) {
    shared.watchStarted = true
    watch(
      user,
      async (current) => {
        rolePending.value = true
        if (!current) {
          role.value = 'user'
          applyUserData(undefined)
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
  }

  const isSignedIn = computed(() => !!user.value)
  const isAdmin = computed(() => role.value === 'admin')

  const moderationBlockCount = computed(() =>
    effectiveModerationBlockCount(
      rawBlockCount.value,
      blockAtMs.value,
      Date.now(),
      banDecayMs(),
    ),
  )

  const isWriteRestricted = computed(() => {
    const th = banThreshold()
    if (th <= 0) return false
    return isModerationWriteRestricted(
      rawBlockCount.value,
      blockAtMs.value,
      Date.now(),
      th,
      banDecayMs(),
    )
  })

  const restrictedUntilLabel = computed(() => {
    const th = banThreshold()
    if (th <= 0) return null
    const until = moderationWriteRestrictedUntilMs(
      rawBlockCount.value,
      blockAtMs.value,
      Date.now(),
      th,
      banDecayMs(),
    )
    return until != null ? formatRestrictedUntilLabel(until) : null
  })

  const restrictedMessage = computed(() => {
    if (!isWriteRestricted.value) return null
    const until = restrictedUntilLabel.value
    return until
      ? `콘텐츠 경고가 누적되어 글·댓글 작성이 잠시 제한됐어요. (${until})`
      : '콘텐츠 경고가 누적되어 글·댓글 작성이 잠시 제한됐어요.'
  })

  async function recordContentModerationBlock() {
    const uid = user.value?.uid
    const threshold = banThreshold()
    if (!uid || threshold <= 0) {
      return { effectiveCount: 0, restricted: false, messageSuffix: '' }
    }

    const ref = roleDocRef(uid)
    const snap = await getDoc(ref)
    if (!snap.exists()) {
      await setDoc(ref, {
        role: 'user',
        displayName: user.value?.displayName ?? null,
        moderationBlockCount: 1,
        moderationBlockAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    }
    else {
      await updateDoc(ref, {
        moderationBlockCount: increment(1),
        moderationBlockAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    }

    // increment 직후 getDoc 이 로컬 캐시로 바로 반영됨
    const nextCount = (snap.exists()
      ? Math.max(0, Math.floor(Number((snap.data() as Record<string, unknown>).moderationBlockCount) || 0))
      : 0) + 1
    const nextAt = Date.now()
    rawBlockCount.value = nextCount
    blockAtMs.value = nextAt

    const effectiveCount = effectiveModerationBlockCount(
      nextCount,
      nextAt,
      nextAt,
      banDecayMs(),
    )
    const restricted = isModerationWriteRestricted(
      nextCount,
      nextAt,
      nextAt,
      threshold,
      banDecayMs(),
    )
    // 앞 사유 문장과 이어 붙일 접미 (공백·구분자 포함)
    let messageSuffix = ` (경고 ${effectiveCount}/${threshold})`
    if (restricted) {
      const until = moderationWriteRestrictedUntilMs(
        nextCount,
        nextAt,
        nextAt,
        threshold,
        banDecayMs(),
      )
      const untilLabel = until != null ? formatRestrictedUntilLabel(until, nextAt) : null
      messageSuffix = untilLabel
        ? ` 경고 ${effectiveCount}회가 되어 글·댓글 작성이 제한됩니다 (${untilLabel}).`
        : ` 경고 ${effectiveCount}회가 되어 글·댓글 작성이 제한됩니다.`
    }
    return { effectiveCount, restricted, messageSuffix }
  }

  function requireAuth() {
    if (!auth) throw new Error('[memi-board] Firebase Auth가 초기화되지 않았습니다.')
    return auth
  }

  async function signInWithGoogle() {
    return signInWithPopup(requireAuth(), new GoogleAuthProvider())
  }

  async function signInWithApple() {
    const provider = new OAuthProvider('apple.com')
    provider.addScope('email')
    provider.addScope('name')
    return signInWithPopup(requireAuth(), provider)
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
    moderationBlockCount,
    isWriteRestricted,
    restrictedUntilLabel,
    restrictedMessage,
    signInWithGoogle,
    signInWithApple,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    canEdit,
    canDelete: canEdit,
    canDeleteComment,
    recordContentModerationBlock,
    refreshBoardUser,
  }
}
