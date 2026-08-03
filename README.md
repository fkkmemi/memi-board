# memi-board

Nuxt 4 + Nuxt UI 프로젝트에 Firebase 기반 게시판을 바로 붙이는 패키지. 게시글 CRUD, 첨부파일(Storage), 댓글, 권한(작성자 본인/관리자), Firebase AI Logic(Gemini) 기반 AI 검열을 제공한다.

클라이언트 전용이다 — 서버나 Firebase Admin SDK가 필요 없다. 소비 프로젝트가 자신의 Firebase 프로젝트 설정만 넘기면 동작한다.

**Nuxt 모듈이 아니라 순수 Vue 3 컴포넌트/composable 패키지다.** `nuxt.config`를 건드리거나 `nuxt-vuefire`를 대신 설치해주지 않는다 — 호스트 프로젝트가 이미 자기 앱을 위해 갖추고 있을 Firebase/nuxt-vuefire 설정을 그대로 재사용하고, memi-board는 그 위에 컴포넌트와 composable만 얹는다. 여러 프로젝트에서 같은 게시판을 재사용하는 게 1차 목적이라, "설정 지점 하나(호스트 프로젝트)"를 유지하는 쪽을 우선했다.

## 설치

**사전 준비물**: Node.js + pnpm, Nuxt 4+ / `@nuxt/ui` 4+, Firestore·Storage·Authentication을 켜둔 Firebase 프로젝트, Firebase CLI(`firebase login` 완료, `firebase.json`/`.firebaserc` 연결). 아직 하나라도 없다면 → [docs/firebase-setup.md](docs/firebase-setup.md)에서 처음부터 순서대로 설명한다.

```bash
pnpm add memi-board @nuxt/ui nuxt-vuefire vuefire firebase
```

`vuefire`/`firebase`/`vue-router`는 `peerDependencies`다 — 반드시 프로젝트에 직접 설치해야 한다(`vue-router`는 Nuxt가 내부적으로 이미 갖고 있어 보통 별도 설치가 필요 없다). memi-board가 자체적으로 이 패키지들을 번들하지 않는 이유는, 그러면 호스트 프로젝트가 설치한 버전과 memi-board 내부 버전이 **서로 다른 모듈 인스턴스**가 돼서 `useCurrentUser()`가 항상 `undefined`를 반환하거나 "VueFireAuth module was added" 에러가 나기 때문이다(vuefire의 인증 상태는 모듈 인스턴스별 내부 상태로 관리됨). 직접 설치하면 하나로 합쳐진다. `nuxt-vuefire`는 memi-board의 peer는 아니지만(memi-board는 vuefire만 직접 쓴다), Nuxt에서 Firebase를 연동하려면 결국 필요하다.

### 1. 호스트가 nuxt-vuefire를 직접 설정한다

`nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  modules: ['@nuxt/ui', 'nuxt-vuefire'],
  vuefire: {
    config: {
      apiKey: '...',
      authDomain: '...',
      projectId: '...',
      storageBucket: '...',
      messagingSenderId: '...',
      appId: '...',
    },
    auth: { enabled: true },
  },
})
```

`firebaseConfig` 값은 Firebase 콘솔 → 프로젝트 설정 → 일반 → "내 앱"에서 복사한다 (자세한 위치는 [docs/firebase-setup.md](docs/firebase-setup.md#3-firebaseconfig-값-가져오기) 참고). 이미 다른 기능(예: 매장 운영자 로그인 등) 때문에 nuxt-vuefire를 쓰고 있는 프로젝트라면 이 단계는 그대로 건너뛴다 — memi-board는 그 설정을 그대로 재사용한다.

### 2. memi-board를 설정한다

플러그인 파일 하나(예: `app/plugins/memi-board.ts`)에서 앱 부팅 시 한 번 호출한다:

```ts
import { configureMemiBoard } from 'memi-board'

export default defineNuxtPlugin(() => {
  configureMemiBoard({
    collectionPrefix: 'board', // Firestore 컬렉션 접두사 (boardPosts, boardUsers, boardSettings)
    auth: { providers: ['google', 'apple'] }, // 'emailPassword'도 선택 가능
    moderation: { enabled: true, onError: 'allow' },
  })
})
```

값을 넘기지 않으면 `collectionPrefix: 'memiBoard'`, `auth.providers: ['google', 'apple']`, `moderation.enabled: true`가 기본값이다.

### 3. Tailwind가 memi-board 컴포넌트를 스캔하게 한다

Tailwind v4는 기본적으로 `node_modules`를 스캔 대상에서 제외한다 — memi-board의 컴포넌트가 쓰는 유틸리티 클래스(`flex`, `gap-2` 등)가 호스트의 최종 CSS에 아예 생성되지 않아 **레이아웃이 깨진 채로(스타일 없이) 렌더링**된다. 호스트의 CSS 진입점에 `@source`로 memi-board의 빌드 결과물을 명시적으로 추가해야 한다:

```css
/* app/assets/css/main.css */
@import "tailwindcss";
@import "@nuxt/ui";
@source "../../../node_modules/memi-board/dist";
```

프로젝트 구조에 따라 `node_modules`까지의 상대 경로는 조정한다(CSS 파일 기준 상대 경로).

> ⚠️ **설치는 여기서 끝이 아니다.** 이 패키지는 서버가 없어서 Firestore/Storage Security Rules를 직접 배포해야 글쓰기·댓글이 동작한다 — 아래 [Security Model](#security-model--반드시-읽어야-하는-부분) 섹션을 반드시 따라 한다. 건너뛰면 글쓰기 버튼을 눌렀을 때 `permission-denied`가 난다.

## 사용법

컴포넌트를 원하는 페이지에 직접 배치한다 — 라우팅은 항상 호스트 프로젝트가 소유한다.

```vue
<!-- app/pages/board/index.vue -->
<script setup lang="ts">
import { MemiBoardList, MemiBoardSignIn, useMemiBoardAuth } from 'memi-board'
const { isSignedIn } = useMemiBoardAuth()
</script>

<template>
  <div>
    <UButton v-if="isSignedIn" to="/board/new" label="새 글쓰기" />
    <MemiBoardList link-base="/board" />
    <MemiBoardSignIn v-if="!isSignedIn" />
  </div>
</template>
```

```vue
<!-- app/pages/board/[id].vue -->
<script setup lang="ts">
import { MemiBoardDetail } from 'memi-board'
const route = useRoute()
const router = useRouter()
</script>

<template>
  <MemiBoardDetail
    :post-id="route.params.id as string"
    @edit="router.push(`/board/${route.params.id}/edit`)"
    @deleted="router.push('/board')"
  />
</template>
```

글쓰기(`/board/new`)·수정(`/board/[id]/edit`) 라우트는 로그인 여부를 호스트가 직접 가드한다 — memi-board는 라우트 미들웨어를 제공하지 않는다(라우팅은 호스트 관심사):

```ts
// app/middleware/board-auth.ts
import { getCurrentUser } from 'vuefire'

export default defineNuxtRouteMiddleware(async () => {
  const user = await getCurrentUser()
  if (!user) return navigateTo('/board')
})
```

```vue
<!-- app/pages/board/new.vue -->
<script setup lang="ts">
import { MemiBoardEditor } from 'memi-board'
definePageMeta({ middleware: 'board-auth' })
const router = useRouter()
</script>

<template>
  <MemiBoardEditor @saved="(id) => router.push(`/board/${id}`)" @cancel="router.push('/board')" />
</template>
```

`playground/app/pages/board/`에 목록·상세·글쓰기·수정·버전히스토리 5개 페이지 전체 예시가 있다 — 그대로 복사해서 시작해도 된다.

제공하는 컴포넌트: `MemiBoardList`, `MemiBoardDetail`, `MemiBoardEditor`, `MemiBoardCommentList`, `MemiBoardCommentForm`, `MemiBoardAttachments`, `MemiBoardSignIn`, `MemiBoardVersionHistory`.
제공하는 composable: `useMemiBoardAuth`, `useMemiBoardPosts`, `useMemiBoardComments`, `useMemiBoardStorage`, `useMemiBoardModeration`, `useMemiBoardSettings`.

### 카테고리

`useMemiBoardSettings()`가 `{prefix}Settings/config` 문서에서 카테고리 목록(`categories: { id, label }[]`)을 읽어온다. `MemiBoardEditor`는 이 목록으로 카테고리 선택 UI를 보여주고, `MemiBoardList`/`MemiBoardDetail`은 글의 `category` 필드를 뱃지로 표시한다.

설정 문서가 아직 없으면 기본 카테고리(자유/공지/질문)로 계속 동작한다 — 관리자(`{prefix}Users/{uid}.role == 'admin'`)가 게시판에 처음 들어오는 순간 그 기본값으로 문서가 자동 생성되고, 이후엔 Firebase 콘솔에서 `{prefix}Settings/config.categories` 배열을 직접 수정하면 된다(카테고리 관리 UI는 아직 없음).

### 로그인 공급자

`configureMemiBoard({ auth: { providers: [...] } })`의 기본값은 `['google', 'apple']`이고, `'emailPassword'`도 배열에 추가할 수 있다.

- **Google**: Firebase 콘솔 → Authentication → Sign-in method에서 Google 활성화만 하면 된다.
- **Apple**: Firebase 콘솔 활성화 외에 Apple Developer 쪽 Services ID·키 발급이 추가로 필요하다 — 순서대로: [docs/firebase-setup.md](docs/firebase-setup.md#apple). 이 설정 없이 버튼을 누르면 에러가 난다.

### 버전 히스토리 페이지

`<MemiBoardVersionHistory />` 컴포넌트를 원하는 페이지(예: `app/pages/board/version-history.vue`)에 배치하면, 게시판을 설치한 사이트의 방문자도 "이 게시판에 어떤 기능이 있는지/뭐가 달라졌는지" 바로 볼 수 있다.

## Security Model — 반드시 읽어야 하는 부분

이 패키지는 서버가 없다. **모든 권한 검증은 Firestore/Storage Security Rules가 전부다.** 아래 두 파일을 프로젝트에 병합하는 것만으로는 부족하다 — **실제로 Firebase에 배포해야** 글쓰기·댓글·첨부파일이 동작한다. 로컬 `.rules` 파일만 고쳐두고 배포를 잊으면 글쓰기 버튼을 눌렀을 때 `permission-denied`가 난다(가장 흔한 설치 실수).

1. [`docs/firestore.rules.example`](docs/firestore.rules.example) — 호스트 프로젝트의 `firestore.rules`에 병합
2. [`docs/storage.rules.example`](docs/storage.rules.example) — 호스트 프로젝트의 `storage.rules`에 병합
3. **배포까지 실행**:
   ```bash
   firebase deploy --only firestore:rules,storage
   ```
   (호스트 프로젝트에 이미 `firestore.rules`/`storage.rules`가 배포 파이프라인에 연결돼 있다면, 평소 쓰던 배포 명령에 이 파일들이 포함돼 있는지 확인한다. Firebase CLI를 처음 연결하는 프로젝트라면 [docs/firebase-setup.md](docs/firebase-setup.md#4-호스트-프로젝트를-firebase-cli에-연결)부터 본다.)

권한 모델:
- 글/댓글 작성 → 로그인 필요
- 수정/삭제 → 작성자 본인 또는 `role: 'admin'`
- 관리자 승격은 이 패키지가 절대 하지 않는다. Firebase 콘솔에서 `{collectionPrefix}Users/{uid}` 문서의 `role` 필드를 직접 `'admin'`으로 바꿔야 한다.

**알려진 한계**: AI 검열은 클라이언트에서만 실행된다. 악의적 사용자가 Firestore SDK로 직접 우회 쓰기하면 검열을 피할 수 있다 — 서버가 없는 아키텍처의 근본적인 한계이며, 이 패키지는 이를 해결하려 하지 않는다. 악용 위험이 큰 프로젝트라면 별도로 Cloud Functions 검증 트리거를 추가하는 것을 권장한다(이 패키지의 범위 밖).

## Firebase AI Logic (AI 검열)

`configureMemiBoard({ moderation: { enabled: true, ... } })`(기본값)면 글/댓글 제출 전에 로컬 비속어 필터 → Gemini 검열을 순서대로 실행하고, 걸리면 제출 자체를 막는다(`moderation.onError`로 검열 서비스 장애 시 허용/차단 정책을 정한다, 기본은 `'allow'`).

Firebase AI Logic을 쓰려면 Firebase 콘솔에서 AI Logic(Gemini Developer API)을 활성화해야 한다 — **무료(Spark) 요금제에서는 제한되거나 안 될 수 있어 Blaze(종량제)가 필요할 수 있다.** 남용 방지를 위해 App Check도 함께 설정하는 것을 권장한다 — App Check는 memi-board가 아니라 호스트의 `vuefire` 설정(`appCheck` 옵션)에서 켠다. **App Check는 옵션을 켠다고 자동으로 강제되지 않는다** — Firebase 콘솔 → App Check에서 Firestore/Storage 각각 "Enforce"를 따로 켜야 실제로 거부가 시작된다. 설정 단계는 [docs/firebase-setup.md](docs/firebase-setup.md#8-app-check-설정-선택-권장)에 자세히 있다.

## 문제 해결

### `[VueFire] useCurrentUser() called before the VueFireAuth module was added to the VueFire plugin`

`nuxt-vuefire`/`vuefire`/`firebase`를 프로젝트에 직접 설치하지 않았을 때, 또는 호스트의 `vuefire.auth.enabled`가 꺼져 있을 때 나는 에러다(위 [설치](#설치) 참고). pnpm 기준으로 `pnpm why vuefire`를 실행했을 때 `vuefire`가 두 개 이상의 서로 다른 버전/인스턴스로 나오면 그게 원인이다 — 하나로 합쳐질 때까지 lockfile을 정리하거나(`pnpm dedupe`), 세 패키지 버전을 프로젝트와 memi-board의 `peerDependencies` 범위에 맞게 맞춘다.

### 설치는 됐는데 카테고리·설정이 하나도 안 보인다

관리자(`role: 'admin'`)가 게시판에 한 번도 들어온 적이 없으면 `{prefix}Settings/config` 문서가 아직 자동 생성되지 않은 상태다 — 코드 내장 기본값(자유/공지/질문)으로 정상 동작 중인 것이니 에러가 아니다. 관리자 계정으로 게시판에 한 번 들어가면 생긴다.

## 로컬 개발 (이 리포 자체를 수정할 때)

```bash
pnpm install
pnpm build         # src/ → dist/ (한 번 빌드해 둬야 playground가 'memi-board'를 resolve할 수 있다)
pnpm dev:prepare
pnpm dev           # playground 실행, http://localhost:3000
```

`src/`를 수정하면서 바로 반영해서 보고 싶으면 다른 터미널에서:

```bash
pnpm build:watch   # vite build --watch — src/ 변경 시마다 dist/를 다시 빌드
```

Firebase 없이 빠르게 테스트하려면 [Firebase Local Emulator Suite](https://firebase.google.com/docs/emulator-suite)를 쓴다:

```bash
firebase emulators:start --project demo-memi-board
NUXT_PUBLIC_USE_EMULATORS=1 pnpm dev
```

## 버전 정보

- 사이트에 설치된 상태에서 보기: `<MemiBoardVersionHistory />` 컴포넌트를 원하는 페이지에 배치
- 코드 수준의 자세한 변경 내역: [CHANGELOG.md](CHANGELOG.md)

## 라이선스

MIT
