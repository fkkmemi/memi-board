<script setup lang="ts">
import MemiBoardSurface from './BoardSurface.vue'
import UserManagementEmail from './UserManagementEmail.vue'
import UserRoleGuide from './UserRoleGuide.vue'
import UserListControls from './UserListControls.vue'
import UserListPagination from './UserListPagination.vue'
import { computed, ref, watch } from 'vue'
import { BOARD_USER_ROLES, useMemiBoardAuth, useMemiBoardI18n, useMemiBoardUserDirectory } from 'memi-board/runtime'
import type { BoardUserModel, BoardUserRole } from 'memi-board/runtime'

const props = withDefaults(defineProps<{ authorized?: boolean }>(), { authorized: false })
const { isAdmin, isOwner, user, rolePending } = useMemiBoardAuth()
const canManage = computed(() => isAdmin.value || props.authorized)
const { users, usersPending, updateUserRole, loadError, sort, direction, pageSize, page, hasNext, previousPage, nextPage, refresh } = useMemiBoardUserDirectory({ enabled: canManage })
const { t, formatNumber } = useMemiBoardI18n()
const roleItems = computed(() => BOARD_USER_ROLES.map(item => ({
  ...item,
  label: t(`common.role.${item.value}`),
  description: t(`boardUsers.roleDescription.${item.value}`),
})))
const assignableRoles = computed(() => roleItems.value.filter(item => isOwner.value ? item.value !== 'owner' : !['owner', 'admin'].includes(item.value)))
const savingUid = ref<string | null>(null)
const savedUid = ref<string | null>(null)
const error = ref('')
const confirmOpen = ref(false)
const pendingChange = ref<{ uid: string; name: string; from: BoardUserRole; to: BoardUserRole } | null>(null)
const confirmDescription = computed(() => pendingChange.value ? t('users.confirmRole.description', {
  name: pendingChange.value.name,
  from: t(`common.role.${pendingChange.value.from}`),
  to: t(`common.role.${pendingChange.value.to}`),
}) : '')

watch(confirmOpen, open => {
  if (!open) {
    pendingChange.value = null
    error.value = ''
  }
})

function requestRoleChange(target: BoardUserModel, role: BoardUserRole) {
  if (!canManage.value || savingUid.value || target.id === user.value?.uid || target.role === 'owner'
    || (!isOwner.value && target.role === 'admin') || (target.role || 'user') === role
    || !assignableRoles.value.some(item => item.value === role)) return
  pendingChange.value = { uid: target.id, name: target.displayName || t('users.noName'), from: target.role || 'user', to: role }
  error.value = ''
  confirmOpen.value = true
}

async function confirmRoleChange() {
  const change = pendingChange.value
  if (!confirmOpen.value || !change || !canManage.value || savingUid.value
    || change.uid === user.value?.uid || (!isOwner.value && change.from === 'admin')
    || !assignableRoles.value.some(item => item.value === change.to)) return
  const { uid, to: role } = change
  savingUid.value = uid
  savedUid.value = null
  error.value = ''
  try {
    await updateUserRole(uid, role)
    savedUid.value = uid
    confirmOpen.value = false
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
  <MemiBoardSurface>
  <div class="flex flex-col gap-6">
    <UserRoleGuide />
    <UserListControls v-if="canManage" v-model:sort="sort" v-model:direction="direction" v-model:page-size="pageSize" :disabled="!!savingUid" />
    <div v-if="rolePending || usersPending" class="py-12 text-center text-sm text-muted">{{ t('users.loading') }}</div>
    <UAlert v-else-if="!canManage" color="error" variant="subtle" icon="i-lucide-shield-alert" :title="t('users.noPermission.title')" :description="t('users.noPermission.description')" />
    <UAlert v-else-if="loadError" color="error" variant="subtle" :description="t('users.loadFailed')">
      <template #actions><UButton color="neutral" variant="outline" :label="t('common.action.retry')" @click="refresh()" /></template>
    </UAlert>
    <div v-else-if="users.length === 0" class="py-12 text-center text-sm text-muted">{{ t('users.empty') }}</div>
    <div v-else class="divide-y divide-default rounded-lg border border-default">
      <div v-for="boardUser in users" :key="boardUser.id" class="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_12rem] md:items-center">
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <p class="truncate font-medium text-highlighted">{{ boardUser.displayName || t('users.noName') }}</p>
            <UBadge v-if="savedUid === boardUser.id" color="success" variant="subtle" :label="t('common.action.saved')" />
          </div>
          <UserManagementEmail :uid="boardUser.id" :authorized="canManage" />
          <p v-if="boardUser.moderationBlockCount" class="mt-1 text-xs text-warning">{{ t('users.moderationWarnings', { count: formatNumber(boardUser.moderationBlockCount) }) }}</p>
        </div>
        <USelect
          :model-value="boardUser.role || 'user'"
          :items="boardUser.role === 'owner' || (!isOwner && boardUser.role === 'admin') ? roleItems : assignableRoles"
          value-key="value"
          label-key="label"
          :loading="savingUid === boardUser.id"
          :disabled="!!savingUid || boardUser.id === user?.uid || boardUser.role === 'owner' || (!isOwner && boardUser.role === 'admin')"
          @update:model-value="requestRoleChange(boardUser, $event as BoardUserRole)"
        />
      </div>
    </div>
    <UserListPagination v-if="canManage" :page="page" :count="users.length" :has-next="hasNext" :pending="usersPending || !!savingUid" @previous="previousPage" @next="nextPage" />
  </div>
  <UModal v-model:open="confirmOpen" :title="t('users.confirmRole.title')" :description="confirmDescription" :dismissible="!savingUid" :close="!savingUid">
    <template #body>
      <UserManagementEmail v-if="pendingChange" :uid="pendingChange.uid" :authorized="canManage" />
      <UAlert v-if="error" class="mt-3" color="error" variant="subtle" icon="i-lucide-circle-alert" :description="error" />
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="outline" :label="t('common.action.cancel')" :disabled="!!savingUid" @click="confirmOpen = false" />
        <UButton :label="t('users.confirmRole.confirm')" :loading="!!savingUid" :disabled="!canManage" @click="confirmRoleChange" />
      </div>
    </template>
  </UModal>
  </MemiBoardSurface>
</template>
