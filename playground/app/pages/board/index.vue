<script setup lang="ts">
import { useMemiBoardAuth } from 'memi-board/runtime'

const { isSignedIn } = useMemiBoardAuth()
</script>

<template>
  <div class="max-w-3xl mx-auto p-6 flex flex-col gap-6">
    <MemiBoardList
      title="게시판"
      write-to="/board/new"
      :can-write="isSignedIn"
      link-base="/board"
    />
    <MemiBoardSignIn v-if="!isSignedIn" />
  </div>
</template>
