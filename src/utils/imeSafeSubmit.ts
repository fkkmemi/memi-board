/**
 * macOS Safari: 한글 조합 중(마지막 글자 미확정)에 제출 버튼을 누르면 첫 click 이 조합 확정에 먹혀
 * 두 번 눌러야 넘어간다. 마우스는 pointerdown 에서 조합을 확정(blur)하고 바로 제출, 뒤따르는 click 은 무시.
 * 터치는 스크롤과 구분해야 하므로 기존 click 그대로.
 *
 * 사용: `<UButton type="submit" @pointerdown="imeSafeSubmitPointerDown" @click="imeSafeSubmitClick" />`
 * 버튼이 속한 form 을 requestSubmit 하므로 form 의 `@submit.prevent` 핸들러가 그대로 불린다.
 */
const suppressClickUntil = new WeakMap<HTMLButtonElement, number>()

function submitButtonOf(e: Event): HTMLButtonElement | null {
  const target = e.currentTarget
  if (target instanceof HTMLButtonElement) return target
  return target instanceof Element ? target.closest('button') : null
}

export function imeSafeSubmitPointerDown(e: PointerEvent): void {
  if (e.pointerType !== 'mouse' || e.button !== 0) return
  const button = submitButtonOf(e)
  const form = button?.form
  if (!button || !form || button.disabled) return
  suppressClickUntil.set(button, Date.now() + 1000)
  const active = document.activeElement
  if (active instanceof HTMLElement) active.blur()
  // blur 로 확정된 마지막 글자가 v-model 에 반영된 뒤 제출
  setTimeout(() => form.requestSubmit(button), 0)
}

export function imeSafeSubmitClick(e: MouseEvent): void {
  const button = submitButtonOf(e)
  if (!button) return
  const until = suppressClickUntil.get(button)
  if (until && Date.now() < until) {
    e.preventDefault()
    suppressClickUntil.delete(button)
  }
}
