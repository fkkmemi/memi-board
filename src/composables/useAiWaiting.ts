import { onBeforeUnmount, ref, watch, type Ref } from 'vue'

/** AI 작업이 이 시간(ms)보다 오래 걸리면 대기 카드(미니게임)를 띄운다. */
export const AI_WAITING_DELAY_MS = 1500

/**
 * 작업 중(`busy`)이 일정 시간 이어지면 `visible`을 켠다. 빨리 끝나면 번쩍이지 않는다.
 * 사용자가 닫으면(`dismiss`) 그 작업이 끝날 때까지 다시 띄우지 않는다.
 */
export function useAiWaiting(busy: Ref<boolean>) {
  const visible = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined
  let dismissed = false
  function dismiss() {
    dismissed = true
    visible.value = false
  }
  watch(busy, (value) => {
    clearTimeout(timer)
    if (!value) {
      visible.value = false
      dismissed = false
      return
    }
    timer = setTimeout(() => { if (!dismissed) visible.value = true }, AI_WAITING_DELAY_MS)
  })
  onBeforeUnmount(() => clearTimeout(timer))
  return { visible, dismiss }
}
