<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useMemiBoardAuth, useMemiBoardSettings } from 'memi-board/runtime'
import type { BoardCategory, BoardListView, BoardWriteRole } from 'memi-board/runtime'

const props = withDefaults(defineProps<{
  categoryId: string
  authorized?: boolean
}>(), { authorized: false })

const emit = defineEmits<{ saved: [category: BoardCategory] }>()

const listViewOptions: Array<{ label: string, value: BoardListView }> = [
  { label: '일반', value: 'default' },
  { label: '이미지', value: 'image' },
  { label: '영상', value: 'video' },
]
const writeRoleOptions: Array<{ label: string, value: BoardWriteRole }> = [
  { label: '일반 이상', value: 'user' },
  { label: '스태프 이상', value: 'staff' },
  { label: '관리자만', value: 'admin' },
]

const { isAdmin, rolePending } = useMemiBoardAuth()
const { categories, settingsPending, saveCategory } = useMemiBoardSettings()
const canManage = computed(() => isAdmin.value || props.authorized)
const mounted = ref(false)
onMounted(() => { mounted.value = true })
const pending = computed(() => !mounted.value || rolePending.value || settingsPending.value)
const source = computed(() => categories.value.find(item => item.id === props.categoryId))
const draft = ref<BoardCategory | null>(null)
const saving = ref(false)
const saved = ref(false)
const error = ref('')

watch([source, () => props.categoryId], ([category]) => {
  draft.value = category
    ? { ...category, listView: category.listView ?? 'default', writeRole: category.writeRole ?? 'user' }
    : null
  saved.value = false
  error.value = ''
}, { immediate: true })

async function save() {
  if (!draft.value) return
  saving.value = true
  saved.value = false
  error.value = ''
  try {
    await saveCategory(draft.value, draft.value.order ?? 0)
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
  <UAlert v-else-if="!canManage" color="neutral" variant="subtle" icon="i-lucide-lock" title="접근 권한이 없습니다" />
  <UAlert v-else-if="!draft" color="neutral" variant="subtle" icon="i-lucide-circle-help" title="없는 게시판입니다" description="게시판 주소를 다시 확인해 주세요." />
  <div v-else class="flex flex-col gap-5">
    <div class="grid gap-2 sm:grid-cols-[9rem_1fr] sm:items-center">
      <div><p class="text-sm font-medium">카테고리 ID</p><p class="text-xs text-muted">주소와 데이터 기준값</p></div>
      <UInput :model-value="draft.id" disabled class="font-mono" />
    </div>
    <div class="grid gap-2 sm:grid-cols-[9rem_1fr] sm:items-center">
      <div><p class="text-sm font-medium">글쓰기 권한</p><p class="text-xs text-muted">글을 쓸 수 있는 최소 역할</p></div>
      <USelect v-model="draft.writeRole" :items="writeRoleOptions" value-key="value" label-key="label" @update:model-value="saved = false" />
    </div>
    <div class="grid gap-2 sm:grid-cols-[9rem_1fr] sm:items-center">
      <div><p class="text-sm font-medium">표시 라벨</p><p class="text-xs text-muted">사용자에게 보이는 이름</p></div>
      <UInput v-model="draft.label" @update:model-value="saved = false" />
    </div>
    <div class="grid gap-2 sm:grid-cols-[9rem_1fr] sm:items-center">
      <div><p class="text-sm font-medium">리스트뷰</p><p class="text-xs text-muted">게시글 목록 표시 방식</p></div>
      <USelect v-model="draft.listView" :items="listViewOptions" value-key="value" label-key="label" @update:model-value="saved = false" />
    </div>
    <div class="flex justify-end border-t border-default pt-4">
      <UButton label="저장" icon="i-lucide-save" :loading="saving" @click="save" />
    </div>
    <UAlert v-if="error" color="error" variant="subtle" :description="error" />
    <UAlert v-if="saved" color="success" variant="subtle" description="게시판 설정을 저장했습니다." />
  </div>
</template>
