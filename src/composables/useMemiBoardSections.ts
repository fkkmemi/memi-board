import { computed } from 'vue'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { useDocument, useFirestore } from 'vuefire'
import type { BoardSection, BoardSectionCols, BoardSectionHeight, BoardSectionKind, BoardSectionLayout, BoardSectionSort } from '../types'
import { BOARD_SECTION_COLS, clampSectionCount } from '../utils/section'

export const DEFAULT_BOARD_SECTIONS: BoardSection[] = []

function asCols(raw: Record<string, unknown>): BoardSectionCols {
  const cols = Number(raw.cols)
  if ((BOARD_SECTION_COLS as number[]).includes(cols)) return cols as BoardSectionCols
  const width = raw.width
  if (width === 'xs') return 3
  if (width === 'sm') return 4
  if (width === 'lg' || Number(raw.span) === 2) return 12
  return 6
}

function asHeight(raw: Record<string, unknown>): BoardSectionHeight {
  const height = raw.height ?? raw.size
  return height === 'sm' || height === 'lg' ? height : 'md'
}

function asKind(raw: Record<string, unknown>): BoardSectionKind {
  if (raw.kind === 'post' || raw.kind === 'comments') return raw.kind
  return 'list'
}

function asSort(raw: Record<string, unknown>): BoardSectionSort {
  return raw.sort === 'likes' ? 'likes' : 'latest'
}

function asBoardId(raw: Record<string, unknown>): string | null {
  const id = typeof raw.boardId === 'string' ? raw.boardId.trim() : ''
  return id || null
}

function asPostIds(raw: Record<string, unknown>, count: number): string[] {
  const source = Array.isArray(raw.postIds) ? raw.postIds : []
  const ids: string[] = []
  for (const value of source) {
    const id = String(value || '').trim()
    if (!id || ids.includes(id)) continue
    ids.push(id)
    if (ids.length >= count) break
  }
  return ids
}

export function normalizeBoardSection(raw: Record<string, unknown>, order: number): BoardSection {
  const kind = asKind(raw)
  const count = clampSectionCount(kind, raw.count)
  return {
    id: String(raw.id || `box-${order + 1}`),
    title: String(raw.title || `섹션 ${order + 1}`),
    showTitle: raw.showTitle !== false,
    kind,
    boardId: asBoardId(raw),
    count,
    postIds: asPostIds(raw, count),
    sort: asSort(raw),
    cols: asCols(raw),
    height: asHeight(raw),
    order,
  }
}

/** 호스트 `settings/homeLayout` 문서를 읽는다. 기존 메인 레이아웃 경로를 유지한다. */
export function useMemiBoardSections() {
  const db = useFirestore()
  const settingsRef = doc(db, 'settings', 'homeLayout')
  const { data: settings, pending } = useDocument<BoardSectionLayout>(settingsRef)

  const sections = computed(() => {
    const source = Array.isArray(settings.value?.blocks) ? settings.value.blocks : DEFAULT_BOARD_SECTIONS
    return source.map((block, index) => normalizeBoardSection(block as unknown as Record<string, unknown>, index))
  })

  async function saveSections(next: BoardSection[]) {
    await setDoc(settingsRef, {
      columns: 12,
      blocks: next.map((block, order) => {
        const raw = block as unknown as Record<string, unknown>
        const kind = asKind(raw)
        const count = clampSectionCount(kind, block.count)
        return {
          id: block.id,
          title: block.title.trim() || `섹션 ${order + 1}`,
          showTitle: block.showTitle !== false,
          kind,
          boardId: asBoardId(raw),
          count,
          postIds: asPostIds(raw, count),
          sort: asSort(raw),
          cols: asCols(raw),
          height: asHeight(raw),
          order,
        }
      }),
      updatedAt: serverTimestamp(),
    })
  }

  const hasSavedLayout = computed(() => Array.isArray(settings.value?.blocks))

  return {
    settings,
    pending,
    sections,
    blocks: sections,
    hasSavedLayout,
    saveSections,
    saveBlocks: saveSections,
  }
}