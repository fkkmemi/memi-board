<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { getDocs, limit as fbLimit, orderBy, query, where } from 'firebase/firestore'
import { useFirestore } from 'vuefire'
import type { PostModel } from 'memi-board/runtime'
import { miniPostTitle, useBoardPathConfig, useMemiBoardSettings } from 'memi-board/runtime'
import { postsCol } from '../utils/boardPaths'

const props = defineProps<{
  modelValue: string[]
  max: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const db = useFirestore()
const cfg = () => useBoardPathConfig()
const { categoryLabel } = useMemiBoardSettings()
const catalog = ref<PostModel[]>([])
const pending = ref(true)
const q = ref('')

const selected = computed(() => props.modelValue)

const filtered = computed(() => {
  const needle = q.value.trim().toLowerCase()
  const rows = catalog.value.filter(post => !selected.value.includes(post.id || ''))
  if (!needle) return rows.slice(0, 20)
  return rows.filter((post) => {
    const title = miniPostTitle(post).toLowerCase()
    return title.includes(needle) || (post.slug || '').toLowerCase().includes(needle)
  }).slice(0, 20)
})

const picked = computed(() =>
  selected.value
    .map(id => catalog.value.find(post => post.id === id))
    .filter((item): item is PostModel => !!item)
)

const full = computed(() => selected.value.length >= props.max)

onMounted(async () => {
  try {
    const snapshot = await getDocs(query(
      postsCol(db, cfg()),
      where('isPublished', '==', true),
      where('listed', '==', true),
      orderBy('createdAt', 'desc'),
      fbLimit(80),
    ))
    catalog.value = snapshot.docs.map(item => ({ id: item.id, ...item.data() }) as PostModel)
  }
  finally {
    pending.value = false
  }
})

function add(id: string) {
  if (!id || selected.value.includes(id) || full.value) return
  emit('update:modelValue', [...selected.value, id])
}

function remove(id: string) {
  emit('update:modelValue', selected.value.filter(item => item !== id))
}
</script>

<template>
  <div class="flex flex-col gap-3 border-t border-default p-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="text-xs text-muted">
        고른 글 {{ selected.length }} / {{ max }}
        <span v-if="max >= 2"> · 2개부터 캐러셀, 4개는 그리드</span>
      </p>
      <UInput
        v-model="q"
        size="sm"
        icon="i-lucide-search"
        placeholder="제목 검색"
        class="w-48"
      />
    </div>

    <div v-if="picked.length" class="flex flex-col gap-1">
      <div
        v-for="post in picked"
        :key="post.id"
        class="flex items-center gap-2 rounded-lg bg-elevated/50 px-2 py-1.5"
      >
        <p class="min-w-0 flex-1 truncate text-sm">
          {{ miniPostTitle(post) }}
          <span class="text-xs text-muted">
            · {{ categoryLabel(post.category || post.boardId) }}
          </span>
        </p>
        <UButton
          icon="i-lucide-x"
          size="xs"
          color="neutral"
          variant="ghost"
          square
          @click="remove(post.id!)"
        />
      </div>
    </div>

    <p v-if="pending" class="text-xs text-muted">글을 불러오는 중…</p>
    <ul v-else class="flex max-h-48 flex-col gap-0.5 overflow-y-auto">
      <li v-for="post in filtered" :key="post.id">
        <button
          type="button"
          class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-elevated disabled:opacity-40"
          :disabled="full"
          @click="add(post.id!)"
        >
          <UIcon name="i-lucide-plus" class="size-3.5 shrink-0 text-muted" />
          <span class="min-w-0 truncate">{{ miniPostTitle(post) }}</span>
          <span class="shrink-0 text-[11px] text-muted">
            {{ categoryLabel(post.category || post.boardId) }}
          </span>
        </button>
      </li>
      <li v-if="!filtered.length" class="px-2 py-3 text-center text-xs text-muted">
        더 고를 글이 없습니다.
      </li>
    </ul>
  </div>
</template>
