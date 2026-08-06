/**
 * 게시판 SEO — 호스트 Nuxt 파이프라인에서 컴파일된다 (link 시 패키지 로컬 nuxt 이중 로딩 방지).
 *
 * Nuxt E1001: useSeoMeta / useHead 는 반드시 첫 await 이전에 호출한다.
 * (async setup 에서 await 이후 Nuxt 인스턴스 컨텍스트가 끊김)
 *
 * 사용:
 *   await useMemiBoardPostSeo()
 *   await useMemiBoardListSeo()
 *   await useMemiBoardListSeo({ category: 'notice' })
 */
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useAsyncData, useHead, useRequestURL, useRoute, useRuntimeConfig, useSeoMeta } from '#imports'
import {
  boardListOgDescription,
  boardListOgTitle,
  boardPostOgDescription,
  boardPostOgTitle,
  fetchPublicListForSeo,
  fetchPublicPostForSeo,
  normalizeBasePath,
  resolvePublicSeoDb,
  toAbsoluteUrl,
  useMemiBoardConfig,
  type BoardListSeoPayload,
  type BoardPostSeoPayload,
} from 'memi-board/runtime'

function resolveOrigin(siteUrl: string | undefined): string {
  const fromConfig = siteUrl?.trim().replace(/\/$/, '')
  if (fromConfig) return fromConfig
  try {
    const runtime = useRuntimeConfig()
    const envUrl = String((runtime.public as { siteUrl?: string }).siteUrl || '').trim()
    if (envUrl) return envUrl.replace(/\/$/, '')
  }
  catch {
    // non-nuxt
  }
  try {
    const req = useRequestURL()
    if (req?.origin && !req.origin.includes('localhost') && !req.origin.includes('127.0.0.1')) {
      return req.origin
    }
  }
  catch {
    // no request
  }
  return ''
}

function paramString(value: unknown): string {
  if (Array.isArray(value)) return String(value[0] || '')
  return String(value || '')
}

/** 글 상세 SEO. route.params.category + id|slug 기본. */
export async function useMemiBoardPostSeo(opts?: {
  category?: MaybeRefOrGetter<string>
  slug?: MaybeRefOrGetter<string>
  path?: MaybeRefOrGetter<string>
}) {
  // --- 동기 Nuxt composable 구간 (await 전) ---
  const config = useMemiBoardConfig()
  const seo = config.seo
  const route = useRoute()
  const siteName = seo.siteName?.trim() || 'Board'
  const origin = resolveOrigin(seo.siteUrl)
  const basePath = normalizeBasePath(seo.basePath)

  if (seo.enabled === false) {
    return { post: computed(() => null as BoardPostSeoPayload | null) }
  }

  const category = computed(() =>
    (toValue(opts?.category) || paramString(route.params.category)).trim(),
  )
  const slug = computed(() =>
    (toValue(opts?.slug)
      || paramString(route.params.slug)
      || paramString(route.params.id)).trim(),
  )

  // setup 동기 구간에서 Firestore 캡처 (async 핸들러 안 useFirestore 금지)
  const seoDb = resolvePublicSeoDb()

  // await 하지 않고 먼저 등록 → data ref 확보 후 메타 연결
  const postAsync = useAsyncData(
    () => `memi-board-seo-post-${category.value}-${slug.value}`,
    () => fetchPublicPostForSeo(category.value, slug.value, seoDb),
    { watch: [category, slug], server: true, lazy: false },
  )
  const post = computed(() => postAsync.data.value ?? null)

  const title = computed(() =>
    post.value
      ? boardPostOgTitle(post.value.title, post.value.categoryLabel, siteName)
      : `게시글 | ${siteName}`,
  )
  const description = computed(() =>
    post.value
      ? boardPostOgDescription({
          summary: post.value.summary,
          categoryLabel: post.value.categoryLabel,
          authorName: post.value.authorName,
        })
      : '게시판',
  )
  const ogImage = computed(() => {
    const img = post.value?.previewImage || seo.defaultOgImage || ''
    return origin ? toAbsoluteUrl(img, origin, seo.defaultOgImage || '') : img
  })
  const canonical = computed(() => {
    const custom = toValue(opts?.path)?.trim()
    const path = custom
      || `${basePath}/${encodeURIComponent(category.value)}/${encodeURIComponent(slug.value)}`
    return origin ? `${origin}${path.startsWith('/') ? path : `/${path}`}` : path
  })
  const indexable = computed(() => !!post.value)

  useSeoMeta({
    title,
    description,
    ogTitle: title,
    ogDescription: description,
    ogImage,
    ogUrl: canonical,
    ogType: 'article',
    ogSiteName: siteName,
    ogLocale: 'ko_KR',
    twitterCard: 'summary_large_image',
    twitterTitle: title,
    twitterDescription: description,
    twitterImage: ogImage,
    articleAuthor: computed(() => {
      const name = post.value?.authorName?.trim()
      return name ? [name] : undefined
    }),
    articlePublishedTime: computed(() => post.value?.createdAt || undefined),
  })

  useHead(() => ({
    link: [{ rel: 'canonical', href: canonical.value }],
    meta: [
      { property: 'og:image:alt', content: title.value },
      { name: 'robots', content: indexable.value ? 'index,follow' : 'noindex,nofollow' },
    ],
  }))

  // SSR/첫 페인트용 데이터 대기 (메타는 computed 로 이미 연결됨)
  await postAsync

  return { post }
}

/** 목록 SEO. category 생략 시 route.params.category 또는 전체. */
export async function useMemiBoardListSeo(opts?: {
  category?: MaybeRefOrGetter<string | null | undefined>
  path?: MaybeRefOrGetter<string>
}) {
  // --- 동기 Nuxt composable 구간 (await 전) ---
  const config = useMemiBoardConfig()
  const seo = config.seo
  const route = useRoute()
  const siteName = seo.siteName?.trim() || 'Board'
  const origin = resolveOrigin(seo.siteUrl)
  const basePath = normalizeBasePath(seo.basePath)

  if (seo.enabled === false) {
    return { list: computed(() => null as BoardListSeoPayload | null) }
  }

  const category = computed(() => {
    const fromOpts = toValue(opts?.category)
    if (fromOpts !== undefined) return fromOpts?.trim() || null
    const fromRoute = paramString(route.params.category).trim()
    return fromRoute || null
  })

  const seoDb = resolvePublicSeoDb()

  const listAsync = useAsyncData(
    () => `memi-board-seo-list-${category.value || 'all'}`,
    () => fetchPublicListForSeo(category.value, seoDb),
    { watch: [category], server: true, lazy: false },
  )
  const list = computed(() => listAsync.data.value ?? null)

  const title = computed(() =>
    boardListOgTitle(list.value?.categoryLabel || category.value, siteName),
  )
  const description = computed(() => boardListOgDescription({
    categoryLabel: list.value?.categoryLabel,
    description: list.value?.description,
    recentTitles: list.value?.recentTitles,
  }))
  const ogImage = computed(() => {
    const img = list.value?.ogImage || seo.defaultOgImage || ''
    return origin ? toAbsoluteUrl(img, origin, seo.defaultOgImage || '') : img
  })
  const canonical = computed(() => {
    const custom = toValue(opts?.path)?.trim()
    const path = custom
      || (category.value
        ? `${basePath}/${encodeURIComponent(category.value)}`
        : basePath)
    return origin ? `${origin}${path.startsWith('/') ? path : `/${path}`}` : path
  })
  const indexable = computed(() => {
    if (!list.value) return true
    if (list.value.kind === 'category'
      && !list.value.description
      && list.value.recentTitles.length === 0
      && !list.value.ogImage) {
      return false
    }
    return true
  })

  useSeoMeta({
    title,
    description,
    ogTitle: title,
    ogDescription: description,
    ogImage,
    ogUrl: canonical,
    ogType: 'website',
    ogSiteName: siteName,
    ogLocale: 'ko_KR',
    twitterCard: 'summary_large_image',
    twitterTitle: title,
    twitterDescription: description,
    twitterImage: ogImage,
  })

  useHead(() => ({
    link: [{ rel: 'canonical', href: canonical.value }],
    meta: [
      { property: 'og:image:alt', content: title.value },
      { name: 'robots', content: indexable.value ? 'index,follow' : 'noindex,nofollow' },
    ],
  }))

  await listAsync

  return { list }
}
