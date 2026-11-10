<script setup lang="ts">
import MemiBoardSurface from './BoardSurface.vue'
import UserListControls from './UserListControls.vue'
import UserListPagination from './UserListPagination.vue'
import { useMemiBoardI18n, useMemiBoardUserDirectory } from 'memi-board/runtime'

defineProps<{ authorProfileTo?: (uid: string) => string }>()
const { users, usersPending, loadError, sort, direction, pageSize, page, hasNext, previousPage, nextPage, refresh } = useMemiBoardUserDirectory()
const { t } = useMemiBoardI18n()
</script>

<template>
  <MemiBoardSurface>
    <UserListControls v-model:sort="sort" v-model:direction="direction" v-model:page-size="pageSize" />
    <div v-if="usersPending" class="py-12 text-center text-sm text-muted">{{ t('users.loading') }}</div>
    <UAlert v-else-if="loadError" color="error" variant="subtle" :description="t('users.loadFailed')">
      <template #actions><UButton color="neutral" variant="outline" :label="t('common.action.retry')" @click="refresh()" /></template>
    </UAlert>
    <div v-else-if="users.length === 0" class="py-12 text-center text-sm text-muted">{{ t('users.empty') }}</div>
    <div v-else class="divide-y divide-default rounded-lg border border-default">
      <div v-for="boardUser in users" :key="boardUser.id" class="flex items-center gap-3 p-4">
        <UAvatar :src="boardUser.photoURL || undefined" :alt="boardUser.displayName || t('users.noName')" />
        <div class="min-w-0 flex-1">
          <ULink v-if="authorProfileTo" :to="authorProfileTo(boardUser.id)" class="block truncate font-medium text-highlighted">
            {{ boardUser.displayName || t('users.noName') }}
          </ULink>
          <p v-else class="truncate font-medium text-highlighted">{{ boardUser.displayName || t('users.noName') }}</p>
          <p v-if="boardUser.bio" class="truncate text-sm text-muted">{{ boardUser.bio }}</p>
        </div>
        <UBadge color="neutral" variant="subtle" :label="t(`common.role.${boardUser.role || 'user'}`)" />
      </div>
    </div>
    <UserListPagination :page="page" :count="users.length" :has-next="hasNext" :pending="usersPending" @previous="previousPage" @next="nextPage" />
  </MemiBoardSurface>
</template>
