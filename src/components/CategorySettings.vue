<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useMemiBoardAuth, useMemiBoardSettings, useMemiBoardUsers } from 'memi-board/runtime'
import type { BoardCategory, BoardListView, BoardVisibility, BoardWriteRole } from 'memi-board/runtime'
import MemiBoardOptionCards from './OptionCards.vue'

const props = withDefaults(defineProps<{
  categoryId: string
  authorized?: boolean
  /**
   * "허용 스태프" 필드를 보여줄지 — 스태프 본인이 자기 접근 범위를 직접 넓히지 못하게
   * 기본은 board-role 관리자만이다. 호스트에 별도 관리자 개념(예: 사이트 전체 관리자)이
   * 있으면 그 값으로 명시적으로 넘긴다. 이 prop이 없으면 스태프에게는 필드가 숨겨진다
   * (규칙도 스태프가 이 필드 값을 바꾸는 건 별도로 막는다 — UI는 편의일 뿐 보안 경계가 아니다).
   */
  canManageStaff?: boolean
  /**
   * 존재하지 않는 카테고리 id로 열렸을 때 생성 폼을 보여줄지. 기본은 board-role
   * 관리자만 — 스태프는 기존 카테고리 편집은 가능해도 새로 만들 수는 없다.
   */
  canCreate?: boolean
}>(), { authorized: false })

const emit = defineEmits<{ saved: [category: BoardCategory] }>()

const listViewOptions: Array<{ label: string, value: BoardListView }> = [
  { label: '일반', value: 'default' },
  { label: '조밀', value: 'dense' },
  { label: '이미지', value: 'image' },
  { label: '영상', value: 'video' },
]
const writeRoleOptions: Array<{ label: string, value: BoardWriteRole }> = [
  { label: '일반 이상', value: 'user' },
  { label: '스태프 이상', value: 'staff' },
  { label: '관리자만', value: 'admin' },
]
const visibilityOptions: Array<{ label: string, value: BoardVisibility, description?: string }> = [
  { label: '보임', value: 'public', description: '전체 목록·필터에 표시' },
  { label: '숨김', value: 'hidden', description: '일기장·비공개. 주소로 와도 안내만' },
]

const { isAdmin, rolePending } = useMemiBoardAuth()
const { categories, settingsPending, saveCategory } = useMemiBoardSettings()
const canManage = computed(() => isAdmin.value || props.authorized)
// users 전체 목록은 rules상 board-role 관리자만 읽을 수 있다 — "허용 스태프" 지정 권한이
// 있을 때만(기본은 board-role 관리자) 쿼리를 시작한다. canManage(호스트 authorized 포함)로
// 그냥 열면 스태프도 authorized=true라 여기서 다시 permission-denied가 난다.
const canManageStaffAssignment = computed(() => props.canManageStaff ?? isAdmin.value)
const { users } = useMemiBoardUsers({ enabled: canManageStaffAssignment })
const mounted = ref(false)
onMounted(() => { mounted.value = true })
const pending = computed(() => !mounted.value || rolePending.value || settingsPending.value)
const source = computed(() => categories.value.find(item => item.id === props.categoryId))
const canCreate = computed(() => props.canCreate ?? isAdmin.value)
const isNew = computed(() => !source.value)
const draft = ref<BoardCategory | null>(null)
const saving = ref(false)
const saved = ref(false)
const error = ref('')

function emptyDraft(id: string): BoardCategory {
  return {
    id,
    label: '',
    description: '',
    visibility: 'public',
    listView: 'default',
    writeRole: 'user',
    commentWriteRole: 'user',
    allowedStaffUids: [],
  }
}

// 이 카테고리에 글/댓글을 쓰려면 스태프 역할이 필요할 때만 "허용 스태프" 지정이 의미가 있다.
const staffOptions = computed(() => users.value
  .filter(item => item.role === 'staff')
  .map(item => ({ label: item.displayName || item.email || item.id, value: item.id })))
const needsStaffPicker = computed(() =>
  (draft.value?.writeRole === 'staff' || draft.value?.commentWriteRole === 'staff')
  && canManageStaffAssignment.value)

function toDraft(category: BoardCategory): BoardCategory {
  return {
    ...category,
    description: category.description ?? '',
    visibility: category.visibility === 'hidden' ? 'hidden' : 'public',
    listView: category.listView ?? 'default',
    writeRole: category.writeRole ?? 'user',
    commentWriteRole: category.commentWriteRole ?? 'user',
    allowedStaffUids: category.allowedStaffUids ?? [],
  }
}

// 카테고리 전환·최초 로드 시에만 draft를 서버 값으로 맞춘다.
// 저장 직후 onSnapshot 갱신으로 draft.description 이 비워지거나 입력 중이던 값이 덮이지 않게 한다.
watch(() => props.categoryId, (id) => {
  if (source.value) draft.value = toDraft(source.value)
  else if (canCreate.value) draft.value = emptyDraft(id)
  else draft.value = null
  saved.value = false
  error.value = ''
})

watch(source, (category) => {
  if (!category) {
    if (!draft.value || draft.value.id !== props.categoryId) {
      draft.value = canCreate.value ? emptyDraft(props.categoryId) : null
    }
    return
  }
  if (!draft.value || draft.value.id !== category.id) {
    draft.value = toDraft(category)
    return
  }
  // 저장 직후 서버 스냅샷이 오면 description 등 누락 없이 draft만 보강(입력 중이면 유지)
  if (saving.value || saved.value) {
    draft.value = {
      ...draft.value,
      ...toDraft(category),
      // 방금 저장한 로컬 값을 우선 — 스냅샷 지연/구 필드명 대비
      description: draft.value.description || toDraft(category).description || '',
      label: draft.value.label || category.label,
    }
  }
}, { immediate: true })

async function save() {
  if (!draft.value) return
  saving.value = true
  saved.value = false
  error.value = ''
  const snapshot = { ...draft.value }
  try {
    const order = isNew.value ? categories.value.length : (snapshot.order ?? 0)
    await saveCategory(snapshot, order)
    snapshot.order = order
    // 저장 성공 직후 draft 유지 (스냅샷 오기 전에 watch가 비우지 않도록)
    draft.value = toDraft(snapshot)
    saved.value = true
    emit('saved', snapshot)
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
    <UAlert
      v-if="isNew"
      color="neutral"
      variant="subtle"
      icon="i-lucide-circle-plus"
      title="아직 없는 게시판입니다"
      description="아래 정보를 입력하고 저장하면 이 ID로 새로 만들어집니다."
    />
    <div class="grid gap-2 sm:grid-cols-[9rem_1fr] sm:items-center">
      <div><p class="text-sm font-medium">카테고리 ID</p><p class="text-xs text-muted">주소와 데이터 기준값</p></div>
      <UInput :model-value="draft.id" disabled class="font-mono" />
    </div>
    <div class="flex flex-col gap-2">
      <div><p class="text-sm font-medium">글쓰기 권한</p><p class="text-xs text-muted">글을 쓸 수 있는 최소 역할</p></div>
      <MemiBoardOptionCards v-model="draft.writeRole" :options="writeRoleOptions" @update:model-value="saved = false" />
    </div>
    <div class="flex flex-col gap-2">
      <div><p class="text-sm font-medium">댓글쓰기 권한</p><p class="text-xs text-muted">댓글을 쓸 수 있는 최소 역할</p></div>
      <MemiBoardOptionCards v-model="draft.commentWriteRole" :options="writeRoleOptions" @update:model-value="saved = false" />
    </div>
    <div v-if="needsStaffPicker" class="grid gap-2 sm:grid-cols-[9rem_1fr] sm:items-center">
      <div><p class="text-sm font-medium">허용 스태프</p><p class="text-xs text-muted">비워두면 스태프 전체 허용, 지정하면 이 사람들만</p></div>
      <USelectMenu
        v-model="draft.allowedStaffUids"
        :items="staffOptions"
        value-key="value"
        label-key="label"
        multiple
        placeholder="스태프 전체 허용"
        @update:model-value="saved = false"
      />
    </div>
    <div class="grid gap-2 sm:grid-cols-[9rem_1fr] sm:items-center">
      <div><p class="text-sm font-medium">표시 라벨</p><p class="text-xs text-muted">사용자에게 보이는 이름</p></div>
      <UInput v-model="draft.label" @update:model-value="saved = false" />
    </div>
    <div class="grid gap-2 sm:grid-cols-[9rem_1fr] sm:items-start">
      <div><p class="text-sm font-medium">설명</p><p class="text-xs text-muted">게시판 상단 등에 보이는 안내 문구</p></div>
      <UTextarea
        v-model="draft.description"
        :rows="3"
        autoresize
        :maxrows="6"
        placeholder="이 게시판에 대한 짧은 설명 (선택)"
        @update:model-value="saved = false"
      />
    </div>
    <div v-if="canManageStaffAssignment" class="flex flex-col gap-2">
      <div>
        <p class="text-sm font-medium">공개 범위</p>
        <p class="text-xs text-muted">숨김이면 전체 필터에 안 나오고, 글은 관리자·스태프·작성자만 읽을 수 있습니다</p>
      </div>
      <MemiBoardOptionCards v-model="draft.visibility" :options="visibilityOptions" @update:model-value="saved = false" />
    </div>
    <div class="flex flex-col gap-2">
      <div><p class="text-sm font-medium">리스트뷰</p><p class="text-xs text-muted">게시글 목록 표시 방식</p></div>
      <MemiBoardOptionCards v-model="draft.listView" :options="listViewOptions" @update:model-value="saved = false" />
    </div>
    <div class="flex justify-end border-t border-default pt-4">
      <UButton :label="isNew ? '만들기' : '저장'" :icon="isNew ? 'i-lucide-plus' : 'i-lucide-save'" :loading="saving" @click="save" />
    </div>
    <UAlert v-if="error" color="error" variant="subtle" :description="error" />
    <UAlert v-if="saved" color="success" variant="subtle" :description="isNew ? '게시판을 만들었습니다.' : '게시판 설정을 저장했습니다.'" />
  </div>
</template>
