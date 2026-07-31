<script setup lang="ts">
import { MemiBoardDetail } from 'memi-board'

const route = useRoute()
const router = useRouter()
const id = route.params.id as string
</script>

<template>
  <div class="max-w-3xl mx-auto p-6">
    <MemiBoardDetail
      :post-id="id"
      @deleted="router.push('/board')"
      @edit="router.push(`/board/${id}/edit`)"
    />
  </div>
</template>
