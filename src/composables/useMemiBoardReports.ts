import { computed, onScopeDispose, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import type { Unsubscribe } from 'firebase/firestore'
import {
  documentId,
  getDocs,
  limit as fbLimit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
} from 'firebase/firestore'
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore'
import { useCurrentUser, useFirestore } from 'vuefire'
import { useBoardPathConfig } from '../config'
import { useMemiBoardAuth } from './useMemiBoardAuth'
import { reportDoc, reportsCol } from '../utils/boardPaths'
import type { BoardReportModel, BoardReportReason, BoardReportStatus } from '../types'

export const REPORT_DETAIL_MAX_LENGTH = 200
export const REPORT_REASONS: { value: BoardReportReason, label: string }[] = [
  { value: 'spam', label: '스팸·광고' },
  { value: 'abuse', label: '욕설·혐오·괴롭힘' },
  { value: 'adult', label: '음란물' },
  { value: 'illegal', label: '불법 정보' },
  { value: 'other', label: '기타' },
]

export function reportReasonLabel(reason: BoardReportReason | string | undefined) {
  return REPORT_REASONS.find(item => item.value === reason)?.label || reason || '신고'
}

export function useMemiBoardReports(boardId: string, postId: string) {
  const cfg = () => useBoardPathConfig()
  const db = useFirestore()
  const user = useCurrentUser()

  const hasReported = ref(false)
  const pending = ref(false)
  let stop: Unsubscribe | undefined

  watch(user, (current) => {
    stop?.()
    stop = undefined
    if (!current) {
      hasReported.value = false
      return
    }
    stop = onSnapshot(reportDoc(db, cfg(), postId, current.uid), (snap) => {
      hasReported.value = snap.exists()
    }, (cause) => {
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
    if (!uid) throw new Error('로그인이 필요합니다.')
    if (pending.value) return
    if (input.authorUid && input.authorUid === uid) throw new Error('자신의 글은 신고할 수 없습니다.')
    const reason = REPORT_REASONS.some(item => item.value === input.reason) ? input.reason : null
    if (!reason) throw new Error('신고 사유를 선택해 주세요.')
    const detail = (input.detail || '').trim()
    if (detail.length > REPORT_DETAIL_MAX_LENGTH) {
      throw new Error(`자세한 내용은 ${REPORT_DETAIL_MAX_LENGTH}자까지입니다.`)
    }

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
        authorName: input.authorName ?? null,
        createdAt: serverTimestamp(),
      })
      hasReported.value = true
    }
    finally {
      pending.value = false
    }
  }

  return { hasReported, pending, submitReport }
}

const QUEUE_PAGE_SIZE = 20

export function useMemiBoardReportQueue(options: { pageSize?: number, boardId?: MaybeRefOrGetter<string> } = {}) {
  const cfg = () => useBoardPathConfig()
  const db = useFirestore()
  const { canManageContent, canManageBoard } = useMemiBoardAuth()
  const pageSize = options.pageSize ?? QUEUE_PAGE_SIZE
  const boardFilter = computed(() => toValue(options.boardId)?.trim() || '')

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

  function startHead() {
    stop?.()
    if (!canManageContent.value) {
      reports.value = []
      pending.value = false
      return
    }
    pending.value = true
    const constraints = boardFilter.value
      ? [where('status', '==', 'open'), where('boardId', '==', boardFilter.value)]
      : [where('status', '==', 'open'), where('target', '==', 'post')]
    stop = onSnapshot(query(
      reportsCol(db, cfg()),
      ...constraints,
      orderBy('createdAt', 'desc'),
      orderBy(documentId(), 'desc'),
      fbLimit(pageSize),
    ), (snapshot) => {
      reports.value = snapshot.docs.map(mapDoc).filter(item => canManageBoard(item.boardId))
      cursor = snapshot.docs.at(-1) ?? null
      hasMore.value = snapshot.docs.length >= pageSize
      pending.value = false
    }, (cause) => {
      console.error('[memi-board:report-queue] onSnapshot failed', cause)
      loadError.value = (cause as Error).message || String(cause)
      pending.value = false
    })
  }

  watch([canManageContent, boardFilter], startHead, { immediate: true })
  onScopeDispose(() => stop?.())

  async function loadMore() {
    if (loadingMore.value || !hasMore.value || !cursor || !canManageContent.value) return
    loadingMore.value = true
    loadError.value = ''
    try {
      const constraints = boardFilter.value
        ? [where('status', '==', 'open'), where('boardId', '==', boardFilter.value)]
        : [where('status', '==', 'open'), where('target', '==', 'post')]
      const snapshot = await getDocs(query(
        reportsCol(db, cfg()),
        ...constraints,
        orderBy('createdAt', 'desc'),
        orderBy(documentId(), 'desc'),
        startAfter(cursor),
        fbLimit(pageSize + 1),
      ))
      const pageDocs = snapshot.docs.slice(0, pageSize)
      const existing = new Set(reports.value.map(item => item.id))
      reports.value.push(...pageDocs.map(mapDoc).filter(item => !existing.has(item.id) && canManageBoard(item.boardId)))
      cursor = pageDocs.at(-1) ?? cursor
      hasMore.value = snapshot.docs.length > pageSize
    }
    catch (cause) {
      loadError.value = (cause as Error).message || String(cause)
    }
    finally {
      loadingMore.value = false
    }
  }

  async function resolveReport(report: BoardReportModel, status: Exclude<BoardReportStatus, 'open'>) {
    if (!report.id || !canManageBoard(report.boardId)) return
    await updateDoc(reportDoc(db, cfg(), report.postId, report.uid), {
      status,
      reviewedAt: serverTimestamp(),
      reviewedBy: useCurrentUser().value?.uid || '',
    })
  }

  return {
    reports,
    pending,
    loadingMore,
    hasMore,
    loadError,
    loadMore,
    dismissReport: (report: BoardReportModel) => resolveReport(report, 'dismissed'),
    actionReport: (report: BoardReportModel) => resolveReport(report, 'actioned'),
  }
}
