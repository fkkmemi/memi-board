<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { query, serverTimestamp, where, writeBatch, getDocs } from 'firebase/firestore'
import { useFirestore } from 'vuefire'
import { PROFILE_BIO_MAX, PROFILE_NAME_MAX, boardUserDoc, commentsCol, postsCol, useAiWaiting, useBoardPathConfig, useMemiBoardAiUsage, useMemiBoardI18n, useMemiBoardModeration, useMemiBoardWritingAssistant } from 'memi-board/runtime'
import type { FormError } from '@nuxt/ui'
import type { BoardUserModel } from 'memi-board/runtime'
import { useMemiBoardStorage } from 'memi-board/storage'
import MemiBoardAvatarCropModal from './AvatarCropModal.vue'
import MemiBoardAiUsageRing from './AiUsageRing.vue'
import MemiBoardWaitingOverlay from './WaitingOverlay.vue'

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  uid: string
  profile: BoardUserModel | null | undefined
}>()

const emit = defineEmits<{ saved: [] }>()

const db = useFirestore()
const { t, locale, aiEnabled } = useMemiBoardI18n()
const { checkText: checkName } = useMemiBoardModeration({ context: 'profile-name' })
const { checkText: checkBio } = useMemiBoardModeration({ context: 'profile-bio' })
const { checkImage: checkPhoto } = useMemiBoardModeration({ context: 'profile-photo' })
const checkingBio = ref(false)
const checkingPhoto = ref(false)

const displayName = ref('')
const bio = ref('')
const photoURL = ref<string | null>(null)
const saving = ref(false)
const checkingName = ref(false)
const error = ref('')

const FORM_ID = 'memi-board-profile-edit-form'
const formState = computed(() => ({ displayName: displayName.value, bio: bio.value }))
// 공백만 있는 이름도 비어 있는 것으로 본다. 길이는 입력창 maxlength 가 막는다.
function validate(state: Partial<{ displayName: string }>): FormError[] {
  return state.displayName?.trim() ? [] : [{ name: 'displayName', message: t('profileEditModal.nameRequired') }]
}

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
    error.value = t('profileEditModal.imageOnly')
    return
  }
  if (cropSrc.value.startsWith('blob:')) URL.revokeObjectURL(cropSrc.value)
  cropSrc.value = URL.createObjectURL(file)
  cropOpen.value = true
}

// 올리기 전에 AI로 검사한다. 통과한 사진만 대기 파일이 되고, 막히면 이유를 보여 준다.
async function onCropConfirm(file: File) {
  if (checkingPhoto.value) return
  checkingPhoto.value = true
  error.value = ''
  try {
    const review = await checkPhoto(file)
    if (review.flagged || review.error) {
      error.value = review.reason || t('profileEditModal.photoRejected')
      cropOpen.value = false
      return
    }
    pendingAvatarFile = file
    if (photoURL.value?.startsWith('blob:')) URL.revokeObjectURL(photoURL.value)
    photoURL.value = URL.createObjectURL(file)
    cropOpen.value = false
  }
  finally {
    checkingPhoto.value = false
  }
}

const avatarPreview = computed(() => photoURL.value ?? undefined)

// AI로 프로필 사진 만들기: 만든 그림은 미리보기로만 두었다가 "이 사진 사용"을 누르면 기존 크롭 창으로 넘긴다.
// 하루 그림 횟수는 글에 넣는 AI 그림과 같이 쓴다.
const { generateAvatarImage } = useMemiBoardWritingAssistant({ locale })
const { image: imageUsage } = useMemiBoardAiUsage()
const aiPhotoOpen = ref(false)
const aiPhotoRequest = ref('')
const aiPhotoBlob = ref<Blob | null>(null)
const aiPhotoUrl = ref('')
const aiPhotoRunning = ref(false)
const aiPhotoError = ref('')
// 사진 만들기, 이름·소개·사진 AI 검사, 저장이 오래 걸릴 때 같은 카드를 쓴다.
const waitBusy = computed(() => aiPhotoRunning.value || saving.value || checkingPhoto.value)
const { visible: aiWaitingVisible, dismiss: dismissAiWaiting } = useAiWaiting(waitBusy)
const aiPhotoUsageLabel = computed(() => t('profileEditModal.aiPhotoDialog.left', { remaining: imageUsage.value.remaining, limit: imageUsage.value.limit }))

function clearAiPhoto() {
  if (aiPhotoUrl.value) URL.revokeObjectURL(aiPhotoUrl.value)
  aiPhotoUrl.value = ''
  aiPhotoBlob.value = null
}

function openAiPhoto() {
  clearAiPhoto()
  aiPhotoError.value = ''
  aiPhotoRequest.value = ''
  aiPhotoOpen.value = true
}

async function generateAiPhoto() {
  if (aiPhotoRunning.value || imageUsage.value.remaining < 1) return
  aiPhotoError.value = ''
  // 모달이 열려 있으면 대기 카드의 게임을 누를 때 모달이 닫히므로, 만드는 동안은 닫아 두었다가 결과와 함께 다시 연다.
  aiPhotoOpen.value = false
  aiPhotoRunning.value = true
  try {
    const blob = await generateAvatarImage({ name: displayName.value, bio: bio.value, request: aiPhotoRequest.value })
    clearAiPhoto()
    aiPhotoBlob.value = blob
    aiPhotoUrl.value = URL.createObjectURL(blob)
  }
  catch (cause) {
    aiPhotoError.value = cause instanceof Error ? cause.message : t('editor.ai.failed')
  }
  finally {
    aiPhotoRunning.value = false
    aiPhotoOpen.value = true
  }
}

function useAiPhoto() {
  const blob = aiPhotoBlob.value
  if (!blob) return
  if (cropSrc.value.startsWith('blob:')) URL.revokeObjectURL(cropSrc.value)
  cropSrc.value = URL.createObjectURL(blob)
  aiPhotoOpen.value = false
  clearAiPhoto()
  cropOpen.value = true
}

watch(aiPhotoOpen, (isOpen) => {
  if (!isOpen && !aiPhotoRunning.value) clearAiPhoto()
})

async function updateProfileReferences(nextName: string, nextPhotoURL: string | null) {
  const config = useBoardPathConfig()
  const [postsSnapshot, commentsSnapshot, repliesSnapshot] = await Promise.all([
    getDocs(query(postsCol(db, config), where('authorUid', '==', props.uid))),
    getDocs(query(commentsCol(db, config), where('authorUid', '==', props.uid))),
    // Rules can only allow this list for regular users when listed==true is pinned in the query.
    // Reply-target names on hidden boards are not updated.
    getDocs(query(commentsCol(db, config), where('replyToUid', '==', props.uid), where('listed', '==', true))),
  ])

  // 한 댓글이 작성자이면서 답글 대상일 수도 있으므로 같은 문서의 변경을 합친다.
  const updates = new Map<string, {
    ref: (typeof commentsSnapshot.docs)[number]['ref']
    data: Record<string, unknown>
  }>()
  for (const doc of postsSnapshot.docs) {
    updates.set(doc.ref.path, {
      ref: doc.ref,
      data: { authorName: nextName, authorPhoto: nextPhotoURL },
    })
  }
  for (const doc of commentsSnapshot.docs) {
    updates.set(doc.ref.path, {
      ref: doc.ref,
      data: { authorName: nextName, authorPhoto: nextPhotoURL },
    })
  }
  for (const doc of repliesSnapshot.docs) {
    const existing = updates.get(doc.ref.path)
    updates.set(doc.ref.path, {
      ref: doc.ref,
      data: { ...existing?.data, replyToName: nextName },
    })
  }

  // Firestore batch 한도(500)보다 여유 있게 나눈다. 프로필 문서는 마지막 batch에
  // 넣어 전파 도중 실패했을 때 저장 완료로 보이지 않게 하고, 재시도는 멱등이다.
  const writes = [...updates.values()]
  for (let offset = 0; offset < writes.length; offset += 450) {
    const batch = writeBatch(db)
    for (const update of writes.slice(offset, offset + 450)) batch.update(update.ref, update.data)
    await batch.commit()
  }

  const profileBatch = writeBatch(db)
  profileBatch.update(boardUserDoc(db, config, props.uid), {
    displayName: nextName,
    bio: bio.value.trim().slice(0, PROFILE_BIO_MAX) || null,
    photoURL: nextPhotoURL,
    updatedAt: serverTimestamp(),
  })
  await profileBatch.commit()
}

async function onSave() {
  if (saving.value) return
  const trimmedName = displayName.value.trim().slice(0, PROFILE_NAME_MAX)
  if (!trimmedName) return
  saving.value = true
  error.value = ''
  try {
    if (trimmedName !== (props.profile?.displayName ?? '').trim()) {
      checkingName.value = true
      const review = await checkName(trimmedName)
      checkingName.value = false
      if (review.flagged || review.error) {
        error.value = review.reason || t('profileEditModal.nameRejected')
        return
      }
    }
    const trimmedBio = bio.value.trim().slice(0, PROFILE_BIO_MAX)
    if (trimmedBio && trimmedBio !== (props.profile?.bio ?? '').trim()) {
      checkingBio.value = true
      const bioReview = await checkBio(trimmedBio)
      checkingBio.value = false
      if (bioReview.flagged || bioReview.error) {
        error.value = bioReview.reason || t('profileEditModal.bioRejected')
        return
      }
    }
    let nextPhotoURL = props.profile?.photoURL ?? null
    if (pendingAvatarFile) {
      avatarUploading.value = true
      nextPhotoURL = await uploadAvatar(props.uid, pendingAvatarFile)
      avatarUploading.value = false
    }

    await updateProfileReferences(trimmedName, nextPhotoURL)

    pendingAvatarFile = null
    open.value = false
    emit('saved')
  }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : t('profileEditModal.saveFailed')
  }
  finally {
    saving.value = false
    checkingName.value = false
    checkingBio.value = false
    avatarUploading.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('profileEditModal.title')"
    :dismissible="!saving && !aiPhotoRunning && !checkingPhoto"
    :close="!saving && !aiPhotoRunning && !checkingPhoto"
    :ui="{ content: 'sm:max-w-md' }"
  >
    <template #body>
      <UForm
        :id="FORM_ID"
        :state="formState"
        :validate="validate"
        class="flex flex-col gap-4"
        @submit="onSave"
      >
        <div class="flex items-center gap-3">
          <UAvatar
            :src="avatarPreview"
            :alt="displayName || t('common.label.anonymous')"
            size="xl"
          />
          <UButton
            :label="t('profileEditModal.changePhoto')"
            icon="i-lucide-camera"
            color="neutral"
            variant="outline"
            size="sm"
            @click="avatarInput?.click()"
            :disabled="saving"
          />
          <UButton
            v-if="aiEnabled"
            :label="t('profileEditModal.aiPhoto')"
            icon="i-lucide-sparkles"
            color="neutral"
            variant="outline"
            size="sm"
            :disabled="saving || imageUsage.remaining < 1"
            @click="openAiPhoto"
          >
            <template #trailing>
              <MemiBoardAiUsageRing :used="imageUsage.used" :limit="imageUsage.limit" :label="aiPhotoUsageLabel" />
            </template>
          </UButton>
          <input
            ref="avatarInput"
            type="file"
            accept="image/*"
            class="hidden"
            @change="onPickAvatar"
          >
        </div>

        <UFormField
          name="displayName"
          required
          :label="t('profileEditModal.name')"
          :help="t('profileEditModal.nameReviewHelp')"
        >
          <template #hint>
            <span class="tabular-nums">{{ displayName.length }} / {{ PROFILE_NAME_MAX }}</span>
          </template>
          <UInput
            v-model="displayName"
            :placeholder="t('profileEditModal.name')"
            :maxlength="PROFILE_NAME_MAX"
            :disabled="saving"
            class="w-full"
          />
        </UFormField>

        <UFormField name="bio" :label="t('profileEditModal.bio')">
          <template #hint>
            <span class="tabular-nums">{{ bio.length }} / {{ PROFILE_BIO_MAX }}</span>
          </template>
          <UTextarea
            v-model="bio"
            :rows="3"
            :maxlength="PROFILE_BIO_MAX"
            :disabled="saving"
            :placeholder="t('profileEditModal.bioPlaceholder')"
            class="w-full"
          />
        </UFormField>

        <p
          v-if="error"
          class="text-sm text-error"
        >
          {{ error }}
        </p>
      </UForm>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          color="neutral"
          variant="ghost"
          :disabled="saving"
          @click="open = false"
        >
          {{ t('common.action.cancel') }}
        </UButton>
        <UButton
          type="submit"
          :form="FORM_ID"
          :loading="saving"
        >
          {{ checkingName || checkingBio ? t('profileEditModal.checkingName') : t('common.action.save') }}
        </UButton>
      </div>
    </template>
  </UModal>

  <MemiBoardWaitingOverlay
    :open="aiWaitingVisible"
    icon="i-lucide-sparkles"
    closable
    @close="dismissAiWaiting"
  />

  <UModal
    v-model:open="aiPhotoOpen"
    :title="t('profileEditModal.aiPhotoDialog.title')"
    :ui="{ content: 'sm:max-w-md' }"
  >
    <template #body>
      <div class="flex flex-col gap-3">
        <UFormField
          :label="t('profileEditModal.aiPhotoDialog.label')"
          :help="t('profileEditModal.aiPhotoDialog.help')"
        >
          <UTextarea
            v-model="aiPhotoRequest"
            :placeholder="t('profileEditModal.aiPhotoDialog.placeholder')"
            autocomplete="off"
            class="w-full"
            :rows="2"
            :maxlength="500"
            autofocus
            @keydown.enter.exact.prevent="generateAiPhoto"
          />
        </UFormField>
        <p class="flex items-center gap-2 text-xs text-muted">
          <MemiBoardAiUsageRing :used="imageUsage.used" :limit="imageUsage.limit" :label="aiPhotoUsageLabel" />
          {{ aiPhotoUsageLabel }}<template v-if="imageUsage.hours"> · {{ t('profileEditModal.aiPhotoDialog.resets', { hours: imageUsage.hours }) }}</template>
        </p>
        <div v-if="aiPhotoUrl" class="flex justify-center">
          <img
            :src="aiPhotoUrl"
            :alt="t('profileEditModal.aiPhotoDialog.alt')"
            class="size-48 rounded-full border border-default object-cover"
          >
        </div>
        <UAlert
          v-if="aiPhotoError"
          color="error"
          variant="subtle"
          :description="aiPhotoError"
        />
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="aiPhotoOpen = false">
          {{ t('common.action.cancel') }}
        </UButton>
        <UButton
          :color="aiPhotoUrl ? 'neutral' : 'primary'"
          :variant="aiPhotoUrl ? 'outline' : 'solid'"
          icon="i-lucide-sparkles"
          :loading="aiPhotoRunning"
          :disabled="imageUsage.remaining < 1"
          @click="generateAiPhoto"
        >
          {{ aiPhotoUrl ? t('profileEditModal.aiPhotoDialog.regenerate') : t('profileEditModal.aiPhotoDialog.generate') }}
        </UButton>
        <UButton
          v-if="aiPhotoUrl"
          icon="i-lucide-check"
          :disabled="aiPhotoRunning"
          @click="useAiPhoto"
        >
          {{ t('profileEditModal.aiPhotoDialog.use') }}
        </UButton>
      </div>
    </template>
  </UModal>

  <MemiBoardAvatarCropModal
    v-model:open="cropOpen"
    :src="cropSrc"
    :output-size="256"
    :loading="avatarUploading || checkingPhoto"
    @confirm="onCropConfirm"
  />
</template>
