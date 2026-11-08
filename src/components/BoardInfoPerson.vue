<script setup lang="ts">
import { toRef } from 'vue'
import { useMemiBoardI18n, useMemiBoardUserProfile } from 'memi-board/runtime'

const props = defineProps<{ uid: string }>()
const { t } = useMemiBoardI18n()
const { profile } = useMemiBoardUserProfile(toRef(props, 'uid'))
</script>

<template>
  <div class="flex min-w-0 items-center gap-2">
    <UAvatar
      :src="profile?.photoURL ?? undefined"
      :alt="profile?.displayName ?? t('common.label.anonymous')"
      size="2xs"
    />
    <span class="truncate text-sm">{{ profile?.displayName ?? t('common.label.anonymous') }}</span>
  </div>
</template>
