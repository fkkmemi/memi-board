import { computed, ref, watch } from 'vue'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { useDocument, useFirestore } from 'vuefire'
import { applyMemiBoardSiteSettings, isMemiBoardAiEnabled, memiBoardDefaultLocale, useBoardPathConfig } from '../config'
import { MEMI_BOARD_LOCALES } from '../i18n/locales'
import { boardSsrKey } from '../utils/boardPaths'

/**
 * Reserved document id for site-wide memi-board settings. It lives in the board settings
 * collection so no extra Firestore rule is needed (only admins can write). It has no `order`
 * (the board list query skips it) and `visibility: 'hidden'` (sitemaps and public lists skip it).
 */
export const APP_SETTINGS_DOC_ID = '__app'

/** Site-wide settings edited on the board settings screen. */
export function useMemiBoardAppSettings() {
  const db = useFirestore()
  const cfg = useBoardPathConfig()
  const ref_ = doc(db, cfg.settingsCollection, APP_SETTINGS_DOC_ID)
  const { data, pending } = useDocument<{ hideAbout?: boolean, disableAiTitle?: boolean, disableAi?: boolean, disableI18n?: boolean, locale?: string, locales?: string[] }>(ref_, {
    ssrKey: boardSsrKey(cfg, 'app'),
  })
  const saving = ref(false)
  const error = ref('')

  // 이 문서를 읽는 화면(푸터·설정)이 있으면 값을 런타임 설정에 바로 반영한다.
  // 모듈 플러그인이 아직 없는 환경(개발 서버를 재시작하기 전 등)에서도 설정이 적용된다.
  watch(data, value => applyMemiBoardSiteSettings((value ?? undefined) as Record<string, unknown> | undefined), { immediate: true })

  /** The About memi-board footer link and popup. Visible unless `hideAbout: true` is stored, so existing sites keep showing it. */
  const showAbout = computed(() => data.value?.hideAbout !== true)

  /**
   * AI writes a title when a new post's title is left empty (text, or the first photo when there is
   * no text — the photo is sent to Google AI). On unless `disableAiTitle: true` is stored.
   */
  /** The stored AI title switch, without the AI master switch (for the settings screen). */
  const aiTitleSwitch = computed(() => data.value?.disableAiTitle !== true)
  const aiTitleEnabled = computed(() => isMemiBoardAiEnabled() && data.value?.disableAiTitle !== true)

  async function save(patch: Record<string, unknown>): Promise<void> {
    saving.value = true
    error.value = ''
    try {
      await setDoc(ref_, { ...patch, visibility: 'hidden', updatedAt: serverTimestamp() }, { merge: true })
    }
    catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
    }
    finally {
      saving.value = false
    }
  }

  /** AI master switch. Off turns off moderation, translation, the writing assistant, and AI titles. */
  const siteAiEnabled = computed(() => data.value?.disableAi !== true)
  /** Internationalization master switch. Off fixes the board to one language and turns off translation. */
  const siteI18nEnabled = computed(() => data.value?.disableI18n !== true)
  /** Default language, or the one fixed language when internationalization is off. */
  const siteLocale = computed(() => data.value?.locale || memiBoardDefaultLocale() || 'ko')

  /** Languages the site offers. All of them unless an admin picked a subset. */
  const siteLocales = computed<string[]>(() => {
    const stored = data.value?.locales
    const all = MEMI_BOARD_LOCALES.map(item => item.code as string)
    return Array.isArray(stored) && stored.length ? all.filter(code => stored.includes(code)) : all
  })

  /** Saves the whole site settings card at once. Returns true when the write succeeded. */
  async function saveSite(patch: Record<string, unknown>): Promise<boolean> {
    await save(patch)
    return !error.value
  }

  return {
    showAbout, aiTitleEnabled, aiTitleSwitch, siteAiEnabled, siteI18nEnabled, siteLocale, siteLocales,
    pending, saving, error, saveSite,
  }
}
