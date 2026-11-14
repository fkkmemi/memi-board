import { computed, onBeforeUnmount, ref } from 'vue'
import { useCurrentUser } from 'vuefire'
import { aiUsageSummary } from '../utils/aiUsage'
import { IMAGE_GENERATION_DAILY_LIMIT, WRITING_ASSISTANT_DAILY_LIMIT } from './useMemiBoardWritingAssistant'
import { useMemiBoardUserProfile } from './useMemiBoardUserProfile'

/**
 * 내 AI 사용 횟수(글쓰기·그림, 24시간 구간). 사용자 문서를 실시간으로 읽어서
 * 호출이 끝나는 대로 화면의 횟수가 바뀐다. 예약 중인 호출도 사용한 것으로 센다.
 */
export function useMemiBoardAiUsage() {
  const user = useCurrentUser()
  const { profile } = useMemiBoardUserProfile(() => user.value?.uid ?? '')
  // 구간이 끝나는 시각이 지나면 횟수가 0으로 돌아오도록 가끔 갱신한다.
  const now = ref(Date.now())
  const timer = typeof window !== 'undefined' ? setInterval(() => { now.value = Date.now() }, 60_000) : undefined
  onBeforeUnmount(() => clearInterval(timer))

  const writing = computed(() => aiUsageSummary(profile.value as Record<string, unknown> | null, 'writing', WRITING_ASSISTANT_DAILY_LIMIT, now.value))
  const image = computed(() => aiUsageSummary(profile.value as Record<string, unknown> | null, 'image', IMAGE_GENERATION_DAILY_LIMIT, now.value))
  return { writing, image }
}
