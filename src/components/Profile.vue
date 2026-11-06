<script setup lang="ts">
import MemiBoardSurface from './BoardSurface.vue'
import { computed, ref } from 'vue'
import { useMemiBoardAuth, useMemiBoardI18n, useMemiBoardUserProfile, useMemiBoardUserStats, WRITING_ASSISTANT_DAILY_LIMIT } from 'memi-board/runtime'
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

const { postCount, commentCount } = useMemiBoardUserStats(() => props.uid)
// Own account only: the AI writing quota in the current 24-hour window.
const aiUsage = computed(() => {
  const data = profile.value
  const windowAt = data?.aiWritingWindowAt?.toMillis?.()
  const active = windowAt != null && now.value - windowAt < 24 * 60 * 60 * 1000
  const used = active ? Math.max(0, Number(data?.aiWritingCount) || 0) : 0
  const pending = active ? Math.max(0, Number(data?.aiWritingPending) || 0) : 0
  const hours = active && windowAt != null ? Math.max(1, Math.ceil((windowAt + 24 * 60 * 60 * 1000 - now.value) / (60 * 60 * 1000))) : 0
  return { used: used + pending, hours }
})
</script>

<template>
  <MemiBoardSurface>
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

    <div class="flex flex-wrap gap-2">
      <UBadge icon="i-lucide-file-text" color="neutral" variant="subtle" :label="t('profile.stats.posts', { count: postCount ?? '–' })" />
      <UBadge icon="i-lucide-message-circle" color="neutral" variant="subtle" :label="t('profile.stats.comments', { count: commentCount ?? '–' })" />
      <UBadge
        v-if="isOwnProfile"
        icon="i-lucide-sparkles"
        color="neutral"
        variant="subtle"
        :label="aiUsage.hours
          ? t('profile.stats.aiUsageResets', { used: aiUsage.used, limit: WRITING_ASSISTANT_DAILY_LIMIT, hours: aiUsage.hours })
          : t('profile.stats.aiUsage', { used: aiUsage.used, limit: WRITING_ASSISTANT_DAILY_LIMIT })"
      />
      <UBadge
        v-if="isOwnProfile && profile.moderationBlockCount"
        icon="i-lucide-triangle-alert"
        color="warning"
        variant="subtle"
        :label="t('profile.stats.warnings', { count: profile.moderationBlockCount })"
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
  </MemiBoardSurface>
</template>
