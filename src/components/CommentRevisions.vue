<script setup lang="ts">
import { computed, watch } from 'vue'
import { useMemiBoardCommentRevisions, useMemiBoardI18n } from 'memi-board/runtime'

/** 댓글 수정 기록. 수정으로 덮어쓰인 이전 본문·이미지를 최신순으로 보여 준다. 보드 매니저 전용. */
const props = defineProps<{
  boardId: string
  commentId: string
}>()

const open = defineModel<boolean>('open', { default: false })

const { t, formatFullDate } = useMemiBoardI18n()
const { revisions, pending, error, load } = useMemiBoardCommentRevisions(() => props.boardId, () => props.commentId)

watch(open, (value) => {
  if (value) void load()
})

const items = computed(() => revisions.value.map(item => ({
  label: item.revision === 0 ? t('postRevisions.original') : t('postRevisions.version', { version: item.revision }),
  value: item.id,
  revision: item,
})))
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('commentItem.history')"
    :description="t('postRevisions.description')"
  >
    <template #body>
      <div v-if="pending" class="space-y-3">
        <USkeleton class="h-10 w-full" />
        <USkeleton class="h-10 w-full" />
      </div>
      <UAlert
        v-else-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        :title="t('postRevisions.loadFailed')"
      />
      <UEmpty
        v-else-if="!revisions.length"
        icon="i-lucide-history"
        :title="t('postRevisions.empty')"
      />
      <UAccordion v-else :items="items" type="multiple">
        <template #default="{ item }">
          <div class="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-start">
            <UBadge variant="subtle" color="neutral" size="sm">
              {{ item.label }}
            </UBadge>
            <span class="text-sm text-muted">
              {{ t('postRevisions.replacedAt', { time: formatFullDate(item.revision.createdAt) }) }}
            </span>
            <span class="text-sm text-muted">
              {{ t('postRevisions.replacedBy', { name: item.revision.editedByName || item.revision.editedBy }) }}
            </span>
          </div>
        </template>
        <template #content="{ item }">
          <div class="flex flex-col gap-2 pb-4">
            <p class="whitespace-pre-wrap break-words text-sm">
              {{ item.revision.body }}
            </p>
            <ULink
              v-for="image in item.revision.images"
              :key="image.path"
              :to="image.url"
              target="_blank"
              class="inline-block"
            >
              <img
                :src="image.url"
                :alt="t('commentItem.attachedImage')"
                class="max-h-60 max-w-full rounded-md border border-default object-contain"
              >
            </ULink>
          </div>
        </template>
      </UAccordion>
    </template>
  </UModal>
</template>
