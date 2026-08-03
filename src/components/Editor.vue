<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Attachment } from 'memi-board'
import { useMemiBoardAuth } from 'memi-board'
import { useMemiBoardPosts } from 'memi-board'
import { useMemiBoardModeration } from 'memi-board'
import { useMemiBoardSettings } from 'memi-board'
import MemiBoardAttachments from './Attachments.vue'

const props = defineProps<{
  /** 지정하면 수정 모드, 지정하지 않으면 새 글 작성 모드. */
  postId?: string
}>()

const emit = defineEmits<{ saved: [id: string], cancel: [] }>()

const { user, isSignedIn } = useMemiBoardAuth()
const { getPost, createPost, updatePost } = useMemiBoardPosts()
const { checkText } = useMemiBoardModeration()
const { categories, ensureSettings, addCategory } = useMemiBoardSettings()

const title = ref('')
const content = ref('')
const tagsInput = ref('')
/** boardSettings.categories 의 id */
const category = ref<string | undefined>(undefined)
const attachments = ref<Attachment[]>([])

const categoryItems = computed(() =>
  categories.value.map(c => ({ label: c.label, value: c.id })),
)

const isEdit = computed(() => Boolean(props.postId))
const loading = ref(false)
const saving = ref(false)
const error = ref('')

const showAddCategory = ref(false)
const newCategoryLabel = ref('')
const addingCategory = ref(false)

/** 새 글은 아직 slug가 없으므로 첨부파일 Storage 경로용 임시 네임스페이스를 쓴다. */
const attachmentNamespace = ref(props.postId ?? `new-${Date.now()}`)

async function loadPost(id: string) {
  loading.value = true
  error.value = ''
  try {
    await ensureSettings().catch(() => {})
    const post = await getPost(id)
    if (!post) {
      error.value = '게시글을 찾을 수 없습니다.'
      title.value = ''
      content.value = ''
      return
    }
    title.value = post.title
    content.value = post.content
    tagsInput.value = (post.tags ?? []).join(', ')
    // 설정에 없는 예전 카테고리 id 여도 선택값은 유지 (목록에 없으면 USelect 가 비울 수 있음)
    category.value = post.category
    attachments.value = post.attachments ?? []
    attachmentNamespace.value = id
  }
  catch (e) {
    const msg = (e as Error).message || String(e)
    error.value = msg.includes('permission')
      ? '글을 불러올 권한이 없습니다. 로그인 상태를 확인해 주세요.'
      : `글을 불러오지 못했습니다: ${msg}`
  }
  finally {
    loading.value = false
  }
}

watch(
  () => props.postId,
  (id) => {
    if (id) void loadPost(id)
    else {
      loading.value = false
      attachmentNamespace.value = `new-${Date.now()}`
      void ensureSettings().catch(() => {})
    }
  },
  { immediate: true },
)

async function handleAddCategory() {
  error.value = ''
  if (!isSignedIn.value) {
    error.value = '카테고리 추가에는 로그인이 필요합니다.'
    return
  }
  addingCategory.value = true
  try {
    const id = await addCategory(newCategoryLabel.value)
    category.value = id
    newCategoryLabel.value = ''
    showAddCategory.value = false
  }
  catch (e) {
    error.value = (e as Error).message || String(e)
  }
  finally {
    addingCategory.value = false
  }
}

function friendlyWriteError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  if (msg.includes('permission-denied') || msg.includes('Permission denied')) {
    return '수정 권한이 없습니다. 본인이 작성한 글인지, 로그인이 유지되는지 확인해 주세요.'
  }
  return msg
}

async function handleSubmit() {
  error.value = ''
  if (!title.value.trim() || !content.value.trim()) {
    error.value = '제목과 내용을 입력해 주세요.'
    return
  }
  if (!user.value) {
    error.value = '로그인이 필요합니다.'
    return
  }
  if (!category.value) {
    error.value = '카테고리를 선택해 주세요.'
    return
  }
  // 설정에 있는 id 만 허용 (임의 문자열 저장 방지)
  if (!categories.value.some(c => c.id === category.value)) {
    error.value = '목록에 있는 카테고리를 선택해 주세요. 없으면 아래 + 로 추가할 수 있습니다.'
    return
  }

  saving.value = true
  try {
    const moderation = await checkText(`${title.value}\n${content.value}`)
    if (moderation.flagged) {
      error.value = moderation.reason || '게시할 수 없는 내용이 포함되어 있습니다.'
      return
    }

    const tags = tagsInput.value.split(',').map(t => t.trim()).filter(Boolean)
    const payload = {
      title: title.value.trim(),
      content: content.value,
      tags,
      category: category.value,
      attachments: attachments.value,
    }

    if (props.postId) {
      await updatePost(props.postId, payload)
      emit('saved', props.postId)
    }
    else {
      const id = await createPost({
        ...payload,
        authorUid: user.value.uid,
        authorName: user.value.displayName,
        authorPhoto: user.value.photoURL,
      })
      emit('saved', id)
    }
  }
  catch (e) {
    error.value = friendlyWriteError(e)
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div
    v-if="loading"
    class="flex flex-col gap-3"
  >
    <USkeleton class="h-10 w-full" />
    <USkeleton class="h-40 w-full" />
  </div>

  <form
    v-else
    class="flex flex-col gap-4"
    @submit.prevent="handleSubmit"
  >
    <div class="flex flex-col gap-2">
      <div class="flex items-center gap-2 flex-wrap">
        <USelect
          v-model="category"
          :items="categoryItems"
          placeholder="카테고리 선택"
          class="w-48"
        />
        <UButton
          type="button"
          v-if="isSignedIn"
          variant="outline"
          color="neutral"
          size="sm"
          icon="i-lucide-plus"
          label="카테고리 추가"
          @click="showAddCategory = !showAddCategory"
        />
      </div>
      <p class="text-xs text-muted">
        카테고리는 게시판 설정(boardSettings)에 있는 목록에서 고릅니다.
      </p>

      <div
        v-if="showAddCategory"
        class="flex items-center gap-2"
      >
        <UInput
          v-model="newCategoryLabel"
          placeholder="새 카테고리 이름"
          class="w-48"
          @keydown.enter.prevent="handleAddCategory"
        />
        <UButton
          type="button"
          size="sm"
          label="추가"
          :loading="addingCategory"
          @click="handleAddCategory"
        />
        <UButton
          type="button"
          size="sm"
          variant="ghost"
          color="neutral"
          label="취소"
          @click="showAddCategory = false; newCategoryLabel = ''"
        />
      </div>
    </div>

    <UInput
      v-model="title"
      placeholder="제목"
      size="lg"
      required
    />
    <UTextarea
      v-model="content"
      placeholder="내용을 입력하세요"
      :rows="12"
      required
    />
    <UInput
      v-model="tagsInput"
      placeholder="태그 (쉼표로 구분)"
    />

    <MemiBoardAttachments
      v-model="attachments"
      :post-id="attachmentNamespace"
      editable
    />

    <p
      v-if="error"
      class="text-sm text-error"
    >
      {{ error }}
    </p>

    <div class="flex gap-2">
      <UButton
        type="submit"
        :loading="saving"
        :label="isEdit ? '수정 완료' : '게시하기'"
      />
      <UButton
        variant="ghost"
        color="neutral"
        label="취소"
        @click="emit('cancel')"
      />
    </div>
  </form>
</template>
