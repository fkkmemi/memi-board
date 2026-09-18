/**
 * 클라이언트 전용 서브패스 — Editor.vue/Attachments.vue만 여기서 import 한다.
 * canvas 기반 compressImage가 브라우저 전용이므로 SSR로 로드되는
 * memi-board/runtime(dist/index.js)과 분리한다.
 */
export { useMemiBoardStorage, EDITOR_IMAGE_MAX_BYTES, EDITOR_IMAGE_SOURCE_MAX_BYTES } from './composables/useMemiBoardStorage'
export { compressImage } from './utils/compressImage'
