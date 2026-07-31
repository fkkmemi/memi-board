<script setup lang="ts">
const route = useRoute()
const base = route.meta.memiBoardBase as string
const { isSignedIn } = useMemiBoardAuth()
</script>

<template>
  <div class="max-w-3xl mx-auto p-6 flex flex-col gap-6">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-semibold">
        게시판
      </h1>
      <UButton
        v-if="isSignedIn"
        :to="`${base}/new`"
        label="새 글쓰기"
        icon="i-lucide-pencil"
      />
    </div>
    <MemiBoardList :link-base="base" />
    <MemiBoardSignIn v-if="!isSignedIn" />
  </div>
</template>
