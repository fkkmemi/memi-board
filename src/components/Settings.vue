<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { slugify, useMemiBoardAuth, useMemiBoardSettings, useMemiBoardUsers } from 'memi-board/runtime'
import type { BoardCategory, BoardListView, BoardVisibility, BoardWriteRole } from 'memi-board/runtime'
import MemiBoardOptionCards from './OptionCards.vue'

const props = withDefaults(defineProps<{
  /** 호스트 자체 관리자 권한도 허용할 때 true. Firebase rules 권한은 호스트가 별도로 맞춰야 한다. */
  authorized?: boolean
  /** 카테고리 페이지 기본 경로. 기본 `/board` → `/board/{id}` */
  categoryBase?: string
  /** 지정하면 해당 카테고리 하나만 편집하고 추가·삭제·순서·위험 영역을 숨긴다. */
  categoryId?: string
  /** 호스트 서버에서 게시판 전체 데이터를 삭제하는 관리자 전용 작업. */
  deleteAll?: () => Promise<void>
  /**
   * "허용 스태프" 필드를 보여줄지 — 스태프 본인이 자기 접근 범위를 직접 넓히지 못하게
   * 기본은 board-role 관리자만이다. 호스트에 별도 관리자 개념이 있으면 명시적으로 넘긴다.
   */
  canManageStaff?: boolean
}>(), {
  authorized: false,
  categoryBase: '/board',
})

const emit = defineEmits<{
  saved: [categories: BoardCategory[]]
}>()

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
  { label: '숨김', value: 'hidden', description: '일기장·비공개' },
]

const { isAdmin, rolePending } = useMemiBoardAuth()
const { categories, settingsPending, saveCategory, saveCategories, deleteCategory } = useMemiBoardSettings()
const canManage = computed(() => isAdmin.value || props.authorized)
// boardUsers 전체 목록은 rules상 board-role 관리자만 읽을 수 있다 — "허용 스태프" 지정 권한이
// 있을 때만(기본은 board-role 관리자) 쿼리를 시작한다. canManage(호스트 authorized 포함)로
// 그냥 열면 스태프도 authorized=true라 여기서 다시 permission-denied가 난다.
const canManageStaffAssignment = computed(() => props.canManageStaff ?? isAdmin.value)
const { users } = useMemiBoardUsers({ enabled: canManageStaffAssignment })
// 이 카테고리에 글/댓글을 쓰려면 스태프 역할이 필요할 때만 "허용 스태프" 지정이 의미가 있다.
const staffOptions = computed(() => users.value
  .filter(item => item.role === 'staff')
  .map(item => ({ label: item.displayName || item.email || item.id, value: item.id })))
function needsStaffPicker(category: BoardCategory) {
  return (category.writeRole === 'staff' || category.commentWriteRole === 'staff')
    && canManageStaffAssignment.value
}
// Firebase의 SSR pending 값과 클라이언트 첫 값이 달라질 수 있다. 최초 hydration은
// 양쪽 모두 로딩 화면으로 맞춘 뒤 mounted 이후 실제 상태를 렌더링한다.
const mounted = ref(false)
onMounted(() => { mounted.value = true })
const pending = computed(() => !mounted.value || rolePending.value || settingsPending.value)

const draft = ref<BoardCategory[]>([])
const newLabel = ref('')
const savingId = ref<string | null>(null)
const savedId = ref<string | null>(null)
const ordering = ref(false)
const error = ref('')
const deleteConfirm = ref('')
const deletingAll = ref(false)
const deleteDone = ref(false)

watch([categories, settingsPending], ([list, loading]) => {
  if (!loading && draft.value.length === 0) {
    const visible = props.categoryId ? list.filter(category => category.id === props.categoryId) : list
    draft.value = visible.map(category => ({
      ...category,
      description: category.description ?? '',
      visibility: category.visibility === 'hidden' ? 'hidden' : 'public',
      listView: category.listView ?? 'default',
      writeRole: category.writeRole ?? 'user',
      commentWriteRole: category.commentWriteRole ?? 'user',
      allowedStaffUids: category.allowedStaffUids ?? [],
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
  draft.value.push({
    id,
    label,
    description: '',
    visibility: 'public',
    listView: 'default',
    writeRole: 'user',
    commentWriteRole: 'user',
    allowedStaffUids: [],
  })
  newLabel.value = ''
}

async function moveCategory(index: number, offset: -1 | 1) {
  const target = index + offset
  if (target < 0 || target >= draft.value.length) return
  const next = [...draft.value]
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item!)
  draft.value = next.map((category, order) => ({ ...category, order }))
  ordering.value = true
  error.value = ''
  try {
    await saveCategories(draft.value)
  }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : '카테고리 순서를 저장하지 못했습니다.'
  }
  finally {
    ordering.value = false
  }
}

async function removeCategory(index: number) {
  const category = draft.value[index]
  if (!category || !window.confirm(`‘${category.label}’ 카테고리를 삭제하시겠습니까?`)) return
  error.value = ''
  try {
    await deleteCategory(category.id)
    draft.value.splice(index, 1)
  }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : '카테고리를 삭제하지 못했습니다.'
  }
}

function categoryTo(id: string) {
  return `${props.categoryBase.replace(/\/$/, '')}/${encodeURIComponent(id)}`
}

async function save(category: BoardCategory, index: number) {
  error.value = ''
  savedId.value = null
  savingId.value = category.id
  try {
    const order = props.categoryId ? (category.order ?? index) : index
    await saveCategory(category, order)
    category.order = order
    savedId.value = category.id
    emit('saved', draft.value)
  }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : '게시판 설정을 저장하지 못했습니다.'
  }
  finally {
    savingId.value = null
  }
}

async function runDeleteAll() {
  if (!props.deleteAll || deleteConfirm.value !== '게시판 데이터 삭제') return
  deletingAll.value = true
  deleteDone.value = false
  error.value = ''
  try {
    await props.deleteAll()
    deleteConfirm.value = ''
    deleteDone.value = true
  }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : '게시판 데이터를 삭제하지 못했습니다.'
  }
  finally {
    deletingAll.value = false
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
    <UAlert
      v-if="categoryId && !draft.length"
      color="neutral"
      variant="subtle"
      icon="i-lucide-circle-help"
      title="없는 게시판입니다"
      description="게시판 주소를 다시 확인해 주세요."
    />
    <details
      v-for="(category, index) in draft"
      :key="category.id"
      :open="index === 0"
      class="group overflow-hidden rounded-lg border border-default bg-default"
    >
      <summary class="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 select-none [&::-webkit-details-marker]:hidden">
        <div class="min-w-0">
          <code class="text-sm font-semibold text-highlighted">{{ category.id }}</code>
          <p class="mt-1 truncate text-xs text-muted">{{ category.label || '라벨 없음' }} · {{ categoryTo(category.id) }}</p>
        </div>
        <UIcon name="i-lucide-chevron-down" class="size-4 text-muted transition-transform group-open:rotate-180" />
      </summary>

      <div class="flex flex-col gap-5 border-t border-default px-4 py-4">
        <div class="grid gap-2 sm:grid-cols-[9rem_1fr] sm:items-center">
          <div><p class="text-sm font-medium">카테고리 ID</p><p class="text-xs text-muted">주소와 데이터 기준값</p></div>
          <UInput :model-value="category.id" disabled class="font-mono" />
        </div>
        <div class="flex flex-col gap-2">
          <div><p class="text-sm font-medium">글쓰기 권한</p><p class="text-xs text-muted">이 카테고리에 글을 쓸 수 있는 최소 역할</p></div>
          <MemiBoardOptionCards
            v-model="category.writeRole"
            :options="writeRoleOptions"
            @update:model-value="savedId = null"
          />
        </div>
        <div class="flex flex-col gap-2">
          <div><p class="text-sm font-medium">댓글쓰기 권한</p><p class="text-xs text-muted">이 카테고리에 댓글을 쓸 수 있는 최소 역할</p></div>
          <MemiBoardOptionCards
            v-model="category.commentWriteRole"
            :options="writeRoleOptions"
            @update:model-value="savedId = null"
          />
        </div>
        <div v-if="needsStaffPicker(category)" class="grid gap-2 sm:grid-cols-[9rem_1fr] sm:items-center">
          <div><p class="text-sm font-medium">허용 스태프</p><p class="text-xs text-muted">비워두면 스태프 전체 허용, 지정하면 이 사람들만</p></div>
          <USelectMenu
            v-model="category.allowedStaffUids"
            :items="staffOptions"
            value-key="value"
            label-key="label"
            multiple
            placeholder="스태프 전체 허용"
            @update:model-value="savedId = null"
          />
        </div>
        <div class="grid gap-2 sm:grid-cols-[9rem_1fr] sm:items-center">
          <div><p class="text-sm font-medium">표시 라벨</p><p class="text-xs text-muted">사용자에게 보이는 이름</p></div>
          <UInput v-model="category.label" @update:model-value="savedId = null" />
        </div>
        <div class="grid gap-2 sm:grid-cols-[9rem_1fr] sm:items-start">
          <div><p class="text-sm font-medium">설명</p><p class="text-xs text-muted">게시판 상단 등에 보이는 안내 문구</p></div>
          <UTextarea
            v-model="category.description"
            :rows="3"
            autoresize
            :maxrows="6"
            placeholder="이 게시판에 대한 짧은 설명 (선택)"
            @update:model-value="savedId = null"
          />
        </div>
        <div v-if="canManageStaffAssignment" class="flex flex-col gap-2">
          <div>
            <p class="text-sm font-medium">공개 범위</p>
            <p class="text-xs text-muted">숨김이면 전체 필터에 안 나오고 rules 로 글 읽기가 제한됩니다</p>
          </div>
          <MemiBoardOptionCards
            v-model="category.visibility"
            :options="visibilityOptions"
            @update:model-value="savedId = null"
          />
        </div>
        <div class="flex flex-col gap-2">
          <div><p class="text-sm font-medium">리스트뷰</p><p class="text-xs text-muted">게시글 목록 표시 방식</p></div>
          <MemiBoardOptionCards
            v-model="category.listView"
            :options="listViewOptions"
            @update:model-value="savedId = null"
          />
        </div>
        <div class="flex flex-wrap justify-between gap-2 border-t border-default pt-4">
          <div v-if="!categoryId" class="flex gap-1">
            <UButton label="위로" icon="i-lucide-arrow-up" color="neutral" variant="outline" size="sm" :disabled="index === 0 || ordering" @click="moveCategory(index, -1)" />
            <UButton label="아래로" icon="i-lucide-arrow-down" color="neutral" variant="outline" size="sm" :disabled="index === draft.length - 1 || ordering" @click="moveCategory(index, 1)" />
          </div>
          <div class="flex gap-1">
            <UButton
              label="게시판으로 이동"
              icon="i-lucide-arrow-up-right"
              color="neutral"
              variant="ghost"
              size="sm"
              :to="categoryTo(category.id)"
            />
            <UButton v-if="!categoryId" label="카테고리 삭제" icon="i-lucide-trash-2" color="error" variant="ghost" size="sm" @click="removeCategory(index)" />
            <UButton
              label="저장"
              icon="i-lucide-save"
              size="sm"
              :loading="savingId === category.id"
              @click="save(category, index)"
            />
          </div>
        </div>
      </div>
    </details>

    <div v-if="!categoryId" class="flex gap-2 border-t border-default pt-4">
      <UInput v-model="newLabel" class="flex-1" placeholder="새 카테고리 이름" @keyup.enter="addCategory" />
      <UButton label="추가" icon="i-lucide-plus" color="neutral" variant="outline" @click="addCategory" />
    </div>
    <UAlert v-if="error" color="error" variant="subtle" :description="error" />
    <UAlert v-if="savedId" color="success" variant="subtle" :description="`‘${draft.find(item => item.id === savedId)?.label}’ 카테고리를 저장했습니다.`" />

    <section v-if="deleteAll && !categoryId" class="mt-4 flex flex-col gap-3 border-t border-error/40 pt-6">
      <div>
        <h2 class="font-semibold text-error">위험 영역</h2>
        <p class="mt-1 text-sm text-muted">
          모든 게시글, 댓글, 첨부파일과 카테고리 설정을 영구 삭제합니다. 게시판 사용자와 관리자 권한은 유지합니다.
        </p>
      </div>
      <UFormField label="확인을 위해 ‘게시판 데이터 삭제’를 입력하세요">
        <UInput v-model="deleteConfirm" autocomplete="off" placeholder="게시판 데이터 삭제" />
      </UFormField>
      <div class="flex justify-end">
        <UButton
          label="모든 데이터 삭제"
          icon="i-lucide-bomb"
          color="error"
          :disabled="deleteConfirm !== '게시판 데이터 삭제'"
          :loading="deletingAll"
          @click="runDeleteAll"
        />
      </div>
      <UAlert v-if="deleteDone" color="success" variant="subtle" description="게시판 데이터를 모두 삭제했습니다." />
    </section>
  </div>
</template>
