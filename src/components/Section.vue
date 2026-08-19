<script setup lang="ts">
import { computed } from 'vue'
import type { BoardSection, CommentModel, PostModel } from 'memi-board/runtime'
import { miniMoreLink, sectionColClass, sectionMinHeight } from 'memi-board/runtime'
import MemiBoardMiniComments from './MiniComments.vue'
import MemiBoardMiniList from './MiniList.vue'
import MemiBoardMiniPost from './MiniPost.vue'

const props = defineProps<{
  section: BoardSection
  getPostLink?: (post: PostModel) => string | undefined
  getCommentLink?: (comment: CommentModel) => string | undefined
  getMoreLink?: (section: BoardSection) => string | undefined
}>()

const moreTo = computed(() => props.getMoreLink?.(props.section) ?? miniMoreLink(props.section))
</script>

<template>
  <article
    class="flex flex-col overflow-hidden rounded-xl border border-default bg-default"
    :class="[sectionColClass(section.cols), sectionMinHeight(section.height)]"
  >
    <header
      v-if="section.showTitle || section.kind === 'list' || section.kind === 'comments'"
      class="flex items-center justify-between gap-2 border-b border-default px-3 py-2"
    >
      <h2
        v-if="section.showTitle"
        class="min-w-0 truncate text-sm font-semibold text-highlighted"
      >
        {{ section.title }}
      </h2>
      <span v-else class="min-w-0" />
      <UButton
        v-if="section.kind === 'list' || section.kind === 'comments'"
        :to="moreTo"
        variant="link"
        color="neutral"
        size="xs"
        trailing-icon="i-lucide-chevron-right"
        class="shrink-0 px-0"
        label="더 보기"
      />
    </header>
    <MemiBoardMiniList
      v-if="section.kind === 'list'"
      :section="section"
      :get-post-link="getPostLink"
    />
    <MemiBoardMiniComments
      v-else-if="section.kind === 'comments'"
      :section="section"
      :get-comment-link="getCommentLink"
    />
    <MemiBoardMiniPost
      v-else
      :section="section"
      :get-post-link="getPostLink"
    />
  </article>
</template>
