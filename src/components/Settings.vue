<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { MEMI_BOARD_LOCALES, slugify, useMemiBoardAuth, useMemiBoardI18n, useMemiBoardSettings, useMemiBoardUsers } from 'memi-board/runtime'
import type { BoardCategory, BoardEditorType, BoardListView, BoardVisibility, BoardWriteRole } from 'memi-board/runtime'
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

const { t } = useMemiBoardI18n()
const listViewOptions = computed<Array<{ label: string, value: BoardListView }>>(() => [
  { label: t('settings.option.default'), value: 'default' },
  { label: t('settings.listView.options.dense'), value: 'dense' },
  { label: t('common.label.image'), value: 'image' },
  { label: t('settings.listView.options.video'), value: 'video' },
])
const editorTypeOptions = computed<Array<{ label: string, value: BoardEditorType, description: string }>>(() => [
  { label: t('settings.option.default'), value: 'default', description: t('settings.editorType.options.default') },
  { label: t('common.label.image'), value: 'image', description: t('settings.editorType.options.image') },
])
const writeRoleOptions = computed<Array<{ label: string, value: BoardWriteRole }>>(() => [
  { label: t('settings.writeRole.options.user'), value: 'user' },
  { label: t('settings.writeRole.options.staff'), value: 'staff' },
  { label: t('settings.writeRole.options.admin'), value: 'admin' },
])
const visibilityOptions = computed<Array<{ label: string, value: BoardVisibility, description?: string }>>(() => [
  { label: t('settings.visibility.options.public.label'), value: 'public', description: t('settings.visibility.options.public.description') },
  { label: t('settings.visibility.options.hidden.label'), value: 'hidden', description: t('settings.visibility.options.hidden.description') },
])
// reka-ui Select 는 빈 문자열 값을 허용하지 않아 '자동'을 sentinel 로 두고 저장 시 '' 로 바꾼다.
const LOCALE_AUTO = 'auto'
const localeOptions = computed(() => [
  { label: t('settings.locale.auto'), value: LOCALE_AUTO },
  ...MEMI_BOARD_LOCALES.map((item: { code: string, name: string }) => ({ label: item.name, value: item.code })),
])
function fromLocaleOption(value: string) {
  return value === LOCALE_AUTO ? '' : value
}

const { isAdmin, rolePending } = useMemiBoardAuth()
const { categories, settingsPending, saveCategory, saveCategories, deleteCategory } = useMemiBoardSettings()
const canManage = computed(() => isAdmin.value || props.authorized)
// users 전체 목록은 rules상 board-role 관리자만 읽을 수 있다 — "허용 스태프" 지정 권한이
// 있을 때만(기본은 board-role 관리자) 쿼리를 시작한다. canManage(호스트 authorized 포함)로
// 그냥 열면 스태프도 authorized=true라 여기서 다시 permission-denied가 난다.
const canManageStaffAssignment = computed(() => props.canManageStaff ?? isAdmin.value)
const { users } = useMemiBoardUsers({ enabled: canManageStaffAssignment })
// 이 카테고리에 글/댓글을 쓰려면 스태프 역할이 필요할 때만 "허용 스태프" 지정이 의미가 있다.
const staffOptions = computed(() => users.value
  .filter(item => item.role === 'staff')
  .map(item => ({ label: item.displayName || item.id, value: item.id })))
function needsStaffPicker(category: BoardCategory) {
  return canManageStaffAssignment.value
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
const deletingId = ref<string | null>(null)
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
      editorType: category.editorType ?? (category.listView === 'image' ? 'image' : 'default'),
      writeRole: category.writeRole ?? 'user',
      commentWriteRole: category.commentWriteRole ?? 'user',
      allowedStaffUids: category.allowedStaffUids ?? [],
      locale: category.locale ?? '',
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
    editorType: 'default',
    writeRole: 'user',
    commentWriteRole: 'user',
    allowedStaffUids: [],
    locale: '',
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
    error.value = cause instanceof Error ? cause.message : t('settings.error.orderFailed')
  }
  finally {
    ordering.value = false
  }
}

async function removeCategory(index: number) {
  const category = draft.value[index]
  if (!category || !window.confirm(
    t('settings.deleteConfirm', { label: category.label }),
  )) return
  error.value = ''
  deletingId.value = category.id
  try {
    await deleteCategory(category.id)
    draft.value.splice(index, 1)
  }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : t('settings.error.deleteFailed')
  }
  finally {
    deletingId.value = null
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
    error.value = cause instanceof Error ? cause.message : t('settings.error.saveFailed')
  }
  finally {
    savingId.value = null
  }
}

async function runDeleteAll() {
  if (!props.deleteAll || deleteConfirm.value !== t('settings.danger.phrase')) return
  deletingAll.value = true
  deleteDone.value = false
  error.value = ''
  try {
    await props.deleteAll()
    deleteConfirm.value = ''
    deleteDone.value = true
  }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : t('settings.error.deleteAllFailed')
  }
  finally {
    deletingAll.value = false
  }
}
</script>

<template>
  <div v-if="pending" class="py-16 text-center text-sm text-muted">{{ t('settings.loading') }}</div>
  <UAlert
    v-else-if="!canManage"
    color="neutral"
    variant="subtle"
    icon="i-lucide-circle-help"
    :title="t('settings.notFound.title')"
    :description="t('settings.notFound.checkAddress')"
  />
  <div v-else class="flex flex-col gap-4">
    <UAlert
      v-if="categoryId && !draft.length"
      color="neutral"
      variant="subtle"
      icon="i-lucide-circle-help"
      :title="t('settings.notFound.title')"
      :description="t('settings.notFound.checkBoardAddress')"
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
          <p class="mt-1 truncate text-xs text-muted">{{ category.label || t('settings.noLabel') }} · {{ categoryTo(category.id) }}</p>
        </div>
        <UIcon name="i-lucide-chevron-down" class="size-4 text-muted transition-transform group-open:rotate-180" />
      </summary>

      <div class="flex flex-col gap-5 border-t border-default px-4 py-4">
        <div class="grid gap-2 sm:grid-cols-[9rem_1fr] sm:items-center">
          <div><p class="text-sm font-medium">{{ t('settings.id.label') }}</p><p class="text-xs text-muted">{{ t('settings.id.help') }}</p></div>
          <UInput :model-value="category.id" disabled class="font-mono" />
        </div>
        <div class="flex flex-col gap-2">
          <div><p class="text-sm font-medium">{{ t('settings.writeRole.label') }}</p><p class="text-xs text-muted">{{ t('settings.writeRole.help') }}</p></div>
          <MemiBoardOptionCards
            v-model="category.writeRole"
            :options="writeRoleOptions"
            @update:model-value="savedId = null"
          />
        </div>
        <div class="flex flex-col gap-2">
          <div>
            <p class="text-sm font-medium">{{ t('settings.commentWriteRole.label') }}</p>
            <p class="text-xs text-muted">
              {{ category.visibility === 'hidden'
                ? t('settings.commentWriteRole.hiddenHelp')
                : t('settings.commentWriteRole.help') }}
            </p>
          </div>
          <MemiBoardOptionCards
            v-if="category.visibility !== 'hidden'"
            v-model="category.commentWriteRole"
            :options="writeRoleOptions"
            @update:model-value="savedId = null"
          />
          <p
            v-else
            class="rounded-lg border border-default px-3 py-2.5 text-sm text-muted"
          >
            {{ t('settings.commentWriteRole.hiddenFixed') }}
          </p>
        </div>
        <div v-if="needsStaffPicker(category)" class="grid gap-2 sm:grid-cols-[9rem_1fr] sm:items-center">
          <div><p class="text-sm font-medium">{{ t('settings.staff.label') }}</p><p class="text-xs text-muted">{{ t('settings.staff.help') }}</p></div>
          <USelectMenu
            v-model="category.allowedStaffUids"
            :items="staffOptions"
            value-key="value"
            label-key="label"
            multiple
            :placeholder="t('settings.staff.placeholder')"
            @update:model-value="savedId = null"
          />
        </div>
        <div class="grid gap-2 sm:grid-cols-[9rem_1fr] sm:items-center">
          <div><p class="text-sm font-medium">{{ t('settings.label.label') }}</p><p class="text-xs text-muted">{{ t('settings.label.help') }}</p></div>
          <UInput v-model="category.label" @update:model-value="savedId = null" />
        </div>
        <div class="grid gap-2 sm:grid-cols-[9rem_1fr] sm:items-start">
          <div><p class="text-sm font-medium">{{ t('settings.description.label') }}</p><p class="text-xs text-muted">{{ t('settings.description.help') }}</p></div>
          <UTextarea
            v-model="category.description"
            :rows="3"
            autoresize
            :maxrows="6"
            :placeholder="t('settings.description.placeholder')"
            @update:model-value="savedId = null"
          />
        </div>
        <div v-if="canManageStaffAssignment" class="flex flex-col gap-2">
          <div>
            <p class="text-sm font-medium">{{ t('settings.visibility.label') }}</p>
            <p class="text-xs text-muted">{{ t('settings.visibility.help') }}</p>
          </div>
          <MemiBoardOptionCards
            v-model="category.visibility"
            :options="visibilityOptions"
            @update:model-value="savedId = null"
          />
        </div>
        <div class="flex flex-col gap-2">
          <div><p class="text-sm font-medium">{{ t('settings.listView.label') }}</p><p class="text-xs text-muted">{{ t('settings.listView.help') }}</p></div>
          <MemiBoardOptionCards
            v-model="category.listView"
            :options="listViewOptions"
            @update:model-value="savedId = null"
          />
        </div>
        <div class="flex flex-col gap-2">
          <div><p class="text-sm font-medium">{{ t('settings.editorType.label') }}</p><p class="text-xs text-muted">{{ t('settings.editorType.help') }}</p></div>
          <MemiBoardOptionCards
            v-model="category.editorType"
            :options="editorTypeOptions"
            @update:model-value="savedId = null"
          />
        </div>
        <div class="grid gap-2 sm:grid-cols-[9rem_1fr] sm:items-center">
          <div><p class="text-sm font-medium">{{ t('settings.locale.label') }}</p><p class="text-xs text-muted">{{ t('settings.locale.help') }}</p></div>
          <USelect
            :model-value="category.locale || LOCALE_AUTO"
            :items="localeOptions"
            value-key="value"
            label-key="label"
            @update:model-value="category.locale = fromLocaleOption($event as string); savedId = null"
          />
        </div>
        <div class="flex flex-wrap justify-between gap-2 border-t border-default pt-4">
          <div v-if="!categoryId" class="flex gap-1">
            <UButton :label="t('common.action.toTop')" icon="i-lucide-arrow-up" color="neutral" variant="outline" size="sm" :disabled="index === 0 || ordering" @click="moveCategory(index, -1)" />
            <UButton :label="t('settings.action.moveDown')" icon="i-lucide-arrow-down" color="neutral" variant="outline" size="sm" :disabled="index === draft.length - 1 || ordering" @click="moveCategory(index, 1)" />
          </div>
          <div class="flex gap-1">
            <UButton
              :label="t('settings.action.goToBoard')"
              icon="i-lucide-arrow-up-right"
              color="neutral"
              variant="ghost"
              size="sm"
              :to="categoryTo(category.id)"
            />
            <UButton
              v-if="!categoryId"
              :label="t('settings.action.deleteBoard')"
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="sm"
              :loading="deletingId === category.id"
              :disabled="deletingId !== null"
              @click="removeCategory(index)"
            />
            <UButton
              :label="t('common.action.save')"
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
      <UInput v-model="newLabel" class="flex-1" :placeholder="t('settings.newCategoryPlaceholder')" @keyup.enter="addCategory" />
      <UButton :label="t('common.action.add')" icon="i-lucide-plus" color="neutral" variant="outline" @click="addCategory" />
    </div>
    <UAlert v-if="error" color="error" variant="subtle" :description="error" />
    <UAlert v-if="savedId" color="success" variant="subtle" :description="t('settings.savedCategory', { label: draft.find(item => item.id === savedId)?.label })" />

    <section v-if="deleteAll && !categoryId" class="mt-4 flex flex-col gap-3 border-t border-error/40 pt-6">
      <div>
        <h2 class="font-semibold text-error">{{ t('settings.danger.title') }}</h2>
        <p class="mt-1 text-sm text-muted">
          {{ t('settings.danger.description') }}
        </p>
      </div>
      <UFormField :label="t('settings.danger.confirmLabel', { phrase: t('settings.danger.phrase') })">
        <UInput v-model="deleteConfirm" autocomplete="off" :placeholder="t('settings.danger.phrase')" />
      </UFormField>
      <div class="flex justify-end">
        <UButton
          :label="t('settings.danger.button')"
          icon="i-lucide-bomb"
          color="error"
          :disabled="deleteConfirm !== t('settings.danger.phrase')"
          :loading="deletingAll"
          @click="runDeleteAll"
        />
      </div>
      <UAlert v-if="deleteDone" color="success" variant="subtle" :description="t('settings.danger.done')" />
    </section>
  </div>
</template>
