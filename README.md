# memi-board

Firebase 기반 게시판을 호스트 앱에 붙이는 Vue 컴포넌트 패키지입니다. 게시글 CRUD, 첨부파일, 실시간 댓글, 작성자·관리자 권한, Firebase AI Logic 기반 콘텐츠 검열을 제공합니다.

`memi-board`는 Nuxt 모듈이 아닙니다. Firebase와 VueFire 초기화, 페이지 라우팅은 호스트가 담당하고 패키지는 컴포넌트와 composable만 제공합니다. 현재 UI는 `@nuxt/ui` v4 컴포넌트를 사용하므로 Nuxt UI가 구성된 Vue/Nuxt 앱을 대상으로 합니다.

## 요구 사항

- Vue 3.5+
- Vue Router 4.5+
- Firebase Web SDK 12+
- VueFire 3.2+
- Nuxt UI 4+

## 설치

```bash
pnpm add memi-board firebase vuefire
```

Nuxt에서는 호스트 앱이 `@nuxt/ui`와 `nuxt-vuefire`를 설정해야 합니다.

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@nuxt/ui', 'nuxt-vuefire'],
  vuefire: {
    config: {
      apiKey: '...',
      authDomain: '...',
      projectId: '...',
      storageBucket: '...',
      messagingSenderId: '...',
      appId: '...'
    },
    auth: { enabled: true }
  },
  routeRules: {
    '/board/**': { ssr: false }
  }
})
```

호스트 플러그인에서 게시판을 한 번 설정합니다. Firebase 앱을 다시 초기화하지 않습니다.

```ts
// app/plugins/memi-board.ts
import { configureMemiBoard } from 'memi-board'

export default defineNuxtPlugin(() => {
  configureMemiBoard({
    collectionPrefix: 'board',
    auth: { providers: ['google', 'apple'] },
    moderation: { enabled: true, onError: 'allow' }
  })
})
```

Nuxt UI의 Tailwind 스캐너가 npm 패키지의 레이아웃 클래스를 포함하도록 앱의 기본 CSS에 source를 추가합니다.

```css
/* app/assets/css/main.css */
@import "tailwindcss";
@import "@nuxt/ui";
@source "../../../node_modules/memi-board/dist";
```

프로젝트 구조에 따라 `node_modules`까지의 상대 경로는 조정하세요.

## 페이지 연결

패키지가 라우트를 자동 생성하지 않으므로 호스트에서 페이지를 직접 만듭니다.

```vue
<!-- app/pages/board/index.vue -->
<script setup lang="ts">
import { MemiBoardList, MemiBoardSignIn, useMemiBoardAuth } from 'memi-board'

const { isSignedIn } = useMemiBoardAuth()
</script>

<template>
  <MemiBoardList link-base="/board" />
  <MemiBoardSignIn v-if="!isSignedIn" />
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
    :post-id="String(route.params.id)"
    @edit="id => router.push(`/board/${id}/edit`)"
    @deleted="router.push('/board')"
  />
</template>
```

글쓰기와 수정 페이지에는 호스트 앱의 로그인 미들웨어를 적용하고 `MemiBoardEditor`를 배치합니다.

## 공개 API

컴포넌트:

- `MemiBoardList`
- `MemiBoardDetail`
- `MemiBoardEditor`
- `MemiBoardCommentList`
- `MemiBoardCommentForm`
- `MemiBoardAttachments`
- `MemiBoardSignIn`
- `MemiBoardVersionHistory`

Composable과 설정:

- `configureMemiBoard`
- `useMemiBoardAuth`
- `useMemiBoardPosts`
- `useMemiBoardComments`
- `useMemiBoardStorage`
- `useMemiBoardModeration`

## 로그인 공급자

기본값은 Google과 Apple입니다. 이메일 로그인을 함께 제공하려면 `emailPassword`를 추가합니다.

```ts
configureMemiBoard({
  auth: { providers: ['google', 'apple', 'emailPassword'] }
})
```

각 공급자는 Firebase Console의 Authentication에서 활성화해야 합니다. Apple 로그인은 Apple Developer의 Services ID와 Firebase callback URL 설정도 필요합니다.

## Security Rules

이 패키지는 클라이언트 전용이므로 실제 권한 검증은 Firestore와 Storage Security Rules가 담당합니다.

- [`docs/firestore.rules.example`](docs/firestore.rules.example)
- [`docs/storage.rules.example`](docs/storage.rules.example)

예제의 `memiBoard` prefix는 `configureMemiBoard()`의 `collectionPrefix`와 동일하게 변경해 호스트 규칙에 병합해야 합니다.

권한 모델:

- 글·댓글 작성: 로그인 필요
- 글 수정·삭제: 작성자 또는 게시판 관리자
- 댓글 삭제: 댓글 작성자, 부모 게시글 작성자 또는 게시판 관리자
- 관리자 역할: `{prefix}Users/{uid}.role = 'admin'`을 Firebase Console 등 신뢰할 수 있는 관리 경로에서 설정

## AI 검열

검열을 활성화하면 로컬 차단어 검사 후 Firebase AI Logic을 사용합니다. AI 요청은 클라이언트에서 실행되므로 Firestore 직접 쓰기를 통한 우회를 완전히 막지는 못합니다. 악용 위험이 큰 서비스는 서버 검증을 추가해야 합니다.

Firebase AI Logic과 App Check 초기화는 호스트 앱이 담당합니다.

## 패키지 개발 및 배포 검사

```bash
pnpm install
pnpm run typecheck
pnpm run build
pnpm pack --dry-run
```

## 라이선스

[MIT](LICENSE)
