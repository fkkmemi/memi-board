<script setup lang="ts">
import { computed, getCurrentInstance, onBeforeUnmount, onMounted, ref, shallowReactive, useId } from 'vue'
import { useMemiBoardAppSettings, useMemiBoardI18n, versionHistory } from 'memi-board/runtime'
import MemiBoardVersionHistory from './VersionHistory.vue'

const props = defineProps<{ introduction?: string }>()
// One visible footer per app, even when a page combines several board views
// or still contains a legacy, manually placed MemiBoardFooter.
const appProvides = getCurrentInstance()!.appContext.provides
const registryKey = 'memi-board:footer-anchors'
const anchors: Map<string, HTMLElement> = appProvides[registryKey]
  ?? (appProvides[registryKey] = shallowReactive(new Map<string, HTMLElement>()))
const id = useId()
const anchor = ref<HTMLElement | null>(null)
const active = computed(() => {
  if (!anchor.value) return true
  let last: HTMLElement | undefined
  for (const element of anchors.values()) {
    if (!last || last.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING) last = element
  }
  return last === anchor.value
})
onMounted(() => { if (anchor.value) anchors.set(id, anchor.value) })
onBeforeUnmount(() => { anchors.delete(id) })
const { t, dir } = useMemiBoardI18n()
const { showAbout } = useMemiBoardAppSettings()
const introductionText = computed(() => props.introduction ?? t('footer.introduction'))

const open = ref(false)
const tab = ref<'about' | 'sites' | 'history'>('about')
const version = versionHistory[0]?.version
const sites = [
  { name: 'memi.dev', domain: 'memi.dev', href: 'https://memi.dev', icon: 'i-lucide-code-2', key: 'memi' },
  { name: 'Loop Waiting', domain: 'loopwait.com', href: 'https://loopwait.com', icon: 'i-lucide-clock', key: 'waiting' },
  { name: 'Loop Track', domain: 'loop-track.web.app', href: 'https://loop-track.web.app', icon: 'i-lucide-navigation', key: 'track' },
  { name: 'LOOP', domain: 'loopsystem.co.kr', href: 'https://loopsystem.co.kr', icon: 'i-lucide-building-2', key: 'loop' },
  { name: 'Safe ON', domain: 'safe-pedal.com', href: 'https://safe-pedal.com', icon: 'i-lucide-shield-check', key: 'safe' },
]
const detailHref = 'https://memi.dev/memi-board'
const inviteSiteHref = 'https://memi.dev/board'
const contactEmail = 'fkkmemi@gmail.com'
const inviteHref = computed(() => {
  const subject = encodeURIComponent(t('footer.sites.inviteSubject'))
  const body = encodeURIComponent(t('footer.sites.inviteBody'))
  return `mailto:${contactEmail}?subject=${subject}&body=${body}`
})
const feedbackHref = computed(() => {
  const subject = encodeURIComponent(t('footer.feedbackSubject'))
  const body = encodeURIComponent(t('footer.feedbackBody'))
  return `mailto:${contactEmail}?subject=${subject}&body=${body}`
})
const links = computed(() => [
  { label: 'memi.dev', address: 'memi.dev', href: 'https://memi.dev', icon: 'i-lucide-globe', accent: false },
  { label: t('footer.detail'), address: 'memi.dev/memi-board', href: detailHref, icon: 'i-lucide-book-open', accent: false },
  { label: 'YouTube', address: 'youtube.com/@fkkmemi', href: 'https://www.youtube.com/@fkkmemi', icon: 'i-simple-icons-youtube', accent: true },
  { label: 'npm', address: 'npmjs.com/package/memi-board', href: 'https://www.npmjs.com/package/memi-board', icon: 'i-simple-icons-npm', accent: false },
  { label: 'GitHub', address: 'github.com/fkkmemi/memi-board', href: 'https://github.com/fkkmemi/memi-board', icon: 'i-simple-icons-github', accent: false },
  { label: t('footer.email'), address: contactEmail, href: `mailto:${contactEmail}`, icon: 'i-lucide-mail', accent: false },
])
const stacks = computed(() => [
  { title: t('footer.stack.ui'), icon: 'i-lucide-palette', text: 'Nuxt 4 · Vue 3 · TypeScript · Nuxt UI · Tailwind CSS' },
  { title: t('footer.stack.data'), icon: 'i-lucide-database', text: 'Firebase Firestore · Auth · Storage · nuxt-vuefire' },
  { title: t('footer.stack.writing'), icon: 'i-lucide-pencil-line', text: 'Tiptap · Lucide Icons · Intl API' },
])
</script>

<template>
  <div v-if="showAbout" ref="anchor" class="contents">
    <footer v-if="active" class="flex justify-center pt-2">
      <button type="button" class="cursor-pointer text-[11px] text-dimmed transition-colors hover:text-muted" @click="open = true">
        About memi-board™
      </button>
    </footer>

    <UModal
      v-if="active"
      v-model:open="open"
      :title="t('footer.info.title')"
      :content="{ dir }"
      :ui="{
        content: 'max-w-3xl rounded-2xl',
        header: 'shrink-0 px-5 py-4 sm:px-6',
        body: 'min-h-0 p-0 sm:p-0',
      }"
    >
      <template #header="{ close }">
        <div class="flex w-full flex-wrap items-center justify-between gap-4">
          <div class="flex min-w-0 items-center gap-3">
            <span class="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary ring ring-inset ring-primary/15">
              <UIcon name="i-lucide-code-2" class="size-5" />
            </span>
            <div>
              <p class="text-sm font-semibold tracking-tight text-highlighted">memi-board™</p>
              <p v-if="version" class="mt-0.5 font-mono text-[10px] tracking-wider text-dimmed">v{{ version }}</p>
            </div>
          </div>
          <div class="order-last flex w-full min-w-0 gap-1 overflow-x-auto rounded-full bg-elevated/70 p-1" role="group" :aria-label="t('footer.info.title')">
            <button
              v-for="item in (['about', 'sites', 'history'] as const)"
              :key="item"
              type="button"
              :aria-pressed="tab === item"
              class="flex-1 shrink-0 cursor-pointer whitespace-nowrap rounded-full px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:flex-none sm:px-5"
              :class="tab === item ? 'bg-default text-highlighted shadow-sm ring ring-default' : 'text-muted hover:text-highlighted'"
              @click="tab = item"
            >{{ t(`footer.info.${item}`) }}</button>
          </div>
          <UButton color="neutral" variant="ghost" icon="i-lucide-x" class="rounded-full" :aria-label="t('common.action.close')" @click="close" />
        </div>
      </template>

      <template #body>
        <div class="flex min-h-full flex-col">
          <div class="relative isolate flex-1 px-5 py-8 sm:px-6">
            <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
            <div class="mx-auto w-full">
              <template v-if="tab === 'about'">
                <div class="flex flex-col gap-5">
                  <div>
                    <p class="mb-4 text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">{{ t('footer.eyebrow') }}</p>
                    <h2 class="text-4xl font-semibold tracking-[-0.06em] text-highlighted sm:text-5xl">memi-board<sup class="ms-1 align-super text-sm font-medium tracking-normal text-muted">™</sup><span class="text-primary">.</span></h2>
                    <p class="mt-4 text-base font-medium tracking-tight text-toned sm:text-lg">{{ t('footer.tagline') }}</p>
                  </div>
                  <div>
                    <p class="max-w-xl whitespace-pre-line text-sm leading-7 text-muted">{{ introductionText }}</p>
                    <a :href="detailHref" target="_blank" rel="noopener noreferrer" class="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                      {{ t('footer.detail') }}
                      <UIcon name="i-lucide-arrow-up-right" class="size-3.5" />
                    </a>
                  </div>
                </div>

                <div class="mt-8 grid gap-3 sm:grid-cols-3 sm:gap-4">
                  <section v-for="(item, index) in stacks" :key="item.title" class="rounded-2xl border border-default bg-default/80 p-5">
                    <div class="mb-5 flex items-center justify-between">
                      <UIcon :name="item.icon" class="size-5 text-primary" />
                      <span class="font-mono text-[10px] text-dimmed">0{{ index + 1 }}</span>
                    </div>
                    <h3 class="text-sm font-semibold tracking-tight text-highlighted">{{ item.title }}</h3>
                    <p class="mt-2 text-xs leading-6 text-muted">{{ item.text }}</p>
                  </section>
                </div>
              </template>
              <template v-else-if="tab === 'sites'">
                <div class="mb-8">
                  <p class="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">{{ t('footer.siteEyebrow') }}</p>
                  <h2 class="text-3xl font-semibold tracking-tight text-highlighted sm:text-4xl">{{ t('footer.info.sites') }}</h2>
                  <p class="mt-3 text-sm leading-7 text-muted">{{ t('footer.sites.description') }}</p>
                </div>
                <div class="grid gap-3 sm:grid-cols-2">
                  <a
                    v-for="site in sites"
                    :key="site.href"
                    :href="site.href"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="group rounded-2xl border border-default bg-default/80 p-5 transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:p-6"
                  >
                    <div class="mb-6 flex items-center justify-between">
                      <span class="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><UIcon :name="site.icon" class="size-5" /></span>
                      <UIcon name="i-lucide-arrow-up-right" class="size-4 text-dimmed transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
                    </div>
                    <h3 class="text-base font-semibold tracking-tight text-highlighted">{{ site.name }}</h3>
                    <p class="mt-1 text-xs leading-6 text-muted">{{ t(`footer.sites.${site.key}`) }}</p>
                    <p class="mt-4 break-all font-mono text-[11px] text-dimmed">{{ site.domain }}</p>
                  </a>
                  <div class="flex flex-col gap-4 rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-5 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                    <div class="flex items-start gap-4">
                      <span class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><UIcon name="i-lucide-messages-square" class="size-5" /></span>
                      <div>
                        <h3 class="text-base font-semibold tracking-tight text-highlighted">{{ t('footer.sites.inviteTitle') }}</h3>
                        <p class="mt-1 text-xs leading-6 text-muted">{{ t('footer.sites.invite') }}</p>
                      </div>
                    </div>
                    <p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                      <a :href="inviteSiteHref" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 font-medium text-primary hover:text-primary/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                        {{ t('footer.sites.inviteSite') }}
                        <UIcon name="i-lucide-arrow-up-right" class="size-3.5" />
                      </a>
                      <span class="text-dimmed">{{ t('footer.sites.inviteOr') }}</span>
                      <a :href="inviteHref" class="font-medium text-muted hover:text-highlighted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{{ t('footer.email') }}</a>
                    </p>
                  </div>
                </div>
              </template>
              <template v-else>
                <div class="mb-8 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p class="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">{{ t('footer.changelog') }}</p>
                    <h2 class="text-3xl font-semibold tracking-tight text-highlighted sm:text-4xl">{{ t('footer.info.history') }}</h2>
                  </div>
                  <UBadge v-if="version" :label="`v${version}`" variant="subtle" class="rounded-full" />
                </div>
                <MemiBoardVersionHistory />
              </template>
            </div>
          </div>

          <section class="border-t border-default bg-elevated/25 px-5 py-6 sm:px-6">
            <div class="mx-auto">
              <div class="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <h2 class="text-[10px] font-semibold uppercase tracking-[0.2em] text-dimmed">{{ t('footer.links') }}</h2>
                <div class="flex items-center gap-3 text-[11px]">
                  <a :href="feedbackHref" class="inline-flex items-center gap-1 font-medium text-primary hover:text-primary/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                    <UIcon name="i-lucide-message-square" class="size-3.5" />
                    {{ t('footer.feedback') }}
                  </a>
                  <span class="text-dimmed">{{ t('footer.credit') }}</span>
                </div>
              </div>
              <div class="grid gap-2 sm:grid-cols-2">
                <a
                  v-for="link in links"
                  :key="link.href"
                  :href="link.href"
                  :target="link.href.startsWith('https:') ? '_blank' : undefined"
                  rel="noopener noreferrer"
                  class="group flex min-w-0 items-start gap-3 rounded-xl p-3 transition-colors hover:bg-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <UIcon :name="link.icon" class="mt-0.5 size-5 shrink-0" :class="link.accent ? 'text-red-500' : 'text-muted group-hover:text-highlighted'" />
                  <div class="min-w-0">
                    <span class="flex items-center gap-1.5 text-xs font-semibold text-highlighted">{{ link.label }}<UIcon name="i-lucide-arrow-up-right" class="size-3 text-dimmed transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></span>
                    <span class="mt-1 block break-all text-[10px] leading-4 text-dimmed">{{ link.address }}</span>
                  </div>
                </a>
              </div>
            </div>
          </section>
        </div>
      </template>
    </UModal>
  </div>
</template>
