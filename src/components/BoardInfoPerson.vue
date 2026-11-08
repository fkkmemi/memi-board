<script setup lang="ts">
import { toRef } from 'vue'
import { useMemiBoardUserProfile } from 'memi-board/runtime'
import MemiBoardAuthorMenu from './AuthorMenu.vue'

const props = defineProps<{
  uid: string
  authorProfileTo?: (authorUid: string) => string | undefined
  authorPostsTo?: (authorUid: string) => string | undefined
  authorCommentsTo?: (authorUid: string) => string | undefined
}>()
const { profile } = useMemiBoardUserProfile(toRef(props, 'uid'))
</script>

<template>
  <MemiBoardAuthorMenu
    :author-uid="uid"
    :author-name="profile?.displayName"
    :author-photo="profile?.photoURL"
    :author-profile-to="authorProfileTo"
    :author-posts-to="authorPostsTo"
    :author-comments-to="authorCommentsTo"
    :show-avatar="true"
  />
</template>
