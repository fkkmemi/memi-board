import { ref, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore'
import { boardTranslationLocales, hashText } from '../utils/localizedFields'
import { plainTextFromHtml, titleFromBody } from '../utils/postBody'
import { buildPostPreview } from '../utils/postPreview'
import { useMemiBoardPosts } from './useMemiBoardPosts'
import { useMemiBoardSettings } from './useMemiBoardSettings'
import { useMemiBoardWritingAssistant } from './useMemiBoardWritingAssistant'
import type { PostDetail } from '../types'

/**
 * Board settings tool: finds published posts whose saved translation is missing or out of date,
 * and translates them one by one. Meant for boards with automatic translation off, or to repair
 * posts after a failed automatic translation. Nothing runs until `run()` is called.
 */
export function useMemiBoardPostTranslations(boardId: MaybeRefOrGetter<string>) {
  const { getPosts, getPost, savePostTranslations } = useMemiBoardPosts(boardId)
  const { getBoard } = useMemiBoardSettings()
  const { translatePost } = useMemiBoardWritingAssistant()

  const stale = ref<string[]>([])
  const total = ref(0)
  const scanning = ref(false)
  const running = ref(false)
  const done = ref(0)
  const failed = ref(0)
  const error = ref('')

  function isCurrent(post: PostDetail): boolean {
    const source = post.i18nSource
    if (!source || !post.i18n) return false
    const storedTitle = post.title?.trim() || titleFromBody(post.content)
    if ((source.title ?? '') !== storedTitle) return false
    if ((source.summary ?? '').trim() !== (post.summary ?? '').trim()) return false
    return !plainTextFromHtml(post.content) || post.contentI18nSource?.hash === hashText(post.content)
  }

  async function scan(): Promise<void> {
    scanning.value = true
    error.value = ''
    try {
      const ids: string[] = []
      let cursor: QueryDocumentSnapshot<DocumentData> | undefined
      let count = 0
      for (;;) {
        const page = await getPosts({ pageSize: 50, cursor, publicOnly: false })
        for (const item of page.posts) {
          count++
          const detail = await getPost(item.id as string)
          if (detail && !isCurrent(detail)) ids.push(detail.id as string)
        }
        if (!page.hasMore) break
        cursor = page.cursor
      }
      total.value = count
      stale.value = ids
    }
    catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
    }
    finally {
      scanning.value = false
    }
  }

  /** Translates and saves every stale post. Automatic mode: does not use the daily AI quota. */
  async function run(): Promise<void> {
    if (running.value) return
    running.value = true
    done.value = 0
    failed.value = 0
    error.value = ''
    const targets = boardTranslationLocales(getBoard(toValue(boardId)))
    try {
      for (const id of [...stale.value]) {
        try {
          const post = await getPost(id)
          if (!post) continue
          const content = post.content
          const translations = await translatePost({
            automatic: true,
            targets,
            title: post.title?.trim() || titleFromBody(content),
            summary: post.summary || buildPostPreview(content, post.attachments ?? []).summary,
            content: plainTextFromHtml(content) ? content : '',
          })
          await savePostTranslations(id, translations)
          stale.value = stale.value.filter(item => item !== id)
          done.value++
        }
        catch (cause) {
          failed.value++
          console.warn('[memi-board] bulk post translation failed', id, cause)
        }
      }
    }
    finally {
      running.value = false
    }
  }

  return { stale, total, scanning, running, done, failed, error, scan, run }
}
