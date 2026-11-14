<script setup lang="ts">
import { ref } from 'vue'
import { useMemiBoardI18n } from 'memi-board/runtime'
import MemiBoardGameMemory from './GameMemory.vue'
import MemiBoardGameLightsOut from './GameLightsOut.vue'
import MemiBoardGameSudoku from './GameSudoku.vue'

const { t } = useMemiBoardI18n()
const GAMES = ['memory', 'lights', 'sudoku'] as const
// 열릴 때마다 무작위로 하나를 시작하고, 탭으로 다른 게임을 고를 수 있다.
const game = ref<typeof GAMES[number]>(GAMES[Math.floor(Math.random() * GAMES.length)]!)
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="mx-auto flex gap-1 rounded-full bg-elevated/70 p-1" role="group">
      <button
        v-for="item in GAMES"
        :key="item"
        type="button"
        :aria-pressed="game === item"
        class="cursor-pointer rounded-full px-4 py-1.5 text-xs font-medium transition-colors"
        :class="game === item ? 'bg-default text-highlighted shadow-sm ring ring-default' : 'text-muted hover:text-highlighted'"
        @click="game = item"
      >{{ t(`waiting.games.${item}`) }}</button>
    </div>
    <MemiBoardGameMemory v-if="game === 'memory'" />
    <MemiBoardGameLightsOut v-else-if="game === 'lights'" />
    <MemiBoardGameSudoku v-else />
  </div>
</template>
