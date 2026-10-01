<script setup lang="ts">
import { imeSafeSubmitClick, imeSafeSubmitPointerDown } from 'memi-board/runtime'
import { ref, computed } from 'vue'
import { useMemiBoardConfig } from 'memi-board/runtime'
import { useMemiBoardAuth } from 'memi-board/runtime'
import { useMemiBoardI18n } from 'memi-board/runtime'

const config = useMemiBoardConfig()
const { t } = useMemiBoardI18n()
const providers = computed(() => config.auth?.providers ?? ['google', 'apple'])
const hasOAuthProvider = computed(() => providers.value.includes('google') || providers.value.includes('apple'))

const { signInWithGoogle, signInWithApple, signInWithEmail, signUpWithEmail } = useMemiBoardAuth()

const mode = ref<'signin' | 'signup'>('signin')
const email = ref('')
const password = ref('')
const displayName = ref('')
const loading = ref(false)
const error = ref('')

async function handleGoogle() {
  loading.value = true
  error.value = ''
  try {
    await signInWithGoogle()
  }
  catch (e) {
    error.value = (e as Error).message
  }
  finally {
    loading.value = false
  }
}

async function handleApple() {
  loading.value = true
  error.value = ''
  try {
    await signInWithApple()
  }
  catch (e) {
    error.value = (e as Error).message
  }
  finally {
    loading.value = false
  }
}

async function handleEmailSubmit() {
  if (loading.value) return
  loading.value = true
  error.value = ''
  try {
    if (mode.value === 'signin') {
      await signInWithEmail(email.value, password.value)
    }
    else {
      await signUpWithEmail(email.value, password.value, displayName.value || undefined)
    }
  }
  catch (e) {
    error.value = (e as Error).message
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-4 max-w-sm">
    <UButton
      v-if="providers.includes('google')"
      icon="i-simple-icons-google"
      color="neutral"
      variant="outline"
      :label="t('signIn.withGoogle')"
      block
      :loading="loading"
      @click="handleGoogle"
    />

    <UButton
      v-if="providers.includes('apple')"
      icon="i-simple-icons-apple"
      color="neutral"
      variant="outline"
      :label="t('signIn.withApple')"
      block
      :loading="loading"
      @click="handleApple"
    />

    <template v-if="providers.includes('emailPassword')">
      <div
        v-if="hasOAuthProvider"
        class="flex items-center gap-2 text-xs text-muted"
      >
        <div class="flex-1 border-t border-default" />
        {{ t('signIn.or') }}
        <div class="flex-1 border-t border-default" />
      </div>

      <form
        class="flex flex-col gap-3"
        @submit.prevent="handleEmailSubmit"
      >
        <UInput
          v-if="mode === 'signup'"
          v-model="displayName"
          :placeholder="t('signIn.name')"
        />
        <UInput
          v-model="email"
          type="email"
          :placeholder="t('signIn.email')"
          required
        />
        <UInput
          v-model="password"
          type="password"
          :placeholder="t('signIn.password')"
          required
        />
        <UButton
          type="submit"
          @pointerdown="imeSafeSubmitPointerDown"
          @click="imeSafeSubmitClick"
          block
          :loading="loading"
          :label="mode === 'signin' ? t('common.action.signIn') : t('signIn.signUp')"
        />
      </form>

      <UButton
        variant="link"
        size="sm"
        color="neutral"
        :label="mode === 'signin' ? t('signIn.toSignUp') : t('signIn.toSignIn')"
        @click="mode = mode === 'signin' ? 'signup' : 'signin'"
      />
    </template>

    <p
      v-if="error"
      class="text-sm text-error"
    >
      {{ error }}
    </p>
  </div>
</template>
