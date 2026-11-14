<script setup lang="ts">
import MemiBoardSurface from './BoardSurface.vue'
import MemiBoardSettingsVersion from './SettingsVersion.vue'
import UserManagementEmail from './UserManagementEmail.vue'
import UserRoleGuide from './UserRoleGuide.vue'
import UserListControls from './UserListControls.vue'
import UserListPagination from './UserListPagination.vue'
import { computed, ref, watch } from 'vue'
import { BOARD_USER_ROLES, IMAGE_GENERATION_DAILY_LIMIT, WRITING_ASSISTANT_DAILY_LIMIT, aiUsageSummary, useMemiBoardAuth, useMemiBoardI18n, useMemiBoardUserDirectory } from 'memi-board/runtime'
import type { BoardUserModel, BoardUserRole } from 'memi-board/runtime'

const props = withDefaults(defineProps<{ authorized?: boolean }>(), { authorized: false })
const { isAdmin, isOwner, user, rolePending } = useMemiBoardAuth()
const canManage = computed(() => isAdmin.value || props.authorized)
const { users, usersPending, updateUserRole, resetUserAiUsage, resetUserWarnings, loadError, sort, direction, pageSize, page, hasNext, previousPage, nextPage, refresh } = useMemiBoardUserDirectory({ enabled: canManage })
const { t, formatNumber } = useMemiBoardI18n()
const roleItems = computed(() => BOARD_USER_ROLES.map(item => ({
  ...item,
  label: t(`common.role.${item.value}`),
  description: t(`boardUsers.roleDescription.${item.value}`),
})))
const assignableRoles = computed(() => roleItems.value.filter(item => isOwner.value ? item.value !== 'owner' : !['owner', 'admin'].includes(item.value)))
const savingUid = ref<string | null>(null)
const resettingUid = ref<string | null>(null)
const resetUid = ref<string | null>(null)
const resetError = ref('')
const warningResetUid = ref<string | null>(null)
async function resetWarnings(target: BoardUserModel) {
  if (!isAdmin.value || resettingUid.value) return
  resettingUid.value = target.id
  warningResetUid.value = null
  resetError.value = ''
  try {
    await resetUserWarnings(target.id)
    warningResetUid.value = target.id
  }
  catch (cause) {
    resetError.value = cause instanceof Error ? cause.message : t('users.warningReset.failed')
  }
  finally {
    resettingUid.value = null
  }
}
const now = ref(Date.now())
function aiUsageOf(target: BoardUserModel) {
  const data = target as unknown as Record<string, unknown>
  return {
    writing: aiUsageSummary(data, 'writing', WRITING_ASSISTANT_DAILY_LIMIT, now.value),
    image: aiUsageSummary(data, 'image', IMAGE_GENERATION_DAILY_LIMIT, now.value),
  }
}
async function resetAiUsage(target: BoardUserModel) {
  if (!isAdmin.value || resettingUid.value) return
  resettingUid.value = target.id
  resetUid.value = null
  resetError.value = ''
  try {
    await resetUserAiUsage(target.id)
    now.value = Date.now()
    resetUid.value = target.id
  }
  catch (cause) {
    resetError.value = cause instanceof Error ? cause.message : t('users.aiReset.failed')
  }
  finally {
    resettingUid.value = null
  }
}
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
    <UAlert v-if="resetError" color="error" variant="subtle" icon="i-lucide-circle-alert" :description="resetError" />
    <div v-if="rolePending || usersPending" class="py-12 text-center text-sm text-muted">{{ t('users.loading') }}</div>
    <UAlert v-else-if="!canManage" color="error" variant="subtle" icon="i-lucide-shield-alert" :title="t('users.noPermission.title')" :description="t('users.noPermission.description')" />
    <UAlert v-else-if="loadError" color="error" variant="subtle" :description="t('users.loadFailed')">
      <template #actions><UButton color="neutral" variant="outline" :label="t('common.action.retry')" @click="refresh()" /></template>
    </UAlert>
    <div v-else-if="users.length === 0" class="py-12 text-center text-sm text-muted">{{ t('users.empty') }}</div>
    <div v-else class="divide-y divide-default rounded-lg border border-default">
      <div v-for="boardUser in users" :key="boardUser.id" class="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_minmax(12rem,20rem)] md:items-center">
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <p class="truncate font-medium text-highlighted">{{ boardUser.displayName || t('users.noName') }}</p>
            <UBadge v-if="savedUid === boardUser.id" color="success" variant="subtle" :label="t('common.action.saved')" />
          </div>
          <UserManagementEmail :uid="boardUser.id" :authorized="canManage" />
          <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span class="inline-flex items-center gap-1 tabular-nums" :class="aiUsageOf(boardUser).writing.remaining < 1 && 'text-warning'">
              <UIcon name="i-lucide-sparkles" class="size-3.5" />
              {{ t('users.aiUsage.writing', { used: aiUsageOf(boardUser).writing.used, limit: aiUsageOf(boardUser).writing.limit }) }}
            </span>
            <span class="inline-flex items-center gap-1 tabular-nums" :class="aiUsageOf(boardUser).image.remaining < 1 && 'text-warning'">
              <UIcon name="i-lucide-image" class="size-3.5" />
              {{ t('users.aiUsage.image', { used: aiUsageOf(boardUser).image.used, limit: aiUsageOf(boardUser).image.limit }) }}
            </span>
            <UBadge v-if="resetUid === boardUser.id" color="success" variant="subtle" size="sm" :label="t('users.aiReset.done')" />
            <UButton
              v-if="isAdmin"
              size="xs"
              color="neutral"
              variant="ghost"
              icon="i-lucide-rotate-ccw"
              :label="t('users.aiReset.button')"
              :loading="resettingUid === boardUser.id"
              :disabled="!!resettingUid || (aiUsageOf(boardUser).writing.used + aiUsageOf(boardUser).image.used) === 0"
              @click="resetAiUsage(boardUser)"
            />
          </div>
          <div v-if="boardUser.moderationBlockCount || warningResetUid === boardUser.id" class="mt-1 flex flex-wrap items-center gap-2 text-xs">
            <span v-if="boardUser.moderationBlockCount" class="text-warning">{{ t('users.moderationWarnings', { count: formatNumber(boardUser.moderationBlockCount) }) }}</span>
            <UBadge v-if="warningResetUid === boardUser.id" color="success" variant="subtle" size="sm" :label="t('users.warningReset.done')" />
            <UButton
              v-if="isAdmin && boardUser.moderationBlockCount"
              size="xs"
              color="neutral"
              variant="ghost"
              icon="i-lucide-rotate-ccw"
              :label="t('users.warningReset.button')"
              :loading="resettingUid === boardUser.id"
              :disabled="!!resettingUid"
              @click="resetWarnings(boardUser)"
            />
          </div>
        </div>
        <div class="flex flex-wrap gap-1.5" role="group" :aria-label="t('users.roleGroup')">
          <UButton
            v-for="item in (boardUser.role === 'owner' || (!isOwner && boardUser.role === 'admin') ? roleItems : assignableRoles)"
            :key="item.value"
            size="xs"
            :color="(boardUser.role || 'user') === item.value ? 'primary' : 'neutral'"
            :variant="(boardUser.role || 'user') === item.value ? 'solid' : 'outline'"
            :label="item.label"
            :aria-pressed="(boardUser.role || 'user') === item.value"
            :loading="savingUid === boardUser.id && pendingChange?.to === item.value"
            :disabled="!!savingUid || boardUser.id === user?.uid || boardUser.role === 'owner' || (!isOwner && boardUser.role === 'admin')"
            @click="requestRoleChange(boardUser, item.value)"
          />
        </div>
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
  <MemiBoardSettingsVersion />
  </MemiBoardSurface>
</template>
