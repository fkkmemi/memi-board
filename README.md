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
| 런타임 | Nuxt **4+** (3.x peer 는 허용하나 playground/검증은 4 기준) |
| UI | `@nuxt/ui` **4+** (컴포넌트가 `UButton` 등 auto-import 전제) |
| 데이터 | Firebase **Firestore + Auth + Storage** |
| Vue | `vue` 3.5+, `vuefire` 3.2+, `firebase` 12+ |
| 모듈 | `nuxt-vuefire` (호스트가 설치·설정) |

**의도적으로 하지 않는 일:** Firebase 초기화, 라우트/미들웨어 등록, App Check 초기화, 서버 검열.

## 구조 (0.4+)

| 엔트리 | 역할 |
|--------|------|
| `memi-board` | **core** — `configureMemiBoard`, composables, types (**Vue 컴포넌트 export 없음**) |
| `memi-board/nuxt` | **thin Nuxt 모듈** — SFC를 호스트 Vite에 등록 → `MemiBoardList` 등 auto-import |

런타임 설정은 모듈 options가 아니라 호스트 플러그인의 `configureMemiBoard()` 한곳.

```
호스트 Nuxt 앱
├── nuxt-vuefire + firebaseConfig     ← 인증·Firestore
├── (선택) App Check 플러그인         ← AI Logic Enforce 시 필수에 가까움
├── memi-board/nuxt                   ← UI 등록
├── plugins/memi-board.ts             ← configureMemiBoard
├── pages/board/*                     ← 라우트는 호스트 소유
└── firestore.rules + storage.rules   ← docs 예시 병합 후 배포
```

## 설치

**사전 준비:** Node + pnpm, Firebase 프로젝트(Firestore·Storage·Auth). 처음부터면 → [docs/firebase-setup.md](docs/firebase-setup.md).

```bash
pnpm add memi-board @nuxt/ui nuxt-vuefire vuefire firebase
```

`vuefire` / `firebase` / `nuxt-vuefire` 는 **호스트에 직접 설치** — peer 이중 인스턴스가 나면 인증·Firestore가 깨진다.

### 1. modules + vuefire

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: [
    '@nuxt/ui',
    'nuxt-vuefire',
    'memi-board/nuxt',
  ],
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
})
```

### 2. configureMemiBoard

```ts
// app/plugins/memi-board.ts
import { configureMemiBoard } from 'memi-board'

export default defineNuxtPlugin(() => {
  configureMemiBoard({
    // Firestore: {prefix}Posts, {prefix}Users, {prefix}Settings
    collectionPrefix: 'board',
    auth: { providers: ['google', 'apple'] }, // + 'emailPassword'
    moderation: {
      enabled: true,
      model: 'gemini-3.5-flash-lite', // 권장. 2.5-flash 는 신규 프로젝트에서 미제공일 수 있음
      onError: 'block', // 'allow' | 'block' — AI 실패 시 저장 허용/거부 (기본 allow)
      moderateImages: false,
      useLimitedUseAppCheckTokens: false, // App Check 세션 토큰으로도 가능
      // localBlocklist: ['금칙어'],
    },
  })
})
```

### 3. Tailwind `@source` (필수)

패키지 SFC 안의 클래스가 purge되지 않도록:

```css
/* app/assets/css/main.css */
@import "tailwindcss";
@import "@nuxt/ui";
@source "../../../node_modules/memi-board/dist/runtime/components";
```

### 4. Security Rules + 인덱스 배포

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

## 사용법

라우팅·미들웨어는 **호스트 소유**. 컴포넌트는 모듈 auto-import (`MemiBoardList` 등).  
`import { MemiBoardEditor } from 'memi-board'` 는 **안 된다** — core 엔트리는 composable/types 만 export.

```vue
<!-- app/pages/board/index.vue -->
<script setup lang="ts">
import { useMemiBoardAuth } from 'memi-board'
const { isSignedIn } = useMemiBoardAuth()
</script>

<template>
  <div>
    <UButton v-if="isSignedIn" to="/board/new" label="새 글쓰기" />
    <!-- 단순: 상세 /board/{id} -->
    <MemiBoardList post-link-base="/board" />
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
// MemiBoardEditor 는 auto-import (import from 'memi-board' 불필요)
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

### 제공하는 API

**컴포넌트 (auto-import):**  
`MemiBoardList`, `MemiBoardDetail`, `MemiBoardEditor`, `MemiBoardCommentList`, `MemiBoardCommentForm`, `MemiBoardAttachments`, `MemiBoardSignIn`, `MemiBoardSettings`, `MemiBoardUsers`, `MemiBoardVersionHistory`

**List props:** `pageSize`, `category`, `postLinkBase`, `getPostLink(post)`, `linkBase`(deprecated)

**Editor props:** `postId`(수정), `fixedCategory`(path 고정 시 선택 UI 숨김)  
본문은 Nuxt UI **`UEditor`**(TipTap, `content-type="html"`). 호스트 `@nuxt/ui` 4.x 에 Editor 포함 필요.

**에디터 이미지:** 툴바 / 붙여넣기 / 드롭 → Firebase Storage  
`{prefix}/posts/{postId}/images/*` + `.../images/thumbnails/*` (원본+썸네일).  
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
- [ ] `pnpm add memi-board` 및 peer 직접 설치
- [ ] `modules`에 `memi-board/nuxt`
- [ ] `configureMemiBoard` 플러그인 (`collectionPrefix` 충돌 없게)
- [ ] CSS `@source` …/memi-board/dist/runtime/components
- [ ] Rules 예시 병합 + **deploy**
- [ ] 카테고리 필터 사용 시 indexes deploy
- [ ] 페이지·미들웨어 직접 작성 (또는 playground 복사)
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

패키지 쪽 `node_modules`의 vuefire가 잡히면 이중 인스턴스. 호스트에서 `vite.resolve.dedupe` + 필요 시 alias/optimizeDeps. 배포 전에는 **npm 버전**으로 설치하는 것을 권장.

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

## 버전 · 라이선스

- UI: `<MemiBoardVersionHistory />`
- 상세: [CHANGELOG.md](CHANGELOG.md)
- **MIT**
