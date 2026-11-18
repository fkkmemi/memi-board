import { defineComponent, getCurrentInstance, h, reactive, render } from 'vue'
import { useMemiBoardI18n } from 'memi-board/runtime'
import MemiBoardWaitingOverlay from './WaitingOverlay.vue'

/**
 * Shows the waiting card outside the calling component (mounted on body), so it survives the
 * route change after a save. The game keeps going until the user closes it; closing only closes.
 */
export function useDetachedWaiting(options: { locale: () => string | undefined, icon?: string }) {
  const appContext = getCurrentInstance()?.appContext
  const state = reactive({ done: false })
  let container: HTMLElement | null = null

  function close() {
    if (!container) return
    render(null, container)
    container.remove()
    container = null
  }

  function open() {
    state.done = false
    if (container || typeof document === 'undefined') return
    const boardLocale = options.locale()
    const Card = defineComponent({
      setup() {
        useMemiBoardI18n({ boardLocale: () => boardLocale })
        return () => h(MemiBoardWaitingOverlay, {
          open: true,
          done: state.done,
          // Keep the editor untouchable while saving; once saved the card floats freely.
          block: !state.done,
          closable: true,
          icon: options.icon,
          onClose: close,
        })
      },
    })
    container = document.createElement('div')
    document.body.appendChild(container)
    const vnode = h(Card)
    if (appContext) vnode.appContext = appContext
    render(vnode, container)
  }

  function finish() {
    state.done = true
  }

  return { open, finish, close, isOpen: () => !!container }
}
