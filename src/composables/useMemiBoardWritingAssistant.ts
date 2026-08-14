import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai'
import { useFirebaseApp } from 'vuefire'
import { useMemiBoardConfig } from '../config'

export type WritingAssistantAction =
  | 'proofread'
  | 'polish'
  | 'continue'
  | 'summarize'
  | 'translate-en'
  | 'translate-ko'
  | 'title'

interface WritingAssistantInput {
  action: WritingAssistantAction
  content: string
  title?: string
  selection?: boolean
}

const INSTRUCTIONS: Record<WritingAssistantAction, string> = {
  proofread: '맞춤법, 띄어쓰기, 문법 오류만 고쳐라. 의미와 말투는 바꾸지 마라.',
  polish: '뜻과 작성자의 말투를 유지하면서 더 자연스럽고 읽기 좋은 문장으로 다듬어라.',
  continue: '앞의 맥락과 말투에 맞는 내용을 과장 없이 한두 문단 이어서 작성하라.',
  summarize: '핵심 정보는 보존하면서 원문의 약 절반 길이로 간결하게 줄여라.',
  'translate-en': '자연스러운 영어로 번역하라. 고유명사와 기술 용어는 정확히 유지하라.',
  'translate-ko': '자연스러운 한국어로 번역하라. 고유명사와 기술 용어는 정확히 유지하라.',
  title: '본문을 대표하는 간결한 한국어 제목 하나를 만들어라. 따옴표나 설명 없이 제목만 출력하라.',
}

function cleanModelOutput(value: string): string {
  return value.trim()
    .replace(/^```(?:html|text)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
}

/** 검열과 동일한 Firebase AI Logic 연결을 사용하는 글쓰기 도우미. */
export function useMemiBoardWritingAssistant() {
  const app = useFirebaseApp()
  const config = useMemiBoardConfig()

  async function assist(input: WritingAssistantInput): Promise<string> {
    const moderation = config.moderation ?? {}
    const ai = getAI(app, {
      backend: new GoogleAIBackend(),
      useLimitedUseAppCheckTokens: moderation.useLimitedUseAppCheckTokens !== false,
    })
    const model = getGenerativeModel(ai, {
      model: moderation.model ?? 'gemini-3.5-flash-lite',
      systemInstruction: [
        '너는 게시판 글쓰기 편집 도우미다.',
        '사용자가 요청한 편집 결과만 출력하고 설명, 인사, 마크다운 코드 펜스를 붙이지 마라.',
        input.action === 'title' || input.selection
          ? '출력은 일반 텍스트로 작성하라.'
          : '입력의 HTML 구조와 링크, 이미지 태그를 보존하고 결과도 HTML 조각으로 출력하라.',
      ].join('\n'),
      generationConfig: {
        temperature: input.action === 'continue' || input.action === 'title' ? 0.6 : 0.2,
        maxOutputTokens: 2048,
      },
    })
    const source = input.content.trim()
    if (!source) throw new Error('AI로 다듬을 내용을 먼저 입력해 주세요.')
    const prompt = [
      `작업: ${INSTRUCTIONS[input.action]}`,
      input.title ? `현재 제목: ${input.title}` : '',
      `본문:\n${source.slice(0, 12000)}`,
    ].filter(Boolean).join('\n\n')
    const result = await model.generateContent(prompt)
    const output = cleanModelOutput(result.response.text())
    if (!output) throw new Error('AI가 결과를 만들지 못했습니다. 다시 시도해 주세요.')
    return output
  }

  return { assist }
}
