<script setup lang="ts">
import { computed } from 'vue'
import { useMemiBoardI18n, versionHistory } from 'memi-board/runtime'

// 버전 기록은 한국어·영어만 둔다. 한국어가 아니면 영어를 보여준다.
const { locale } = useMemiBoardI18n()
const entries = computed(() => versionHistory.map(entry => locale.value === 'ko'
  ? entry
  : { ...entry, highlights: entry.highlightsEn ?? entry.highlights, note: entry.noteEn ?? entry.note }))
</script>

<template>
  <div class="flex flex-col gap-6">
    <div
      v-for="entry in entries"
      :key="entry.version"
      class="flex flex-col gap-2"
    >
      <div class="flex items-center gap-2">
        <UBadge
          :label="`v${entry.version}`"
          color="primary"
          variant="subtle"
        />
        <span class="text-sm text-muted">{{ entry.date }}</span>
      </div>
      <ul class="list-disc list-inside text-sm leading-relaxed space-y-1">
        <li
          v-for="item in entry.highlights"
          :key="item"
        >
          {{ item }}
        </li>
      </ul>
      <p
        v-if="entry.note"
        class="text-xs text-muted"
      >
        {{ entry.note }}
      </p>
    </div>
  </div>
</template>
