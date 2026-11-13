import { computed, onScopeDispose, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import type { Unsubscribe } from 'firebase/firestore'
import {
  documentId,
  getDoc,
  getDocs,
  limit as fbLimit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  runTransaction,
  where,
} from 'firebase/firestore'
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore'
import { useCurrentUser, useFirestore } from 'vuefire'
import { useBoardPathConfig } from '../config'
import { useMemiBoardAuth } from './useMemiBoardAuth'
import { commentDoc, commentReportDoc, reportDoc, reportDocById, reportsCol } from '../utils/boardPaths'
import type { BoardReportModel, BoardReportReason, BoardReportStatus } from '../types'
import type { MemiBoardLocale } from '../i18n/locales'
import { translate } from '../i18n/translate'
import { useMemiBoardI18n } from '../i18n/useMemiBoardI18n'
import { clampProfileName } from '../utils/profileLimits'

export const REPORT_DETAIL_MAX_LENGTH = 200
export const REPORT_REVIEW_NOTE_MAX_LENGTH = 200
/** 댓글 신고에 복제해 두는 본문 발췌 길이. */
export const REPORT_COMMENT_EXCERPT_MAX_LENGTH = 200
/**
 * 신고 사유 목록. `label` 은 호환용 한국어 원문이다 — 화면에는 `reportReasonLabel(value, locale)` 로
 * 현재 언어 문구를 쓴다.
 */
export const REPORT_REASONS: { value: BoardReportReason, label: string }[] = [
  { value: 'spam', label: '스팸·광고' },
  { value: 'abuse', label: '욕설·혐오·괴롭힘' },
  { value: 'adult', label: '음란물' },
  { value: 'illegal', label: '불법 정보' },
  { value: 'other', label: '기타' },
]

export function reportReasonLabel(reason: BoardReportReason | string | undefined, locale?: MemiBoardLocale) {
  if (REPORT_REASONS.some(item => item.value === reason)) return translate(locale, `reports.reason.${reason}`)
  return reason || translate(locale, 'reports.fallbackLabel')
}

type Translate = ReturnType<typeof useMemiBoardI18n>['t']

/** 글·댓글 신고 공통 사유 검증. 통과하면 정리된 reason/detail 을 돌려준다. */
function validateReportInput(
  t: Translate,
  input: { reason: BoardReportReason, detail?: string },
) {
  const reason = REPORT_REASONS.some(item => item.value === input.reason) ? input.reason : null
  if (!reason) throw new Error(t('reports.reasonRequired'))
  const detail = (input.detail || '').trim()
  if (reason === 'other' && !detail) throw new Error(t('reports.otherDetailRequired'))
  if (detail.length > REPORT_DETAIL_MAX_LENGTH) {
    throw new Error(t('reports.detailTooLong', { max: REPORT_DETAIL_MAX_LENGTH }))
  }
  return { reason, detail }
}

export function useMemiBoardReports(boardId: string, postId: string) {
  const cfg = () => useBoardPathConfig()
  const db = useFirestore()
  const user = useCurrentUser()
  const { t } = useMemiBoardI18n()

  const report = ref<BoardReportModel | null>(null)
  const hasReported = computed(() => !!report.value)
  const reportPending = ref(true)
  const reportError = ref('')
  let subscription = 0
  const pending = ref(false)
  let stop: Unsubscribe | undefined

  watch(user, (current) => {
    const version = ++subscription
    stop?.()
    stop = undefined
    report.value = null
    reportError.value = ''
    reportPending.value = !!current
    if (!current) return
    stop = onSnapshot(reportDoc(db, cfg(), postId, current.uid), (snap) => {
      if (version !== subscription) return
      report.value = snap.exists() ? { id: snap.id, ...snap.data() } as BoardReportModel : null
      reportPending.value = false
    }, (cause) => {
      if (version !== subscription) return
      reportError.value = t('reports.statusLoadFailed')
      reportPending.value = false
      console.error('[memi-board:reports] onSnapshot failed', cause)
    })
  }, { immediate: true })

  onScopeDispose(() => stop?.())

  async function submitReport(input: {
    reason: BoardReportReason
    detail?: string
    postTitle?: string
    authorUid?: string
    authorName?: string | null
  }): Promise<void> {
    const uid = user.value?.uid
    if (!uid) throw new Error(t('reports.signInRequired'))
    if (pending.value) return
    if (input.authorUid && input.authorUid === uid) throw new Error(t('reports.cannotReportOwn'))
    if (hasReported.value) throw new Error(t('reports.alreadyReported'))
    const { reason, detail } = validateReportInput(t, input)

    pending.value = true
    try {
      await setDoc(reportDoc(db, cfg(), postId, uid), {
        uid,
        target: 'post',
        postId,
        boardId,
        reason,
        detail,
        status: 'open',
        postTitle: (input.postTitle || '').trim().slice(0, 200),
        authorUid: input.authorUid || '',
        authorName: clampProfileName(input.authorName),
        createdAt: serverTimestamp(),
      })
      report.value = { uid, target: 'post', postId, boardId, reason, detail, status: 'open' } as BoardReportModel
    }
    finally {
      pending.value = false
    }
  }

  return { hasReported, report, reportPending, reportError, pending, submitReport }
}

/**
 * 댓글 하나의 신고. 댓글 목록에서 댓글마다 실시간 구독을 열지 않도록, 신고 상태는
 * `loadReport()` 를 부를 때(신고 버튼을 눌렀을 때) 한 번만 읽는다.
 */
export function useMemiBoardCommentReport(boardId: string, postId: string, commentId: string) {
  const cfg = () => useBoardPathConfig()
  const db = useFirestore()
  const user = useCurrentUser()
  const { t } = useMemiBoardI18n()

  const report = ref<BoardReportModel | null>(null)
  const hasReported = computed(() => !!report.value)
  const reportPending = ref(false)
  const reportError = ref('')
  const pending = ref(false)
  let loadVersion = 0

  watch(() => user.value?.uid, () => {
    loadVersion++
    report.value = null
    reportError.value = ''
    reportPending.value = false
  })

  async function loadReport(): Promise<void> {
    const uid = user.value?.uid
    if (!uid) return
    const version = ++loadVersion
    reportPending.value = true
    reportError.value = ''
    try {
      const snap = await getDoc(commentReportDoc(db, cfg(), commentId, uid))
      if (version !== loadVersion) return
      report.value = snap.exists() ? { id: snap.id, ...snap.data() } as BoardReportModel : null
    }
    catch (cause) {
      if (version !== loadVersion) return
      reportError.value = t('reports.statusLoadFailed')
      console.error('[memi-board:reports] comment report load failed', cause)
    }
    finally {
      if (version === loadVersion) reportPending.value = false
    }
  }

  async function submitReport(input: {
    reason: BoardReportReason
    detail?: string
    commentBody?: string
    postTitle?: string
    authorUid?: string
    authorName?: string | null
  }): Promise<void> {
    const uid = user.value?.uid
    if (!uid) throw new Error(t('reports.signInRequired'))
    if (pending.value) return
    if (input.authorUid && input.authorUid === uid) throw new Error(t('reports.cannotReportOwnComment'))
    if (hasReported.value) throw new Error(t('reports.alreadyReportedComment'))
    const { reason, detail } = validateReportInput(t, input)

    pending.value = true
    try {
      const data = {
        uid,
        target: 'comment' as const,
        postId,
        commentId,
        boardId,
        reason,
        detail,
        status: 'open' as const,
        postTitle: (input.postTitle || '').trim().slice(0, 200),
        commentExcerpt: (input.commentBody || '').trim().slice(0, REPORT_COMMENT_EXCERPT_MAX_LENGTH),
        authorUid: input.authorUid || '',
        authorName: clampProfileName(input.authorName),
      }
      await setDoc(commentReportDoc(db, cfg(), commentId, uid), { ...data, createdAt: serverTimestamp() })
      report.value = data as BoardReportModel
    }
    finally {
      pending.value = false
    }
  }

  return { hasReported, report, reportPending, reportError, pending, loadReport, submitReport }
}

const QUEUE_PAGE_SIZE = 20

export function useMemiBoardReportQueue(options: { pageSize?: number, boardId?: MaybeRefOrGetter<string>, status?: MaybeRefOrGetter<'open' | 'processed'> } = {}) {
  const cfg = () => useBoardPathConfig()
  const db = useFirestore()
  const { t } = useMemiBoardI18n()
  const { isAdmin, canManageContent, canManageBoard } = useMemiBoardAuth()
  const pageSize = options.pageSize ?? QUEUE_PAGE_SIZE
  const boardFilter = computed(() => toValue(options.boardId)?.trim() || '')

  const statusFilter = computed(() => toValue(options.status) ?? 'open')
  const statusConstraint = () => statusFilter.value === 'processed'
    ? where('status', 'in', ['dismissed', 'actioned'])
    : where('status', '==', 'open')
  const reports = ref<BoardReportModel[]>([])
  const pending = ref(true)
  const loadingMore = ref(false)
  const hasMore = ref(false)
  const loadError = ref('')
  let cursor: QueryDocumentSnapshot<DocumentData> | null = null
  let stop: Unsubscribe | undefined

  function mapDoc(item: QueryDocumentSnapshot<DocumentData>): BoardReportModel {
    return { id: item.id, ...item.data() } as BoardReportModel
  }

  let queueVersion = 0
  function startHead() {
    const version = ++queueVersion
    stop?.()
    reports.value = []
    cursor = null
    hasMore.value = false
    loadError.value = ''
    loadingMore.value = false
    if (!canManageContent.value || (!isAdmin.value && !boardFilter.value)) {
      reports.value = []
      pending.value = false
      return
    }
    pending.value = true
    const constraints = boardFilter.value
      ? [statusConstraint(), where('boardId', '==', boardFilter.value)]
      : [statusConstraint(), where('target', 'in', ['post', 'comment'])]
    stop = onSnapshot(query(
      reportsCol(db, cfg()),
      ...constraints,
      orderBy('createdAt', 'desc'),
      orderBy(documentId(), 'desc'),
      fbLimit(pageSize),
    ), (snapshot) => {
      if (version !== queueVersion) return
      reports.value = snapshot.docs.map(mapDoc).filter(item => canManageBoard(item.boardId))
      cursor = snapshot.docs.at(-1) ?? null
      hasMore.value = snapshot.docs.length >= pageSize
      pending.value = false
    }, (cause) => {
      if (version !== queueVersion) return
      console.error('[memi-board:report-queue] onSnapshot failed', cause)
      loadError.value = (cause as Error).message || String(cause)
      pending.value = false
    })
  }

  watch([canManageContent, isAdmin, boardFilter, statusFilter], startHead, { immediate: true })
  onScopeDispose(() => stop?.())

  async function loadMore() {
    if (loadingMore.value || !hasMore.value || !cursor || !canManageContent.value) return
    const version = queueVersion
    loadingMore.value = true
    loadError.value = ''
    try {
      const constraints = boardFilter.value
        ? [statusConstraint(), where('boardId', '==', boardFilter.value)]
        : [statusConstraint(), where('target', 'in', ['post', 'comment'])]
      const snapshot = await getDocs(query(
        reportsCol(db, cfg()),
        ...constraints,
        orderBy('createdAt', 'desc'),
        orderBy(documentId(), 'desc'),
        startAfter(cursor),
        fbLimit(pageSize + 1),
      ))
      if (version !== queueVersion) return
      const pageDocs = snapshot.docs.slice(0, pageSize)
      const existing = new Set(reports.value.map(item => item.id))
      reports.value.push(...pageDocs.map(mapDoc).filter(item => !existing.has(item.id) && canManageBoard(item.boardId)))
      cursor = pageDocs.at(-1) ?? cursor
      hasMore.value = snapshot.docs.length > pageSize
    }
    catch (cause) {
      if (version !== queueVersion) return
      loadError.value = (cause as Error).message || String(cause)
    }
    finally {
      if (version === queueVersion) loadingMore.value = false
    }
  }

  /**
   * @param options.blindComment 댓글 신고를 검토 완료할 때 같은 트랜잭션에서 댓글도 블라인드한다.
   *   댓글이 이미 지워졌으면 블라인드는 건너뛰고 신고 상태만 바꾼다.
   */
  async function resolveReport(
    report: BoardReportModel,
    status: Exclude<BoardReportStatus, 'open'>,
    note = '',
    options: { blindComment?: boolean } = {},
  ) {
    const current = useCurrentUser().value
    if (!current || !report.id || !canManageBoard(report.boardId)) throw new Error(t('reports.manageRequired'))
    const reviewNote = note.trim()
    if (!reviewNote) throw new Error(t('reports.reviewNoteRequired'))
    if (reviewNote.length > REPORT_REVIEW_NOTE_MAX_LENGTH) throw new Error(t('reports.detailTooLong', { max: REPORT_REVIEW_NOTE_MAX_LENGTH }))
    // Two reviewers cannot overwrite each other's decision.
    await runTransaction(db, async transaction => {
      // Use the stored document ID: comment reports are keyed by commentId, not postId.
      const target = reportDocById(db, cfg(), report.id!)
      const snapshot = await transaction.get(target)
      const comment = options.blindComment && status === 'actioned' && report.target === 'comment' && report.commentId
        ? commentDoc(db, cfg(), report.commentId)
        : null
      const commentSnapshot = comment ? await transaction.get(comment) : null
      if (!snapshot.exists() || snapshot.data().status !== 'open') throw new Error(t('reports.alreadyReviewed'))
      if (comment && commentSnapshot?.exists() && !commentSnapshot.data().isBlinded) {
        transaction.update(comment, { isBlinded: true, moderatedAt: serverTimestamp(), moderatedBy: current.uid })
      }
      transaction.update(target, {
        status,
        reviewedAt: serverTimestamp(),
        reviewedBy: current.uid,
        reviewedByName: current.displayName?.trim().slice(0, 80) || null,
        reviewNote,
      })
    })
  }

  return {
    reports,
    pending,
    loadingMore,
    hasMore,
    loadError,
    loadMore,
    dismissReport: (report: BoardReportModel, note?: string) => resolveReport(report, 'dismissed', note),
    actionReport: (report: BoardReportModel, note?: string, options?: { blindComment?: boolean }) =>
      resolveReport(report, 'actioned', note, options),
  }
}
