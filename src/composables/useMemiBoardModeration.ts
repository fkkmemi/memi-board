import { getAI, getGenerativeModel, GoogleAIBackend, Schema } from 'firebase/ai'
import { useFirebaseApp } from 'vuefire'
import { buildLocalBlockRegex, DEFAULT_LOCAL_BLOCKLIST, MODERATION_SYSTEM, parseModerationJson } from '../utils/moderation-prompt'
import { useMemiBoardConfig } from '../config'
import type { ModerationResult, ModerationVia } from '../types'

const APPROVED: ModerationResult = { flagged: false, category: 'none', reason: '', via: 'empty' }

function logModeration(
  phase: string,
  detail: Record<string, unknown>,
) {
  // 개발·테스트에서 항상 보이게 (프로덕션도 한 줄 info — 필요 시 나중에 dev only)
  console.info(`[memi-board:moderation] ${phase}`, detail)
}

/**
 * 글쓰기 전 블로킹 검열. 로컬 비속어 필터 → Firebase AI Logic(Gemini).
 * App Check limited-use 토큰 사용.
 */
export function useMemiBoardModeration() {
  const config = useMemiBoardConfig()
  const moderation = config.moderation ?? {}
  const app = useFirebaseApp()

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
    const modelName = moderation.model ?? 'gemini-2.5-flash'
    const ai = getAI(app, { backend: new GoogleAIBackend(), useLimitedUseAppCheckTokens: true })
    return {
      modelName,
      model: getGenerativeModel(ai, {
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
      }),
    }
  }

  function errorResult(): ModerationResult {
    if (moderation.onError === 'block') {
      return {
        flagged: true,
        category: 'other',
        reason: '검열 서비스에 일시적으로 연결할 수 없어 제출이 보류되었습니다. 잠시 후 다시 시도해 주세요.',
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

  async function checkText(text: string): Promise<ModerationResult> {
    const trimmed = text.trim()
    const preview = trimmed.slice(0, 80)

    logModeration('start', {
      preview,
      length: trimmed.length,
      enabled: moderation.enabled !== false,
      model: moderation.model ?? 'gemini-2.5-flash',
      onError: moderation.onError ?? 'allow',
    })

    if (!trimmed) {
      const r = { ...APPROVED, via: 'empty' as ModerationVia }
      logModeration('result', r)
      return r
    }

    const local = localCheck(trimmed)
    if (local) {
      const hit = trimmed.match(localBlockRe)?.[0]
      logModeration('local-block', { hit, ...local })
      logModeration('result', local)
      return local
    }
    logModeration('local-pass', { message: '로컬 금칙어 미매칭 → AI Logic 호출' })

    if (moderation.enabled === false) {
      const r: ModerationResult = { ...APPROVED, via: 'disabled' }
      logModeration('result', r)
      return r
    }

    try {
      const { model, modelName } = getModerationModel()
      logModeration('ai-call', { modelName, useLimitedUseAppCheckTokens: true })
      const t0 = performance.now()
      const result = await model.generateContent(`심사할 텍스트:\n"""${trimmed.slice(0, 4000)}"""`)
      const ms = Math.round(performance.now() - t0)
      const raw = result.response.text()
      logModeration('ai-raw', { ms, raw: raw.slice(0, 500) })

      const parsed = parseModerationJson(raw)
      if (!parsed) {
        logModeration('ai-parse-fail', { raw: raw.slice(0, 300) })
        const r = errorResult()
        logModeration('result', r)
        return r
      }
      const out: ModerationResult = {
        flagged: parsed.flagged,
        category: parsed.category as ModerationResult['category'],
        reason: parsed.reason,
        via: 'ai',
      }
      logModeration('result', { ...out, ms })
      return out
    }
    catch (e) {
      logModeration('ai-error', {
        message: e instanceof Error ? e.message : String(e),
        name: e instanceof Error ? e.name : undefined,
        // FirebaseError code 등
        code: (e as { code?: string })?.code,
      })
      const r = errorResult()
      logModeration('result', r)
      return r
    }
  }

  async function checkImage(file: File): Promise<ModerationResult> {
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

      const { model, modelName } = getModerationModel()
      logModeration('ai-image-call', { modelName, type: file.type, size: file.size })
      const result = await model.generateContent([
        { inlineData: { mimeType: file.type || 'image/jpeg', data: base64 } },
        '이 이미지를 심사해 주세요.',
      ])
      const raw = result.response.text()
      const parsed = parseModerationJson(raw)
      if (!parsed) {
        logModeration('ai-image-parse-fail', { raw: raw.slice(0, 300) })
        return errorResult()
      }
      const out: ModerationResult = {
        flagged: parsed.flagged,
        category: parsed.category as ModerationResult['category'],
        reason: parsed.reason,
        via: 'ai',
      }
      logModeration('ai-image-result', out)
      return out
    }
    catch (e) {
      logModeration('ai-image-error', { message: e instanceof Error ? e.message : String(e) })
      return errorResult()
    }
  }

  return { checkText, checkImage }
}
