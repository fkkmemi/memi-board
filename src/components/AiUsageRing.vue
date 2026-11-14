<script setup lang="ts">
import { computed } from 'vue'

/** 하루 AI 사용 횟수를 원형 게이지로 보여 준다. 80%부터 노랑, 다 쓰면 빨강. */
const props = defineProps<{
  used: number
  limit: number
  /** 접근성·툴팁용 설명 */
  label?: string
  /** 링 옆에 `남은/전체` 숫자를 보여 줄지 */
  showCount?: boolean
}>()

const CIRCUMFERENCE = 2 * Math.PI * 8
const ratio = computed(() => props.limit > 0 ? Math.min(props.used / props.limit, 1) : 0)
const remaining = computed(() => Math.max(0, props.limit - props.used))
const tone = computed(() => ratio.value >= 1 ? 'text-error' : ratio.value >= 0.8 ? 'text-warning' : 'text-primary')
</script>

<template>
  <span
    role="meter"
    :aria-label="label"
    :aria-valuenow="used"
    aria-valuemin="0"
    :aria-valuemax="limit"
    class="inline-flex items-center gap-1 text-xs tabular-nums"
    :class="tone"
  >
    <svg viewBox="0 0 20 20" class="size-5 -rotate-90" aria-hidden="true">
      <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="2.5" class="opacity-20" />
      <circle
        cx="10"
        cy="10"
        r="8"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        :stroke-dasharray="CIRCUMFERENCE"
        :stroke-dashoffset="CIRCUMFERENCE * (1 - ratio)"
        class="transition-[stroke-dashoffset] duration-300"
      />
    </svg>
    <span v-if="showCount">{{ remaining }}/{{ limit }}</span>
  </span>
</template>
