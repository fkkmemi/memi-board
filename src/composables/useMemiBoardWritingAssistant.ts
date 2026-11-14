import { getAI, getGenerativeModel, GoogleAIBackend, ImageConfigAspectRatio, ImageConfigImageSize, ResponseModality } from 'firebase/ai'
import { runTransaction, serverTimestamp } from 'firebase/firestore'
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useCurrentUser, useFirebaseApp, useFirestore } from 'vuefire'
import { assertMemiBoardAiEnabled, assertMemiBoardTranslationEnabled, useBoardPathConfig, useMemiBoardConfig } from '../config'
import { boardUserDoc } from '../utils/boardPaths'
import { memiBoardLanguageLabel } from '../utils/moderation-prompt'
import { plainTextFromHtml } from '../utils/postBody'
import { AI_USAGE_FIELDS, AI_USAGE_WINDOW_MS, aiUsageOf, type AiUsageKind } from '../utils/aiUsage'
import { generatedBannerBlob } from '../utils/bannerGeneration'
import { postImagePrompt } from '../utils/postImageGeneration'
import { avatarImagePrompt } from '../utils/avatarImageGeneration'
import { boardTranslationLocales, coversLocales, hashText, mergeSourceFields } from '../utils/localizedFields'
import { normalizeMemiBoardLocale, type MemiBoardLocale } from '../i18n/locales'
import { translate, type MemiBoardMessageParams } from '../i18n/translate'
import { useMemiBoardI18n } from '../i18n/useMemiBoardI18n'
import type { CommentTranslationSet, MemiBoardI18nMap, PostTranslationSet } from '../types'
import { HTML_MAX_CHARS, useMemiBoardAutoTranslate } from './useMemiBoardAutoTranslate'

export const WRITING_ASSISTANT_DAILY_LIMIT = 20
/** 그림은 호출당 비용이 글쓰기보다 훨씬 커서 따로, 더 적게 센다. */
export const IMAGE_GENERATION_DAILY_LIMIT = 3
/** 사진으로 제목을 만들 때 보낼 수 있는 사진 최대 크기. */
const IMAGE_TITLE_MAX_BYTES = 4 * 1024 * 1024
const DAILY_LIMITS = { writing: WRITING_ASSISTANT_DAILY_LIMIT, image: IMAGE_GENERATION_DAILY_LIMIT } as const

export type WritingAssistantAction =
  | 'proofread'
  | 'polish'
  | 'continue'
  | 'summarize'
  | 'translate-en'
  | 'translate-ko'
  | 'title'
  | 'draft'
  | 'custom'

const CUSTOM_INSTRUCTION_MAX_LENGTH = 200
const DRAFT_BRIEF_MAX_LENGTH = 500

interface WritingAssistantInput {
  action: WritingAssistantAction
  content: string
  title?: string
  selection?: boolean
  /** action이 'custom'일 때 사용자가 직접 입력한 지시문 (예: "경상도 사투리 스타일로") */
  customInstruction?: string
  /** action이 'draft'일 때 작성자가 적은 요청(예: "제주 2박 3일 여행 후기, 친근한 말투"). 제목만 있어도 된다. */
  brief?: string
  /** 저장 과정에서 자동으로 부르는 호출이면 true. 하루 사용 횟수를 차감하지 않는다. */
  automatic?: boolean
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
  draft: '제목과 작성자의 요청을 바탕으로 게시글 본문을 새로 작성하라. 제목과 요청에 없는 사실, 수치, 경험은 지어내지 말고, 짧은 문단 몇 개로 간결하게 쓰라. 본문이 이미 있으면 그 내용과 말투를 따르라. 제목 줄은 반복하지 마라.',
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
    draft: `Write the body of a message board post from the title and the author's request. Do not invent facts, figures or experiences that the title and request do not give; write a few short paragraphs, concisely. If a body already exists, follow its content and tone. Do not repeat the title as a heading. Write in ${language} unless the title or request is clearly in another language.`,
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
    if (input.action === 'translate-en' || input.action === 'translate-ko' || input.action === 'title' || input.action === 'draft') return base
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
  const { translateEntries, translateHtml, detectSourceLocale } = useMemiBoardAutoTranslate()

  type Usage = ReturnType<typeof aiUsageOf>

  function dailyLimitError(kind: AiUsageKind, windowAt: number, now: number): Error {
    const resetAt = windowAt + AI_USAGE_WINDOW_MS
    const hours = Math.max(1, Math.ceil((resetAt - now) / (60 * 60 * 1000)))
    return new Error(t(kind === 'image' ? 'writingAssistant.imageDailyLimit' : 'writingAssistant.dailyLimit', { limit: DAILY_LIMITS[kind], hours }))
  }

  async function mutateDailyUse(
    kind: AiUsageKind,
    apply: (usage: Usage) => Record<string, unknown> | null,
  ): Promise<void> {
    const uid = user.value?.uid
    if (!uid) throw new Error(t('writingAssistant.loginRequired'))

    await runTransaction(db, async (transaction) => {
      const ref = boardUserDoc(db, useBoardPathConfig(), uid)
      const snapshot = await transaction.get(ref)
      if (!snapshot.exists()) throw new Error(t('writingAssistant.userMissing'))
      const data = snapshot.data() as Record<string, unknown>
      const patch = apply(aiUsageOf(data, kind, Date.now()))
      if (!patch) return
      transaction.update(ref, { ...patch, updatedAt: serverTimestamp() })
    })
  }

  /** 모델 호출 전에 자리를 잡는다. 확정 횟수는 아직 올리지 않는다. */
  async function reserveDailyUse(kind: AiUsageKind): Promise<void> {
    const f = AI_USAGE_FIELDS[kind]
    await mutateDailyUse(kind, (usage) => {
      if (usage.active && usage.windowAt != null && usage.count + usage.pending >= DAILY_LIMITS[kind]) {
        throw dailyLimitError(kind, usage.windowAt, Date.now())
      }
      if (usage.active) return { [f.pending]: usage.pending + 1 }
      return {
        [f.count]: 0,
        [f.pending]: 1,
        [f.windowAt]: serverTimestamp(),
      }
    })
  }

  /** 호출이 성공하면 예약을 확정 횟수로 옮긴다. */
  async function commitDailyUse(kind: AiUsageKind): Promise<void> {
    const f = AI_USAGE_FIELDS[kind]
    await mutateDailyUse(kind, (usage) => {
      if (!usage.active || usage.pending < 1 || usage.count >= DAILY_LIMITS[kind]) return null
      return {
        [f.count]: usage.count + 1,
        [f.pending]: usage.pending - 1,
      }
    })
  }

  /** 호출이 실패하면 예약만 되돌린다. 확정 횟수는 그대로다. */
  async function releaseDailyUse(kind: AiUsageKind): Promise<void> {
    const f = AI_USAGE_FIELDS[kind]
    await mutateDailyUse(kind, (usage) => {
      if (!usage.active || usage.pending < 1) return null
      return { [f.pending]: usage.pending - 1 }
    })
  }

  /** `automatic` 번역(게시판의 자동 번역 설정)은 하루 사용 횟수를 쓰지 않는다. */
  async function withDailyUse<T>(task: () => Promise<T>, automatic = false, kind: AiUsageKind = 'writing'): Promise<T> {
    if (automatic) return task()
    await reserveDailyUse(kind)
    try {
      const result = await task()
      try {
        await commitDailyUse(kind)
      }
      catch {
        // 결과는 이미 나왔다. 예약은 남겨 그 자리를 횟수로 유지한다.
      }
      return result
    }
    catch (error) {
      await releaseDailyUse(kind).catch(() => {})
      throw error
    }
  }

  async function assist(input: WritingAssistantInput): Promise<string> {
    assertMemiBoardAiEnabled()
    if (input.action === 'translate-en' || input.action === 'translate-ko') assertMemiBoardTranslationEnabled()
    const lang = locale.value
    const ko = lang === 'ko'
    const instruction = resolveInstruction(input, lang, t)
    const brief = input.brief?.trim().slice(0, DRAFT_BRIEF_MAX_LENGTH) ?? ''
    // 본문 쓰기는 본문이 비어 있어도 제목이나 요청 중 하나만 있으면 된다.
    if (input.action === 'draft') {
      if (!input.title?.trim() && !brief) throw new Error(t('writingAssistant.draftRequired'))
    }
    else if (!input.content.trim()) throw new Error(t('writingAssistant.contentRequired'))
    return withDailyUse(async () => {
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
          temperature: input.action === 'continue' || input.action === 'title' || input.action === 'custom' || input.action === 'draft' ? 0.6 : 0.2,
          maxOutputTokens: 2048,
        },
      })
      const source = input.content.trim()
      const prompt = (ko
        ? [
            `작업: ${instruction}`,
            input.title ? `현재 제목: ${input.title}` : '',
            brief ? `작성자의 요청: ${brief}` : '',
            source ? `본문:\n${source.slice(0, 12000)}` : '',
          ]
        : [
            `Task: ${instruction}`,
            input.title ? `Current title: ${input.title}` : '',
            brief ? `Author's request: ${brief}` : '',
            source ? `Body:\n${source.slice(0, 12000)}` : '',
          ]).filter(Boolean).join('\n\n')
      const result = await model.generateContent(prompt)
      const output = cleanModelOutput(result.response.text())
      if (!output) throw new Error(t('writingAssistant.emptyResult'))
      return output
    }, input.automatic === true)
  }

  /**
   * 제목·요약·본문을 지원 언어 10개로 번역한다.
   * 하루 사용 횟수는 언어 수와 상관없이 1회만 차감한다. 저장은 호출한 쪽이 한다.
   */
  async function translatePost(input: {
    /** 실제 원문 언어. 생략하면 글 내용에서 판별하며 화면 언어는 사용하지 않는다. */
    source?: MemiBoardLocale
    /** 번역할 언어. 기본: 지원 언어 전체(보드 설정은 boardTranslationLocales 로 넘긴다) */
    targets?: MemiBoardLocale[]
    title?: string
    summary?: string
    content?: string
    /** 게시판 자동 번역에서 호출하면 true. 하루 사용 횟수를 차감하지 않는다. */
    automatic?: boolean
  }): Promise<PostTranslationSet> {
    assertMemiBoardTranslationEnabled()
    const targets = input.targets?.length ? input.targets : boardTranslationLocales()
    const title = input.title?.trim() ?? ''
    const summary = input.summary?.trim() ?? ''
    const content = input.content ?? ''
    const fields: Record<string, string> = {}
    if (title) fields.title = title
    if (summary) fields.summary = summary
    const bodyTooLong = !!plainTextFromHtml(content) && content.length > HTML_MAX_CHARS
    // 자동 번역은 본문이 길어도 제목·요약은 번역해서 저장한다. 직접 누른 번역은 이유를 알려 준다.
    if (bodyTooLong && !input.automatic) {
      throw new Error(t('writingAssistant.translateTooLong', { limit: HTML_MAX_CHARS, count: targets.length }))
    }
    const hasText = !!plainTextFromHtml(content) && !bodyTooLong
    if (!Object.keys(fields).length && !hasText) throw new Error(t('writingAssistant.translateEmpty'))

    return withDailyUse(async () => {
      const source = input.source ?? await detectSourceLocale([plainTextFromHtml(content), title, summary].filter(Boolean).join('\n'))
      const required = [...targets, source]
      const emptyFields: Record<string, MemiBoardI18nMap> = {}
      const [fieldMap, htmlMap] = await Promise.all([
        Object.keys(fields).length
          ? translateEntries([{
              id: 'post',
              fields,
              context: 'message board post title and short summary',
            }], {
              source,
              targets,
              purpose: 'message board post title and short summary',
            })
          : Promise.resolve(emptyFields),
        hasText
          ? translateHtml(content, { source, targets }).catch((cause) => {
              if (!input.automatic) throw cause
              return {} as Partial<Record<MemiBoardLocale, string>>
            })
          : Promise.resolve({} as Partial<Record<MemiBoardLocale, string>>),
      ])

      const i18n = mergeSourceFields(source, fields, fieldMap.post)
      if (Object.keys(fields).length && !coversLocales(i18n, Object.keys(fields), required)) {
        throw new Error(t('writingAssistant.translateIncomplete'))
      }

      const result: PostTranslationSet = {
        i18n,
        i18nSource: { locale: source, title, summary },
      }
      if (hasText) {
        const htmlFields: MemiBoardI18nMap = {}
        for (const [code, text] of Object.entries(htmlMap)) {
          const localeCode = normalizeMemiBoardLocale(code)
          if (localeCode && typeof text === 'string' && text.trim()) htmlFields[localeCode] = { content: text.trim() }
        }
        // 일부 언어만 성공해도 그만큼은 저장한다. 빠진 언어는 원문 본문을 보여 준다.
        if (Object.keys(htmlFields).length) {
          result.contentI18n = mergeSourceFields(source, { content }, htmlFields)
          result.contentI18nSource = { locale: source, hash: hashText(content) }
        }
        else if (!input.automatic) {
          throw new Error(t('writingAssistant.translateIncomplete'))
        }
      }
      return result
    }, input.automatic === true)
  }

  /** 댓글은 HTML 변환 없이 일반 텍스트 필드로 번역한다. */
  async function translateComment(input: { body: string, targets?: MemiBoardLocale[], automatic?: boolean }): Promise<CommentTranslationSet> {
    assertMemiBoardTranslationEnabled()
    const body = input.body.trim()
    if (!body) throw new Error(t('writingAssistant.translateEmpty'))
    const targets = input.targets?.length ? input.targets : boardTranslationLocales()
    return withDailyUse(async () => {
      const source = await detectSourceLocale(body)
      const translated = await translateEntries([{
        id: 'comment', fields: { body }, context: 'message board comment or reply, plain text',
      }], { source, targets, purpose: 'message board comments and replies' })
      const i18n = mergeSourceFields(source, { body }, translated.comment)
      if (!coversLocales(i18n, ['body'], [...targets, source])) throw new Error(t('writingAssistant.translateIncomplete'))
      return { i18n, i18nSource: { locale: source, body } }
    }, input.automatic === true)
  }

  /**
   * 글 없이 사진만 올린 글의 제목을, 첫 사진을 보고 만든다. 저장 과정에서 자동으로 부르므로
   * 하루 사용 횟수를 차감하지 않는다. 사진을 읽지 못하면(CORS·용량·형식) 오류를 던진다.
   */
  async function suggestTitleFromImage(imageUrl: string): Promise<string> {
    assertMemiBoardAiEnabled()
    const response = await fetch(imageUrl)
    if (!response.ok) throw new Error(`image fetch failed: ${response.status}`)
    const blob = await response.blob()
    if (!blob.type.startsWith('image/')) throw new Error('not an image')
    if (blob.size > IMAGE_TITLE_MAX_BYTES) throw new Error('image too large for title suggestion')
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
    const moderation = config.moderation ?? {}
    const ai = getAI(app, {
      backend: new GoogleAIBackend(),
      useLimitedUseAppCheckTokens: moderation.useLimitedUseAppCheckTokens !== false,
    })
    const model = getGenerativeModel(ai, {
      model: moderation.model ?? 'gemini-3.5-flash-lite',
      systemInstruction: 'You write titles for message board posts. Output only the title as plain text, without quotes or explanation.',
      generationConfig: { temperature: 0.4, maxOutputTokens: 128 },
    })
    const language = memiBoardLanguageLabel(locale.value)
    const result = await model.generateContent([
      { inlineData: { mimeType: blob.type, data } },
      { text: `Write one short, natural title (at most 30 characters) in ${language} that describes this photo.` },
    ])
    const title = cleanModelOutput(result.response.text()).split('\n')[0]?.trim() ?? ''
    if (!title) throw new Error(t('writingAssistant.emptyResult'))
    return title
  }

  /**
   * 글에 넣을 그림을 만든다. 작성자의 프롬프트가 있으면 그것을, 없으면 제목·본문에서 주제를 골라 그린다.
   * 그림은 글쓰기와 따로 하루 IMAGE_GENERATION_DAILY_LIMIT 회까지 센다. 결과는 로컬 Blob이고 업로드는 호출한 쪽이 한다.
   */
  /** 이미지 모델을 한 번 부른다. 호출 전에 그림 횟수 한 번을 예약하고, 성공해야 확정한다. */
  function runImageModel(prompt: string, aspectRatio: typeof ImageConfigAspectRatio[keyof typeof ImageConfigAspectRatio]): Promise<Blob> {
    return withDailyUse(async () => {
      const ai = getAI(app, {
        backend: new GoogleAIBackend(),
        useLimitedUseAppCheckTokens: config.moderation?.useLimitedUseAppCheckTokens !== false,
      })
      const model = getGenerativeModel(ai, {
        model: config.bannerGeneration?.model?.trim() || 'gemini-nano-banana-2.1',
        generationConfig: {
          responseModalities: [ResponseModality.IMAGE],
          imageConfig: { aspectRatio, imageSize: ImageConfigImageSize.SIZE_1K },
        },
      }, { timeout: 180_000 })
      const result = await model.generateContent(prompt)
      const blob = generatedBannerBlob(result.response.inlineDataParts())
      if (!blob) throw new Error(t('writingAssistant.noImage'))
      return blob
    }, false, 'image')
  }

  async function generatePostImage(input: { title?: string, body?: string, request?: string }): Promise<Blob> {
    assertMemiBoardAiEnabled()
    const request = input.request?.trim() ?? ''
    const body = plainTextFromHtml(input.body ?? '')
    if (!request && !input.title?.trim() && !body) throw new Error(t('writingAssistant.imageRequired'))
    return runImageModel(postImagePrompt({ title: input.title, body, request }), ImageConfigAspectRatio.LANDSCAPE_16x9)
  }

  /**
   * 프로필 사진(정사각형)을 만든다. 글에 넣는 그림과 같은 하루 그림 횟수를 쓴다.
   * 요청이 없어도 이름·소개에서 분위기를 잡아 만든다. 결과는 로컬 Blob이고 크롭·업로드는 호출한 쪽이 한다.
   */
  async function generateAvatarImage(input: { name?: string, bio?: string, request?: string }): Promise<Blob> {
    assertMemiBoardAiEnabled()
    return runImageModel(avatarImagePrompt(input), ImageConfigAspectRatio.SQUARE_1x1)
  }

  return { assist, generatePostImage, generateAvatarImage, translatePost, translateComment, suggestTitleFromImage }
}
