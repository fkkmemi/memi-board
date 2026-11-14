<script setup lang="ts">
import MemiBoardSurface from './BoardSurface.vue'
import { computed, ref } from 'vue'
import { useMemiBoardAuth, useMemiBoardI18n, useMemiBoardUserProfile, useMemiBoardUserStats, WRITING_ASSISTANT_DAILY_LIMIT, IMAGE_GENERATION_DAILY_LIMIT, aiUsageSummary } from 'memi-board/runtime'
import MemiBoardProfileEditModal from './ProfileEditModal.vue'
import MemiBoardAuthorMemoList from './AuthorMemoList.vue'

const props = defineProps<{
  uid: string
  /** 본인 프로필의 수정 버튼 대신 표시할 호스트 계정 페이지 주소. */
  accountTo?: string
  /** 본인 프로필의 "내가 남긴 메모" 목록에서 작성자 메뉴 링크로 쓴다. */
  authorProfileTo?: (authorUid: string) => string | undefined
  authorPostsTo?: (authorUid: string) => string | undefined
  authorCommentsTo?: (authorUid: string) => string | undefined
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
// Own account only: the AI writing and image quotas in the current 24-hour window.
const aiUsage = computed(() => aiUsageSummary(profile.value as Record<string, unknown> | null, 'writing', WRITING_ASSISTANT_DAILY_LIMIT, now.value))
const aiImageUsage = computed(() => aiUsageSummary(profile.value as Record<string, unknown> | null, 'image', IMAGE_GENERATION_DAILY_LIMIT, now.value))
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
        v-if="isOwnProfile && accountTo"
        :to="accountTo"
        :label="t('profile.myAccount')"
        icon="i-lucide-user-round"
        color="neutral"
        variant="outline"
        size="sm"
        class="shrink-0"
      />
      <UButton
        v-else-if="isOwnProfile"
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
        v-if="isOwnProfile"
        icon="i-lucide-image"
        color="neutral"
        variant="subtle"
        :label="t('profile.stats.aiImageUsage', { used: aiImageUsage.used, limit: IMAGE_GENERATION_DAILY_LIMIT })"
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

    <template v-if="isOwnProfile">
      <USeparator class="mt-2" />
      <MemiBoardAuthorMemoList
        :author-profile-to="authorProfileTo"
        :author-posts-to="authorPostsTo"
        :author-comments-to="authorCommentsTo"
      />
    </template>
  </div>

  <MemiBoardProfileEditModal
    v-if="isOwnProfile && !accountTo"
    v-model:open="editOpen"
    :uid="uid"
    :profile="profile"
  />
  </MemiBoardSurface>
</template>
