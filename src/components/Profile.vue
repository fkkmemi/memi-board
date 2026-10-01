<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMemiBoardAuth, useMemiBoardI18n, useMemiBoardUserProfile } from 'memi-board/runtime'
import MemiBoardProfileEditModal from './ProfileEditModal.vue'

const props = defineProps<{
  uid: string
}>()

const { profile, profilePending } = useMemiBoardUserProfile(() => props.uid)
const now = ref(Date.now())

const { t, formatRelativeDate } = useMemiBoardI18n()

const roleLabel = computed(() => {
  const role = profile.value?.role
  return role === 'admin' || role === 'staff' || role === 'user' ? t(`common.role.${role}`) : undefined
})

const { user } = useMemiBoardAuth()
const isOwnProfile = computed(() => !!user.value?.uid && user.value.uid === props.uid)
const editOpen = ref(false)
</script>

<template>
  <div
    v-if="profilePending"
    class="flex items-center gap-3"
  >
    <USkeleton class="size-16 shrink-0 rounded-full" />
    <div class="flex flex-col gap-2">
      <USkeleton class="h-5 w-32" />
      <USkeleton class="h-4 w-48" />
    </div>
  </div>

  <p
    v-else-if="!profile"
    class="text-sm text-muted"
  >
    {{ t('profile.notFound') }}
  </p>

  <div
    v-else
    class="flex flex-col gap-3"
  >
    <div class="flex items-center gap-3">
      <UAvatar
        :src="profile.photoURL ?? undefined"
        :alt="profile.displayName ?? t('common.label.anonymous')"
        size="xl"
        class="shrink-0"
      />
      <div class="flex min-w-0 flex-1 flex-col gap-0.5">
        <div class="flex min-w-0 items-center gap-2">
          <h2 class="min-w-0 truncate text-lg font-bold text-highlighted">
            {{ profile.displayName ?? t('profile.noName') }}
          </h2>
          <UBadge
            v-if="roleLabel && profile.role !== 'user'"
            :label="roleLabel"
            color="primary"
            variant="subtle"
            size="sm"
          />
        </div>
        <p class="text-xs text-muted">
          {{ t('profile.joined', { time: formatRelativeDate(profile.joinedAt, now) }) }} · {{ t('profile.lastVisit', { time: formatRelativeDate(profile.lastVisitAt, now) }) }}
        </p>
      </div>
      <UButton
        v-if="isOwnProfile"
        :label="t('common.action.edit')"
        icon="i-lucide-pencil"
        color="neutral"
        variant="outline"
        size="sm"
        class="shrink-0"
        @click="editOpen = true"
      />
    </div>

    <p
      v-if="profile.bio"
      class="whitespace-pre-line text-sm text-toned"
    >
      {{ profile.bio }}
    </p>
  </div>

  <MemiBoardProfileEditModal
    v-if="isOwnProfile"
    v-model:open="editOpen"
    :uid="uid"
    :profile="profile"
  />
</template>
