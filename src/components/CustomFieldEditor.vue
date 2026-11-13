<script setup lang="ts">
import { ref } from 'vue'
import { CUSTOM_FIELD_LABEL_MAX, CUSTOM_FIELD_MAX, CUSTOM_FIELD_PLACEHOLDER_MAX, useMemiBoardI18n } from 'memi-board/runtime'
import type { BoardCustomField } from 'memi-board/runtime'

const fields = defineModel<BoardCustomField[]>({ default: () => [] })
const emit = defineEmits<{ dirty: [] }>()
const { t } = useMemiBoardI18n()

function add() {
  if (fields.value.length >= CUSTOM_FIELD_MAX) return
  fields.value = [...fields.value, { key: '', label: '', placeholder: '' }]
  emit('dirty')
}

function move(from: number, to: number) {
  if (from === to || to < 0 || to >= fields.value.length) return
  const next = [...fields.value]
  const [field] = next.splice(from, 1)
  next.splice(to, 0, field!)
  fields.value = next
  emit('dirty')
}

/** Rows are draggable only while the grip is pressed, so text in the inputs stays selectable. */
const armed = ref<number | null>(null)
const dragging = ref<number | null>(null)
const over = ref<number | null>(null)

function dragStart(event: DragEvent, index: number) {
  dragging.value = index
  event.dataTransfer?.setData('text/plain', String(index))
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function dragOver(event: DragEvent, index: number) {
  if (dragging.value === null) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  over.value = index
}

function drop(index: number) {
  if (dragging.value !== null) move(dragging.value, index)
  dragEnd()
}

function dragEnd() {
  armed.value = null
  dragging.value = null
  over.value = null
}

function remove(index: number) {
  fields.value = fields.value.filter((_, item) => item !== index)
  emit('dirty')
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div>
      <p class="text-sm font-medium">{{ t('settings.customFields.label') }}</p>
      <p class="text-xs text-muted">{{ t('settings.customFields.help') }}</p>
    </div>
    <div v-if="fields.length" class="hidden gap-2 text-xs text-muted sm:flex">
      <span class="w-8 shrink-0" />
      <div class="grid min-w-0 flex-1 grid-cols-3 gap-2">
        <span>{{ t('settings.customFields.key') }}</span>
        <span>{{ t('settings.customFields.name') }}</span>
        <span>{{ t('settings.customFields.placeholder') }}</span>
      </div>
      <span class="w-8 shrink-0" />
    </div>
    <div
      v-for="(field, index) in fields"
      :key="index"
      class="flex items-center gap-2 rounded-md transition-opacity"
      :class="[dragging === index ? 'opacity-40' : '', over === index && dragging !== null && dragging !== index ? 'ring-2 ring-primary/50' : '']"
      :draggable="armed === index"
      @dragstart="dragStart($event, index)"
      @dragover="dragOver($event, index)"
      @dragleave="over === index && (over = null)"
      @drop.prevent="drop(index)"
      @dragend="dragEnd"
    >
      <div class="flex shrink-0 flex-col sm:hidden">
        <UButton
          icon="i-lucide-chevron-up"
          color="neutral"
          variant="ghost"
          size="xs"
          :disabled="index === 0"
          :aria-label="t('settings.customFields.moveUp')"
          @click="move(index, index - 1)"
        />
        <UButton
          icon="i-lucide-chevron-down"
          color="neutral"
          variant="ghost"
          size="xs"
          :disabled="index === fields.length - 1"
          :aria-label="t('settings.customFields.moveDown')"
          @click="move(index, index + 1)"
        />
      </div>
      <UTooltip :text="t('settings.customFields.drag')" :delay-duration="200">
        <UButton
          class="hidden shrink-0 cursor-grab active:cursor-grabbing sm:inline-flex"
          icon="i-lucide-grip-vertical"
          color="neutral"
          variant="ghost"
          :aria-label="t('settings.customFields.drag')"
          @pointerdown="armed = index"
          @pointerup="dragging === null && (armed = null)"
          @keydown.up.prevent="move(index, index - 1)"
          @keydown.down.prevent="move(index, index + 1)"
        />
      </UTooltip>
      <div class="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
        <UInput
          v-model="field.key"
          :placeholder="t('settings.customFields.keyPlaceholder')"
          :aria-label="t('settings.customFields.key')"
          maxlength="32"
          class="w-full font-mono"
          autocapitalize="off"
          spellcheck="false"
          @update:model-value="emit('dirty')"
        />
        <UInput
          v-model="field.label"
          :placeholder="t('settings.customFields.namePlaceholder')"
          :aria-label="t('settings.customFields.name')"
          :maxlength="CUSTOM_FIELD_LABEL_MAX"
          class="w-full"
          @update:model-value="emit('dirty')"
        />
        <UInput
          v-model="field.placeholder"
          :placeholder="t('settings.customFields.inputPlaceholder')"
          :aria-label="t('settings.customFields.placeholder')"
          :maxlength="CUSTOM_FIELD_PLACEHOLDER_MAX"
          class="w-full"
          @update:model-value="emit('dirty')"
        />
      </div>
      <UTooltip :text="t('common.action.delete')" :delay-duration="200">
        <UButton
          class="shrink-0"
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          :aria-label="t('common.action.delete')"
          @click="remove(index)"
        />
      </UTooltip>
    </div>
    <div>
      <UButton
        :label="t('settings.customFields.add')"
        icon="i-lucide-plus"
        color="neutral"
        variant="outline"
        size="sm"
        :disabled="fields.length >= CUSTOM_FIELD_MAX"
        @click="add"
      />
    </div>
  </div>
</template>
