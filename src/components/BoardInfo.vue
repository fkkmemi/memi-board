<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatDate, useMemiBoardI18n, useMemiBoardSettings } from 'memi-board/runtime'
import MemiBoardInfoPerson from './BoardInfoPerson.vue'

const props = defineProps<{
  boardId?: string
  title?: string
  description?: string
  /** 만든 사람/관리자/스태프 메뉴 중 "프로필 보기" 링크. */
  authorProfileTo?: (authorUid: string) => string | undefined
  /** 만든 사람/관리자/스태프 메뉴 중 "작성글 보기" 링크. */
  authorPostsTo?: (authorUid: string) => string | undefined
  /** 만든 사람/관리자/스태프 메뉴 중 "작성한 댓글 보기" 링크. */
  authorCommentsTo?: (authorUid: string) => string | undefined
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
const open = ref(false)
</script>

<template>
  <div class="flex min-w-0 flex-col gap-2">
    <h1 v-if="title" class="min-w-0 text-2xl font-bold tracking-tight text-highlighted">
      <UButton
        v-if="hasInfo"
        :label="title"
        color="neutral"
        variant="ghost"
        trailing-icon="i-lucide-chevron-down"
        :aria-expanded="open"
        class="-mx-1.5 h-auto max-w-full min-w-0 justify-start px-1.5 py-0.5 text-start text-2xl font-bold tracking-tight text-highlighted"
        :ui="{ label: 'truncate', trailingIcon: open ? 'size-5 rotate-180 text-muted transition-transform' : 'size-5 text-muted transition-transform' }"
        @click="open = !open"
      />
      <span v-else class="block truncate">{{ title }}</span>
    </h1>
    <div v-if="hasInfo && open" class="flex flex-col gap-3">
        <p v-if="description" class="whitespace-pre-line break-words text-sm text-default">
          {{ description }}
        </p>
        <dl class="flex flex-col gap-3 text-sm sm:flex-row sm:flex-wrap sm:gap-x-6">
          <div v-if="creatorUid" class="flex flex-col gap-1 rounded-lg border border-default px-3 py-2">
            <dt class="text-xs text-muted">
              {{ t('list.boardInfo.creator') }}
            </dt>
            <dd class="flex flex-wrap items-center gap-x-2 gap-y-1">
              <MemiBoardInfoPerson
                :uid="creatorUid"
                :author-profile-to="authorProfileTo"
                :author-posts-to="authorPostsTo"
                :author-comments-to="authorCommentsTo"
              />
              <span v-if="createdAt" class="text-xs text-muted">
                {{ createdAt }}
              </span>
            </dd>
          </div>
          <div v-if="managers.length" class="flex flex-col gap-1 rounded-lg border border-default px-3 py-2">
            <dt class="text-xs text-muted">
              {{ t('list.boardInfo.managers') }}
            </dt>
            <dd class="flex flex-wrap items-center gap-x-3 gap-y-1">
              <MemiBoardInfoPerson
                v-for="uid in managers"
                :key="uid"
                :uid="uid"
                :author-profile-to="authorProfileTo"
                :author-posts-to="authorPostsTo"
                :author-comments-to="authorCommentsTo"
              />
            </dd>
          </div>
          <div v-if="staff.length" class="flex flex-col gap-1 rounded-lg border border-default px-3 py-2">
            <dt class="text-xs text-muted">
              {{ t('list.boardInfo.staff') }}
            </dt>
            <dd class="flex flex-wrap items-center gap-x-3 gap-y-1">
              <MemiBoardInfoPerson
                v-for="uid in staff"
                :key="uid"
                :uid="uid"
                :author-profile-to="authorProfileTo"
                :author-posts-to="authorPostsTo"
                :author-comments-to="authorCommentsTo"
              />
            </dd>
          </div>
        </dl>
    </div>
  </div>
</template>
