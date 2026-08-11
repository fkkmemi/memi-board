/**
 * 클라이언트 전용 서브패스 — Editor.vue/Attachments.vue만 여기서 import 한다.
 * heic2any(WASM glue가 문자열로 박혀 있음)와 canvas 기반 compressImage가
 * 여기 들어있어서, SSR로 로드되는 memi-board/runtime(dist/index.js)에는
 * 절대 섞이면 안 된다 — 안 그러면 Nitro rollup commonjs 파서가 그 청크를
 * 파싱하다 실패해 프로덕션 빌드 자체가 깨진다(호출도 없는데도).
 */
export { useMemiBoardStorage, EDITOR_IMAGE_MAX_BYTES, EDITOR_IMAGE_SOURCE_MAX_BYTES } from './composables/useMemiBoardStorage'
export { compressImage } from './utils/compressImage'
