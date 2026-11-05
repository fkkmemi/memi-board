<script setup lang="ts">
import { inject, provide } from 'vue'
import MemiBoardFooter from './Footer.vue'

defineProps<{ introduction?: string }>()
const nested = inject('memi-board:surface', false)
provide('memi-board:surface', true)
</script>

<template>
  <div :class="!nested && 'flex flex-col gap-4'">
    <slot />
    <MemiBoardFooter v-if="!nested" :introduction="introduction" />
  </div>
</template>
