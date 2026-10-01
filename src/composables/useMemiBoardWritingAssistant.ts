import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai'
import { runTransaction, serverTimestamp } from 'firebase/firestore'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useCurrentUser, useFirebaseApp, useFirestore } from 'vuefire'
import { useBoardPathConfig, useMemiBoardConfig } from '../config'
import { boardUserDoc } from '../utils/boardPaths'
import { memiBoardLanguageLabel } from '../utils/moderation-prompt'
import { normalizeMemiBoardLocale, type MemiBoardLocale } from '../i18n/locales'
import { translate, type MemiBoardMessageParams } from '../i18n/translate'
import { useMemiBoardI18n } from '../i18n/useMemiBoardI18n'

export const WRITING_ASSISTANT_DAILY_LIMIT = 10
const WRITING_ASSISTANT_WINDOW_MS = 24 * 60 * 60 * 1000

export type WritingAssistantAction =
  | 'proofread'
  | 'polish'
  | 'continue'
  | 'summarize'
  | 'translate-en'
  | 'translate-ko'
  | 'title'
  | 'custom'

const CUSTOM_INSTRUCTION_MAX_LENGTH = 200

interface WritingAssistantInput {
  action: WritingAssistantAction
  content: string
  title?: string
  selection?: boolean
  /** action이 'custom'일 때 사용자가 직접 입력한 지시문 (예: "경상도 사투리 스타일로") */
  customInstruction?: string
}

type BuiltInAction = Exclude<WritingAssistantAction, 'custom'>

/** 한국어 보드용 원문 지시문 (ko) */
const INSTRUCTIONS: Record<BuiltInAction, string> = {
  proofread: '맞춤법, 띄어쓰기, 문법 오류만 고쳐라. 의미와 말투는 바꾸지 마라.',
  polish: '뜻과 작성자의 말투를 유지하면서 더 자연스럽고 읽기 좋은 문장으로 다듬어라.',
  continue: '앞의 맥락과 말투에 맞는 내용을 과장 없이 한두 문단 이어서 작성하라.',
  summarize: '핵심 정보는 보존하면서 원문의 약 절반 길이로 간결하게 줄여라.',
  'translate-en': '자연스러운 영어로 번역하라. 고유명사와 기술 용어는 정확히 유지하라.',
  'translate-ko': '자연스러운 한국어로 번역하라. 고유명사와 기술 용어는 정확히 유지하라.',
  title: '본문을 대표하는 간결한 한국어 제목 하나를 만들어라. 따옴표나 설명 없이 제목만 출력하라.',
}

/** ko 외 언어용 영어 지시문. 결과는 보드 언어로 쓰도록 language 를 넣는다. */
function englishInstructions(language: string): Record<BuiltInAction, string> {
  return {
    proofread: 'Fix only spelling, spacing, and grammar errors. Do not change the meaning or tone.',
    polish: 'Refine the text into more natural, readable sentences while keeping the meaning and the author\'s tone.',
    continue: 'Continue writing one or two paragraphs that match the preceding context and tone, without exaggeration.',
    summarize: 'Shorten the text concisely to about half of its original length while preserving the key information.',
    'translate-en': 'Translate into natural English. Keep proper nouns and technical terms accurate.',
    'translate-ko': 'Translate into natural Korean. Keep proper nouns and technical terms accurate.',
    title: `Create one concise title in ${language} that represents the body. Output only the title, without quotes or explanation.`,
  }
}

type Translator = (key: string, params?: MemiBoardMessageParams) => string

function resolveInstruction(input: WritingAssistantInput, locale: MemiBoardLocale, t: Translator): string {
  const ko = locale === 'ko'
  const language = memiBoardLanguageLabel(locale)
  if (input.action !== 'custom') {
    if (ko) return INSTRUCTIONS[input.action]
    const base = englishInstructions(language)[input.action]
    // 번역 작업은 대상 언어가 정해져 있으므로 보드 언어 지시를 덧붙이지 않는다.
    if (input.action === 'translate-en' || input.action === 'translate-ko' || input.action === 'title') return base
    return `${base} Write the result in the same language as the original text; if unclear, write in ${language}.`
  }
  const custom = input.customInstruction?.trim().slice(0, CUSTOM_INSTRUCTION_MAX_LENGTH)
  if (!custom) throw new Error(t('writingAssistant.customRequired'))
  return ko
    ? `뜻은 유지하면서 다음 스타일 지시를 반영해 다시 써라: ${custom}`
    : `Rewrite the text applying the following style instruction while keeping the meaning: ${custom}`
}

function cleanModelOutput(value: string): string {
  return value.trim()
    .replace(/^```(?:html|text)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
}

function timestampMs(value: unknown): number | null {
  if (!value || typeof value !== 'object') return null
  if ('toMillis' in value && typeof (value as { toMillis: () => number }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis()
  }
  return null
}

export interface UseMemiBoardWritingAssistantOptions {
  /**
   * 보드 언어. 같은 컴포넌트에서 useMemiBoardI18n({ boardLocale }) 로 provide 한 값은
   * 자기 자신에게 inject 되지 않으므로, 그 경우 여기로 넘긴다(예: Editor 의 locale).
   */
  locale?: MaybeRefOrGetter<string | undefined | null>
}

/** 검열과 동일한 Firebase AI Logic 연결을 사용하는 글쓰기 도우미. */
export function useMemiBoardWritingAssistant(options: UseMemiBoardWritingAssistantOptions = {}) {
  const i18n = useMemiBoardI18n()
  const locale = computed<MemiBoardLocale>(() => normalizeMemiBoardLocale(toValue(options.locale)) ?? i18n.locale.value)
  const t: Translator = (key, params) => translate(locale.value, key, params)
  const app = useFirebaseApp()
  const db = useFirestore()
  const user = useCurrentUser()
  const config = useMemiBoardConfig()

  async function reserveDailyUse(): Promise<void> {
    const uid = user.value?.uid
    if (!uid) throw new Error(t('writingAssistant.loginRequired'))

    await runTransaction(db, async (transaction) => {
      const ref = boardUserDoc(db, useBoardPathConfig(), uid)
      const snapshot = await transaction.get(ref)
      if (!snapshot.exists()) throw new Error(t('writingAssistant.userMissing'))

      const data = snapshot.data() as Record<string, unknown>
      const previousAt = timestampMs(data.aiWritingWindowAt)
      const previousCount = Math.max(0, Math.floor(Number(data.aiWritingCount) || 0))
      const now = Date.now()
      const activeWindow = previousAt != null && now - previousAt < WRITING_ASSISTANT_WINDOW_MS
      if (activeWindow && previousCount >= WRITING_ASSISTANT_DAILY_LIMIT) {
        const resetAt = previousAt + WRITING_ASSISTANT_WINDOW_MS
        const hours = Math.max(1, Math.ceil((resetAt - now) / (60 * 60 * 1000)))
        throw new Error(t('writingAssistant.dailyLimit', { limit: WRITING_ASSISTANT_DAILY_LIMIT, hours }))
      }

      transaction.update(ref, {
        aiWritingCount: activeWindow ? previousCount + 1 : 1,
        aiWritingWindowAt: activeWindow ? data.aiWritingWindowAt : serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    })
  }

  async function assist(input: WritingAssistantInput): Promise<string> {
    const lang = locale.value
    const ko = lang === 'ko'
    const instruction = resolveInstruction(input, lang, t)
    if (!input.content.trim()) throw new Error(t('writingAssistant.contentRequired'))
    await reserveDailyUse()
    const moderation = config.moderation ?? {}
    const ai = getAI(app, {
      backend: new GoogleAIBackend(),
      useLimitedUseAppCheckTokens: moderation.useLimitedUseAppCheckTokens !== false,
    })
    const model = getGenerativeModel(ai, {
      model: moderation.model ?? 'gemini-3.5-flash-lite',
      systemInstruction: (ko
        ? [
            '너는 게시판 글쓰기 편집 도우미다.',
            '사용자가 요청한 편집 결과만 출력하고 설명, 인사, 마크다운 코드 펜스를 붙이지 마라.',
            input.action === 'title' || input.selection
              ? '출력은 일반 텍스트로 작성하라.'
              : '입력의 HTML 구조와 링크, 이미지 태그를 보존하고 결과도 HTML 조각으로 출력하라.',
          ]
        : [
            'You are an editing assistant for writing message board posts.',
            'Output only the requested edit result. Do not add explanations, greetings, or markdown code fences.',
            input.action === 'title' || input.selection
              ? 'Write the output as plain text.'
              : 'Preserve the HTML structure, links, and image tags of the input, and output the result as an HTML fragment as well.',
          ]).join('\n'),
      generationConfig: {
        temperature: input.action === 'continue' || input.action === 'title' || input.action === 'custom' ? 0.6 : 0.2,
        maxOutputTokens: 2048,
      },
    })
    const source = input.content.trim()
    const prompt = (ko
      ? [
          `작업: ${instruction}`,
          input.title ? `현재 제목: ${input.title}` : '',
          `본문:\n${source.slice(0, 12000)}`,
        ]
      : [
          `Task: ${instruction}`,
          input.title ? `Current title: ${input.title}` : '',
          `Body:\n${source.slice(0, 12000)}`,
        ]).filter(Boolean).join('\n\n')
    const result = await model.generateContent(prompt)
    const output = cleanModelOutput(result.response.text())
    if (!output) throw new Error(t('writingAssistant.emptyResult'))
    return output
  }

  return { assist }
}
