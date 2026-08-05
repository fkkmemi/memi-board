<script setup lang="ts">
import { ref } from 'vue'

withDefaults(defineProps<{ introduction?: string }>(), {
  introduction: 'Nuxt 4와 Vue 3, TypeScript를 바탕으로 만들고 Nuxt UI와 Firebase로 글과 댓글을 자연스럽게 이어가는 게시판입니다.',
})

const open = ref(false)
const tab = ref<'about' | 'history'>('about')
const stacks = [
  { title: '화면과 경험', icon: 'i-lucide-palette', text: 'Nuxt 4 · Vue 3 · TypeScript · Nuxt UI · Tailwind CSS' },
  { title: '데이터와 로그인', icon: 'i-lucide-database', text: 'Firebase Firestore · Auth · Storage · nuxt-vuefire' },
  { title: '글쓰기와 편의', icon: 'i-lucide-pencil-line', text: 'Tiptap · Lucide Icons · dayjs' },
]
</script>

<template>
  <footer class="flex justify-center border-t border-default/60 pt-4">
    <button type="button" class="cursor-pointer text-[11px] text-dimmed transition-colors hover:text-muted" @click="open = true">
      powered by memi
    </button>
  </footer>

  <UModal v-model:open="open" title="게시판 정보" :ui="{ content: 'sm:max-w-2xl' }">
    <template #body>
      <div class="flex flex-col gap-4">
        <div class="flex gap-1 rounded-lg bg-muted p-1">
          <UButton size="sm" class="flex-1 justify-center" :color="tab === 'about' ? 'primary' : 'neutral'" :variant="tab === 'about' ? 'solid' : 'ghost'" @click="tab = 'about'">이 게시판은</UButton>
          <UButton size="sm" class="flex-1 justify-center" :color="tab === 'history' ? 'primary' : 'neutral'" :variant="tab === 'history' ? 'solid' : 'ghost'" @click="tab = 'history'">버전 히스토리</UButton>
        </div>

        <div v-if="tab === 'about'" class="max-h-[min(60vh,36rem)] space-y-4 overflow-y-auto px-1">
          <div class="flex items-start gap-3 px-1">
            <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-500/10"><UIcon name="i-lucide-code-2" class="size-5 text-primary-500" /></div>
            <div><h3 class="font-bold text-highlighted">이 게시판은</h3><p class="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted">{{ introduction }}</p></div>
          </div>
          <section v-for="item in stacks" :key="item.title" class="rounded-2xl border border-default bg-default/70 p-4">
            <div class="flex items-center gap-3"><UIcon :name="item.icon" class="size-5 text-primary" /><div><h4 class="text-sm font-bold text-highlighted">{{ item.title }}</h4><p class="mt-1 text-sm text-muted">{{ item.text }}</p></div></div>
          </section>
        </div>
        <div v-else class="max-h-[min(55vh,30rem)] overflow-y-auto px-1"><MemiBoardVersionHistory /></div>
      </div>
    </template>
  </UModal>
</template>
