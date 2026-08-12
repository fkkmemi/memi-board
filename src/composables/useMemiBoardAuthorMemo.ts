import { computed, reactive, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { deleteDoc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { useFirestore } from 'vuefire'
import { useBoardPathConfig } from '../config'
import { authorMemoDoc } from '../utils/boardPaths'
import { useMemiBoardAuth } from './useMemiBoardAuth'
import type { AuthorMemoSentiment } from '../types'

export const AUTHOR_MEMO_MAX_LENGTH = 100

interface MemoEntry {
  text: string
  sentiment: AuthorMemoSentiment | null
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
    entry = reactive({ text: '', sentiment: null, loaded: false, pending: false, saving: false, error: '' })
    memoCache.set(key, entry)
  }
  return entry
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
    const ref_ = memoRef.value
    if (!ref_) return
    const entry = getEntry(cacheKey.value)
    entry.pending = true
    entry.error = ''
    try {
      const snapshot = await getDoc(ref_)
      const data = snapshot.data()
      entry.text = data ? ((data.text as string) ?? '') : ''
      entry.sentiment = data ? ((data.sentiment as AuthorMemoSentiment) ?? null) : null
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
      throw new Error(`메모는 ${AUTHOR_MEMO_MAX_LENGTH.toLocaleString()}자까지 작성할 수 있습니다.`)
    }
    const entry = getEntry(cacheKey.value)
    entry.saving = true
    entry.error = ''
    try {
      await setDoc(ref_, { text: trimmed, sentiment: nextSentiment, updatedAt: serverTimestamp() })
      entry.text = trimmed
      entry.sentiment = nextSentiment
      entry.loaded = true
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
      entry.loaded = true
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
