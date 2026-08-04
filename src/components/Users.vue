<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMemiBoardAuth } from '../composables/useMemiBoardAuth'
import { BOARD_USER_ROLES, useMemiBoardUsers } from '../composables/useMemiBoardUsers'
import type { BoardUserRole } from '../types'

const props = withDefaults(defineProps<{ authorized?: boolean }>(), { authorized: false })
const { isAdmin, rolePending } = useMemiBoardAuth()
const { users, usersPending, updateUserRole } = useMemiBoardUsers()
const canManage = computed(() => isAdmin.value || props.authorized)
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
    error.value = cause instanceof Error ? cause.message : '역할을 변경하지 못했습니다.'
  }
  finally {
    savingUid.value = null
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="grid gap-3 md:grid-cols-3">
      <UAlert v-for="item in BOARD_USER_ROLES" :key="item.value" color="neutral" variant="subtle" :title="item.label" :description="item.description" />
    </div>
    <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-circle-alert" :description="error" />
    <div v-if="rolePending || usersPending" class="py-12 text-center text-sm text-muted">사용자 목록을 불러오고 있습니다.</div>
    <UAlert v-else-if="!canManage" color="error" variant="subtle" icon="i-lucide-shield-alert" title="권한이 없습니다" description="게시판 관리자만 사용자 역할을 관리할 수 있습니다." />
    <div v-else-if="users.length === 0" class="py-12 text-center text-sm text-muted">게시판에 로그인한 사용자가 없습니다.</div>
    <div v-else class="divide-y divide-default rounded-lg border border-default">
      <div v-for="boardUser in users" :key="boardUser.id" class="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_12rem] md:items-center">
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <p class="truncate font-medium text-highlighted">{{ boardUser.displayName || '이름 없음' }}</p>
            <UBadge v-if="savedUid === boardUser.id" color="success" variant="subtle" label="저장됨" />
          </div>
          <p class="truncate text-sm text-muted">{{ boardUser.email || boardUser.id }}</p>
          <p v-if="boardUser.moderationBlockCount" class="mt-1 text-xs text-warning">콘텐츠 경고 {{ boardUser.moderationBlockCount }}회</p>
        </div>
        <USelect
          :model-value="boardUser.role || 'user'"
          :items="BOARD_USER_ROLES"
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
