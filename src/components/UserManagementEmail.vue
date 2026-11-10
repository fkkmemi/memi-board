<script setup lang="ts">
import { computed } from 'vue'
import { doc } from 'firebase/firestore'
import { useDocument, useFirestore } from 'vuefire'
import { useBoardPathConfig, useMemiBoardI18n } from 'memi-board/runtime'
import type { BoardUserPrivateModel } from 'memi-board/runtime'

const props = defineProps<{ uid: string; authorized: boolean }>()
const db = useFirestore()
const { t } = useMemiBoardI18n()
const privateRef = computed(() => props.authorized && props.uid
  ? doc(db, useBoardPathConfig().usersCollection, props.uid, 'private', 'info')
  : null)
const { data: info, pending, error } = useDocument<BoardUserPrivateModel>(privateRef)
</script>

<template>
  <p class="truncate text-sm text-muted">
    {{ pending ? t('common.label.loading') : error ? t('users.emailLoadFailed') : info?.email || t('users.noEmail') }}
  </p>
</template>
