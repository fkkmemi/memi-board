<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { serverTimestamp, updateDoc } from 'firebase/firestore'
import { useFirestore } from 'vuefire'
import { boardUserDoc, useBoardPathConfig } from 'memi-board/runtime'
import type { BoardUserModel } from 'memi-board/runtime'
import { useMemiBoardStorage } from 'memi-board/storage'
import MemiBoardAvatarCropModal from './AvatarCropModal.vue'

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  uid: string
  profile: BoardUserModel | null | undefined
}>()

const emit = defineEmits<{ saved: [] }>()

const db = useFirestore()

const displayName = ref('')
const bio = ref('')
const photoURL = ref<string | null>(null)
const saving = ref(false)
const error = ref('')

// 열릴 때마다 최신 프로필로 폼을 리셋 — 이전에 취소한 입력이 남아있지 않게.
watch(open, (isOpen) => {
  if (!isOpen) return
  displayName.value = props.profile?.displayName ?? ''
  bio.value = props.profile?.bio ?? ''
  photoURL.value = props.profile?.photoURL ?? null
  error.value = ''
})

const cropOpen = ref(false)
const cropSrc = ref('')
const avatarUploading = ref(false)
const avatarInput = ref<HTMLInputElement | null>(null)
let pendingAvatarFile: File | null = null

const { uploadAvatar } = useMemiBoardStorage()

function onPickAvatar(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    error.value = '이미지 파일만 선택할 수 있습니다.'
    return
  }
  if (cropSrc.value.startsWith('blob:')) URL.revokeObjectURL(cropSrc.value)
  cropSrc.value = URL.createObjectURL(file)
  cropOpen.value = true
}

function onCropConfirm(file: File) {
  pendingAvatarFile = file
  photoURL.value = URL.createObjectURL(file)
  cropOpen.value = false
}

const avatarPreview = computed(() => photoURL.value ?? undefined)

async function onSave() {
  if (saving.value) return
  const trimmedName = displayName.value.trim()
  if (!trimmedName) {
    error.value = '이름을 입력해 주세요.'
    return
  }
  saving.value = true
  error.value = ''
  try {
    let nextPhotoURL = props.profile?.photoURL ?? null
    if (pendingAvatarFile) {
      avatarUploading.value = true
      nextPhotoURL = await uploadAvatar(props.uid, pendingAvatarFile)
      avatarUploading.value = false
    }

    await updateDoc(boardUserDoc(db, useBoardPathConfig(), props.uid), {
      displayName: trimmedName,
      bio: bio.value.trim() || null,
      photoURL: nextPhotoURL,
      updatedAt: serverTimestamp(),
    })

    pendingAvatarFile = null
    open.value = false
    emit('saved')
  }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : '프로필을 저장하지 못했습니다.'
  }
  finally {
    saving.value = false
    avatarUploading.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="프로필 수정"
    :ui="{ content: 'sm:max-w-md' }"
  >
    <template #body>
      <div class="flex flex-col gap-4">
        <div class="flex items-center gap-3">
          <UAvatar
            :src="avatarPreview"
            :alt="displayName || '익명'"
            size="xl"
          />
          <UButton
            label="사진 변경"
            icon="i-lucide-camera"
            color="neutral"
            variant="outline"
            size="sm"
            @click="avatarInput?.click()"
          />
          <input
            ref="avatarInput"
            type="file"
            accept="image/*"
            class="hidden"
            @change="onPickAvatar"
          >
        </div>

        <UFormField label="이름">
          <UInput
            v-model="displayName"
            placeholder="이름"
            :maxlength="40"
            class="w-full"
          />
        </UFormField>

        <UFormField label="자기소개">
          <UTextarea
            v-model="bio"
            :rows="3"
            :maxlength="200"
            placeholder="나를 소개해 보세요"
            class="w-full"
          />
        </UFormField>

        <p
          v-if="error"
          class="text-sm text-error"
        >
          {{ error }}
        </p>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          color="neutral"
          variant="ghost"
          :disabled="saving"
          @click="open = false"
        >
          취소
        </UButton>
        <UButton
          :loading="saving"
          @click="onSave"
        >
          저장
        </UButton>
      </div>
    </template>
  </UModal>

  <MemiBoardAvatarCropModal
    v-model:open="cropOpen"
    :src="cropSrc"
    :output-size="256"
    :loading="avatarUploading"
    @confirm="onCropConfirm"
  />
</template>
