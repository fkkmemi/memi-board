<script setup lang="ts">
import { MemiBoardEditor } from 'memi-board'

definePageMeta({ middleware: 'board-auth' })

const router = useRouter()
</script>

<template>
  <div class="max-w-3xl mx-auto p-6">
    <MemiBoardEditor
      @saved="(id) => router.push(`/board/${id}`)"
      @cancel="router.push('/board')"
    />
  </div>
</template>
