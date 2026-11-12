<script setup lang="ts">
import { computed, watch } from 'vue'
import Youtube from '@tiptap/extension-youtube'
import { renderMarkdownToHtml, useMemiBoardI18n, useMemiBoardPostRevisions } from 'memi-board/runtime'

/** 글 수정 기록. 수정으로 덮어쓰인 이전 버전을 최신순으로 보여 준다. 보드 매니저 전용. */
const props = defineProps<{
  boardId: string
  postId: string
}>()

const open = defineModel<boolean>('open', { default: false })

const { t, formatFullDate } = useMemiBoardI18n()
const { revisions, pending, error, load } = useMemiBoardPostRevisions(() => props.boardId, () => props.postId)

watch(open, (value) => {
  if (value) void load()
})

const viewerExtensions = [
  Youtube.configure({ nocookie: true, controls: true, width: 640, height: 360 }),
]

function contentHtml(raw: string): string {
  if (!raw.trim()) return ''
  if (/<[a-z][\s\S]*>/i.test(raw)) return raw
  return renderMarkdownToHtml(raw)
}

const items = computed(() => revisions.value.map(item => ({
  label: item.revision === 0 ? t('postRevisions.original') : t('postRevisions.version', { version: item.revision }),
  value: item.id,
  revision: item,
})))
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('postRevisions.title')"
    :description="t('postRevisions.description')"
    :ui="{ content: 'sm:max-w-3xl' }"
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
          <div class="flex flex-col gap-3 pb-4">
            <h3 class="text-lg font-semibold break-words">
              {{ item.revision.title }}
            </h3>
            <UEditor
              class="prose dark:prose-invert max-w-none break-words"
              :model-value="contentHtml(item.revision.content)"
              content-type="html"
              :editable="false"
              :extensions="viewerExtensions"
              :starter-kit="{ link: { openOnClick: true } }"
            />
            <div v-if="item.revision.tags?.length" class="flex flex-wrap gap-1">
              <UBadge v-for="tag in item.revision.tags" :key="tag" variant="subtle" color="primary" size="sm">
                {{ tag }}
              </UBadge>
            </div>
            <ul v-if="item.revision.attachments?.length" class="flex flex-col gap-1 text-sm">
              <li v-for="file in item.revision.attachments" :key="file.path" class="flex items-center gap-1">
                <UIcon name="i-lucide-paperclip" class="size-3.5 text-muted" />
                <ULink :to="file.url" target="_blank" class="break-all">
                  {{ file.name }}
                </ULink>
              </li>
            </ul>
          </div>
        </template>
      </UAccordion>
    </template>
  </UModal>
</template>
