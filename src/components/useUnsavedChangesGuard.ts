import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'

/** Route changes and browser exits share the editor's last loaded/saved state. */
export function useUnsavedChangesGuard(
  snapshot: () => string,
  busy: () => boolean,
  message: () => string,
) {
  const savedSnapshot = ref(snapshot())
  const dirty = computed(() => busy() || snapshot() !== savedSnapshot.value)
  const markSaved = () => { savedSnapshot.value = snapshot() }

  function confirmLeave() {
    return !dirty.value || window.confirm(message())
  }

  onBeforeRouteLeave(confirmLeave)
  onBeforeRouteUpdate((to, from) => to.path === from.path || confirmLeave())

  function beforeUnload(event: BeforeUnloadEvent) {
    if (!dirty.value) return
    event.preventDefault()
    event.returnValue = ''
  }

  // Attach only while dirty so clean editors can use the browser's page cache.
  let stopWatching: (() => void) | undefined
  onMounted(() => {
    stopWatching = watch(dirty, (value) => {
      if (value) window.addEventListener('beforeunload', beforeUnload)
      else window.removeEventListener('beforeunload', beforeUnload)
    }, { immediate: true, flush: 'sync' })
  })
  onBeforeUnmount(() => {
    stopWatching?.()
    window.removeEventListener('beforeunload', beforeUnload)
  })

  return { markSaved, confirmLeave }
}
