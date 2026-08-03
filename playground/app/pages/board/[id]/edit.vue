<script setup lang="ts">


definePageMeta({ middleware: 'board-auth' })

const route = useRoute()
const router = useRouter()
const id = route.params.id as string
</script>

<template>
  <div class="max-w-3xl mx-auto p-6">
    <MemiBoardEditor
      :post-id="id"
      @saved="(savedId) => router.push(`/board/${savedId}`)"
      @cancel="router.push(`/board/${id}`)"
    />
  </div>
</template>
