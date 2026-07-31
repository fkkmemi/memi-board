# memi-board

Nuxt 4 + Nuxt UI 프로젝트에 Firebase 기반 게시판을 바로 붙이는 모듈. 게시글 CRUD, 첨부파일(Storage), 댓글, 권한(작성자 본인/관리자), Firebase AI Logic(Gemini) 기반 AI 검열을 제공한다.

클라이언트 전용이다 — 서버나 Firebase Admin SDK가 필요 없다. 소비 프로젝트가 자신의 Firebase 프로젝트 설정만 넘기면 동작한다.

## 설치

```bash
pnpm add memi-board @nuxt/ui
```

`nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  modules: ['@nuxt/ui', 'memi-board'],
  memiBoard: {
    firebaseConfig: {
      apiKey: '...',
      authDomain: '...',
      projectId: '...',
      storageBucket: '...',
      messagingSenderId: '...',
      appId: '...',
    },
    // 이 옵션들이 기본값이며, 필요에 따라 덮어쓸 수 있다
    collectionPrefix: 'memiBoard',
    auth: { providers: ['google', 'apple'] }, // 'emailPassword'도 선택 가능
    moderation: { enabled: true, onError: 'allow' },
    pages: false, // true로 하면 /board 하위 라우트를 자동 등록한다
  },
})
```

내부적으로 [nuxt-vuefire](https://vuefire.vuejs.org/nuxt/)를 설치해서 Firebase Auth/Firestore/Storage에 연동한다. Admin SDK는 사용하지 않는다.

> ⚠️ **설치는 여기서 끝이 아니다.** 이 모듈은 서버가 없어서 Firestore/Storage Security Rules를 직접 배포해야 글쓰기·댓글이 동작한다 — 아래 [Security Model](#security-model--반드시-읽어야-하는-부분) 섹션을 반드시 따라 한다. 건너뛰면 글쓰기 버튼을 눌렀을 때 `permission-denied`가 난다.

### 이미 `nuxt-vuefire`를 쓰는 프로젝트에 붙이는 경우

호스트 프로젝트가 (자체 서버 기능 등으로) 이미 `nuxt-vuefire`를 설치해 뒀다면, 이 모듈은 그걸 다시 설치하지 않고 그대로 재사용한다 — `nuxt-vuefire` 자체엔 중복 설치를 막는 장치가 없어서, 안 그러면 플러그인·서버 라우트가 두 번 등록돼 문제가 생길 수 있다. 이 경우:

- 호스트 쪽 `nuxt-vuefire` 설정에 `auth: { enabled: true }`가 켜져 있어야 이 모듈의 로그인·역할 기능이 동작한다.
- `memiBoard.firebaseConfig`는 그대로 적어도 되지만(옵션 스키마 유지 목적), 실제로는 호스트가 이미 초기화한 Firebase 앱을 그대로 쓴다.
- `memiBoard.appCheck`/`emulators` 옵션은 이 경우 무시된다 — 호스트 쪽 `nuxt-vuefire` 설정을 따른다.

## 사용법

### `pages: true` — 가장 빠른 시작

옵션만 켜면 `/board` (목록/상세/글쓰기/수정) 라우트가 자동으로 생긴다. 경로를 바꾸려면 `pages: { base: '/community' }`.

### 컴포넌트 직접 배치

라우팅을 직접 관리하고 싶다면 `pages: false`(기본값)로 두고 컴포넌트를 원하는 페이지에 배치한다:

```vue
<!-- pages/community/index.vue -->
<template>
  <MemiBoardList link-base="/community" />
</template>
```

```vue
<!-- pages/community/[id].vue -->
<template>
  <MemiBoardDetail :post-id="$route.params.id" @edit="..." @deleted="..." />
</template>
```

제공하는 컴포넌트: `MemiBoardList`, `MemiBoardDetail`, `MemiBoardEditor`, `MemiBoardCommentList`, `MemiBoardCommentForm`, `MemiBoardAttachments`, `MemiBoardSignIn`, `MemiBoardVersionHistory`.
제공하는 composable: `useMemiBoardAuth`, `useMemiBoardPosts`, `useMemiBoardComments`, `useMemiBoardStorage`, `useMemiBoardModeration`, `useMemiBoardSettings`.

### 카테고리

`useMemiBoardSettings()`가 `{prefix}Settings/config` 문서에서 카테고리 목록(`categories: { id, label }[]`)을 읽어온다. `MemiBoardEditor`는 이 목록으로 카테고리 선택 UI를 보여주고, `MemiBoardList`/`MemiBoardDetail`은 글의 `category` 필드를 뱃지로 표시한다.

설정 문서가 아직 없으면 기본 카테고리(자유/공지/질문)로 계속 동작한다 — 관리자(`{prefix}Users/{uid}.role == 'admin'`)가 게시판에 처음 들어오는 순간 그 기본값으로 문서가 자동 생성되고, 이후엔 Firebase 콘솔에서 `{prefix}Settings/config.categories` 배열을 직접 수정하면 된다(카테고리 관리 UI는 아직 없음).

### 로그인 공급자

기본값은 `['google', 'apple']`이고, `'emailPassword'`도 배열에 추가할 수 있다.

- **Google**: Firebase 콘솔 → Authentication → Sign-in method에서 Google 활성화만 하면 된다.
- **Apple**: Firebase 콘솔에서 Apple 활성화 외에, Apple Developer 계정에서 **Services ID**를 만들고 콜백 도메인(`{authDomain}`, `https://{authDomain}/__/auth/handler`)을 등록해야 한다. Team ID / Key ID / 개인 키(.p8)까지 Firebase 콘솔에 입력해야 실제로 동작한다 — [Firebase 공식 가이드](https://firebase.google.com/docs/auth/web/apple) 참고. 이 설정 없이 Apple 로그인 버튼을 누르면 에러가 난다.

### 버전 히스토리 페이지

`pages: true`면 `${base}/version-history`(기본 `/board/version-history`)에 이 모듈의 버전 히스토리 페이지가 자동으로 생긴다 — 게시판을 설치한 사이트의 방문자도 "이 게시판에 어떤 기능이 있는지/뭐가 달라졌는지" 바로 볼 수 있다. `pages: false`로 직접 배치하는 경우엔 `<MemiBoardVersionHistory />` 컴포넌트만 원하는 곳에 넣으면 된다.

## Security Model — 반드시 읽어야 하는 부분

이 모듈은 서버가 없다. **모든 권한 검증은 Firestore/Storage Security Rules가 전부다.** 아래 두 파일을 프로젝트에 병합하는 것만으로는 부족하다 — **실제로 Firebase에 배포해야** 글쓰기·댓글·첨부파일이 동작한다. 로컬 `.rules` 파일만 고쳐두고 배포를 잊으면 글쓰기 버튼을 눌렀을 때 `permission-denied`가 난다(가장 흔한 설치 실수).

1. [`docs/firestore.rules.example`](docs/firestore.rules.example) — 호스트 프로젝트의 `firestore.rules`에 병합
2. [`docs/storage.rules.example`](docs/storage.rules.example) — 호스트 프로젝트의 `storage.rules`에 병합
3. **배포까지 실행**:
   ```bash
   firebase deploy --only firestore:rules,storage
   ```
   (호스트 프로젝트에 이미 `firestore.rules`/`storage.rules`가 배포 파이프라인에 연결돼 있다면, 평소 쓰던 배포 명령에 이 파일들이 포함돼 있는지 확인한다.)

권한 모델:
- 글/댓글 작성 → 로그인 필요
- 수정/삭제 → 작성자 본인 또는 `role: 'admin'`
- 관리자 승격은 이 모듈이 절대 하지 않는다. Firebase 콘솔에서 `{collectionPrefix}Users/{uid}` 문서의 `role` 필드를 직접 `'admin'`으로 바꿔야 한다.

**알려진 한계**: AI 검열은 클라이언트에서만 실행된다. 악의적 사용자가 Firestore SDK로 직접 우회 쓰기하면 검열을 피할 수 있다 — 서버가 없는 아키텍처의 근본적인 한계이며, 이 모듈은 이를 해결하려 하지 않는다. 악용 위험이 큰 프로젝트라면 별도로 Cloud Functions 검증 트리거를 추가하는 것을 권장한다(이 모듈의 범위 밖).

## Firebase AI Logic (AI 검열)

`moderation.enabled`가 true(기본값)면 글/댓글 제출 전에 로컬 비속어 필터 → Gemini 검열을 순서대로 실행하고, 걸리면 제출 자체를 막는다(`moderation.onError`로 검열 서비스 장애 시 허용/차단 정책을 정한다, 기본은 `'allow'`).

Firebase AI Logic을 쓰려면 Firebase 콘솔에서 AI Logic(Gemini Developer API)을 활성화하고, 남용 방지를 위해 App Check도 함께 설정하는 것을 권장한다(`appCheck` 옵션).

## 로컬 개발 (이 리포 자체를 수정할 때)

```bash
pnpm install
pnpm dev:prepare
pnpm dev   # playground 실행, http://localhost:3000
```

Firebase 없이 빠르게 테스트하려면 [Firebase Local Emulator Suite](https://firebase.google.com/docs/emulator-suite)를 쓴다:

```bash
firebase emulators:start --project demo-memi-board
NUXT_PUBLIC_USE_EMULATORS=1 pnpm dev
```

## 버전 정보

- 사이트에 설치된 상태에서 보기: `<MemiBoardVersionHistory />` 컴포넌트, 또는 `pages: true`일 때 `/board/version-history`
- 코드 수준의 자세한 변경 내역: [CHANGELOG.md](CHANGELOG.md)

## 라이선스

MIT
