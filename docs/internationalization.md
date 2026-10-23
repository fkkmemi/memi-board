# 국제화와 콘텐츠 번역 설정

[설치 가이드](host-integration.md) · [README](../README.md) · [Firebase 준비](firebase-setup.md)

`i18n.enabled`·`translation.enabled`는 **memi-board 0.47.0 이상**에서 지원한다. 기존 호스트는 `pnpm add memi-board@^0.47.0`으로 업데이트하고 lockfile도 함께 반영한다.

## 1. 서비스에 맞는 모드 고르기

**UI 언어**는 저장·취소·안내문·날짜 같은 화면 문구의 언어다. **콘텐츠 번역**은 게시판 이름·설명, 섹션 제목, 글 제목·요약·본문을 다른 언어로 생성하고 표시하는 기능이다.

| 사용 목적 | `i18n.enabled` | `translation.enabled` | 동작 |
|---|---|---|---|
| 한국어 또는 영어만 사용하는 사이트 | `false` | 지정 불필요 | `locale`로 UI 고정, 콘텐츠 원문 표시, 번역 기능 숨김 |
| 다국어 UI만 필요한 사이트 | `true` | `false` | UI 언어 전환, 콘텐츠 원문 표시, 번역 기능 숨김 |
| 다국어 UI와 콘텐츠 번역이 필요한 사이트 | `true` | `true` | UI 언어 전환과 콘텐츠 번역 모두 사용 |
| 기존 설정 그대로 | 생략 | 생략 | 두 옵션 모두 기본 `true` |

`i18n.enabled: false`가 우선한다. 이때 `translation.enabled: true`를 지정해도 콘텐츠 번역은 실행하지 않는다. 두 기능을 끄더라도 기존 번역 데이터는 삭제하지 않는다.

## 2. 복사해서 사용할 설정

아래 `memiBoard` 블록을 호스트의 `defineNuxtConfig({ ... })` 안에 넣는다. Firebase 초기화 등 나머지 설정은 [설치 가이드](host-integration.md)를 따른다.

### 한 언어로만 운영

```ts
memiBoard: {
  locale: 'ko', // 영어 전용이면 'en'
  i18n: { enabled: false }
}
```

- 호스트의 현재 언어와 게시판별 언어를 무시하고 `locale`를 사용한다. 생략하거나 지원하지 않는 값이면 `ko`다.
- 게시판 언어 선택, 번역 버튼, 자동 번역 토글, 글쓰기 AI의 번역 메뉴를 숨긴다.
- 저장된 번역이 있어도 콘텐츠는 원문으로 표시한다.
- 게시판의 자동 번역 토글이 이전에 켜져 있어도 설정 저장 시 번역하지 않는다.
- `@nuxtjs/i18n`을 설치할 필요가 없다. 호스트가 이미 쓰고 있어도 게시판은 지정 언어로 고정된다.

### UI는 다국어, 콘텐츠는 원문

```ts
memiBoard: {
  locale: 'ko',
  i18n: { enabled: true },
  translation: { enabled: false }
}
```

게시판 언어 선택은 유지하고 번역 관련 UI만 숨긴다. 메뉴·버튼·날짜는 현재 화면 언어를 따르고, 게시판 라벨·설명·섹션 제목·게시글은 작성한 원문을 보여 준다.

### UI와 콘텐츠 번역 모두 사용

```ts
memiBoard: {
  locale: 'ko',
  i18n: { enabled: true },
  translation: { enabled: true }
}
```

번역을 생성하려면 호스트 Firebase 프로젝트에 AI Logic 연결을 준비해야 한다. UI 언어 파일을 보여 주는 것만으로는 AI 요청이 발생하지 않는다.

## 3. 호스트의 언어 전환 연결

지원 언어는 `ko`, `en`, `ja`, `de`, `fr`, `es`, `pt`, `zh`, `ar`, `id`다. `en-US`·`pt_BR` 같은 값은 지원 코드로 정규화한다. `i18n.enabled`가 켜져 있을 때 언어 결정 순서는 다음과 같다.

1. 게시판 설정의 고정 언어
2. 부모 게시판 화면이 전달한 언어
3. 호스트 `@nuxtjs/i18n`의 현재 언어
4. `memiBoard.locale`
5. `ko`

사이트 언어 전환을 그대로 따르려면 게시판 설정의 언어를 **자동**으로 둔다. 게시판 언어를 따로 고정하면 사이트 언어보다 우선한다.

호스트에 `@nuxtjs/i18n`을 사용하는 경우:

```ts
// nuxt.config.ts — 기존 설정에 병합
modules: ['@nuxt/ui', '@nuxtjs/i18n', 'nuxt-vuefire', 'memi-board'],
i18n: {
  locales: [
    { code: 'ko', language: 'ko-KR', name: '한국어', file: 'ko.json' },
    { code: 'en', language: 'en-US', name: 'English', file: 'en.json' }
  ],
  defaultLocale: 'ko',
  strategy: 'no_prefix',
  langDir: 'locales/'
},
memiBoard: {
  i18n: { enabled: true },
  translation: { enabled: false }
}
```

이 예제는 한국어·영어 UI만 사용한다. 호스트의 `i18n/locales/ko.json`·`en.json`에 호스트 UI용 메시지를 만든다(처음에는 `{}`도 가능). 게시판 자체의 번역 파일은 패키지가 제공하므로 복사하지 않는다. 나머지 언어도 필요할 때 호스트 목록에 추가한다.

Nuxt UI 내부 문구와 사이트 `<html>` 언어는 호스트가 연결한다. 예를 들어 한국어·영어 호스트는 `app/app.vue`에서 다음처럼 설정할 수 있다.

```vue
<script setup lang="ts">
import { en, ko } from '@nuxt/ui/locale'
const { locale } = useI18n()
const uiLocale = computed(() => locale.value === 'en' ? en : ko)
useHead({ htmlAttrs: { lang: () => uiLocale.value.code, dir: () => uiLocale.value.dir } })
</script>

<template>
  <UApp :locale="uiLocale">
    <NuxtPage />
  </UApp>
</template>
```

레이아웃을 사용하는 사이트는 기존 `<NuxtLayout>` 구조를 유지한다. 게시판이 단일 언어이고 호스트는 다국어인 경우, 사이트 전체의 `<html>`·`UApp` 언어는 호스트 정책대로 결정한다.

## 4. 번역이 실행되고 저장되는 시점

| 대상 | 실행 시점 | 저장 시점 |
|---|---|---|
| 게시판 라벨·설명: 수동 | **10개 언어로 번역** 클릭 | 번역 후 설정의 **저장** 클릭 |
| 게시판 라벨·설명: 자동 | 자동 번역 토글을 켜고 **저장** 클릭 | 번역 완료 후 설정과 함께 저장 |
| 홈 섹션 제목 | 섹션 레이아웃 저장 | 번역 후 레이아웃과 함께 저장 |
| 기존 글의 제목·요약·본문 | 글쓰기 AI의 **10개 언어로 번역해 저장** 클릭 | 번역 완료 후 해당 글에 즉시 저장 |
| 아직 저장하지 않은 새 글 | 글쓰기 AI의 **10개 언어로 번역해 저장** 클릭 | 새 글을 저장할 때 함께 저장 |

10개 언어에는 원문 언어가 포함된다. 원문이 한국어이면 나머지 9개 언어로 번역하고 한국어 원문을 합친다. 번역 버튼을 누르거나 저장할 때까지는 입력만으로 번역 요청을 보내지 않는다.

게시판 이름·설명과 섹션 제목이 번역 당시와 같고 번역이 모두 있으면 재번역을 건너뛴다. 게시판의 자동 번역 토글은 기본 꺼짐이다. `i18n.enabled`·`translation.enabled`의 기본 켜짐은 서비스에서 번역을 사용할 수 있다는 뜻이며, 게시판 자동 번역 토글을 자동으로 켜지는 않는다.

프로그램에서 `translateBoard()`를 직접 호출하면 현재 게시판 자동 번역 토글과 무관하게 번역할 수 있다. 서비스 전체의 국제화·번역 옵션이 꺼져 있으면 원문을 그대로 반환한다.

## 5. AI 연결과 실패 처리

[Firebase 준비 문서](firebase-setup.md)의 AI Logic·App Check 절차를 호스트 프로젝트에 적용한다. Firebase 웹 앱의 `projectId`, `appId`, App Check 등록 대상이 일치해야 한다. 번역 모델과 App Check 토큰 옵션은 기존 `memiBoard.moderation.model`·`moderation.useLimitedUseAppCheckTokens`를 공유한다.

`moderation.enabled: false`는 **검열**을 끄는 설정이다. 번역까지 끄려면 `translation.enabled: false` 또는 `i18n.enabled: false`를 사용한다. 반대로 번역을 꺼도 맞춤법 교정·문장 다듬기 같은 글쓰기 도우미와 검열은 각자의 설정을 따른다.

| 상황 | 처리 |
|---|---|
| 게시판 수동 번역 실패 | 입력 내용을 유지하고 오류 표시. 설정 저장은 사용자가 결정 |
| 게시판 자동 번역 실패 | 설정과 원문은 저장하고 번역 실패 안내 표시 |
| 섹션 번역 실패 | 원문 레이아웃 저장, 콘솔 경고 |
| 게시글 번역 실패 | 오류 표시. 번역 결과 저장 단계로 진행하지 않음 |
| 서비스 옵션으로 번역을 끈 상태 | 자동 번역을 건너뛰고 정상 저장. AI 번역 직접 호출은 `memi-board/translation-disabled` 오류 |

게시글 AI 번역은 언어 수와 무관하게 글쓰기 도우미 일일 사용량 1회로 처리한다. 번역 비활성화에 따른 호출 거절은 AI 요청이나 사용량 갱신 전에 이루어진다. 활성 상태에서 이미 시작한 요청의 실패는 사용량이 차감될 수 있다.

## 6. 기존 데이터와 다시 활성화하기

번역은 기존 문서의 `i18n`·`i18nSource`에 저장하며, 게시글 본문 번역은 해당 본문 문서에 저장한다. 기능을 끄기 위해 데이터 마이그레이션이나 번역 필드 삭제를 할 필요는 없다.

원문이 번역 당시와 다르면 해당 번역 대신 원문을 표시한다. 다시 활성화했을 때도 이 검사를 유지한다. 예를 들어 번역을 끈 동안 게시판 이름을 바꿨다면, 다시 번역하기 전까지 이전 이름의 번역을 보여 주지 않는다.

## 7. 호스트가 직접 만드는 UI

패키지는 자체 UI만 숨긴다. 호스트가 만든 언어 선택기나 번역 버튼은 호스트에서 아래 상태를 사용해 제어한다.

```vue
<script setup lang="ts">
import { useMemiBoardI18n } from 'memi-board/runtime'
const { i18nEnabled, translationEnabled } = useMemiBoardI18n()
</script>

<template>
  <span v-if="i18nEnabled">언어 전환 가능</span>
  <span v-if="translationEnabled">콘텐츠 번역 사용 가능</span>
</template>
```

컴포넌트 밖에서는 `isMemiBoardI18nEnabled()`·`isMemiBoardTranslationEnabled()`를 사용한다. 두 함수는 `memi-board/runtime`에서 명시적으로 가져온다. `configureMemiBoard()`도 같은 옵션을 받지만, Nuxt 호스트에서는 `nuxt.config.ts`의 `memiBoard`만 지정하면 된다.

## 8. 확인할 항목

- 단일 언어: 호스트를 다른 언어로 바꿔도 게시판 버튼·날짜가 지정 언어를 유지하는지 확인한다.
- 콘텐츠 번역만 끄기: UI는 바뀌고 기존 번역이 있는 글도 원문을 표시하는지 확인한다.
- 자동 번역이 켜진 게시판을 저장해도 번역 비활성화 상태에서는 AI 요청이 없는지 확인한다.
- 다시 활성화: 변경되지 않은 원문은 저장된 번역을 쓰고, 변경한 원문은 오래된 번역을 쓰지 않는지 확인한다.
- 번역 실패 시 입력과 설정이 보존되는지 확인한다.

패키지 개발 환경의 회귀 검사는 `pnpm test:i18n`으로 실행한다.
