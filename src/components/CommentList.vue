<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useMemiBoardComments } from 'memi-board'
import MemiBoardCommentSkeleton from './CommentSkeleton.vue'
import MemiBoardCommentThread from './CommentThread.vue'

const props = defineProps<{ postId: string }>()

const { comments, commentsPending, hasMore, loadingMore, loadMore } = useMemiBoardComments(props.postId)
const now = ref(Date.now())
const loadMoreTrigger = ref<HTMLElement | null>(null)
let relativeTimeTimer: ReturnType<typeof setInterval> | undefined
let loadMoreDelayTimer: ReturnType<typeof setTimeout> | undefined
let loadMoreObserver: IntersectionObserver | undefined
const waitingToLoad = ref(false)
const morePending = computed(() => waitingToLoad.value || loadingMore.value)
let triggerVisible = false
let automaticRequest = false

function cancelAutomaticLoad() {
  if (!automaticRequest || !loadMoreDelayTimer) return
  clearTimeout(loadMoreDelayTimer)
  loadMoreDelayTimer = undefined
  automaticRequest = false
  waitingToLoad.value = false
}

function scheduleLoadMore(automatic = false) {
  if (loadMoreDelayTimer || loadingMore.value || !hasMore.value) return
  automaticRequest = automatic
  waitingToLoad.value = true
  loadMoreDelayTimer = setTimeout(() => {
    loadMoreDelayTimer = undefined
    if (automaticRequest && !triggerVisible) {
      automaticRequest = false
      waitingToLoad.value = false
      return
    }
    automaticRequest = false
    waitingToLoad.value = false
    if (hasMore.value && !loadingMore.value) void loadMore()
  }, 1_000)
}

onMounted(() => {
  relativeTimeTimer = setInterval(() => { now.value = Date.now() }, 60_000)
  loadMoreObserver = new IntersectionObserver((entries) => {
    triggerVisible = entries.some(entry => entry.isIntersecting)
    if (triggerVisible) scheduleLoadMore(true)
    else cancelAutomaticLoad()
  })
  if (loadMoreTrigger.value) loadMoreObserver.observe(loadMoreTrigger.value)
})

watch(loadMoreTrigger, (element, previous) => {
  if (previous) loadMoreObserver?.unobserve(previous)
  if (element) loadMoreObserver?.observe(element)
}, { flush: 'post' })

onUnmounted(() => {
  clearInterval(relativeTimeTimer)
  clearTimeout(loadMoreDelayTimer)
  waitingToLoad.value = false
  loadMoreObserver?.disconnect()
})

</script>

<template>
  <div class="flex flex-col gap-3">
    <div v-if="commentsPending" class="flex flex-col gap-3" aria-label="댓글을 불러오고 있습니다">
      <MemiBoardCommentSkeleton v-for="index in 10" :key="`initial-${index}`" />
    </div>
    <p
      v-else-if="!comments.length"
      class="text-sm text-muted"
    >
      아직 댓글이 없습니다.
    </p>

    <MemiBoardCommentThread
      v-for="comment in comments"
      :key="comment.id"
      :root="comment"
      :post-id="postId"
      :now="now"
    />

    <div
      v-if="!commentsPending && hasMore"
      ref="loadMoreTrigger"
      class="flex justify-center py-3"
    >
      <UButton
        label="댓글 더보기"
        icon="i-lucide-chevron-down"
        color="neutral"
        variant="soft"
        :loading="morePending"
        :disabled="morePending"
        @click="scheduleLoadMore()"
      />
    </div>

    <div v-if="morePending" class="flex flex-col gap-3" aria-label="댓글을 더 불러오고 있습니다">
      <MemiBoardCommentSkeleton v-for="index in 10" :key="`more-${index}`" />
    </div>
  </div>
</template>
