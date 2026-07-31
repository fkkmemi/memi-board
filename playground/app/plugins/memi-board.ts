import { configureMemiBoard } from 'memi-board'

// memi-board는 nuxt.config가 아니라 이렇게 앱 부팅 시 한 번 호출하는 방식으로 설정한다.
export default defineNuxtPlugin(() => {
  configureMemiBoard({
    collectionPrefix: 'memiBoard',
    auth: { providers: ['google', 'apple'] },
  })
})
