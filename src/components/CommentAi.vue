<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { boardTranslationLocales, COMMENT_BODY_MAX_LENGTH, useMemiBoardI18n, useMemiBoardSettings, useMemiBoardWritingAssistant } from 'memi-board/runtime'
import type { CommentTranslationSet, WritingAssistantAction } from 'memi-board/runtime'

const props = defineProps<{ boardId: string, disabled?: boolean }>()
const body = defineModel<string>({ required: true })
const translations = defineModel<CommentTranslationSet | undefined>('translations')
const emit = defineEmits<{ busy: [value: boolean] }>()
const { t, locale, translationEnabled } = useMemiBoardI18n()
const { getBoard } = useMemiBoardSettings()
const { assist, translateComment } = useMemiBoardWritingAssistant({ locale })
const targets = computed(() => boardTranslationLocales(getBoard(props.boardId)))
const running = ref(false)
const error = ref('')
const notice = ref('')
const previewOpen = ref(false)
const before = ref('')
const result = ref('')
const customOpen = ref(false)
const instruction = ref('')
watch(body, () => { translations.value = undefined; notice.value = '' }, { flush: 'sync' })
const items = computed(() => [
  [
    ...(['proofread', 'polish', 'continue', 'summarize'] as const).map(action => ({ label: t(`editor.ai.${action}`), onSelect: () => run(action) })),
  ],
  ...(translationEnabled.value ? [[{ label: t('editor.ai.translateAll', { count: targets.value.length }), icon: 'i-lucide-languages', onSelect: translate }]] : []),
  [{ label: t('editor.ai.custom'), onSelect: () => { instruction.value = ''; customOpen.value = true } }],
])
function busy(value: boolean) { running.value = value; emit('busy', value) }
async function run(action: WritingAssistantAction) {
  if (running.value || props.disabled || !body.value.trim()) return
  before.value = body.value
  error.value = ''; notice.value = ''
  busy(true)
  try {
    const output = await assist({ action, content: before.value, selection: true, customInstruction: instruction.value })
    result.value = action === 'continue' ? `${before.value}\n\n${output}` : output
    if (result.value.length > COMMENT_BODY_MAX_LENGTH) throw new Error(t('comments.bodyTooLong', { max: COMMENT_BODY_MAX_LENGTH }))
    previewOpen.value = true
  }
  catch (cause) { error.value = cause instanceof Error ? cause.message : t('editor.ai.failed') }
  finally { busy(false) }
}
async function translate() {
  if (running.value || props.disabled || !body.value.trim()) return
  const source = body.value
  error.value = ''; notice.value = ''
  busy(true)
  try {
    const output = await translateComment({ body: source, targets: targets.value })
    if (body.value === source) {
      translations.value = output
      notice.value = t('commentForm.translationPending', { count: targets.value.length })
    }
  }
  catch (cause) { error.value = cause instanceof Error ? cause.message : t('editor.ai.failed') }
  finally { busy(false) }
}
function apply() {
  if (body.value === before.value) body.value = result.value
  previewOpen.value = false
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <UDropdownMenu :items="items">
      <UButton type="button" icon="i-lucide-sparkles" label="AI" size="sm" color="neutral" variant="ghost"
        :aria-label="t('editor.aiAssistant')" :loading="running" :disabled="disabled || running || !body.trim()" />
    </UDropdownMenu>
    <span v-if="error" class="text-xs text-error" role="alert">{{ error }}</span>
    <span v-else-if="notice" class="text-xs text-primary" role="status">{{ notice }}</span>
  </div>
  <UModal v-model:open="customOpen" :title="t('editor.ai.custom')">
    <template #body><UTextarea v-model="instruction" :maxlength="200" /></template>
    <template #footer>
      <UButton type="button" :disabled="!instruction.trim()" :label="t('editor.apply')" @click="customOpen = false; run('custom')" />
    </template>
  </UModal>
  <UModal v-model:open="previewOpen" :title="t('editor.aiPreview.title')">
    <template #body>
      <div class="grid gap-4 sm:grid-cols-2">
        <div><p class="text-xs text-muted">{{ t('editor.aiPreview.before') }}</p><p class="whitespace-pre-wrap break-words text-sm">{{ before }}</p></div>
        <div><p class="text-xs text-primary">{{ t('editor.aiPreview.after') }}</p><p class="whitespace-pre-wrap break-words text-sm">{{ result }}</p></div>
      </div>
    </template>
    <template #footer>
      <UButton type="button" color="neutral" variant="ghost" :label="t('common.action.cancel')" @click="previewOpen = false" />
      <UButton type="button" :label="t('editor.apply')" :disabled="disabled || body !== before" @click="apply" />
    </template>
  </UModal>
</template>
