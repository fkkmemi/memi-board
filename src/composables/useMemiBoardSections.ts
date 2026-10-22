import { computed } from 'vue'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { useDocument, useFirestore } from 'vuefire'
import type { BoardSection, BoardSectionCols, BoardSectionHeight, BoardSectionKind, BoardSectionLayout, BoardSectionSort } from '../types'
import { BOARD_SECTION_COLS, clampSectionCount } from '../utils/section'
import type { MemiBoardLocale } from '../i18n/locales'
import { translate } from '../i18n/translate'
import { useMemiBoardI18n } from '../i18n/useMemiBoardI18n'
import { coversLocales, mergeSourceFields, readI18nSource, readLocalizedFields } from '../utils/localizedFields'
import { useMemiBoardAutoTranslate } from './useMemiBoardAutoTranslate'

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

function defaultSectionTitle(order: number, locale?: MemiBoardLocale) {
  return translate(locale, 'sections.defaultTitle', { n: order + 1 })
}

export function normalizeBoardSection(raw: Record<string, unknown>, order: number, locale?: MemiBoardLocale): BoardSection {
  const kind = asKind(raw)
  const count = clampSectionCount(kind, raw.count)
  const i18n = readLocalizedFields(raw.i18n)
  const i18nSource = readI18nSource(raw.i18nSource)
  return {
    id: String(raw.id || `box-${order + 1}`),
    title: String(raw.title || defaultSectionTitle(order, locale)),
    showTitle: raw.showTitle !== false,
    kind,
    boardId: asBoardId(raw),
    count,
    postIds: asPostIds(raw, count),
    sort: asSort(raw),
    cols: asCols(raw),
    height: asHeight(raw),
    order,
    ...(i18n ? { i18n } : {}),
    ...(i18nSource ? { i18nSource } : {}),
  }
}

/** 호스트 `settings/homeLayout` 문서를 읽는다. 기존 메인 레이아웃 경로를 유지한다. */
export function useMemiBoardSections() {
  const { locale } = useMemiBoardI18n()
  const { translateEntries } = useMemiBoardAutoTranslate()
  const db = useFirestore()
  const settingsRef = doc(db, 'settings', 'homeLayout')
  const { data: settings, pending } = useDocument<BoardSectionLayout>(settingsRef)

  const sections = computed(() => {
    const source = Array.isArray(settings.value?.blocks) ? settings.value.blocks : DEFAULT_BOARD_SECTIONS
    return source.map((block, index) => normalizeBoardSection(block as unknown as Record<string, unknown>, index, locale.value))
  })

  async function withSectionTranslations(list: BoardSection[]): Promise<BoardSection[]> {
    const source = locale.value
    const pending = list.filter((section) => {
      const title = section.title.trim()
      if (!title) return false
      return !(section.i18nSource?.title === title && coversLocales(section.i18n, ['title']))
    })
    if (!pending.length) return list
    const translated = await translateEntries(pending.map(section => ({
      id: section.id,
      fields: { title: section.title.trim() },
      context: section.kind,
    })), {
      source,
      purpose: 'section heading on a website home page',
    })
    return list.map((section) => {
      const row = translated[section.id]
      if (!row) return section
      const title = section.title.trim()
      const i18n = mergeSourceFields(source, { title }, row)
      if (!coversLocales(i18n, ['title'])) return section
      return { ...section, title, i18n, i18nSource: { locale: source, title } }
    })
  }

  function sectionPayload(block: BoardSection, order: number) {
    const raw = block as unknown as Record<string, unknown>
    const kind = asKind(raw)
    const count = clampSectionCount(kind, block.count)
    const title = block.title.trim() || defaultSectionTitle(order, locale.value)
    return {
      id: block.id,
      title,
      showTitle: block.showTitle !== false,
      kind,
      boardId: asBoardId(raw),
      count,
      postIds: asPostIds(raw, count),
      sort: asSort(raw),
      cols: asCols(raw),
      height: asHeight(raw),
      order,
      ...(block.i18n ? { i18n: block.i18n } : {}),
      ...(block.i18nSource?.title === title ? { i18nSource: block.i18nSource } : {}),
    }
  }

  async function saveSections(next: BoardSection[]) {
    let blocks = next
    try {
      blocks = await withSectionTranslations(next)
    }
    catch (cause) {
      console.warn('[memi-board] section translation skipped', cause)
    }
    await setDoc(settingsRef, {
      columns: 12,
      blocks: blocks.map((block, order) => sectionPayload(block, order)),
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