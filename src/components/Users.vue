<script setup lang="ts">
import { computed, ref } from 'vue'
import { BOARD_USER_ROLES, useMemiBoardAuth, useMemiBoardI18n, useMemiBoardUsers } from 'memi-board/runtime'
import type { BoardUserRole } from 'memi-board/runtime'

const props = withDefaults(defineProps<{ authorized?: boolean }>(), { authorized: false })
const { isAdmin, rolePending } = useMemiBoardAuth()
const canManage = computed(() => isAdmin.value || props.authorized)
const { users, usersPending, updateUserRole } = useMemiBoardUsers({ enabled: canManage })
const { t, formatNumber } = useMemiBoardI18n()
const roleItems = computed(() => BOARD_USER_ROLES.map(item => ({
  ...item,
  label: t(`common.role.${item.value}`),
  description: t(`boardUsers.roleDescription.${item.value}`),
})))
const savingUid = ref<string | null>(null)
const savedUid = ref<string | null>(null)
const error = ref('')

async function changeRole(uid: string, role: BoardUserRole) {
  if (!canManage.value) return
  savingUid.value = uid
  savedUid.value = null
  error.value = ''
  try {
    await updateUserRole(uid, role)
    savedUid.value = uid
  }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : t('users.changeRoleFailed')
  }
  finally {
    savingUid.value = null
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="grid gap-3 md:grid-cols-3">
      <UAlert v-for="item in roleItems" :key="item.value" color="neutral" variant="subtle" :title="item.label" :description="item.description" />
    </div>
    <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-circle-alert" :description="error" />
    <div v-if="rolePending || usersPending" class="py-12 text-center text-sm text-muted">{{ t('users.loading') }}</div>
    <UAlert v-else-if="!canManage" color="error" variant="subtle" icon="i-lucide-shield-alert" :title="t('users.noPermission.title')" :description="t('users.noPermission.description')" />
    <div v-else-if="users.length === 0" class="py-12 text-center text-sm text-muted">{{ t('users.empty') }}</div>
    <div v-else class="divide-y divide-default rounded-lg border border-default">
      <div v-for="boardUser in users" :key="boardUser.id" class="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_12rem] md:items-center">
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <p class="truncate font-medium text-highlighted">{{ boardUser.displayName || t('users.noName') }}</p>
            <UBadge v-if="savedUid === boardUser.id" color="success" variant="subtle" :label="t('common.action.saved')" />
          </div>
          <p class="truncate text-sm text-muted">{{ boardUser.id }}</p>
          <p v-if="boardUser.moderationBlockCount" class="mt-1 text-xs text-warning">{{ t('users.moderationWarnings', { count: formatNumber(boardUser.moderationBlockCount) }) }}</p>
        </div>
        <USelect
          :model-value="boardUser.role || 'user'"
          :items="roleItems"
          value-key="value"
          label-key="label"
          :loading="savingUid === boardUser.id"
          :disabled="savingUid === boardUser.id"
          @update:model-value="changeRole(boardUser.id, $event as BoardUserRole)"
        />
      </div>
    </div>
  </div>
</template>
