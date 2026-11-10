<script setup lang="ts">
import { BOARD_USER_ROLES, useMemiBoardI18n } from 'memi-board/runtime'

const { t } = useMemiBoardI18n()
const appearance = {
  owner: { icon: 'i-lucide-crown', color: 'text-amber-500 dark:text-amber-400', badge: 'border-amber-500/30 bg-amber-500/10' },
  admin: { icon: 'i-lucide-shield-check', color: 'text-teal-600 dark:text-teal-400', badge: 'border-teal-500/30 bg-teal-500/10' },
  manager: { icon: 'i-lucide-user-cog', color: 'text-blue-500 dark:text-blue-400', badge: 'border-blue-500/30 bg-blue-500/10' },
  staff: { icon: 'i-lucide-user-check', color: 'text-green-600 dark:text-green-400', badge: 'border-green-500/30 bg-green-500/10' },
  user: { icon: 'i-lucide-user-round', color: 'text-muted', badge: 'border-default bg-elevated' },
}
</script>

<template>
  <details class="group overflow-hidden rounded-xl border border-default bg-muted/30">
    <summary class="flex cursor-pointer list-none items-center gap-3 px-4 py-4 select-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary sm:px-5 [&::-webkit-details-marker]:hidden">
      <UIcon name="i-lucide-info" class="size-5 shrink-0 text-teal-500" />
      <span class="flex-1 font-semibold text-highlighted">{{ t('boardUsers.guide.title') }}</span>
      <UIcon name="i-lucide-chevron-down" class="size-5 shrink-0 text-muted transition-transform group-open:rotate-180" />
    </summary>
    <div class="grid gap-3 border-t border-default p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-5">
      <article v-for="item in BOARD_USER_ROLES" :key="item.value" class="rounded-lg border border-default bg-default p-4">
        <div class="mb-4 flex items-center gap-2.5" :class="appearance[item.value].color">
          <UIcon :name="appearance[item.value].icon" class="size-6 shrink-0" />
          <h3 class="rounded-md border px-2 py-1 text-sm font-medium" :class="appearance[item.value].badge">
            {{ t(`common.role.${item.value}`) }}
          </h3>
        </div>
        <ul class="space-y-2.5 pl-4 text-sm leading-6 text-muted list-disc marker:text-dimmed">
          <li v-for="point in ['permissions', 'roles', 'restriction']" :key="point">
            {{ t(`boardUsers.guide.${item.value}.${point}`) }}
          </li>
        </ul>
      </article>
    </div>
    <p class="border-t border-default px-4 py-4 text-sm leading-6 text-muted sm:px-5">{{ t('boardUsers.guide.assignmentNote') }}</p>
  </details>
</template>
