<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useMemiBoardI18n } from 'memi-board/runtime'

const props = withDefaults(defineProps<{
  state?: 'idle' | 'authenticating' | 'working' | 'error'
  processed?: number
  error?: string
  isOwner?: boolean
  accountLabel?: string | null
  lockedPolicy?: boolean | null
}>(), { state: 'idle', processed: 0, error: '', isOwner: false, accountLabel: null, lockedPolicy: null })
const emit = defineEmits<{ confirm: [options: { deleteContent: boolean }] }>()
const { t, formatNumber } = useMemiBoardI18n()
const open = ref(false)
const deleteContent = ref(false)
const acknowledged = ref(false)
const confirmation = ref('')
const busy = computed(() => props.state === 'authenticating' || props.state === 'working')
const canConfirm = computed(() => !busy.value && !props.isOwner && acknowledged.value && confirmation.value === 'DELETE')
watch(() => props.lockedPolicy, value => { if (value !== null) deleteContent.value = value }, { immediate: true })
function showConfirmation() {
  if (busy.value || props.isOwner) return
  confirmation.value = ''
  acknowledged.value = false
  if (props.lockedPolicy === null) deleteContent.value = false
  open.value = true
}
</script>

<template>
  <section class="mt-6 rounded-xl border border-error/20 bg-error/3 p-4">
    <h3 class="text-sm font-semibold text-highlighted">{{ t('accountDeletion.title') }}</h3>
    <p class="mt-1 text-xs leading-5 text-muted">{{ t(isOwner ? 'accountDeletion.ownerBlocked' : 'accountDeletion.intro') }}</p>
    <UButton class="mt-3" color="error" variant="ghost" size="sm" :disabled="isOwner || busy" :loading="busy" :label="t('accountDeletion.open')" @click="showConfirmation" />
  </section>
  <UModal v-model:open="open" :title="t('accountDeletion.title')" :description="t('accountDeletion.description')" :dismissible="!busy" :close="!busy" :ui="{ content: 'sm:max-w-lg' }">
    <template #body>
      <div class="space-y-5">
        <p v-if="accountLabel" class="break-all rounded-lg bg-muted p-3 text-sm font-medium text-highlighted">{{ accountLabel }}</p>
        <UAlert color="warning" variant="subtle" icon="i-lucide-triangle-alert" :description="t('accountDeletion.authWarning')" />
        <UCheckbox v-model="deleteContent" :disabled="busy || lockedPolicy !== null" :label="t('accountDeletion.deleteContent')" :description="t('accountDeletion.contentWarning')" />
        <p class="text-xs leading-5 text-muted">{{ t('accountDeletion.retention') }}</p>
        <p v-if="lockedPolicy !== null" class="text-xs text-warning">{{ t('accountDeletion.resumePolicy') }}</p>
        <UCheckbox v-model="acknowledged" :disabled="busy" :label="t('accountDeletion.acknowledge')" />
        <UFormField :label="t('accountDeletion.typeConfirmation')">
          <UInput v-model="confirmation" :disabled="busy" placeholder="DELETE" autocomplete="off" spellcheck="false" class="w-full" @keydown.enter.prevent="canConfirm && emit('confirm', { deleteContent })" />
        </UFormField>
        <div v-if="busy" role="status" aria-live="polite" class="space-y-2 rounded-lg border border-default p-4">
          <p class="text-sm font-medium text-highlighted">{{ t(state === 'authenticating' ? 'accountDeletion.authenticating' : 'accountDeletion.working') }}</p>
          <UProgress />
          <p class="text-xs leading-5 text-muted">{{ t('accountDeletion.progress', { count: formatNumber(processed) }) }}</p>
        </div>
        <UAlert v-if="error" color="error" variant="subtle" :description="error" />
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="outline" :disabled="busy" :label="t('common.action.cancel')" @click="open = false" />
        <UButton color="error" :loading="busy" :disabled="!canConfirm" :label="t(lockedPolicy !== null ? 'accountDeletion.resume' : 'accountDeletion.confirm')" @click="emit('confirm', { deleteContent })" />
      </div>
    </template>
  </UModal>
</template>
