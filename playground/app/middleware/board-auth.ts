import { getCurrentUser } from 'vuefire'

/** 글쓰기/수정 라우트 가드 — 호스트 프로젝트가 직접 소유하는 라우팅 관심사라 memi-board가 아니라 여기서 정의한다. */
export default defineNuxtRouteMiddleware(async () => {
  const user = await getCurrentUser()
  if (!user) {
    return navigateTo('/board')
  }
})
