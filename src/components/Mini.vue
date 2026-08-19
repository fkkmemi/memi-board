<script setup lang="ts">
import type { BoardSection, CommentModel, PostModel } from 'memi-board/runtime'
import { useMemiBoardSections } from 'memi-board/runtime'
import MemiBoardSection from './Section.vue'

defineProps<{
  getPostLink?: (post: PostModel) => string | undefined
  getCommentLink?: (comment: CommentModel) => string | undefined
  getMoreLink?: (section: BoardSection) => string | undefined
}>()

const { sections, pending, hasSavedLayout } = useMemiBoardSections()
</script>

<template>
  <section v-if="pending && !hasSavedLayout" class="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
    <div class="grid grid-cols-12 gap-3">
      <USkeleton v-for="i in 4" :key="i" class="col-span-12 h-48 md:col-span-6" />
    </div>
  </section>

  <section
    v-else-if="sections.length"
    class="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6"
  >
    <div class="grid grid-cols-12 gap-3">
      <MemiBoardSection
        v-for="section in sections"
        :key="section.id"
        :section="section"
        :get-post-link="getPostLink"
        :get-comment-link="getCommentLink"
        :get-more-link="getMoreLink"
      />
    </div>
  </section>
</template>
