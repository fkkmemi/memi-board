<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'

const props = defineProps<{
  title?: string | null
}>()

const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | undefined

// 데스크톱 크롬도 navigator.share 자체는 갖고 있어서 존재 여부만으로는 구분이 안 된다.
// 실제로 모바일 OS 공유시트(카카오톡 등 포함)를 원하는 건 모바일뿐이므로 UA로 구분한다.
const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

async function handleShare() {
  const url = window.location.href

  if (isMobile && navigator.share) {
    try {
      await navigator.share({ title: props.title ?? undefined, url })
      return
    }
    catch (err) {
      if ((err as Error)?.name === 'AbortError') return
    }
  }

  // 데스크톱, 혹은 모바일 공유시트 실패 — 링크 복사로 대체
  await navigator.clipboard.writeText(url)
  copied.value = true
  if (copiedTimer) clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => { copied.value = false }, 1500)
}

onBeforeUnmount(() => {
  if (copiedTimer) clearTimeout(copiedTimer)
})
</script>

<template>
  <UButton
    :icon="copied ? 'i-lucide-check' : 'i-lucide-share-2'"
    size="sm"
    variant="ghost"
    :color="copied ? 'success' : 'neutral'"
    :label="copied ? '링크 복사됨' : '공유'"
    @click="handleShare"
  />
</template>
