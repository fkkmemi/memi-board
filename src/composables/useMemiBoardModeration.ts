import { getAI, getGenerativeModel, GoogleAIBackend, Schema } from 'firebase/ai'
import { useFirebaseApp } from 'vuefire'
import { buildLocalBlockRegex, DEFAULT_LOCAL_BLOCKLIST, MODERATION_SYSTEM, parseModerationJson } from '../utils/moderation-prompt'
import { useMemiBoardConfig } from '../config'
import { useMemiBoardAuth } from './useMemiBoardAuth'
import type { ModerationResult, ModerationVia } from '../types'

const APPROVED: ModerationResult = { flagged: false, category: 'none', reason: '', via: 'empty' }

/**
 * 글쓰기 전 블로킹 검열.
 * 이용 제한 확인 → 로컬 비속어 → Firebase AI Logic(Gemini).
 * 콘텐츠 차단(local/ai) 시 boardUsers 경고 누적.
 */
export function useMemiBoardModeration() {
  const config = useMemiBoardConfig()
  const moderation = config.moderation ?? {}
  const app = useFirebaseApp()
  const {
    isWriteRestricted,
    restrictedMessage,
    recordContentModerationBlock,
  } = useMemiBoardAuth()

  const localBlockRe = buildLocalBlockRegex([...DEFAULT_LOCAL_BLOCKLIST, ...(moderation.localBlocklist ?? [])])

  function localCheck(text: string): ModerationResult | null {
    const match = text.match(localBlockRe)
    if (match) {
      return {
        flagged: true,
        category: 'abuse',
        reason: '욕설·비속어가 포함되어 게시할 수 없습니다. 표현을 바꿔 주세요.',
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
      systemInstruction: MODERATION_SYSTEM,
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
        reason: '내용 검토에 실패해 글을 등록할 수 없습니다. 잠시 후 다시 시도해 주세요.',
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

  /** 콘텐츠 위반(local/ai)만 경고 누적. API 오류·이용제한 자체는 제외. */
  async function applyStrikeIfContentBlock(result: ModerationResult): Promise<ModerationResult> {
    if (!result.flagged || result.error) return result
    if (result.via !== 'local' && result.via !== 'ai') return result
    try {
      const { messageSuffix } = await recordContentModerationBlock()
      if (messageSuffix) {
        return {
          ...result,
          reason: `${result.reason || '게시할 수 없는 내용이 포함되어 있습니다.'}${messageSuffix}`,
        }
      }
    }
    catch (e) {
      console.warn('[memi-board] record moderation strike failed', e instanceof Error ? e.message : e)
    }
    return result
  }

  async function checkText(text: string): Promise<ModerationResult> {
    if (isWriteRestricted.value) {
      return {
        flagged: true,
        category: 'other',
        reason: restrictedMessage.value
          || '콘텐츠 경고가 누적되어 글·댓글 작성이 잠시 제한됐어요.',
        via: 'restricted',
      }
    }

    const trimmed = text.trim()
    if (!trimmed) {
      return { ...APPROVED, via: 'empty' as ModerationVia }
    }

    const local = localCheck(trimmed)
    if (local) return applyStrikeIfContentBlock(local)

    if (moderation.enabled === false) {
      return { ...APPROVED, via: 'disabled' }
    }

    try {
      const model = getModerationModel()
      const result = await model.generateContent(`심사할 텍스트:\n"""${trimmed.slice(0, 4000)}"""`)
      const raw = result.response.text()
      const parsed = parseModerationJson(raw)
      if (!parsed) return errorResult()
      const out: ModerationResult = {
        flagged: parsed.flagged,
        category: parsed.category as ModerationResult['category'],
        reason: parsed.reason,
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
          || '콘텐츠 경고가 누적되어 글·댓글 작성이 잠시 제한됐어요.',
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
        '이 이미지를 심사해 주세요.',
      ])
      const raw = result.response.text()
      const parsed = parseModerationJson(raw)
      if (!parsed) return errorResult()
      const out: ModerationResult = {
        flagged: parsed.flagged,
        category: parsed.category as ModerationResult['category'],
        reason: parsed.reason,
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
