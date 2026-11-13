import type { BoardCustomField } from '../types'

/** 보드당 커스텀 필드 개수. 글의 extend 키와 1:1 이다. */
export const CUSTOM_FIELD_MAX = 20
export const CUSTOM_FIELD_LABEL_MAX = 40
/** 글쓰기 입력칸에 희미하게 보여 주는 예시. */
export const CUSTOM_FIELD_PLACEHOLDER_MAX = 80
/** 글에 저장하는 값. 버전 문자열처럼 짧게 둔다. */
export const CUSTOM_FIELD_VALUE_MAX = 200

/** 영문 소문자로 시작, 영문·숫자·밑줄, 1–32자. fwFrom 같은 카멜케이스를 허용한다. */
const CUSTOM_FIELD_KEY = /^[a-z][A-Za-z0-9_]{0,31}$/

export type CustomFieldIssue =
  | { code: 'invalidKey' }
  | { code: 'duplicateKey', key: string }
  | { code: 'labelRequired', key: string }
  | { code: 'tooMany' }

function fieldKey(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function fieldLabel(value: unknown): string {
  const label = typeof value === 'string' ? value.trim() : ''
  return label.slice(0, CUSTOM_FIELD_LABEL_MAX)
}

function fieldPlaceholder(value: unknown): string {
  const placeholder = typeof value === 'string' ? value.trim() : ''
  return placeholder.slice(0, CUSTOM_FIELD_PLACEHOLDER_MAX)
}

function toCustomField(key: string, label: string, placeholder: string): BoardCustomField {
  return placeholder ? { key, label, placeholder } : { key, label }
}

/** 저장된 값에서 형식에 맞는 항목만 남긴다. 빈 값과 중복 키는 버린다. */
export function readCustomFields(value: unknown): BoardCustomField[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const fields: BoardCustomField[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const raw = item as Record<string, unknown>
    const key = fieldKey(raw.key)
    const label = fieldLabel(raw.label)
    if (!CUSTOM_FIELD_KEY.test(key) || !label || seen.has(key)) continue
    seen.add(key)
    fields.push(toCustomField(key, label, fieldPlaceholder(raw.placeholder)))
    if (fields.length >= CUSTOM_FIELD_MAX) break
  }
  return fields
}

/**
 * 저장 전에 입력 행을 검사한다. 키와 이름이 둘 다 비어 있는 행은 뺀다.
 * 남은 행이 형식에 맞지 않으면 저장하지 않는다.
 */
export function prepareCustomFields(fields: BoardCustomField[] | undefined): { fields: BoardCustomField[], issue: CustomFieldIssue | null } {
  const filled = (fields ?? []).filter(field => fieldKey(field?.key) || fieldLabel(field?.label) || fieldPlaceholder(field?.placeholder))
  if (filled.length > CUSTOM_FIELD_MAX) return { fields: [], issue: { code: 'tooMany' } }
  const seen = new Set<string>()
  const next: BoardCustomField[] = []
  for (const field of filled) {
    const key = fieldKey(field.key)
    const label = fieldLabel(field.label)
    const placeholder = fieldPlaceholder(field.placeholder)
    if (!CUSTOM_FIELD_KEY.test(key)) return { fields: [], issue: { code: 'invalidKey' } }
    if (seen.has(key)) return { fields: [], issue: { code: 'duplicateKey', key } }
    if (!label) return { fields: [], issue: { code: 'labelRequired', key } }
    seen.add(key)
    next.push(toCustomField(key, label, placeholder))
  }
  return { fields: next, issue: null }
}

/** 글에 저장된 extend. 문자 값만 남기고 빈 값은 뺀다. */
export function readExtend(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: Record<string, string> = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!CUSTOM_FIELD_KEY.test(key) || typeof raw !== 'string') continue
    const text = raw.trim().slice(0, CUSTOM_FIELD_VALUE_MAX)
    if (text) out[key] = text
  }
  return out
}

/** 보드에 선언된 키의 값만 모은다. 비어 있는 칸은 저장하지 않는다. */
export function extendForFields(values: Record<string, string>, fields: BoardCustomField[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const field of fields) {
    const text = (values[field.key] ?? '').trim().slice(0, CUSTOM_FIELD_VALUE_MAX)
    if (text) out[field.key] = text
  }
  return out
}
