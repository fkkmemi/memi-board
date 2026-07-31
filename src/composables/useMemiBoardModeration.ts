import { getAI, getGenerativeModel, GoogleAIBackend, Schema } from 'firebase/ai'
import { useFirebaseApp } from 'vuefire'
import { buildLocalBlockRegex, DEFAULT_LOCAL_BLOCKLIST, MODERATION_SYSTEM, parseModerationJson } from '../utils/moderation-prompt'
import { useMemiBoardConfig } from '../config'
import type { ModerationResult } from '../types'

const APPROVED: ModerationResult = { flagged: false, category: 'none', reason: '' }

/**
 * 글쓰기 전 블로킹 검열. 로컬 비속어 필터를 먼저 돌리고, 통과하면 Firebase AI Logic(Gemini)으로 재검사한다.
 * 검열 API 장애 시 동작은 moderation.onError 옵션을 따른다 (기본 'allow' — 검열 장애로 정상 글쓰기가 막히지 않도록).
 *
 * 알려진 한계: 이 검열은 클라이언트에서만 실행되므로, Firestore에 직접 쓰기하면 우회할 수 있다.
 * (서버가 없는 아키텍처의 근본적 한계 — README의 Security Model 참고)
 */
export function useMemiBoardModeration() {
  const config = useMemiBoardConfig()
  const moderation = config.moderation ?? {}
  const app = useFirebaseApp()

  const localBlockRe = buildLocalBlockRegex([...DEFAULT_LOCAL_BLOCKLIST, ...(moderation.localBlocklist ?? [])])

  function localCheck(text: string): ModerationResult | null {
    if (localBlockRe.test(text)) {
      return { flagged: true, category: 'abuse', reason: '욕설·비속어가 포함되어 게시할 수 없습니다. 표현을 바꿔 주세요.' }
    }
    return null
  }

  function getModerationModel() {
    const ai = getAI(app, { backend: new GoogleAIBackend(), useLimitedUseAppCheckTokens: true })
    return getGenerativeModel(ai, {
      model: moderation.model ?? 'gemini-2.5-flash',
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
        reason: '검열 서비스에 일시적으로 연결할 수 없어 제출이 보류되었습니다. 잠시 후 다시 시도해 주세요.',
        error: true,
      }
    }
    return { ...APPROVED, error: true }
  }

  async function checkText(text: string): Promise<ModerationResult> {
    const trimmed = text.trim()
    if (!trimmed) return APPROVED

    const local = localCheck(trimmed)
    if (local) return local

    if (moderation.enabled === false) return APPROVED

    try {
      const model = getModerationModel()
      const result = await model.generateContent(`심사할 텍스트:\n"""${trimmed.slice(0, 4000)}"""`)
      const parsed = parseModerationJson(result.response.text())
      if (!parsed) {
        console.warn('[memi-board] 검열 응답 파싱 실패 → onError 정책 적용')
        return errorResult()
      }
      return { flagged: parsed.flagged, category: parsed.category as ModerationResult['category'], reason: parsed.reason }
    }
    catch (e) {
      console.warn('[memi-board] AI 검열 호출 실패 → onError 정책 적용', e)
      return errorResult()
    }
  }

  async function checkImage(file: File): Promise<ModerationResult> {
    if (moderation.enabled === false || !moderation.moderateImages) return APPROVED

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
      const parsed = parseModerationJson(result.response.text())
      if (!parsed) return errorResult()
      return { flagged: parsed.flagged, category: parsed.category as ModerationResult['category'], reason: parsed.reason }
    }
    catch (e) {
      console.warn('[memi-board] 이미지 검열 호출 실패 → onError 정책 적용', e)
      return errorResult()
    }
  }

  return { checkText, checkImage }
}
