# memi-board

Nuxt 4 + Nuxt UI + Firebase 프로젝트에 **클라이언트 전용 게시판**을 붙이는 npm 패키지.

- 게시글 CRUD · 댓글 · Storage 첨부 · 카테고리
- 작성자/관리자 권한 (Firestore Rules)
- 로컬 비속어 + Firebase AI Logic(Gemini) 검열 (선택)

**서버 / Firebase Admin 불필요.** 권한은 Rules, 검열은 브라우저(우회 가능 — 아래 한계 참고).

같은 스택(Nuxt 4 · `@nuxt/ui` · `nuxt-vuefire` · Firebase)이면 **다른 호스트 앱에도 그대로 재사용** 가능하다. Firebase 프로젝트는 호스트마다 달라도 되고, 같은 프로젝트를 공유해도 `collectionPrefix`로 컬렉션만 나누면 된다.

## 플랫폼 요구사항

| 항목 | 요구 |
|------|------|
| 런타임 | Nuxt **4+** |
| UI | `@nuxt/ui` **4+** (컴포넌트가 `UButton` 등 auto-import 전제) |
| 데이터 | Firebase **Firestore + Auth + Storage** |
| Vue | `vue` 3.5+, `vuefire` 3.2+, `firebase` 12+ |
| 모듈 | `nuxt-vuefire` (호스트가 설치·설정) |

**의도적으로 하지 않는 일:** Firebase 초기화, 라우트/미들웨어 등록, App Check 초기화, 서버 검열.

## 구조

| 엔트리 | 역할 |
|--------|------|
| `memi-board` | **Nuxt 모듈** — 설정, SFC auto-import, peer dedupe, `dayjs` 개발 서버 최적화 |
| `memi-board/runtime` | composables, types, 유틸리티 (**Vue 컴포넌트 export 없음**) |

일반 사용자는 `nuxt.config.ts`의 `memiBoard`만 설정한다. 별도 Nuxt 플러그인은 필요 없다.

```
호스트 Nuxt 앱
├── nuxt-vuefire + firebaseConfig     ← 인증·Firestore
├── (선택) App Check 플러그인         ← AI Logic Enforce 시 필수에 가까움
├── memi-board                        ← Nuxt 모듈 + 런타임 설정
├── pages/board/*                     ← 라우트는 호스트 소유
└── firestore.rules + storage.rules   ← docs 예시 병합 후 배포
```

## 설치

**사전 준비:** Node + pnpm, Firebase 프로젝트(Firestore·Storage·Auth). 처음부터면 → [docs/firebase-setup.md](docs/firebase-setup.md).

```bash
pnpm add memi-board @nuxt/ui nuxt-vuefire vuefire firebase dayjs
```

`vuefire` / `firebase` / `nuxt-vuefire` / `dayjs`는 **호스트에 직접 설치**한다. TipTap은 `@nuxt/ui`와 `memi-board`가 관리하므로 호스트에서 별도로 설치하거나 버전을 맞출 필요가 없다.

### 1. modules + vuefire

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: [
    '@nuxt/ui',
    'nuxt-vuefire',
    'memi-board',
  ],
  memiBoard: {
    // Firestore: {prefix}Posts, {prefix}Users, {prefix}Settings
    collectionPrefix: 'board',
    auth: { providers: ['google', 'apple'] }, // + 'emailPassword'
    moderation: {
      enabled: true,
      model: 'gemini-3.5-flash-lite',
      onError: 'block', // 'allow' | 'block'
      moderateImages: false,
      useLimitedUseAppCheckTokens: false,
      // localBlocklist: ['금칙어'],
    },
  },
  vuefire: {
    // 콘솔 → 프로젝트 설정 → 내 앱 → 웹 앱 SDK snippet 과 동일해야 함
    // (appId 가 다른 웹 앱이면 App Check / AI Logic 이 실패한다)
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
  routeRules: {
    // 게시판은 Firebase Auth/Firestore를 사용하는 클라이언트 전용 화면이다.
    '/board/**': { ssr: false },
    '/board-settings': { ssr: false },
    '/board-users': { ssr: false },
  },
})
```

`memiBoard` 옵션은 Nuxt 모듈이 런타임 플러그인으로 자동 전달한다. `app/plugins/memi-board.ts`를 만들지 않는다.

### 2. Tailwind `@source` (필수)

패키지 SFC 안의 클래스가 purge되지 않도록:

```css
/* app/assets/css/main.css */
@import "tailwindcss";
@import "@nuxt/ui";
@source "../../../node_modules/memi-board/dist/runtime/components";
```

### 3. Security Rules + 인덱스 배포

1. [docs/firestore.rules.example](docs/firestore.rules.example) → 호스트 `firestore.rules`에 병합  
   (`memiBoard*` 이름을 쓰는 `collectionPrefix`에 맞게 치환)
2. [docs/storage.rules.example](docs/storage.rules.example) → `storage.rules` 병합
3. 카테고리 필터 목록을 쓰면 복합 인덱스 필요 (아래)
4. 배포:
   ```bash
   firebase deploy --only firestore:rules,storage,firestore:indexes
   ```

**Rules를 파일에만 넣고 배포 안 하면** 글쓰기에서 `permission-denied` — 가장 흔한 설치 실수.

#### 카테고리 목록용 인덱스 예시

`firestore.indexes.json` (컬렉션 ID는 prefix에 맞게):

```json
{
  "indexes": [
    {
      "collectionGroup": "boardPosts",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "category", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

> ⚠️ npm 패키지 tarball에도 `docs/` 가 포함된다(0.4.7+). 구버전이면 GitHub의 `docs/`를 보면 된다.

### 4. 최초 관리자와 카테고리 만들기

Rules는 일반 사용자가 스스로 관리자가 되는 것을 막는다. 따라서 최초 한 번은 다음 순서가 필요하다.

1. 아래 게시판 페이지를 만든 뒤 Google 또는 Apple로 로그인한다.
2. Firebase Console → Firestore에서 `{prefix}Users/{uid}` 문서를 찾는다.
3. 해당 문서의 `role`을 문자열 `admin`으로 변경한다.
   - `collectionPrefix: 'board'`라면 `boardUsers/{uid}`
   - UID는 Firebase Console → Authentication → Users에서도 확인할 수 있다.
4. `/board-settings`에서 첫 카테고리를 만든다. 카테고리가 없으면 글을 작성할 수 없다.
5. 이후 역할 변경은 `/board-users`의 `MemiBoardUsers`에서 처리한다.

> 최초 관리자 지정은 신뢰할 수 있는 프로젝트 운영자가 Firebase Console에서만 수행한다. 클라이언트 코드에 관리자 UID나 우회 규칙을 넣지 않는다.

## 사용법

라우팅·미들웨어는 **호스트 소유**. 컴포넌트는 모듈 auto-import (`MemiBoardList` 등).  
`import { MemiBoardEditor } from 'memi-board/runtime'`는 **안 된다**. 컴포넌트는 모듈이 auto-import하고, composable과 type만 `memi-board/runtime`에서 명시적으로 가져올 수 있다.

```vue
<!-- app/pages/board/index.vue -->
<script setup lang="ts">
import { useMemiBoardAuth } from 'memi-board/runtime'
const { isSignedIn } = useMemiBoardAuth()
</script>

<template>
  <div>
    <UButton v-if="isSignedIn" to="/board/new" label="새 글쓰기" />
    <!-- 단순: 상세 /board/{id} -->
    <MemiBoardList
      post-link-base="/board"
      introduction="우리 서비스의 소식과 이야기를 나누는 게시판입니다."
    />
    <!-- 카테고리 path: get-post-link 권장 -->
    <!--
    <MemiBoardList
      :category="route.params.category as string"
      :get-post-link="(p) => `/board/${p.category}/${p.id}`"
    />
    -->
    <MemiBoardSignIn v-if="!isSignedIn" />
  </div>
</template>
```

```vue
<!-- app/pages/board/[id].vue -->
<script setup lang="ts">
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

```ts
// app/middleware/board-auth.ts — 글쓰기 가드 (호스트)
import { getCurrentUser } from 'vuefire'

export default defineNuxtRouteMiddleware(async () => {
  const user = await getCurrentUser()
  if (!user) return navigateTo('/board')
})
```

```vue
<!-- app/pages/board/new.vue -->
<script setup lang="ts">
definePageMeta({ middleware: 'board-auth' })
const router = useRouter()
// MemiBoardEditor 는 auto-import (import from 'memi-board/runtime' 불필요)
</script>

<template>
  <MemiBoardEditor
    @saved="(id) => router.push(`/board/${id}`)"
    @cancel="router.push('/board')"
  />
  <!-- path 로 카테고리 고정 시: fixed-category="free" -->
</template>
```

전체 페이지 예시는 `playground/app/pages/board/` 참고.

### 관리 페이지

기본 Rules는 게시판의 `{prefix}Users/{uid}.role == 'admin'`을 검사한다. 컴포넌트도 같은 role을 확인하므로 기본 설치에서는 `authorized`를 전달하지 않는다.

```vue
<!-- app/pages/board-settings.vue -->
<template>
  <MemiBoardSettings />
</template>
```

```vue
<!-- app/pages/board-users.vue -->
<template>
  <MemiBoardUsers />
</template>
```

호스트의 별도 사이트 관리자 체계를 연동할 때만 `authorized`를 사용할 수 있다. 이 prop은 UI 표시만 허용하며 Firestore Rules를 우회하지 않는다. 이 경우에도 해당 사용자를 게시판 admin으로 등록하거나 호스트 Rules를 같은 관리자 체계에 맞게 수정해야 한다. 관리 URL이 일반 사용자에게 노출되지 않도록 호스트 라우트 가드를 추가하는 것을 권장한다.

### 제공하는 API

**컴포넌트 (auto-import):**  
`MemiBoardList`, `MemiBoardDetail`, `MemiBoardEditor`, `MemiBoardCommentList`, `MemiBoardCommentForm`, `MemiBoardAttachments`, `MemiBoardSignIn`, `MemiBoardSettings`, `MemiBoardUsers`, `MemiBoardVersionHistory`

**List props:** `pageSize`, `category`, `postLinkBase`, `getPostLink(post)`, `linkBase`(deprecated)

**Editor props:** `postId`(수정), `fixedCategory`(path 고정 시 선택 UI 숨김)  
본문은 Nuxt UI **`UEditor`**(TipTap, `content-type="html"`). 호스트 `@nuxt/ui` 4.x 에 Editor 포함 필요.

**에디터 이미지:** 툴바 / 붙여넣기 / 드롭 → Firebase Storage  
`{prefix}/posts/{postId}/images/*` + `.../images/thumbnails/*` (최적화 이미지+썸네일).

본문 이미지는 휴대폰 원본 기준 최대 25MB까지 선택할 수 있다. 5MB를 넘으면 브라우저에서 최대 2560px·JPEG 85%로 최적화하고, 결과가 여전히 5MB를 넘으면 2048px·75%로 한 번 더 줄인 뒤 업로드한다. 5MB 이하 이미지는 원본을 유지한다.
본문 HTML에는 원본 URL. 수정 중 버려진 파일은 호스트 스케줄러로 정리 (`extractEditorImageUrls` 로 본문 참조 비교).

**composables:**  
`useMemiBoardAuth`, `useMemiBoardPosts`, `useMemiBoardComments`, `useMemiBoardStorage`, `useMemiBoardModeration`, `useMemiBoardSettings`, `useMemiBoardUsers`

댓글은 시간순으로 10개씩 cursor 조회하며, 실제 `댓글 더보기` 버튼이 화면에 들어오면 1초 후 자동으로 다음 페이지를 읽는다. 기존 댓글을 모두 읽은 뒤에만 최신 댓글 1개를 실시간 구독한다. 대댓글은 5개씩 조회하고 모두 읽은 뒤 최신 답글 1개를 실시간 구독하며, 화면 깊이는 최대 2단계로 표시한다.

### 카테고리

- 문서: `{prefix}Settings/config/categories/{categoryId}` → `{ label, listView, writeRole, order, updatedAt }`
- 설정이 없으면 빈 목록이며 기본 카테고리를 자동 생성하지 않음
- `MemiBoardSettings`에서 관리자가 카테고리별 저장·삭제·순서·리스트뷰·글쓰기 최소 역할 관리
- `categoryId`는 문서 ID이자 게시글의 `category` 참조값이므로 생성 후 변경하지 않는 것을 권장

### 로그인 공급자

`auth.providers` 기본 `['google', 'apple']`, `'emailPassword'` 추가 가능.

- **Google:** 콘솔 Sign-in method 활성화
- **Apple:** Services ID·키 등 추가 설정 → [docs/firebase-setup.md#apple](docs/firebase-setup.md#apple)

### 버전 히스토리

`<MemiBoardVersionHistory />` 를 페이지에 두면 패키지 기능 변경을 방문자에게 보여줄 수 있다.

## Security Model

서버가 없으므로 **Rules가 전부**다.

권한 요약:

| 동작 | 조건 |
|------|------|
| 글/댓글 읽기 | 공개 |
| 글 작성 | 로그인 + 카테고리 `writeRole` 충족 + `moderationStatus == 'approved'` |
| 댓글 작성 | 로그인 + `moderationStatus == 'approved'` (클라가 항상 approved 로 씀 — 검열 통과 후에만 write) |
| 글 수정·삭제 | 작성자 또는 `{prefix}Users/{uid}.role in ['admin', 'staff']` |
| 댓글 삭제 | 댓글 작성자 · 글 작성자 · admin · staff |
| 역할 관리 | `MemiBoardUsers`에서 admin이 `admin`·`staff`·`user` 변경 |

**알려진 한계:** AI 검열은 클라이언트 전용. SDK로 직접 write 하면 우회 가능. 중요 서비스면 Cloud Functions 검증을 호스트가 추가(패키지 범위 밖).

## Firebase AI Logic (검열)

흐름: **로컬 금칙어 → Gemini 구조화 JSON** → 걸리면 저장 안 함.

| 옵션 | 기본 | 설명 |
|------|------|------|
| `enabled` | `true` | 끄면 로컬만 / 또는 전부 통과에 가깝게 |
| `model` | `gemini-3.5-flash-lite` | Firebase AI Logic 지원 모델명 |
| `onError` | `'allow'` | AI 실패 시 `'block'` 이면 저장 거부 |
| `localBlocklist` | `[]` | 기본 목록에 문자열 추가 |
| `useLimitedUseAppCheckTokens` | `true` | `false`면 일반 App Check 세션 토큰 |
| `blockBanThreshold` | `3` | 콘텐츠 차단(local/ai) 누적 이상이면 글·댓글 제한. `0` = off |
| `blockBanDecayMs` | `86400000` | 경고 1회 차감 간격(기본 24h) |

콘텐츠 차단이 누적되면 `{prefix}Users/{uid}` 에 `moderationBlockCount` / `moderationBlockAt` 이 기록된다.  
3회면 약 하루 동안 작성 불가(24h마다 1 차감). Rules 예시에서 본인은 **+1만** 가능하고 감소·리셋은 admin.

콘솔에서 **AI Logic(Gemini Developer API)** 활성화. 신규 프로젝트는 구형 `gemini-2.5-flash` 가 404 날 수 있음 → 3.x Flash / Flash-Lite 사용.

### App Check (AI Enforce 시 사실상 필수)

`firebaseml` / AI Logic 이 **Enforce** 되어 있으면 App Check 토큰 없이 `generateContent` 가 실패한다.

1. 콘솔 App Check → 웹 앱에 **reCAPTCHA v3** 등록 (사이트 키·시크릿)
2. 호스트에서 **`initializeAppCheck`** (memi-board 밖). 예:

```ts
// app/plugins/app-check.client.ts
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'
import { useFirebaseApp } from 'vuefire'

export default defineNuxtPlugin(() => {
  if (!import.meta.client) return
  // 로컬: self.FIREBASE_APPCHECK_DEBUG_TOKEN = true | '<등록된-uuid>'
  initializeAppCheck(useFirebaseApp(), {
    provider: new ReCaptchaV3Provider('<RECAPTCHA_SITE_KEY>'),
    isTokenAutoRefreshEnabled: true,
  })
})
```

3. 로컬: 디버그 토큰을 콘솔에 등록 (또는 고정 UUID)
4. `firebaseConfig.appId` 가 App Check에 등록한 **웹 앱과 동일**한지 확인
5. (선택) Firestore/Storage 에도 Enforce — 켜면 토큰 없는 요청 거부

> `nuxt-vuefire` 의 `vuefire.appCheck` 옵션만으로 AI Logic까지 충분한지는 SDK/버전에 따라 다를 수 있다. 문제가 있으면 위처럼 명시적 `initializeAppCheck` 를 권장한다.

## 다른 프로젝트에 붙일 때 체크리스트

- [ ] 동일 스택: Nuxt 4 + `@nuxt/ui` 4 + `nuxt-vuefire` + Firebase
- [ ] `pnpm add memi-board @nuxt/ui nuxt-vuefire vuefire firebase dayjs`
- [ ] `modules`에 `@nuxt/ui`, `nuxt-vuefire`, `memi-board`
- [ ] 게시판·관리 경로에 `ssr: false`
- [ ] `nuxt.config.ts`의 `memiBoard` 설정 (`collectionPrefix` 충돌 없게)
- [ ] CSS `@source` …/memi-board/dist/runtime/components
- [ ] Rules 예시 병합 + **deploy**
- [ ] 카테고리 필터 사용 시 indexes deploy
- [ ] 페이지·미들웨어 직접 작성 (또는 playground 복사)
- [ ] 최초 로그인 후 Firebase Console에서 `{prefix}Users/{uid}.role = 'admin'`
- [ ] 설정 페이지에서 첫 카테고리 생성
- [ ] (검열) AI Logic 활성화 + 권장 모델 + App Check
- [ ] `pnpm why vuefire` 로 이중 인스턴스 없는지 확인

같은 Firebase 프로젝트에 호스트 앱 유저 컬렉션이 있어도 무방 — 게시판 역할은 **`{prefix}Users` 전용**이다.

## 문제 해결

### `useCurrentUser() called before the VueFireAuth module...`

`vuefire.auth.enabled` 미설정, 또는 `vuefire`/`firebase` 이중 설치. `pnpm why vuefire` → 하나로. 모듈이 `vite.resolve.dedupe`에 vue/vuefire/firebase를 넣지만, **호스트 peer 설치**가 우선이다.

### 카테고리 필터 쿼리 에러 / 인덱스 링크

콘솔이 안내하는 복합 인덱스 생성, 또는 위 `firestore.indexes.json` 배포.

### AI 검열 실패 / 글 안 올라감 (`onError: 'block'`)

App Check 토큰, `appId` 일치, 모델명(3.x), AI Logic 활성화, 네트워크. 브라우저 콘솔의 `moderation AI failed` warn 확인.

### monorepo `link:` / `file:` 로 개발할 때

링크하기 전에 패키지 의존성과 `dist`를 준비한다.

```bash
# memi-board 저장소
pnpm install
pnpm build

# 호스트 저장소
pnpm add link:../memi-board
```

`src/components` 수정은 Nuxt 모듈이 링크 소스를 직접 읽으므로 즉시 반영된다. `src/module.ts` 또는 core composable을 수정하면 `pnpm build`를 다시 실행하고 호스트 개발 서버를 재시작한다. 모듈이 Vue·Vue Router·VueFire·Firebase·TipTap dedupe와 `dayjs` 최적화를 자동 적용한다. 배포 전에는 의존성을 **npm 버전**으로 되돌린다.

링크 상태에서 새 Tailwind 클래스를 바로 시험하려면 호스트 CSS에 소스 경로를 하나 더 둔다.

```css
@source "../../../node_modules/memi-board/src/components";
@source "../../../node_modules/memi-board/dist/runtime/components";
```

## 로컬 개발 (이 리포)

```bash
pnpm install
pnpm build
pnpm dev:prepare
pnpm dev           # playground
pnpm build:watch   # src 변경 시 dist 갱신
```

에뮬레이터:

```bash
firebase emulators:start --project demo-memi-board
NUXT_PUBLIC_USE_EMULATORS=1 pnpm dev
```

## npm 배포

npm의 6자리 OTP를 인자로 전달하면 빌드, 타입 검사, 패키지 dry-run을 모두 통과한 뒤에만 배포한다.

```bash
pnpm release 123456
```

`pnpm publish 123456`은 pnpm이 `123456`을 OTP가 아닌 폴더 경로로 해석하므로 사용하지 않는다.

## 버전 · 라이선스

- UI: `<MemiBoardVersionHistory />`
- 상세: [CHANGELOG.md](CHANGELOG.md)
- **MIT**
