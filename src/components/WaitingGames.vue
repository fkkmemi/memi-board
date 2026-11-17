<script setup lang="ts">
import { ref } from 'vue'
import { useMemiBoardI18n } from 'memi-board/runtime'
import MemiBoardGameMemory from './GameMemory.vue'
import MemiBoardGameLightsOut from './GameLightsOut.vue'
import MemiBoardGameSlide from './GameSlide.vue'
import MemiBoardGameSudoku from './GameSudoku.vue'
import MemiBoardGameGomoku from './GameGomoku.vue'
import MemiBoardGame2048 from './Game2048.vue'

const { t } = useMemiBoardI18n()
const GAMES = ['memory', 'lights', 'slide', 'sudoku', 'gomoku', 'twenty48'] as const
const LEVELS = ['low', 'mid', 'high'] as const
// 열릴 때마다 무작위로 하나를 시작하고, 탭으로 다른 게임을 고를 수 있다.
const game = ref<typeof GAMES[number]>(GAMES[Math.floor(Math.random() * GAMES.length)]!)
const level = ref<typeof LEVELS[number]>('mid')
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap justify-center gap-1" role="group">
      <button
        v-for="item in GAMES"
        :key="item"
        type="button"
        :aria-pressed="game === item"
        class="cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
        :class="game === item ? 'bg-default text-highlighted shadow-sm ring ring-default' : 'bg-elevated/70 text-muted hover:text-highlighted'"
        @click="game = item"
      >{{ t(`waiting.games.${item}`) }}</button>
    </div>
    <MemiBoardGameMemory v-if="game === 'memory'" :key="level" :level="level" />
    <MemiBoardGameLightsOut v-else-if="game === 'lights'" :key="level" :level="level" />
    <MemiBoardGameSlide v-else-if="game === 'slide'" :key="level" :level="level" />
    <MemiBoardGameSudoku v-else-if="game === 'sudoku'" :key="level" :level="level" />
    <MemiBoardGameGomoku v-else-if="game === 'gomoku'" :key="level" :level="level" />
    <MemiBoardGame2048 v-else-if="game === 'twenty48'" :key="level" :level="level" />
    <div class="flex justify-center gap-1" role="group" :aria-label="t('waiting.level.label')">
      <button
        v-for="item in LEVELS"
        :key="item"
        type="button"
        :aria-pressed="level === item"
        class="cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors"
        :class="level === item ? 'bg-default text-highlighted shadow-sm ring ring-default' : 'bg-elevated/70 text-muted hover:text-highlighted'"
        @click="level = item"
      >{{ t(`waiting.level.${item}`) }}</button>
    </div>
  </div>
</template>
