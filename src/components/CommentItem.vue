<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/ko'
import type { CommentModel } from 'memi-board/runtime'
import { useMemiBoardAuth } from 'memi-board/runtime'

dayjs.extend(relativeTime)
dayjs.locale('ko')

const props = defineProps<{
  comment: CommentModel
  now: number
  deleting?: boolean
}>()

const emit = defineEmits<{
  delete: [commentId: string]
  reply: [comment: CommentModel]
}>()

const { canDeleteComment } = useMemiBoardAuth()

const date = computed(() => props.comment.createdAt?.toDate?.())
const relativeDate = computed(() => date.value ? dayjs(date.value).from(dayjs(props.now)) : '방금 전')
const fullDate = computed(() => date.value ? dayjs(date.value).format('YYYY년 M월 D일 HH:mm:ss') : '시간 확인 중')
</script>

<template>
  <div class="flex items-start gap-3">
    <UAvatar
      :src="comment.authorPhoto ?? undefined"
      :alt="comment.authorName ?? '익명'"
      size="sm"
    />
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium">{{ comment.authorName ?? '익명' }}</span>
        <UTooltip :text="fullDate">
          <time
            :datetime="date?.toISOString()"
            class="cursor-help text-xs text-muted"
          >
            {{ relativeDate }}
          </time>
        </UTooltip>
      </div>
      <p class="whitespace-pre-wrap break-words text-sm">
        <span v-if="comment.parentId && comment.replyToName" class="mr-1 text-primary">@{{ comment.replyToName }}</span>
        {{ comment.body }}
      </p>
      <UButton
        label="답글"
        size="xs"
        color="neutral"
        variant="link"
        class="mt-1 px-0"
        @click="emit('reply', comment)"
      />
    </div>
    <UButton
      v-if="canDeleteComment(comment) && comment.id"
      icon="i-lucide-trash-2"
      size="xs"
      variant="ghost"
      color="error"
      :loading="deleting"
      aria-label="댓글 삭제"
      @click="emit('delete', comment.id)"
    />
  </div>
</template>
