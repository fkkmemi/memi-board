<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const base = route.meta.memiBoardBase as string
</script>

<template>
  <div class="max-w-3xl mx-auto p-6">
    <MemiBoardEditor
      @saved="(id) => router.push(`${base}/${id}`)"
      @cancel="router.push(base)"
    />
  </div>
</template>
