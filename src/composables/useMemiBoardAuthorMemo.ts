import { computed, reactive, ref, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import type { Firestore } from 'firebase/firestore'
import { deleteDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore'
import { useFirestore } from 'vuefire'
import { useBoardPathConfig } from '../config'
import { authorMemoDoc, authorMemosCollection } from '../utils/boardPaths'
import { useMemiBoardAuth } from './useMemiBoardAuth'
import { useMemiBoardI18n } from '../i18n/useMemiBoardI18n'
import type { AuthorMemoSentiment } from '../types'

export const AUTHOR_MEMO_MAX_LENGTH = 100
/** 한 사람이 남길 수 있는 작성자 메모 개수. 목록·닷 표시가 메모 전체를 한 번에 읽어서 상한을 둔다. */
export const AUTHOR_MEMO_MAX_COUNT = 100

interface MemoEntry {
  text: string
  sentiment: AuthorMemoSentiment | null
  /** 정렬용 — 서버 updatedAt(ms). 방금 저장한 건 Date.now(). */
  updatedAt: number
  loaded: boolean
  pending: boolean
  saving: boolean
  error: string
}

/**
 * 같은 작성자가 목록에 여러 번 나오면 AuthorMenu 인스턴스도 여러 개 생기는데,
 * 각자 따로 상태를 들고 있으면 한쪽에서 저장해도 다른 쪽 아이콘·내용이 그대로다.
 * targetUid(+viewerUid)로 캐시를 키잉해서 모든 인스턴스가 같은 reactive 상태를
 * 공유하게 한다 — 하나가 저장하면 화면에 있는 나머지도 즉시 반응한다.
 */
const memoCache = new Map<string, MemoEntry>()

function getEntry(key: string): MemoEntry {
  let entry = memoCache.get(key)
  if (!entry) {
    entry = reactive({ text: '', sentiment: null, updatedAt: 0, loaded: false, pending: false, saving: false, error: '' })
    memoCache.set(key, entry)
  }
  return entry
}

/**
 * 뷰어별로 memos 서브컬렉션 전체를 한 번만 읽는다. 목록에 작성자가 수십 명 나와도
 * 문서마다 getDoc 하지 않고 쿼리 한 번으로 모든 AuthorMenu 의 메모 표시가 채워진다.
 * 실패하면 캐시를 비워 다음 호출에서 다시 시도한다.
 */
const viewerLoads = new Map<string, Promise<void>>()

/** memoCache 는 일반 Map 이라 키 추가·삭제를 못 따라간다 — 목록 computed 가 이 값을 구독한다. */
const memoListVersion = ref(0)

function loadViewerMemos(db: Firestore, cfg: ReturnType<typeof useBoardPathConfig>, viewerUid: string): Promise<void> {
  let promise = viewerLoads.get(viewerUid)
  if (!promise) {
    promise = (async () => {
      const snapshot = await getDocs(query(authorMemosCollection(db, cfg, viewerUid), orderBy('updatedAt', 'desc'), limit(AUTHOR_MEMO_MAX_COUNT)))
      for (const d of snapshot.docs) {
        const target = getEntry(`${viewerUid}:${d.id}`)
        if (target.saving) continue
        const data = d.data()
        target.text = (data.text as string) ?? ''
        target.sentiment = (data.sentiment as AuthorMemoSentiment) ?? null
        target.updatedAt = data.updatedAt?.toMillis?.() ?? 0
      }
      markViewerLoaded(viewerUid)
      memoListVersion.value++
    })()
    promise.catch(() => viewerLoads.delete(viewerUid))
    viewerLoads.set(viewerUid, promise)
  }
  return promise
}

function hasMemo(entry: MemoEntry): boolean {
  return !!entry.text || !!entry.sentiment
}

function countViewerMemos(viewerUid: string): number {
  let count = 0
  for (const [key, entry] of memoCache) {
    if (key.startsWith(`${viewerUid}:`) && hasMemo(entry)) count++
  }
  return count
}

function markViewerLoaded(viewerUid: string): void {
  for (const [key, entry] of memoCache) {
    if (key.startsWith(`${viewerUid}:`)) entry.loaded = true
  }
}

/**
 * 다른 작성자에 대해 나만 보는 개인 메모 + 좋음/나쁨 평가. memiBoardUsers/{내uid}/memos/{targetUid}에
 * 저장되고, 문서 ID가 targetUid라 대상당 메모가 항상 하나다(재저장 시 덮어씀).
 * 다른 사용자·관리자는 규칙상 아예 못 읽으므로 비속어 필터 등 별도 검증이 없다.
 */
export function useMemiBoardAuthorMemo(targetUid: MaybeRefOrGetter<string>) {
  const db = useFirestore()
  const cfg = () => useBoardPathConfig()
  const { user } = useMemiBoardAuth()
  const { t, formatNumber } = useMemiBoardI18n()

  const targetUidValue = computed(() => toValue(targetUid))
  const cacheKey = computed(() => `${user.value?.uid ?? ''}:${targetUidValue.value}`)
  const memoRef = computed(() => {
    const viewerUid = user.value?.uid
    const target = targetUidValue.value
    if (!viewerUid || !target) return null
    return authorMemoDoc(db, cfg(), viewerUid, target)
  })

  const text = computed({
    get: () => getEntry(cacheKey.value).text,
    set: (value: string) => { getEntry(cacheKey.value).text = value },
  })
  const sentiment = computed(() => getEntry(cacheKey.value).sentiment)
  const loaded = computed(() => getEntry(cacheKey.value).loaded)
  const pending = computed(() => getEntry(cacheKey.value).pending)
  const saving = computed(() => getEntry(cacheKey.value).saving)
  const error = computed(() => getEntry(cacheKey.value).error)

  async function load(): Promise<void> {
    const viewerUid = user.value?.uid
    if (!viewerUid || !targetUidValue.value) return
    const entry = getEntry(cacheKey.value)
    if (entry.loaded) return
    const promise = loadViewerMemos(db, cfg(), viewerUid)
    entry.pending = true
    entry.error = ''
    try {
      await promise
      // 쿼리 이후에 처음 마운트된 작성자는 메모가 없는 것 — loaded 로 표시한다.
      entry.loaded = true
    }
    catch (e) {
      entry.error = (e as Error).message || String(e)
      console.error('[memi-board:authorMemo] load failed', e)
    }
    finally {
      entry.pending = false
    }
  }

  /** 좋음/나쁨 버튼이 곧 저장 버튼이다 — 평가 없이 텍스트만 저장하는 경로는 없다. */
  async function save(nextText: string, nextSentiment: AuthorMemoSentiment): Promise<void> {
    const ref_ = memoRef.value
    if (!ref_) return
    const trimmed = nextText.trim()
    if (trimmed.length > AUTHOR_MEMO_MAX_LENGTH) {
      throw new Error(t('authorMemo.tooLong', { max: formatNumber(AUTHOR_MEMO_MAX_LENGTH) }))
    }
    const entry = getEntry(cacheKey.value)
    entry.saving = true
    entry.error = ''
    try {
      // 새 대상에게 처음 남기는 메모만 개수 상한에 걸린다 — 기존 메모 덮어쓰기는 항상 허용.
      const viewerUid = user.value!.uid
      await loadViewerMemos(db, cfg(), viewerUid)
      if (!hasMemo(entry) && countViewerMemos(viewerUid) >= AUTHOR_MEMO_MAX_COUNT) {
        throw new Error(t('authorMemo.limitReached', { max: formatNumber(AUTHOR_MEMO_MAX_COUNT) }))
      }
      await setDoc(ref_, { text: trimmed, sentiment: nextSentiment, updatedAt: serverTimestamp() })
      entry.text = trimmed
      entry.sentiment = nextSentiment
      entry.updatedAt = Date.now()
      entry.loaded = true
      memoListVersion.value++
    }
    catch (e) {
      entry.error = (e as Error).message || String(e)
      console.error('[memi-board:authorMemo] save failed', e)
      throw e
    }
    finally {
      entry.saving = false
    }
  }

  async function remove(): Promise<void> {
    const ref_ = memoRef.value
    if (!ref_) return
    const entry = getEntry(cacheKey.value)
    entry.saving = true
    entry.error = ''
    try {
      await deleteDoc(ref_)
      entry.text = ''
      entry.sentiment = null
      entry.updatedAt = 0
      entry.loaded = true
      memoListVersion.value++
    }
    catch (e) {
      entry.error = (e as Error).message || String(e)
      console.error('[memi-board:authorMemo] remove failed', e)
      throw e
    }
    finally {
      entry.saving = false
    }
  }

  return { text, sentiment, loaded, pending, saving, error, load, save, remove }
}

export interface MyAuthorMemo {
  targetUid: string
  text: string
  sentiment: AuthorMemoSentiment | null
  updatedAt: number
}

/**
 * 내가 남긴 작성자 메모 전체(최근 수정 순). 내 프로필에서 목록으로 보여줄 때 쓴다.
 * AuthorMenu 와 같은 캐시를 공유하므로 목록에서 고치면 다른 화면의 닷·툴팁도 같이 바뀐다.
 */
export function useMemiBoardMyAuthorMemos() {
  const db = useFirestore()
  const { user } = useMemiBoardAuth()
  const pending = ref(false)
  const error = ref('')

  const memos = computed<MyAuthorMemo[]>(() => {
    void memoListVersion.value
    const viewerUid = user.value?.uid
    if (!viewerUid) return []
    const prefix = `${viewerUid}:`
    const list: MyAuthorMemo[] = []
    for (const [key, entry] of memoCache) {
      if (!key.startsWith(prefix)) continue
      if (!entry.text && !entry.sentiment) continue
      list.push({ targetUid: key.slice(prefix.length), text: entry.text, sentiment: entry.sentiment, updatedAt: entry.updatedAt })
    }
    return list.sort((a, b) => b.updatedAt - a.updatedAt)
  })

  async function load(): Promise<void> {
    const viewerUid = user.value?.uid
    if (!viewerUid) return
    pending.value = true
    error.value = ''
    try {
      await loadViewerMemos(db, useBoardPathConfig(), viewerUid)
    }
    catch (e) {
      error.value = (e as Error).message || String(e)
      console.error('[memi-board:authorMemo] list failed', e)
    }
    finally {
      pending.value = false
    }
  }

  return { memos, pending, error, load }
}
