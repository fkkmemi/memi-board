/**
 * 호스트 Nuxt 가 해석하는 가상 모듈.
 * useMemiBoardSeo 는 패키지 dist 에 번들되지 않고 호스트 파이프라인에서 컴파일된다.
 */
declare module '#imports' {
  export const useAsyncData: (...args: any[]) => any
  export const useHead: (...args: any[]) => any
  export const useRequestURL: (...args: any[]) => any
  export const useRoute: (...args: any[]) => any
  export const useRuntimeConfig: (...args: any[]) => any
  export const useSeoMeta: (...args: any[]) => any
}
