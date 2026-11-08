<script setup lang="ts">
import { computed } from 'vue'
import { formatDate, useMemiBoardI18n, useMemiBoardSettings } from 'memi-board/runtime'
import MemiBoardInfoPerson from './BoardInfoPerson.vue'

const props = defineProps<{
  boardId?: string
  title: string
  description?: string
}>()

const { getBoard } = useMemiBoardSettings()
const { t, locale } = useMemiBoardI18n({ boardLocale: () => getBoard(props.boardId ?? '')?.locale })

const board = computed(() => props.boardId ? getBoard(props.boardId) : undefined)
const managers = computed(() => board.value?.allowedManagerUids ?? [])
// 매니저는 스태프 권한도 가지므로 두 목록에 모두 있으면 매니저에만 보인다.
const staff = computed(() => (board.value?.allowedStaffUids ?? []).filter(uid => !managers.value.includes(uid)))
const creatorUid = computed(() => board.value?.createdByUid)
const createdAt = computed(() => formatDate(board.value?.createdAt, locale.value))
const hasInfo = computed(() => !!(props.description || managers.value.length || staff.value.length || creatorUid.value))
</script>

<template>
  <h1 class="min-w-0 text-2xl font-bold tracking-tight text-highlighted">
  <UPopover
    v-if="hasInfo"
    :content="{ side: 'bottom', align: 'start' }"
    :ui="{ content: 'h-auto w-80 max-w-[calc(100vw-2rem)] p-4' }"
  >
    <button
      type="button"
      class="block max-w-full cursor-help truncate text-start"
    >
      {{ title }}
    </button>
    <template #content>
      <div class="flex flex-col gap-3">
        <p
          v-if="description"
          class="whitespace-pre-line text-sm text-default"
        >
          {{ description }}
        </p>
        <dl class="flex flex-col gap-2 text-sm">
          <div
            v-if="creatorUid"
            class="flex flex-col gap-1"
          >
            <dt class="text-xs text-muted">
              {{ t('list.boardInfo.creator') }}
            </dt>
            <dd class="flex flex-wrap items-center gap-x-2 gap-y-1">
              <MemiBoardInfoPerson :uid="creatorUid" />
              <span
                v-if="createdAt"
                class="text-xs text-muted"
              >
                {{ createdAt }}
              </span>
            </dd>
          </div>
          <div
            v-if="managers.length"
            class="flex flex-col gap-1"
          >
            <dt class="text-xs text-muted">
              {{ t('list.boardInfo.managers') }}
            </dt>
            <dd class="flex flex-col gap-1">
              <MemiBoardInfoPerson
                v-for="uid in managers"
                :key="uid"
                :uid="uid"
              />
            </dd>
          </div>
          <div
            v-if="staff.length"
            class="flex flex-col gap-1"
          >
            <dt class="text-xs text-muted">
              {{ t('list.boardInfo.staff') }}
            </dt>
            <dd class="flex flex-col gap-1">
              <MemiBoardInfoPerson
                v-for="uid in staff"
                :key="uid"
                :uid="uid"
              />
            </dd>
          </div>
        </dl>
      </div>
    </template>
  </UPopover>
  <span
    v-else
    class="block truncate"
  >
    {{ title }}
  </span>
  </h1>
</template>
