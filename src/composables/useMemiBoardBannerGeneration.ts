import { getAI, getGenerativeModel, GoogleAIBackend, ImageConfigAspectRatio, ImageConfigImageSize, ResponseModality } from 'firebase/ai'
import { useFirebaseApp } from 'vuefire'
import { assertMemiBoardAiEnabled, useMemiBoardConfig } from '../config'
import { useMemiBoardAuth } from './useMemiBoardAuth'
import { useMemiBoardI18n } from '../i18n/useMemiBoardI18n'
import { bannerGenerationPrompt, generatedBannerBlob } from '../utils/bannerGeneration'

export function useMemiBoardBannerGeneration() {
  const app = useFirebaseApp()
  const config = useMemiBoardConfig()
  const { isSignedIn, canConfigureBoard } = useMemiBoardAuth()
  const { t } = useMemiBoardI18n()

  async function generateBanner(input: { boardId: string, title: string, description?: string, additionalRequest?: string }): Promise<Blob> {
    assertMemiBoardAiEnabled()
    if (!isSignedIn.value || !canConfigureBoard(input.boardId)) throw new Error(t('settings.noAccess'))
    if (!input.title.trim()) throw new Error(t('settings.banner.titleRequired'))
    const ai = getAI(app, {
      backend: new GoogleAIBackend(),
      useLimitedUseAppCheckTokens: config.moderation.useLimitedUseAppCheckTokens !== false,
    })
    const model = getGenerativeModel(ai, {
      model: config.bannerGeneration?.model?.trim() || 'gemini-nano-banana-2.1',
      generationConfig: {
        responseModalities: [ResponseModality.IMAGE],
        imageConfig: {
          aspectRatio: ImageConfigAspectRatio.LANDSCAPE_8x1,
          imageSize: ImageConfigImageSize.SIZE_2K,
        },
      },
    }, { timeout: 180_000 })
    const result = await model.generateContent(bannerGenerationPrompt(input.title, input.description ?? '', input.additionalRequest))
    const blob = generatedBannerBlob(result.response.inlineDataParts())
    if (!blob) throw new Error(t('settings.banner.noImage'))
    return blob
  }

  return { generateBanner }
}
