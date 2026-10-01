import { getAI, getGenerativeModel, GoogleAIBackend, Schema } from 'firebase/ai'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useFirebaseApp } from 'vuefire'
import {
  buildLocalBlockRegex,
  DEFAULT_LOCAL_BLOCKLIST,
  buildModerationImagePrompt,
  buildModerationPrompt,
  buildModerationTextPrompt,
  formatModerationUserReason,
  parseModerationJson,
} from '../utils/moderation-prompt'
import { useMemiBoardConfig } from '../config'
import { normalizeMemiBoardLocale, type MemiBoardLocale } from '../i18n/locales'
import { useMemiBoardI18n } from '../i18n/useMemiBoardI18n'
import { useMemiBoardAuth } from './useMemiBoardAuth'
import { translate } from '../i18n/translate'
import type { ModerationResult, ModerationVia } from '../types'

const APPROVED: ModerationResult = { flagged: false, category: 'none', reason: '', via: 'empty' }

/**
 * 글쓰기 전 블로킹 검열.
 * 이용 제한 확인 → 로컬 비속어 → Firebase AI Logic(Gemini).
 * 콘텐츠 차단(local/ai) 시 board users 경고 누적.
 */
export function useMemiBoardModeration(options: {
  /** 보드 언어. 같은 컴포넌트에서 boardLocale 을 provide 했다면 그 locale 을 넘긴다(자기 자신에게 inject 되지 않음). */
  locale?: MaybeRefOrGetter<string | undefined | null>
} = {}) {
  const promptI18n = useMemiBoardI18n()
  const promptLocale = computed<MemiBoardLocale>(() => normalizeMemiBoardLocale(toValue(options.locale)) ?? promptI18n.locale.value)
  const config = useMemiBoardConfig()
  const moderation = config.moderation ?? {}
  const app = useFirebaseApp()
  const t = (key: string) => translate(promptLocale.value, key)
  const {
    isWriteRestricted,
    restrictedMessage,
    recordContentModerationBlock,
  } = useMemiBoardAuth()

  const localBlockRe = buildLocalBlockRegex([...DEFAULT_LOCAL_BLOCKLIST, ...(moderation.localBlocklist ?? [])])

  function localCheck(text: string): ModerationResult | null {
    const match = text.match(localBlockRe)
    if (match) {
      const hit = match[0] || ''
      return {
        flagged: true,
        category: 'abuse',
        reason: formatModerationUserReason({ via: 'local', localHit: hit, category: 'abuse' }),
        via: 'local',
      }
    }
    return null
  }

  function getModerationModel() {
    const modelName = moderation.model ?? 'gemini-3.5-flash-lite'
    const useLimited = moderation.useLimitedUseAppCheckTokens !== false
    const ai = getAI(app, {
      backend: new GoogleAIBackend(),
      useLimitedUseAppCheckTokens: useLimited,
    })
    return getGenerativeModel(ai, {
      model: modelName,
      systemInstruction: buildModerationPrompt(promptLocale.value),
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 256,
        responseMimeType: 'application/json',
        responseSchema: Schema.object({
          properties: {
            flagged: Schema.boolean(),
            category: Schema.string(),
            reason: Schema.string(),
          },
        }),
      },
    })
  }

  function errorResult(): ModerationResult {
    if (moderation.onError === 'block') {
      return {
        flagged: true,
        category: 'other',
        reason: t('moderation.reviewFailed'),
        error: true,
        via: 'ai-error-block',
      }
    }
    return {
      flagged: false,
      category: 'none',
      reason: '',
      error: true,
      via: 'ai-error-allow',
    }
  }

  /** 사유 + 경고 횟수를 한 문장으로 */
  function withUserFacingReason(result: ModerationResult, messageSuffix = ''): ModerationResult {
    const why = formatModerationUserReason({
      reason: result.reason,
      category: result.category,
      via: result.via,
    })
    // 예: 「시발」 같은 표현은… (경고 2/3)
    const reason = messageSuffix ? `${why}${messageSuffix}` : why
    return { ...result, reason }
  }

  /** 콘텐츠 위반(local/ai)만 경고 누적. API 오류·이용제한 자체는 제외. */
  async function applyStrikeIfContentBlock(result: ModerationResult): Promise<ModerationResult> {
    if (!result.flagged || result.error) return result
    if (result.via !== 'local' && result.via !== 'ai') return result
    try {
      const { messageSuffix } = await recordContentModerationBlock()
      return withUserFacingReason(result, messageSuffix)
    }
    catch (e) {
      console.warn('[memi-board] record moderation strike failed', e instanceof Error ? e.message : e)
      return withUserFacingReason(result)
    }
  }

  async function checkText(text: string, opts?: { skipFilter?: boolean }): Promise<ModerationResult> {
    if (isWriteRestricted.value) {
      return {
        flagged: true,
        category: 'other',
        reason: restrictedMessage.value
          || t('moderation.writeRestricted'),
        via: 'restricted',
      }
    }

    const trimmed = text.trim()
    if (!trimmed) {
      return { ...APPROVED, via: 'empty' as ModerationVia }
    }

    if (opts?.skipFilter) {
      return { ...APPROVED, via: 'admin-override' }
    }

    const local = localCheck(trimmed)
    if (local) return applyStrikeIfContentBlock(local)

    if (moderation.enabled === false) {
      return { ...APPROVED, via: 'disabled' }
    }

    try {
      const model = getModerationModel()
      const result = await model.generateContent(buildModerationTextPrompt(trimmed, promptLocale.value))
      const raw = result.response.text()
      const parsed = parseModerationJson(raw)
      if (!parsed) return errorResult()
      const out: ModerationResult = {
        flagged: parsed.flagged,
        category: parsed.category as ModerationResult['category'],
        reason: formatModerationUserReason({
          reason: parsed.reason,
          category: parsed.category,
          via: 'ai',
        }),
        via: 'ai',
      }
      if (out.flagged) return applyStrikeIfContentBlock(out)
      return out
    }
    catch (e) {
      console.warn('[memi-board] moderation AI failed', e instanceof Error ? e.message : e)
      return errorResult()
    }
  }

  async function checkImage(file: File): Promise<ModerationResult> {
    if (isWriteRestricted.value) {
      return {
        flagged: true,
        category: 'other',
        reason: restrictedMessage.value
          || t('moderation.writeRestricted'),
        via: 'restricted',
      }
    }

    if (moderation.enabled === false || !moderation.moderateImages) {
      return { ...APPROVED, via: 'disabled' }
    }

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '')
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const model = getModerationModel()
      const result = await model.generateContent([
        { inlineData: { mimeType: file.type || 'image/jpeg', data: base64 } },
        buildModerationImagePrompt(promptLocale.value),
      ])
      const raw = result.response.text()
      const parsed = parseModerationJson(raw)
      if (!parsed) return errorResult()
      const out: ModerationResult = {
        flagged: parsed.flagged,
        category: parsed.category as ModerationResult['category'],
        reason: formatModerationUserReason({
          reason: parsed.reason,
          category: parsed.category,
          via: 'ai',
        }),
        via: 'ai',
      }
      if (out.flagged) return applyStrikeIfContentBlock(out)
      return out
    }
    catch (e) {
      console.warn('[memi-board] moderation AI image failed', e instanceof Error ? e.message : e)
      return errorResult()
    }
  }

  return { checkText, checkImage }
}
