<script setup lang="ts">
/**
 * 오래 걸리는 AI 작업을 기다리는 동안 보여 주는, 고민하는 로봇. 이미지 파일 없이 SVG 와 CSS 로만 움직인다.
 * `done` 이면 같은 크기의 기뻐하는 로봇으로 바뀐다. 끝났다고 그림을 없애면 아래 게임이 위로 튀어 오르기 때문이다.
 */
defineProps<{ label?: string, done?: boolean }>()
</script>

<template>
  <svg
    viewBox="0 0 160 100"
    class="ai-thinking mx-auto block h-24 w-auto"
    role="img"
    :aria-label="label"
  >
    <!-- 끝났을 때: 체크가 든 말풍선과 반짝이는 별 -->
    <g v-if="done" class="bubble-done">
      <circle class="dot" cx="104" cy="44" r="3" />
      <circle class="dot" cx="113" cy="35" r="4.5" />
      <ellipse class="cloud" cx="132" cy="20" rx="24" ry="13" />
      <path class="line ok" d="M122 20 l7 7 l13 -14" />
      <path class="star s1" d="M20 20 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 z" />
      <path class="star s2" d="M92 70 l1.5 4 l4 1.5 l-4 1.5 l-1.5 4 l-1.5 -4 l-4 -1.5 l4 -1.5 z" />
    </g>
    <!-- 생각 풍선: 점이 차례로 커졌다 작아진다 -->
    <g v-else class="bubble">
      <circle class="dot d1" cx="104" cy="44" r="3" />
      <circle class="dot d2" cx="113" cy="35" r="4.5" />
      <ellipse class="cloud" cx="132" cy="20" rx="24" ry="13" />
      <circle class="dot d3" cx="122" cy="20" r="2.6" />
      <circle class="dot d4" cx="132" cy="20" r="2.6" />
      <circle class="dot d5" cx="142" cy="20" r="2.6" />
    </g>

    <!-- 로봇 -->
    <g class="robot" :class="{ happy: done }">
      <line class="line" x1="52" y1="26" x2="52" y2="16" />
      <circle class="antenna" cx="52" cy="13" r="3.5" />
      <rect class="head" x="28" y="26" width="48" height="40" rx="12" />
      <template v-if="done">
        <!-- 웃는 눈과 활짝 웃는 입 -->
        <path class="line" d="M36 46 q7 -9 14 0" />
        <path class="line" d="M54 46 q7 -9 14 0" />
        <path class="line smile" d="M40 54 q12 12 24 0" />
      </template>
      <template v-else>
        <!-- 눈: 눈동자가 위쪽 풍선을 올려다보며 좌우로 움직인다 -->
        <circle class="eye" cx="43" cy="44" r="7" />
        <circle class="eye" cx="61" cy="44" r="7" />
        <circle class="pupil" cx="43" cy="44" r="3" />
        <circle class="pupil" cx="61" cy="44" r="3" />
        <!-- 찡그린 눈썹과 일그러진 입 -->
        <path class="line" d="M35 34 L48 37" />
        <path class="line" d="M69 34 L56 37" />
        <path class="line mouth" d="M42 57 q5 -4 9 0 t9 0" />
      </template>
      <!-- 몸통 -->
      <rect class="head" x="36" y="68" width="32" height="22" rx="8" />
      <!-- 머리를 긁는 팔(끝나면 손을 흔든다) -->
      <g class="arm" :class="{ wave: done }">
        <line class="line thick" x1="68" y1="74" x2="82" y2="52" />
        <circle class="hand" cx="83" cy="49" r="4.5" />
      </g>
      <!-- 식은땀 -->
      <path v-if="!done" class="sweat" d="M26 38 q-4 7 0 10 q4 -3 0 -10 z" />
    </g>

    <!-- 돌아가는 톱니 -->
    <g class="gear" :class="{ stopped: done }" transform="translate(118 78)">
      <circle class="gear-ring" r="9" />
      <g class="gear-teeth">
        <rect x="-2.2" y="-14" width="4.4" height="6" rx="1.2" />
        <rect x="-2.2" y="-14" width="4.4" height="6" rx="1.2" transform="rotate(60)" />
        <rect x="-2.2" y="-14" width="4.4" height="6" rx="1.2" transform="rotate(120)" />
        <rect x="-2.2" y="-14" width="4.4" height="6" rx="1.2" transform="rotate(180)" />
        <rect x="-2.2" y="-14" width="4.4" height="6" rx="1.2" transform="rotate(240)" />
        <rect x="-2.2" y="-14" width="4.4" height="6" rx="1.2" transform="rotate(300)" />
      </g>
      <circle class="gear-hole" r="3" />
    </g>
  </svg>
</template>

<style scoped>
.ai-thinking { color: var(--ui-text-muted, #6b7280); }
.line { fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
.line.thick { stroke-width: 4; }
.head { fill: var(--ui-bg-elevated, #f3f4f6); stroke: currentColor; stroke-width: 2.4; }
.eye { fill: var(--ui-bg, #fff); stroke: currentColor; stroke-width: 2; }
.pupil { fill: currentColor; animation: pupil-look 3.2s ease-in-out infinite; }
.antenna { fill: var(--ui-primary, #3b82f6); animation: blink 1.4s ease-in-out infinite; }
.hand { fill: var(--ui-bg-elevated, #f3f4f6); stroke: currentColor; stroke-width: 2.4; }
.arm { transform-origin: 68px 74px; animation: scratch 0.7s ease-in-out infinite alternate; }
.arm.wave { animation: wave 0.55s ease-in-out infinite alternate; }
.ok { stroke: var(--ui-success, #22c55e); stroke-width: 3.2; }
.star { fill: var(--ui-primary, #3b82f6); transform-box: fill-box; transform-origin: center; animation: twinkle 1.4s ease-in-out infinite; }
.star.s2 { animation-delay: 0.6s; }
.bubble-done .dot { fill: var(--ui-bg, #fff); stroke: currentColor; stroke-width: 2; }
.gear.stopped .gear-teeth { animation: none; }
.robot.happy { animation: hop 0.9s ease-in-out infinite; }
.sweat { fill: var(--ui-info, #38bdf8); opacity: 0; animation: sweat 2.4s ease-in infinite; }
.mouth { animation: mouth 1.6s ease-in-out infinite alternate; transform-origin: 51px 57px; }
.cloud { fill: var(--ui-bg, #fff); stroke: currentColor; stroke-width: 2.2; }
.dot { fill: var(--ui-bg, #fff); stroke: currentColor; stroke-width: 2; }
.bubble .dot.d3, .bubble .dot.d4, .bubble .dot.d5 { fill: currentColor; stroke: none; transform-box: fill-box; transform-origin: center; animation: dots 1.5s ease-in-out infinite; }
.bubble .dot.d4 { animation-delay: 0.25s; }
.bubble .dot.d5 { animation-delay: 0.5s; }
.bubble .dot.d1, .bubble .dot.d2 { animation: float 2.6s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
.bubble .dot.d2 { animation-delay: 0.3s; }
.robot { animation: bob 2.8s ease-in-out infinite; transform-origin: 52px 90px; }
.gear-ring { fill: var(--ui-bg-elevated, #f3f4f6); stroke: currentColor; stroke-width: 2.4; }
.gear-teeth rect { fill: currentColor; }
.gear-teeth { animation: spin 4s linear infinite; }
.gear-hole { fill: var(--ui-bg, #fff); stroke: currentColor; stroke-width: 2; }

@keyframes pupil-look {
  0%, 100% { transform: translate(0, 0); }
  25% { transform: translate(2.5px, -3px); }
  60% { transform: translate(-2px, -3px); }
}
@keyframes blink { 50% { opacity: 0.25; } }
@keyframes scratch { from { transform: rotate(-14deg); } to { transform: rotate(10deg); } }
@keyframes sweat {
  0%, 25% { opacity: 0; transform: translateY(-4px); }
  45% { opacity: 1; }
  100% { opacity: 0; transform: translateY(16px); }
}
@keyframes mouth { from { transform: scaleX(0.85); } to { transform: scaleX(1.1); } }
@keyframes dots { 0%, 100% { transform: scale(0.5); opacity: 0.4; } 40% { transform: scale(1.3); opacity: 1; } }
@keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
@keyframes bob { 0%, 100% { transform: rotate(-1.5deg); } 50% { transform: rotate(1.5deg); } }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes wave { from { transform: rotate(-30deg); } to { transform: rotate(14deg); } }
@keyframes twinkle { 0%, 100% { transform: scale(0.4) rotate(0); opacity: 0.4; } 50% { transform: scale(1.2) rotate(30deg); opacity: 1; } }
@keyframes hop { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }

@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; }
}
</style>
