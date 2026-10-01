<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { MEMI_BOARD_LOCALES, useMemiBoardAuth, useMemiBoardI18n, useMemiBoardSettings, useMemiBoardUsers } from 'memi-board/runtime'
import type { BoardCategory, BoardEditorType, BoardListView, BoardVisibility, BoardWriteRole } from 'memi-board/runtime'
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
    editorType: 'default',
    writeRole: 'user',
    commentWriteRole: 'user',
    allowedStaffUids: [],
    locale: '',
  }
}

// 이 카테고리에 글/댓글을 쓰려면 스태프 역할이 필요할 때만 "허용 스태프" 지정이 의미가 있다.
const staffOptions = computed(() => users.value
  .filter(item => item.role === 'staff')
  .map(item => ({ label: item.displayName || item.id, value: item.id })))
const needsStaffPicker = computed(() => canManageStaffAssignment.value)

function toDraft(category: BoardCategory): BoardCategory {
  return {
    ...category,
    description: category.description ?? '',
    visibility: category.visibility === 'hidden' ? 'hidden' : 'public',
    listView: category.listView ?? 'default',
    editorType: category.editorType ?? (category.listView === 'image' ? 'image' : 'default'),
    writeRole: category.writeRole ?? 'user',
    commentWriteRole: category.commentWriteRole ?? 'user',
    allowedStaffUids: category.allowedStaffUids ?? [],
    locale: category.locale ?? '',
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
    error.value = cause instanceof Error ? cause.message : t('settings.error.saveFailed')
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div v-if="pending" class="py-16 text-center text-sm text-muted">{{ t('settings.loading') }}</div>
  <UAlert v-else-if="!canManage" color="neutral" variant="subtle" icon="i-lucide-lock" :title="t('settings.noAccess')" />
  <UAlert v-else-if="!draft" color="neutral" variant="subtle" icon="i-lucide-circle-help" :title="t('settings.notFound.title')" :description="t('settings.notFound.checkBoardAddress')" />
  <div v-else class="flex flex-col gap-5">
    <UAlert
      v-if="isNew"
      color="neutral"
      variant="subtle"
      icon="i-lucide-circle-plus"
      :title="t('settings.newBoard.title')"
      :description="t('settings.newBoard.description')"
    />
    <div class="grid gap-2 sm:grid-cols-[9rem_1fr] sm:items-center">
      <div><p class="text-sm font-medium">{{ t('settings.id.label') }}</p><p class="text-xs text-muted">{{ t('settings.id.help') }}</p></div>
      <UInput :model-value="draft.id" disabled class="font-mono" />
    </div>
    <div class="flex flex-col gap-2">
      <div><p class="text-sm font-medium">{{ t('settings.writeRole.label') }}</p><p class="text-xs text-muted">{{ t('settings.writeRole.helpShort') }}</p></div>
      <MemiBoardOptionCards v-model="draft.writeRole" :options="writeRoleOptions" @update:model-value="saved = false" />
    </div>
    <div class="flex flex-col gap-2">
      <div>
        <p class="text-sm font-medium">{{ t('settings.commentWriteRole.label') }}</p>
        <p class="text-xs text-muted">
          {{ draft.visibility === 'hidden'
            ? t('settings.commentWriteRole.hiddenHelp')
            : t('settings.commentWriteRole.helpShort') }}
        </p>
      </div>
      <MemiBoardOptionCards
        v-if="draft.visibility !== 'hidden'"
        v-model="draft.commentWriteRole"
        :options="writeRoleOptions"
        @update:model-value="saved = false"
      />
      <p
        v-else
        class="rounded-lg border border-default px-3 py-2.5 text-sm text-muted"
      >
        {{ t('settings.commentWriteRole.hiddenFixed') }}
      </p>
    </div>
    <div v-if="needsStaffPicker" class="grid gap-2 sm:grid-cols-[9rem_1fr] sm:items-center">
      <div><p class="text-sm font-medium">{{ t('settings.staff.label') }}</p><p class="text-xs text-muted">{{ t('settings.staff.help') }}</p></div>
      <USelectMenu
        v-model="draft.allowedStaffUids"
        :items="staffOptions"
        value-key="value"
        label-key="label"
        multiple
        :placeholder="t('settings.staff.placeholder')"
        @update:model-value="saved = false"
      />
    </div>
    <div class="grid gap-2 sm:grid-cols-[9rem_1fr] sm:items-center">
      <div><p class="text-sm font-medium">{{ t('settings.label.label') }}</p><p class="text-xs text-muted">{{ t('settings.label.help') }}</p></div>
      <UInput v-model="draft.label" @update:model-value="saved = false" />
    </div>
    <div class="grid gap-2 sm:grid-cols-[9rem_1fr] sm:items-start">
      <div><p class="text-sm font-medium">{{ t('settings.description.label') }}</p><p class="text-xs text-muted">{{ t('settings.description.help') }}</p></div>
      <UTextarea
        v-model="draft.description"
        :rows="3"
        autoresize
        :maxrows="6"
        :placeholder="t('settings.description.placeholder')"
        @update:model-value="saved = false"
      />
    </div>
    <div v-if="canManageStaffAssignment" class="flex flex-col gap-2">
      <div>
        <p class="text-sm font-medium">{{ t('settings.visibility.label') }}</p>
        <p class="text-xs text-muted">{{ t('settings.visibility.help') }}</p>
      </div>
      <MemiBoardOptionCards v-model="draft.visibility" :options="visibilityOptions" @update:model-value="saved = false" />
    </div>
    <div class="flex flex-col gap-2">
      <div><p class="text-sm font-medium">{{ t('settings.listView.label') }}</p><p class="text-xs text-muted">{{ t('settings.listView.help') }}</p></div>
      <MemiBoardOptionCards v-model="draft.listView" :options="listViewOptions" @update:model-value="saved = false" />
    </div>
    <div class="flex flex-col gap-2">
      <div><p class="text-sm font-medium">{{ t('settings.editorType.label') }}</p><p class="text-xs text-muted">{{ t('settings.editorType.help') }}</p></div>
      <MemiBoardOptionCards v-model="draft.editorType" :options="editorTypeOptions" @update:model-value="saved = false" />
    </div>
    <div class="grid gap-2 sm:grid-cols-[9rem_1fr] sm:items-center">
      <div><p class="text-sm font-medium">{{ t('settings.locale.label') }}</p><p class="text-xs text-muted">{{ t('settings.locale.help') }}</p></div>
      <USelect
        :model-value="draft.locale || LOCALE_AUTO"
        :items="localeOptions"
        value-key="value"
        label-key="label"
        @update:model-value="draft.locale = fromLocaleOption($event as string); saved = false"
      />
    </div>
    <div class="flex justify-end border-t border-default pt-4">
      <UButton :label="isNew ? t('settings.action.create') : t('common.action.save')" :icon="isNew ? 'i-lucide-plus' : 'i-lucide-save'" :loading="saving" @click="save" />
    </div>
    <UAlert v-if="error" color="error" variant="subtle" :description="error" />
    <UAlert v-if="saved" color="success" variant="subtle" :description="isNew ? t('settings.created') : t('settings.savedSettings')" />
  </div>
</template>
