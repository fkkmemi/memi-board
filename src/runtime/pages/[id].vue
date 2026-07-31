<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const id = route.params.id as string
const base = route.meta.memiBoardBase as string
</script>

<template>
  <div class="max-w-3xl mx-auto p-6">
    <MemiBoardDetail
      :post-id="id"
      @deleted="router.push(base)"
      @edit="router.push(`${base}/${id}/edit`)"
    />
  </div>
</template>
