<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { slugify, useMemiBoardAuth, useMemiBoardSettings } from 'memi-board'
import type { BoardCategory, BoardListView } from 'memi-board'

const props = withDefaults(defineProps<{
  /** 호스트 자체 관리자 권한도 허용할 때 true. Firebase rules 권한은 호스트가 별도로 맞춰야 한다. */
  authorized?: boolean
}>(), {
  authorized: false,
})

const emit = defineEmits<{
  saved: [categories: BoardCategory[]]
}>()

const listViewOptions: Array<{ label: string, value: BoardListView }> = [
  { label: '일반', value: 'default' },
  { label: '이미지', value: 'image' },
  { label: '영상', value: 'video' },
]

const { isAdmin, rolePending } = useMemiBoardAuth()
const { categories, settingsPending, saveCategories } = useMemiBoardSettings()
const canManage = computed(() => isAdmin.value || props.authorized)
const pending = computed(() => rolePending.value || settingsPending.value)

const draft = ref<BoardCategory[]>([])
const newLabel = ref('')
const saving = ref(false)
const saved = ref(false)
const error = ref('')

watch([categories, settingsPending], ([list, loading]) => {
  if (!loading && draft.value.length === 0) {
    draft.value = list.map(category => ({
      ...category,
      listView: category.listView ?? 'default',
    }))
  }
}, { immediate: true })

function addCategory() {
  const label = newLabel.value.trim()
  if (!label) return
  const base = slugify(label) || `board-${Date.now()}`
  let id = base
  let suffix = 2
  while (draft.value.some(category => category.id === id)) id = `${base}-${suffix++}`
  draft.value.push({ id, label, listView: 'default' })
  newLabel.value = ''
  saved.value = false
}

function moveCategory(index: number, offset: -1 | 1) {
  const target = index + offset
  if (target < 0 || target >= draft.value.length) return
  const next = [...draft.value]
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item!)
  draft.value = next
  saved.value = false
}

function removeCategory(index: number) {
  draft.value.splice(index, 1)
  saved.value = false
}

async function save() {
  error.value = ''
  saved.value = false
  saving.value = true
  try {
    await saveCategories(draft.value)
    saved.value = true
    emit('saved', draft.value)
  }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : '게시판 설정을 저장하지 못했습니다.'
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div v-if="pending" class="py-16 text-center text-sm text-muted">설정을 불러오고 있습니다.</div>
  <UAlert
    v-else-if="!canManage"
    color="neutral"
    variant="subtle"
    icon="i-lucide-circle-help"
    title="없는 게시판입니다"
    description="주소를 다시 확인해 주세요."
  />
  <div v-else class="flex flex-col gap-4">
    <details
      v-for="(category, index) in draft"
      :key="category.id"
      :open="index === 0"
      class="group overflow-hidden rounded-lg border border-default bg-default"
    >
      <summary class="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 select-none [&::-webkit-details-marker]:hidden">
        <div class="min-w-0">
          <code class="text-sm font-semibold text-highlighted">{{ category.id }}</code>
          <p class="mt-1 truncate text-xs text-muted">{{ category.label || '라벨 없음' }} · /{{ category.id }}</p>
        </div>
        <UIcon name="i-lucide-chevron-down" class="size-4 text-muted transition-transform group-open:rotate-180" />
      </summary>

      <div class="flex flex-col gap-5 border-t border-default px-4 py-4">
        <div class="grid gap-2 sm:grid-cols-[9rem_1fr] sm:items-center">
          <div><p class="text-sm font-medium">카테고리 ID</p><p class="text-xs text-muted">주소와 데이터 기준값</p></div>
          <UInput :model-value="category.id" disabled class="font-mono" />
        </div>
        <div class="grid gap-2 sm:grid-cols-[9rem_1fr] sm:items-center">
          <div><p class="text-sm font-medium">표시 라벨</p><p class="text-xs text-muted">사용자에게 보이는 이름</p></div>
          <UInput v-model="category.label" @update:model-value="saved = false" />
        </div>
        <div class="grid gap-2 sm:grid-cols-[9rem_1fr] sm:items-center">
          <div><p class="text-sm font-medium">리스트뷰</p><p class="text-xs text-muted">게시글 목록 표시 방식</p></div>
          <USelect
            v-model="category.listView"
            :items="listViewOptions"
            value-key="value"
            label-key="label"
            @update:model-value="saved = false"
          />
        </div>
        <div class="flex flex-wrap justify-between gap-2 border-t border-default pt-4">
          <div class="flex gap-1">
            <UButton label="위로" icon="i-lucide-arrow-up" color="neutral" variant="outline" size="sm" :disabled="index === 0" @click="moveCategory(index, -1)" />
            <UButton label="아래로" icon="i-lucide-arrow-down" color="neutral" variant="outline" size="sm" :disabled="index === draft.length - 1" @click="moveCategory(index, 1)" />
          </div>
          <UButton label="카테고리 삭제" icon="i-lucide-trash-2" color="error" variant="ghost" size="sm" @click="removeCategory(index)" />
        </div>
      </div>
    </details>

    <div class="flex gap-2 border-t border-default pt-4">
      <UInput v-model="newLabel" class="flex-1" placeholder="새 카테고리 이름" @keyup.enter="addCategory" />
      <UButton label="추가" icon="i-lucide-plus" color="neutral" variant="outline" @click="addCategory" />
    </div>
    <UAlert v-if="error" color="error" variant="subtle" :description="error" />
    <UAlert v-if="saved" color="success" variant="subtle" description="게시판 설정을 저장했습니다." />
    <div class="flex justify-end">
      <UButton label="설정 저장" icon="i-lucide-save" :loading="saving" @click="save" />
    </div>
  </div>
</template>
