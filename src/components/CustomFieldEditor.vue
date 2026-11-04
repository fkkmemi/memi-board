<script setup lang="ts">
import { CUSTOM_FIELD_LABEL_MAX, CUSTOM_FIELD_MAX, CUSTOM_FIELD_PLACEHOLDER_MAX } from '../utils/customFields'
import type { BoardCustomField } from '../types'
import { useMemiBoardI18n } from '../i18n/useMemiBoardI18n'

const fields = defineModel<BoardCustomField[]>({ default: () => [] })
const emit = defineEmits<{ dirty: [] }>()
const { t } = useMemiBoardI18n()

function add() {
  if (fields.value.length >= CUSTOM_FIELD_MAX) return
  fields.value = [...fields.value, { key: '', label: '', placeholder: '' }]
  emit('dirty')
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
      <div class="grid min-w-0 flex-1 grid-cols-3 gap-2">
        <span>{{ t('settings.customFields.key') }}</span>
        <span>{{ t('settings.customFields.name') }}</span>
        <span>{{ t('settings.customFields.placeholder') }}</span>
      </div>
      <span class="w-8 shrink-0" />
    </div>
    <div v-for="(field, index) in fields" :key="index" class="flex items-center gap-2">
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
      <UButton
        class="shrink-0"
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        :aria-label="t('common.action.delete')"
        @click="remove(index)"
      />
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
