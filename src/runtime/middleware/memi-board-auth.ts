import { getCurrentUser } from 'vuefire'
import { defineNuxtRouteMiddleware, navigateTo } from '#app'

/** pages:true 옵션의 글쓰기/수정 라우트에만 붙는 미들웨어 — 로그인하지 않았으면 게시판 목록으로 되돌린다. */
export default defineNuxtRouteMiddleware(async (to) => {
  const user = await getCurrentUser()
  if (!user) {
    return navigateTo((to.meta.memiBoardBase as string | undefined) ?? '/')
  }
})
