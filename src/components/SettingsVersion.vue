<script setup lang="ts">
import { versionHistory } from 'memi-board/runtime'

/** 설정·관리 화면 맨 아래에 붙는 패키지 버전. 문의할 때 어떤 버전인지 바로 알 수 있게 한다. */
const version = versionHistory[0]?.version
</script>

<template>
  <p v-if="version" class="mt-8 text-center font-mono text-xs text-dimmed">memi-board™ v{{ version }}</p>
</template>
