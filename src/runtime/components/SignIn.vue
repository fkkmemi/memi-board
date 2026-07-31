<script setup lang="ts">
const config = useRuntimeConfig().public.memiBoard as { auth: { providers?: Array<'google' | 'emailPassword'> } }
const providers = computed(() => config.auth?.providers ?? ['google', 'emailPassword'])

const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useMemiBoardAuth()

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

async function handleEmailSubmit() {
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
      label="Google로 로그인"
      block
      :loading="loading"
      @click="handleGoogle"
    />

    <template v-if="providers.includes('emailPassword')">
      <div
        v-if="providers.includes('google')"
        class="flex items-center gap-2 text-xs text-muted"
      >
        <div class="flex-1 border-t border-default" />
        또는
        <div class="flex-1 border-t border-default" />
      </div>

      <form
        class="flex flex-col gap-3"
        @submit.prevent="handleEmailSubmit"
      >
        <UInput
          v-if="mode === 'signup'"
          v-model="displayName"
          placeholder="이름"
        />
        <UInput
          v-model="email"
          type="email"
          placeholder="이메일"
          required
        />
        <UInput
          v-model="password"
          type="password"
          placeholder="비밀번호"
          required
        />
        <UButton
          type="submit"
          block
          :loading="loading"
          :label="mode === 'signin' ? '로그인' : '회원가입'"
        />
      </form>

      <UButton
        variant="link"
        size="sm"
        color="neutral"
        :label="mode === 'signin' ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'"
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
