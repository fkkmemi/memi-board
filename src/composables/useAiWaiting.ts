import { onBeforeUnmount, ref, watch, type Ref } from 'vue'

/** AI 작업이 이 시간(ms)보다 오래 걸리면 대기 카드(미니게임)를 띄운다. */
export const AI_WAITING_DELAY_MS = 1500

/**
 * 작업 중(`busy`)이 일정 시간 이어지면 `visible`을 켠다. 빨리 끝나면 번쩍이지 않는다.
 * 카드가 뜬 뒤 작업이 끝나면 닫지 않고 `done`만 켠다. 게임은 사용자가 닫을 때(`dismiss`)까지 남는다.
 * 사용자가 닫으면 그 작업이 끝날 때까지 다시 띄우지 않는다.
 */
export function useAiWaiting(busy: Ref<boolean>) {
  const visible = ref(false)
  const done = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined
  let dismissed = false
  function dismiss() {
    // 작업 중에 닫았을 때만 그 작업 동안 다시 띄우지 않는다. 끝난 뒤 닫은 것은 다음 작업에 남기지 않는다.
    dismissed = busy.value
    visible.value = false
    done.value = false
  }
  watch(busy, (value) => {
    clearTimeout(timer)
    if (!value) {
      if (visible.value) done.value = true
      dismissed = false
      return
    }
    done.value = false
    if (visible.value) return
    timer = setTimeout(() => { if (!dismissed) visible.value = true }, AI_WAITING_DELAY_MS)
  })
  onBeforeUnmount(() => clearTimeout(timer))
  return { visible, done, dismiss }
}
