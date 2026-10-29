# memi-board

Nuxt 4 + Nuxt UI + Firebase 프로젝트에 게시판을 붙이는 npm 패키지.

- 게시글 CRUD · 댓글 · Storage 첨부 · 카테고리 · 조회수
- 작성자/관리자 권한 (Firestore Rules)
- 로컬 비속어 + Firebase AI Logic(Gemini) 검열 (선택)
- **공유 미리보기(OG)** — 호스트 SEO API 없이 목록·상세 메타 (`useMemiBoard*Seo`)

**서버 / Firebase Admin 불필요** (권한은 Rules, 검열은 브라우저 — 우회 가능, 아래 한계 참고).  
공개 목록·글 상세만 SSR로 OG를 채우고, 쓰기·설정은 CSR로 두면 된다.

같은 스택(Nuxt 4 · `@nuxt/ui` · `nuxt-vuefire` · Firebase)이면 **다른 호스트 앱에도 그대로 재사용** 가능하다. Firebase 프로젝트는 호스트마다 달라도 되고, 같은 프로젝트에서는 `boardId`로 게시판 인스턴스를 나눈다 — `memiBoardPosts`/`memiBoardComments`/`memiBoardLikes`는 모두 최상위 flat 컬렉션이고 `boardId`는 각 문서의 필드다(경로 세그먼트가 아니다).

## 안내 문서

| 필요한 작업 | 문서 |
|---|---|
| 다른 사이트에 처음 설치 | [호스트 설치 가이드](docs/host-integration.md) — 최소 설정, 라우트, 첫 게시판 |
| 한 언어만 사용하거나 다국어·번역 선택 | [국제화·콘텐츠 번역](docs/internationalization.md) — 모드별 설정과 저장 시점 |
| Firebase 연결과 규칙·인덱스 배포 | [Firebase 준비](docs/firebase-setup.md) |
| 매장·조직별 담당 권한, 기존 역할 이전 | [역할과 마이그레이션](docs/roles-migration.md) |
| 설정·API·문제 해결 상세 | 이 README의 [호스트 설정](#부모호스트-앱-설정), [API](#제공하는-api), [문제 해결](#문제-해결) |

`i18n.enabled`·`translation.enabled`는 **0.47.0 이상**에서 지원한다. 해당 옵션을 사용할 호스트는 `pnpm add memi-board@^0.47.0`으로 설치하거나 업데이트한다.

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
| `memi-board` | **Nuxt 모듈** — 설정, SFC auto-import, peer dedupe |
| `memi-board/runtime` | composables, types, 유틸리티 (**Vue 컴포넌트 export 없음**) |

일반 사용자는 `nuxt.config.ts`의 `memiBoard`만 설정한다. 별도 Nuxt 플러그인은 필요 없다.

```
호스트 Nuxt 앱
├── nuxt-vuefire + firebaseConfig     ← 인증·Firestore
├── (선택) App Check 플러그인         ← AI Logic Enforce 시 필수에 가까움
├── memi-board                        ← Nuxt 모듈 + 런타임 설정
├── pages/board/*                     ← 라우트는 호스트 소유 (+ SEO 한 줄)
└── firestore.rules + storage.rules   ← docs 예시 병합 후 배포
```

## 설치

**사전 준비:** Node + pnpm, Firebase 프로젝트(Firestore·Storage·Auth). 처음부터면 → [docs/firebase-setup.md](docs/firebase-setup.md).

```bash
pnpm add memi-board @nuxt/ui nuxt-vuefire vuefire firebase
```

`vuefire` / `firebase` / `nuxt-vuefire`는 **호스트에 직접 설치**한다. TipTap은 `@nuxt/ui`와 `memi-board`가 관리하므로 호스트에서 별도로 설치하거나 버전을 맞출 필요가 없다. 날짜 표시는 `Intl`을 사용하므로 `dayjs`는 필요 없다.

---

## 부모(호스트) 앱 설정

호스트가 하는 일만 정리한다. **호스트 전용 SEO API·서버 라우트는 필요 없다.**  
Firestore `listed === true` 공개 글을 패키지가 직접 읽고 `useSeoMeta`로 OG를 채운다.

### 1. `nuxt.config.ts` — modules + `memiBoard` + vuefire + routeRules

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: [
    '@nuxt/ui',
    'nuxt-vuefire',
    'memi-board',
  ],

  memiBoard: {
    // 단일 언어 예시. 다국어 서비스는 아래 국제화 가이드 참고
    locale: 'ko',
    i18n: { enabled: false },
    // Firestore: memiBoardPosts / memiBoardComments / memiBoardLikes / memiBoardSettings / memiBoardUsers
    // (전부 flat 컬렉션 — boardId 는 각 문서의 필드. 컴포저블 호출 시 boardId 인자로 지정)
    auth: { providers: ['google', 'apple'] }, // + 'emailPassword'
    moderation: {
      enabled: true,
      model: 'gemini-3.5-flash-lite',
      onError: 'block', // 'allow' | 'block'
      moderateImages: false,
      useLimitedUseAppCheckTokens: false,
      // localBlocklist: ['금칙어'],
      // blockBanThreshold: 10,
      // blockBanDecayMs: 24 * 60 * 60 * 1000,
    },
    // 공유 미리보기(OG) — 호스트 API 없이 패키지 composable 사용
    seo: {
      enabled: true,
      siteName: 'My App',                           // og:site_name · title 접미사
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL
        || 'https://example.com',                   // 절대 URL origin (trailing slash 없음)
      defaultOgImage: '/images/og-default.jpg',     // 글에 previewImage 없을 때
      basePath: '/board',                           // canonical 경로 prefix
    },
  },

  // (선택) 호스트 전역 siteUrl — SEO가 memiBoard.seo.siteUrl 다음으로 참고할 수 있음
  runtimeConfig: {
    public: {
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'https://example.com',
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
    // 공개 목록·글 상세: SSR 유지(기본) → 카톡/OG 크롤러가 HTML 메타를 읽음
    // 쓰기·설정만 CSR
    '/board/**/new': { ssr: false },
    '/board/**/**/edit': { ssr: false },
    '/board/version-history': { ssr: false },
    '/board-settings/**': { ssr: false },
    '/board-users': { ssr: false },
  },
})
```

`memiBoard` 옵션은 Nuxt 모듈이 런타임 플러그인으로 자동 전달한다. **`app/plugins/memi-board.ts`를 만들지 않는다.**

#### `memiBoard` 옵션 요약

| 키 | 기본 | 설명 |
|----|------|------|
| `postsCollection` | `'memiBoardPosts'` | 글 컬렉션 이름 |
| `commentsCollection` | `'memiBoardComments'` | 댓글 컬렉션 이름 |
| `likesCollection` | `'memiBoardLikes'` | 좋아요 컬렉션 이름 |
| `reportsCollection` | `'memiBoardReports'` | 신고 컬렉션 이름 |
| `settingsCollection` | `'memiBoardSettings'` | 보드 설정 컬렉션 이름 |
| `usersCollection` | `'memiBoardUsers'` | 역할 문서 컬렉션 이름 |
| `auth.providers` | `['google','apple']` | 로그인 공급자 |
| `moderation.*` | (아래 AI 절) | 로컬·Gemini 검열 |
| `seo.enabled` | `true` | `false`면 SEO composable no-op |
| `seo.siteName` | `'Board'` | OG 사이트명·title 접미사 |
| `seo.siteUrl` | `''` | 절대 URL origin. 비우면 `runtimeConfig.public.siteUrl` → 요청 origin 순 |
| `seo.defaultOgImage` | `''` | 대표 이미지 없을 때 (상대경로 또는 `https://…`) |
| `seo.basePath` | `'/board'` | canonical: `{base}`, `{base}/{category}`, `{base}/{category}/{slug}` |
| `i18n.enabled` | `true` | `false`면 UI를 `locale`로 고정하고 언어 선택·콘텐츠 번역을 끈다 |
| `translation.enabled` | `true` | `false`면 UI 언어 전환은 유지하고 콘텐츠 번역 생성·표시를 끈다 |
| `locale` | `'ko'` | 국제화가 켜져 있으면 게시판·호스트 언어 다음의 기본값. 꺼져 있으면 고정 UI 언어 |
| `roleLabels` | 언어별 기본 명칭 | 서비스별 역할 표시 이름. 권한과 담당 범위는 바꾸지 않음 |

#### routeRules 원칙

| 경로 | SSR | 이유 |
|------|-----|------|
| `/board`, `/board/{category}`, `/board/{category}/{slug}` | **on** (기본) | OG/카톡 미리보기 |
| `/board/**/new`, `…/edit`, 설정·유저 관리 | **off** | 로그인·권한 UI, SEO 불필요 |

> 예전 가이드의 `/board/**: { ssr: false }` 전부 CSR은 **공유 미리보기가 비게 된다.** 공개 읽기 경로는 SSR을 켠다.

### 2. 페이지에서 SEO 한 줄 (auto-import)

모듈이 `useMemiBoardListSeo` / `useMemiBoardPostSeo`를 auto-import한다.  
**호스트 `/server/api/board/**` SEO 엔드포인트는 만들지 않는다.**

```vue
<!-- app/pages/board/index.vue — 전체 목록 -->
<script setup lang="ts">
await useMemiBoardListSeo({ path: '/board' })
// … MemiBoardList 등
</script>
```

```vue
<!-- app/pages/board/[category]/index.vue — 카테고리 목록 -->
<script setup lang="ts">
const route = useRoute()
const categoryId = computed(() => String(route.params.category || ''))

await useMemiBoardListSeo({
  category: categoryId,
  path: computed(() => `/board/${encodeURIComponent(categoryId.value)}`),
})
</script>
```

```vue
<!-- app/pages/board/[category]/[id]/index.vue — 글 상세 (id 자리 = slug) -->
<script setup lang="ts">
const route = useRoute()
const categoryId = computed(() => String(route.params.category || ''))
const id = computed(() => String(route.params.id || ''))

const { post: postSeo } = await useMemiBoardPostSeo({
  category: categoryId,
  slug: id,
  path: computed(() =>
    `/board/${encodeURIComponent(categoryId.value)}/${encodeURIComponent(id.value)}`,
  ),
})
// postSeo: id · title · previewImage 등 — SSR 첫 로드에서는 바로 채워진다.
// 클라이언트 이동에서는 화면 전환을 막지 않으려고 기다리지 않으므로 처음엔 null 일 수 있다.

const { resolvePostIdBySlug } = useMemiBoardPosts(categoryId)
const internalId = ref('')
watch([categoryId, id], async ([category, slug]) => {
  if (postSeo.value?.id && postSeo.value.category === category && postSeo.value.slug === slug) {
    internalId.value = postSeo.value.id
    return
  }
  if (import.meta.server) return
  // id 만 조회 (본문은 MemiBoardDetail 이 구독). 방금 작성한 글은 조회 없이 바로 나온다.
  const result = await resolvePostIdBySlug(slug)
  internalId.value = result.status === 'ok' ? result.id : ''
}, { immediate: true })
</script>
```

> 상세·수정 페이지에서 slug → id 는 `getPostBySlug`(본문까지 읽음) 대신 `resolvePostIdBySlug` 를 쓴다. 저장 직후 미리보기 진입이 Firestore 왕복 2회만큼 빨라진다.

| composable | 대상 | OG 요약 |
|------------|------|---------|
| `useMemiBoardListSeo` | 목록 | 카테고리 label·description, 최근 공개 글 이미지 |
| `useMemiBoardPostSeo` | 상세 | 제목·요약·작성자, **`previewImage` → og:image** |

- 공개(`listed`) 글만 조회. **숨김 게시판**은 메타를 비우고 `noindex` 쪽에 가깝게 동작한다.
- 글 상세 `og:type` = `article`, 목록 = `website`.
- 로컬 확인:  
  `curl -sL 'http://localhost:3000/board/…' | grep og:title`  
  또는 브라우저 **페이지 소스 보기** (`view-source:`). DevTools Elements만 보면 하이드레이션 이후와 헷갈릴 수 있다.
- 카톡·슬랙 미리보기는 **배포 URL**로 확인 (localhost 크롤 불가).

### 3. 부모 설정 체크리스트

- [ ] `modules`에 `@nuxt/ui`, `nuxt-vuefire`, `memi-board`
- [ ] `memiBoard.auth` · `moderation` · **`seo`**
- [ ] `seo.siteUrl` / `seo.siteName` / `seo.defaultOgImage` / `seo.basePath`
- [ ] 공개 board 경로 **SSR on**, 쓰기·설정만 `ssr: false`
- [ ] 목록·상세 페이지에 `await useMemiBoard*Seo(…)` 한 줄
- [ ] 호스트 SEO API **만들지 않음**
- [ ] CSS `@source` (아래)
- [ ] (선택) 읽은 글 표시 CSS (아래)
- [ ] Rules·indexes **deploy**
- [ ] 최초 owner + 첫 게시판

### 4. Tailwind `@source` (필수)

패키지 SFC 안의 클래스가 purge되지 않도록:

```css
/* app/assets/css/main.css */
@import "tailwindcss";
@import "@nuxt/ui";
@source "../../../node_modules/memi-board/dist/runtime/components";
```

### 5. 국제화와 콘텐츠 번역 (선택)

[국제화·번역 가이드](docs/internationalization.md)에 모드별 복사 예제, 호스트 언어 연결, 번역 저장 시점, 오류 처리와 기존 데이터 유지 정책을 정리했다.

| 목적 | `memiBoard` 설정 |
|---|---|
| 한국어 전용 | `locale: 'ko', i18n: { enabled: false }` |
| UI만 다국어 | `i18n: { enabled: true }, translation: { enabled: false }` |
| UI·콘텐츠 모두 다국어 | `i18n: { enabled: true }, translation: { enabled: true }` |

설정 생략 시 두 옵션은 `true`이며, `i18n.enabled: false`이면 콘텐츠 번역도 꺼진다. UI는 `locale`로 고정하고 콘텐츠는 원문을 표시한다. 기존 번역 데이터는 유지한다. 호스트의 언어 전환을 연결할 때만 `@nuxtjs/i18n`을 추가하면 된다.

보드 설정의 **글 작성 시 자동 번역**(`autoTranslatePosts`)은 기본 꺼짐이다. 켜면 새 글의 제목·요약·본문을 번역해 함께 저장한다.

번역 버튼은 라벨·설명을 번역해 임시 반영하고 **저장**을 눌러 적용한다. 자동 번역 토글은 기본 꺼짐이며, 켜면 **설정 저장 시** 번역한 뒤 저장한다. 문구가 같고 번역이 모두 있으면 재번역을 건너뛴다. 서비스 전체의 국제화·번역이 꺼져 있으면 자동 번역도 실행하지 않는다.

### 6. 읽은 글 표시 (선택)

목록·미니 컴포넌트의 글 링크는 `.memi-board-post-link` 클래스가 붙어 있고, 제목 텍스트는 `text-inherit`로 링크 색을 따른다. 패키지는 색을 강제하지 않으므로, 방문한 글을 흐리게 보이고 싶으면 호스트 CSS에 `:visited` 스타일만 추가하면 된다.

```css
/* app/assets/css/main.css */
a.memi-board-post-link:visited {
  color: #737373;
}

.dark a.memi-board-post-link:visited {
  color: #a3a3a3;
}
```

**`:visited`는 `color`만 허용하고, 그마저도 `var()`·알파값은 브라우저가 무시한다** (히스토리 스니핑 방지). 그래서 Nuxt UI 토큰(`var(--ui-text-muted)`)을 그대로 못 쓰고 라이트/다크용 리터럴 색상을 각각 지정해야 한다(위 값은 Tailwind `neutral-500`/`neutral-400`).

브라우저 네이티브 `:visited` 라서 서버·DB 저장이 필요 없다. 단, SPA 클라이언트 라우팅(`NuxtLink`)으로만 이동한 경우 브라우저에 "실제 방문"으로 기록되지 않을 수 있어 완전히 신뢰할 수는 없다 — 정확한 읽음 추적이 필요하면 별도로 방문 글 ID를 저장하는 방식을 구현해야 한다.

### 7. Security Rules + 인덱스 배포

1. [docs/firestore.rules.example](docs/firestore.rules.example) → 호스트 `firestore.rules`에 병합  
   (`memiBoardPosts`/`memiBoardComments`/`memiBoardLikes`/`memiBoardReports`/`memiBoardSettings`/`memiBoardUsers` — 전부 최상위 flat 컬렉션)
2. [docs/storage.rules.example](docs/storage.rules.example) → `storage.rules` 병합
3. `firebase.json`의 Storage `bucket`이 `vuefire.config.storageBucket`과 같은지 확인
   (`*.appspot.com` vs `*.firebasestorage.app` — [firebase-setup.md](docs/firebase-setup.md) 참고)
4. 목록/작성자별 쿼리에 필요한 복합 인덱스 배포 (아래)
5. 배포:
   ```bash
   firebase deploy --only firestore:rules,storage,firestore:indexes
   ```
6. Storage의 Firestore 조회 권한 설정: 배포 시 교차 서비스 IAM 역할 추가 안내를 승인하고, 호스트 Firebase 프로젝트의 Storage 서비스 계정에 `roles/firebaserules.firestoreServiceAgent`가 있는지 확인한다. [부모/호스트 설정 절차](docs/firebase-setup.md#storage-규칙의-firestore-조회-권한-부모호스트-프로젝트-필수-설정) 참고. CI 배포 성공만으로 이 권한 설정을 보장하지 않는다.

0.45.1로 갱신하는 호스트는 [새 규칙 적용·전환 절차](docs/firebase-setup.md#0451-규칙-변경과-기존-호스트-전환)를 함께 확인한다. 패키지 설치나 사이트 푸시만으로 Firebase 규칙은 배포되지 않는다.

**Rules를 파일에만 넣고 배포 안 하면** 글쓰기에서 `permission-denied` — 가장 흔한 설치 실수.
**Storage 규칙을 앱이 쓰는 버킷이 아닌 곳에 배포하면** 본문 이미지에서 `storage/unauthorized`.

#### 복합 인덱스

[docs/firestore.indexes.json.example](docs/firestore.indexes.json.example) 를 호스트 `firestore.indexes.json`에 병합한다. 컬렉션 이름을 커스터마이즈했다면(`memiBoard.postsCollection` 등) 인덱스의 `collectionGroup` 값도 그에 맞게 바꿔야 한다.

> ⚠️ npm 패키지 tarball에도 `docs/` 가 포함된다(0.4.7+). 구버전이면 GitHub의 `docs/`를 보면 된다.

### 8. 최초 관리자와 카테고리 만들기

Rules는 일반 사용자가 스스로 관리자가 되는 것을 막는다. 따라서 최초 한 번은 다음 순서가 필요하다.

1. 아래 게시판 페이지를 만든 뒤 Google 또는 Apple로 로그인한다.
2. Firebase Console → Firestore에서 `memiBoardUsers/{uid}` 문서를 찾는다.
3. 해당 문서의 `role`을 문자열 `owner`로 변경한다.
   - UID는 Firebase Console → Authentication → Users에서도 확인할 수 있다.
4. `/board-settings`에서 첫 카테고리를 만든다. 카테고리가 없으면 글을 작성할 수 없다.
5. 이후 역할 변경은 `/board-users`의 `MemiBoardUsers`에서 처리한다.

> 최초 관리자 지정은 신뢰할 수 있는 프로젝트 운영자가 Firebase Console에서만 수행한다. 클라이언트 코드에 관리자 UID나 우회 규칙을 넣지 않는다.

## 사용법

라우팅·미들웨어는 **호스트 소유**. 컴포넌트는 모듈 auto-import (`MemiBoardList` 등).  
`import { MemiBoardEditor } from 'memi-board/runtime'`는 **안 된다**. 컴포넌트는 모듈이 auto-import하고, composable과 type만 `memi-board/runtime`에서 명시적으로 가져올 수 있다.

라우트별 완성 예제는 [호스트 설치 가이드](docs/host-integration.md#7-목록글쓰기상세-페이지-연결)에 있다. 목록·에디터·상세에는 `boardId`를 전달한다.

```vue
<!-- free 게시판 목록: 게시판 설정에서 먼저 free를 만든다 -->
<template>
  <MemiBoardList
    board-id="free"
    :get-post-link="post => `/board/free/${encodeURIComponent(post.slug)}`"
  />
</template>
```

```vue
<!-- 새 글: saved는 새 글의 slug를 전달한다 -->
<template>
  <MemiBoardEditor
    board-id="free"
    @saved="slug => navigateTo(`/board/free/${encodeURIComponent(slug)}`)"
  />
</template>
```

상세에는 `<MemiBoardDetail :board-id="boardId" :post-id="postId" />`를 사용한다. URL의 slug는 `resolvePostIdBySlug()`로 Firestore 문서 ID로 바꾼다. 기존 글 수정의 `saved` 이벤트는 문서 ID를 전달하므로 현재 상세 URL의 slug를 유지한다. 공개 페이지의 SEO와 로그인·관리 페이지 가드까지 포함한 연결 순서는 설치 가이드를 따른다.

### 관리 페이지

전체 설정·사용자 관리는 `owner` 또는 `admin` 역할을 사용한다. 기본 설치에서는 `authorized`를 전달하지 않는다. 관리자 역할 지정은 owner만 가능하고, owner 자체 변경은 신뢰할 수 있는 서버나 콘솔에서 한다. 담당 manager의 개별 게시판 설정은 `MemiBoardCategorySettings`와 `canConfigureBoard(boardId)`를 사용한다.

```vue
<!-- app/pages/board-settings.vue -->
<template>
  <MemiBoardSettings />
</template>
```

전체 게시판 설정에는 관리자(`owner`/`admin`) 전용 **고아 파일·문서 정리**가 표시됩니다. **고아 항목 조회**를 누르면 전체 게시글·댓글·좋아요와 Storage를 읽고, 부모 글이 없는 댓글·파일, 삭제된 댓글의 이미지, 대상 글·댓글이 없는 좋아요를 표시합니다. 경로·유형·파일 크기를 확인한 뒤 개별 또는 전체 선택하여 삭제할 수 있습니다. 최근 24시간 내 갱신된 파일과 기존 본문·번역·첨부·댓글에서 참조하는 파일은 보존합니다. 신고 기록과 게시글 없는 `body` 하위 문서는 이 기능의 정리 대상이 아닙니다.

사용하려면 호스트 프로젝트에 [Firestore 규칙 예제](docs/firestore.rules.example)와 [Storage 규칙 예제](docs/storage.rules.example)의 관리자 조회·삭제 권한을 반영해야 합니다. 커스텀 컬렉션을 사용하면 규칙 경로도 맞춰야 합니다. 조회는 본문을 포함한 전체 데이터를 읽으므로 데이터 규모에 따라 읽기 비용과 시간이 발생합니다. 삭제 대상은 내부 스냅샷에 고정하고, 조회 후 계정·설정 또는 파일 generation이 바뀌면 삭제를 중단합니다. 삭제 직전에 서버에서 다시 조회하며, 문서는 트랜잭션으로 부모 존재 여부를 확인합니다. 파일 삭제와 Firestore 저장은 원자적으로 묶이지 않으므로 게시판 사용이 적은 시간에 실행하세요. 실패한 항목은 목록에 남아 재시도할 수 있습니다.

```vue
<!-- app/pages/board-users.vue -->
<template>
  <MemiBoardUsers />
</template>
```

호스트의 별도 사이트 관리자 체계를 연동할 때만 `authorized`를 사용할 수 있다. 이 prop은 UI 표시만 허용하며 Firestore Rules를 우회하지 않는다. 이 경우에도 해당 사용자를 게시판 admin/owner로 등록하거나 호스트 Rules를 같은 관리자 체계에 맞게 수정해야 한다. 관리 URL이 일반 사용자에게 노출되지 않도록 호스트 라우트 가드를 추가하는 것을 권장한다.

### 제공하는 API

**컴포넌트 (auto-import):**  
`MemiBoardList`, `MemiBoardDetail`, `MemiBoardEditor`, `MemiBoardCommentList`, `MemiBoardCommentForm`, `MemiBoardAttachments`, `MemiBoardSignIn`, `MemiBoardSettings`, `MemiBoardUsers`, `MemiBoardVersionHistory`

**List props:** `boardId`(필수), `pageSize`, `category`(이전 이름), `postLinkBase`, `getPostLink(post)`, `linkBase`(deprecated)

**Editor props:** `boardId`, `postId`(수정), `fixedCategory`(path 고정 시 선택 UI 숨김)
본문은 Nuxt UI **`UEditor`**(TipTap, `content-type="html"`). 호스트 `@nuxt/ui` 4.x 에 Editor 포함 필요.

**에디터 이미지:** 툴바에서 기기 파일 또는 외부 HTTPS 이미지 URL을 추가할 수 있고, 붙여넣기 / 드롭 파일은 Firebase Storage에 업로드한다. 외부 URL은 Storage에 복사하지 않으며 원본이 삭제되거나 핫링크가 차단되면 표시되지 않는다. 첫 본문 이미지는 업로드·외부 링크 구분 없이 목록과 공유 대표 이미지로 사용한다.

`memiBoardPosts/{postId}/images/*` + `.../images/thumbnails/*` (최적화 이미지+썸네일).
글 문서는 아직 없을 수 있고, 붙여넣기는 `image/png` 등이 온다. Storage 예시 규칙은 쓰기를 **로그인 + 5MiB 미만 + `image/*` + 소유권 검증**으로 제한한다. 기존 글은 작성자 또는 전역 admin·owner만 수정할 수 있다. 글 저장 전에는 파일의 `customMetadata.ownerUid`가 로그인 UID와 같아야 하며, 기존 파일을 덮어쓸 때는 기존 메타데이터도 같아야 한다. 이미지 업로드도 Firestore의 글 존재 여부·소유권을 조회한다. 규칙은 **앱 `storageBucket`과 같은 버킷**에 배포해야 한다.

본문 이미지는 휴대폰 원본 기준 최대 25MB까지 선택할 수 있다. 5MB를 넘으면 브라우저에서 최대 2560px·JPEG 85%로 최적화하고, 결과가 여전히 5MB를 넘으면 2048px·75%로 한 번 더 줄인 뒤 업로드한다. 5MB 이하 이미지는 원본을 유지한다.
본문 HTML에는 원본 URL. 수정 중 버려진 파일은 호스트 스케줄러로 정리 (`extractEditorImageUrls` 로 본문 참조 비교).

**composables:**  
`useMemiBoardAuth`, `useMemiBoardPosts`, `useMemiBoardComments`, `useMemiBoardStorage`, `useMemiBoardModeration`, `useMemiBoardSettings`, `useMemiBoardUsers`, `useMemiBoardViews`  
**SEO (auto-import, 호스트 파이프라인):**  
`useMemiBoardListSeo`, `useMemiBoardPostSeo`  
**SEO fetch (필요 시):**  
`fetchPublicListForSeo`, `fetchPublicPostForSeo`, `resolvePublicSeoDb`

댓글은 시간순으로 10개씩 cursor 조회하며, 실제 `댓글 더보기` 버튼이 화면에 들어오면 1초 후 자동으로 다음 페이지를 읽는다. 기존 댓글을 모두 읽은 뒤에만 최신 댓글 1개를 실시간 구독한다. 대댓글은 5개씩 조회하고 모두 읽은 뒤 최신 답글 1개를 실시간 구독하며, 화면 깊이는 최대 2단계로 표시한다.

### 보드 (구 카테고리)

- 문서: `memiBoardSettings/{boardId}` → `{ label, listView, editorType, writeRole, commentWriteRole, visibility, allowedStaffUids, allowedManagerUids, locale, autoTranslate, autoTranslatePosts, i18n, i18nSource, order, updatedAt }`
- 설정이 없으면 빈 목록이며 기본 보드를 자동 생성하지 않음
- `MemiBoardSettings`에서 관리자가 보드별 저장·삭제·순서·리스트뷰·글쓰기 최소 역할 관리
- `boardId`는 문서 ID이자 각 글(`memiBoardPosts`)의 `boardId` 참조값이므로 생성 후 변경하지 않는 것을 권장

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
| 글 읽기 | 공개(`listed`·게시됨) 또는 작성자·관리자·담당 스태프. 숨김 보드는 작성자·관리자·담당 스태프만 |
| 댓글 읽기 | 공개(`listed`) 또는 작성자·관리자·담당 스태프·부모 글을 읽을 수 있는 사람 |
| 글 작성 | 로그인 + 보드 `writeRole` 충족 + `moderationStatus == 'approved'` |
| 댓글 작성 | 로그인 + 보드 `commentWriteRole` 충족. **숨김 보드는 담당 스태프만** (`commentWriteRole` 무시) |
| 글 수정·삭제 | 작성자 또는 해당 보드 관리자·담당 스태프 |
| 댓글 삭제 | 댓글 작성자 · 글 작성자 · 해당 보드 관리자·담당 스태프 |
| 연관 좋아요 정리 | 좋아요 작성자 또는 부모 글 작성자·해당 보드 관리자·담당 스태프. 댓글 좋아요는 댓글 작성자도 정리 가능 |
| 파일 업로드·삭제 | 기존 글은 글 작성자 또는 전역 admin·owner. 글 문서가 없으면 파일의 `ownerUid`로 검증 |
| 역할 관리 | owner는 다른 admin 지정 가능. admin은 manager·staff·user 관리. 자기 역할과 owner 변경은 클라이언트에서 금지 |

글 수정 시 `boardId`·`authorUid`는 바꿀 수 없고 `listed`는 공개 범위 전환 규칙을 따른다. 공개 범위 변경은 `visibilityTransition`을 기록해 새 글·댓글 생성과 일반 글 수정을 잠근 뒤 완료한다. 실패 시 같은 목표 공개 범위로 다시 저장한다. 글과 본문을 한 batch에서 만들 수 있도록 본문 쓰기는 `getAfter()`로 부모 글을 검증한다. 글 삭제 후에도 신고 기록은 보존한다.

Storage 예제의 파일 읽기·목록 조회는 공개다. 숨김 보드·비공개 초안의 Firestore 읽기 제한이 첨부파일에도 적용되는 것은 아니다. Storage의 admin·owner 권한은 보드 담당 여부와 무관한 전역 권한이다. 담당 staff/manager의 타인 파일 관리에는 별도 서버 API가 필요하다. 상세한 이유와 전환 방법은 [규칙 변경 안내](docs/firebase-setup.md#0451-규칙-변경과-기존-호스트-전환)를 참고한다.

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
| `blockBanThreshold` | `10` | 콘텐츠 차단(local/ai) 누적 이상이면 글·댓글 제한. `0` = off |
| `blockBanDecayMs` | `86400000` | 경고 1회 차감 간격(기본 24h) |

콘텐츠 차단이 누적되면 `memiBoardUsers/{uid}` 에 `moderationBlockCount` / `moderationBlockAt` 이 기록된다.  
10회면 약 하루 동안 작성 불가(24h마다 1 차감). Rules 예시에서 본인은 **+1만** 가능하고 감소·리셋은 admin.

### 관리자 검열 우회

글쓰기 폼(`Editor.vue`) 하단, 제출 버튼 위에 `isAdmin`인 사용자에게만 "비속어 필터 무시" 스위치가 보인다. 켜고 제출하면 로컬 금칙어·AI 검열을 모두 건너뛰고 저장한다(`via: 'admin-override'`, 경고 카운트도 쌓이지 않음). 댓글 폼(`CommentForm.vue`)에는 없다.

직접 호출할 때는 `useMemiBoardModeration().checkText(text, { skipFilter: true })`로 우회한다. `skipFilter`는 호스트가 넘긴 값 그대로 신뢰하므로, admin 여부 판정은 호출부(호스트)의 책임이다.

### AI 글쓰기 도우미 사용 제한

에디터의 AI 글쓰기 도우미는 로그인 사용자별 24시간 구간에 최대 **10회** 사용할 수 있다. 호출 전에는 `aiWritingPending` 예약만 잡고, 모델 호출이 성공하면 `aiWritingCount`로 확정한다. 호출이 실패하면 예약만 되돌린다. 확정된 횟수는 내려가지 않는다. 예약과 확정은 `memiBoardUsers/{uid}`를 Firestore 트랜잭션으로 갱신하므로 여러 탭이 동시에 실행해도 합이 10을 넘지 않는다.

호스트는 반드시 최신 `docs/firestore.rules.example`의 `memiBoardUsers/{uid}` 규칙을 실제 Firestore Rules에 병합·배포해야 한다. 0.47.1부터는 예약 필드가 추가됐다. 규칙을 배포하지 않으면 새 패키지의 글쓰기 AI 횟수 갱신이 거절되거나, 예전 규칙만 있는 동안 클라이언트가 카운터를 임의로 수정해 제한을 우회할 수 있다.

콘솔에서 **AI Logic(Gemini Developer API)** 활성화. 신규 프로젝트는 구형 `gemini-2.5-flash` 가 404 날 수 있음 → 3.x Flash / Flash-Lite 사용.

### App Check (AI Enforce 시 사실상 필수)

`firebaseml` / AI Logic 이 **Enforce** 되어 있으면 App Check 토큰 없이 `generateContent` 가 실패한다. memi-board는 App Check를 초기화하지 않는다. 기본값 `moderation.useLimitedUseAppCheckTokens: true` 는 **한 번만 쓰는 토큰**을 요구한다. reCAPTCHA v3의 `ReCaptchaV3Provider` 는 이 토큰을 만들지 않는다.

1. reCAPTCHA Enterprise에서 **점수형** 웹 키를 만든다. 체크박스 키와 v3 공급자는 쓰지 않는다. 도메인에는 실제 사이트 주소만 넣는다. 사이트 키는 공개 값이라 클라이언트 설정에 둔다. 시크릿 키는 클라이언트에 넣지 않는다. Firebase가 토큰을 교환한다.
2. Firebase 콘솔 → App Check → 웹 앱에 그 사이트 키를 등록한다. 등록하는 웹 앱의 `appId` 가 `vuefire.config.appId` 와 같아야 한다.
3. 브라우저 API 키의 API 제한에 **Firebase App Check API** 를 포함한다. 기존에 허용한 API는 빼지 않는다.
4. 호스트 플러그인에서 마운트 후에 Enterprise 토큰을 교환한다. SPA는 첫 페인트 전에 `document.body` 가 비어 있어 `ReCaptchaEnterpriseProvider` 의 숨은 위젯이 `appCheck/recaptcha-error` 로 실패한다.

```ts
// app/plugins/app-check.client.ts
import { initializeAppCheck, CustomProvider } from 'firebase/app-check'
import type { FirebaseApp } from 'firebase/app'
import { useFirebaseApp } from 'vuefire'

export default defineNuxtPlugin((nuxtApp) => {
  const siteKey = String(useRuntimeConfig().public.recaptchaSiteKey || '').trim()
  if (!siteKey) return
  const app = useFirebaseApp()

  nuxtApp.hook('app:mounted', () => {
    initializeAppCheck(app, {
      provider: new CustomProvider({
        getToken: () => exchangeEnterpriseToken(app, siteKey),
      }),
      // 한 번용 토큰은 세션으로 갱신하지 않는다. AI SDK가 호출마다 getToken 한다.
      isTokenAutoRefreshEnabled: false,
    })
  })
})

declare global {
  interface Window {
    grecaptcha?: {
      enterprise?: {
        ready: (callback: () => void) => void
        execute: (siteKey: string, options: { action: string }) => Promise<string>
      }
    }
  }
}

let enterpriseReady: Promise<void> | undefined

function loadEnterprise(siteKey: string) {
  enterpriseReady ??= new Promise((resolve, reject) => {
    const ready = () => {
      const enterprise = window.grecaptcha?.enterprise
      if (!enterprise) {
        reject(new Error('reCAPTCHA Enterprise가 로드되지 않았습니다.'))
        return
      }
      enterprise.ready(() => resolve())
    }
    if (window.grecaptcha?.enterprise) {
      ready()
      return
    }
    const script = document.createElement('script')
    script.src = `https://www.google.com/recaptcha/enterprise.js?render=${encodeURIComponent(siteKey)}`
    script.async = true
    script.onload = ready
    script.onerror = () => reject(new Error('reCAPTCHA Enterprise 스크립트를 불러오지 못했습니다.'))
    document.head.appendChild(script)
  })
  return enterpriseReady
}

async function exchangeEnterpriseToken(app: FirebaseApp, siteKey: string) {
  await loadEnterprise(siteKey)
  const enterprise = window.grecaptcha?.enterprise
  if (!enterprise) throw new Error('reCAPTCHA Enterprise가 로드되지 않았습니다.')
  const recaptchaToken = await enterprise.execute(siteKey, { action: 'fire_app_check' })
  const { projectId, appId, apiKey } = app.options
  const response = await fetch(
    `https://content-firebaseappcheck.googleapis.com/v1/projects/${projectId}/apps/${appId}:exchangeRecaptchaEnterpriseToken?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recaptcha_enterprise_token: recaptchaToken, limited_use: true }),
    },
  )
  if (!response.ok) throw new Error(`App Check token exchange failed (${response.status})`)
  const data = await response.json() as { token: string, ttl?: string }
  const seconds = Number(/^([\d.]+)s$/.exec(data.ttl ?? '')?.[1])
  return {
    token: data.token,
    expireTimeMillis: Date.now() + (Number.isFinite(seconds) ? seconds * 1000 : 60 * 60 * 1000),
  }
}
```

일반 세션 토큰을 쓰려면 `useLimitedUseAppCheckTokens: false` 로 바꾸고, 교환 본문의 `limited_use` 도 빼야 한다.

5. App Check 적용은 **Firebase AI Logic만** 켠다. Cloud Storage와 Cloud Firestore는 모니터링으로 둔다. 한 번용 토큰은 AI Logic만 받는다. Storage나 Firestore에 적용을 켜면 이미지 업로드와 글 저장이 `storage/unauthorized` 또는 권한 오류로 거절된다.
6. 로컬은 `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true` 로 나온 UUID를 콘솔 디버그 토큰에 등록한다. 프로덕션 빌드에서는 디버그 토큰을 켜지 않는다.

## 다른 프로젝트에 붙일 때 체크리스트

- [ ] 동일 스택: Nuxt 4 + `@nuxt/ui` 4 + `nuxt-vuefire` + Firebase
- [ ] `pnpm add memi-board @nuxt/ui nuxt-vuefire vuefire firebase`
- [ ] `modules`에 `@nuxt/ui`, `nuxt-vuefire`, `memi-board`
- [ ] `memiBoard` (`boardId` · `auth` · `moderation` · **`seo`**)
- [ ] 공개 목록·상세 **SSR on**, 쓰기·설정만 `ssr: false` (전 경로 CSR 금지)
- [ ] 목록·상세 페이지에 `await useMemiBoardListSeo` / `useMemiBoardPostSeo`
- [ ] 호스트 SEO API 없음
- [ ] CSS `@source` …/memi-board/dist/runtime/components
- [ ] (선택) `.memi-board-post-link:visited` 읽은 글 표시 CSS
- [ ] Rules 예시 병합 + **deploy**
- [ ] Storage 서비스 계정의 Firestore 조회 IAM 역할 확인 ([호스트 설정](docs/firebase-setup.md#storage-규칙의-firestore-조회-권한-부모호스트-프로젝트-필수-설정))
- [ ] 카테고리·listed 쿼리 사용 시 indexes deploy
- [ ] 페이지·미들웨어 직접 작성 (또는 playground 복사)
- [ ] 최초 로그인 후 Firebase Console에서 `memiBoardUsers/{uid}.role = 'owner'`
- [ ] 설정 페이지에서 첫 카테고리 생성
- [ ] (검열) AI Logic 활성화 + 권장 모델 + App Check
- [ ] `pnpm why vuefire` 로 이중 인스턴스 없는지 확인

같은 Firebase 프로젝트에 호스트 앱 유저 컬렉션이 있어도 무방 — 게시판 역할은 **`memiBoardUsers` 전용**이다.

## 문제 해결

### `useCurrentUser() called before the VueFireAuth module...`

`vuefire.auth.enabled` 미설정, 또는 `vuefire`/`firebase` 이중 설치. `pnpm why vuefire` → 하나로. 모듈이 `vite.resolve.dedupe`에 vue/vuefire/firebase를 넣지만, **호스트 peer 설치**가 우선이다.

### 카테고리 필터 쿼리 에러 / 인덱스 링크

콘솔이 안내하는 복합 인덱스 생성, 또는 위 `firestore.indexes.json` 배포.

### AI 검열 실패 / 글 안 올라감 (`onError: 'block'`)

App Check 토큰, `appId` 일치, 모델명(3.x), AI Logic 활성화, 네트워크. 브라우저 콘솔의 `moderation AI failed` warn 확인.

### 에디터 이미지 `storage/unauthorized`

본문 붙여넣기·업로드가 `User does not have permission to access 'memiBoardPosts/…/images/…'` 로 실패하면:

1. 로그인 상태인지 확인
2. `vuefire.config.storageBucket`과 `firebase.json` `storage.bucket`이 **같은 이름**인지 확인. 구 프로젝트는 `*.appspot.com`(앱)과 `*.firebasestorage.app`(CLI 기본)이 갈라질 수 있다 — 앱이 쓰는 쪽에 규칙을 배포한다.
3. 호스트 `storage.rules`에 `docs/storage.rules.example`의 `memiBoardPosts/{postId}/images` 규칙이 있는지 확인. 쓰기는 `image/*` 이어야 한다(붙여넣기 PNG).
4. 저장 전 파일에 `customMetadata.ownerUid`가 있는지 확인한다. 0.45.1 이상 패키지는 이를 자동으로 넣는다. 기존 글은 작성자·전역 admin·owner인지 확인한다.
5. 이미지 규칙도 Firestore를 조회하므로 [교차 서비스 IAM 역할](docs/firebase-setup.md#storage-규칙의-firestore-조회-권한-부모호스트-프로젝트-필수-설정)을 확인하고, `firebase deploy --only storage` 후 다시 올려 본다.

### ZIP 등 첨부파일 `storage/unauthorized`

`memiBoardPosts/{postId}/attachments/...`에서 실패하면 로그인 상태, 앱이 쓰는 버킷에 배포된 첨부 규칙, **파일당 20MiB 미만** 조건을 먼저 확인한다. 예시 규칙은 ZIP의 MIME 형식이나 `.exe.zip` 이름을 차단하지 않는다.

조건을 충족해도 실패하면 **호스트 Firebase 프로젝트의 Storage 서비스 계정에 Firestore 조회 역할이 있는지** 확인한다. 이미지·첨부 규칙은 `canWritePostFile`에서 `postExists`·`isPostOwner`·`isBoardStaff`를 통해 Firestore를 조회한다. 조회 권한이 없으면 새 글의 문서 존재 여부 확인부터 실패할 수 있다. [부모/호스트 설정 절차](docs/firebase-setup.md#storage-규칙의-firestore-조회-권한-부모호스트-프로젝트-필수-설정)에 따라 `roles/firebaserules.firestoreServiceAgent`를 설정한다.

### 글 삭제 `storage/unauthorized`

작성자 본인 글 삭제가 `User does not have permission to access 'memiBoardPosts/{postId}'` 로 실패하면, 파일 삭제가 아니라 **폴더 목록(`listAll`)** 이 막힌 것이다.

요청은 `prefix=memiBoardPosts/{postId}/`(끝 슬래시)다. `match /memiBoardPosts/{postId} { allow list }` 만 있으면 이 접두사와 안 맞는다. 호스트 `storage.rules`에 예시와 같은 블록이 있어야 한다.

```
match /memiBoardPosts/{postId}/{allPaths=**} {
  allow list, get: if true;
  allow delete: if canDeletePostFile(postId);
}
```

`canDeletePostFile`과 관련 함수도 최신 `docs/storage.rules.example`에서 함께 병합한다. 글 문서가 없으면 로그인만으로 삭제를 허용하던 예전 조건(`!postExists`)은 사용하지 않는다.

`write` 는 이 블록에 넣지 않는다(용량·`image/*` 제한은 `images`/`attachments`/`comment-images` match 가 담당). `firebase deploy --only storage` 후 다시 삭제한다. 패키지는 `images/`·`attachments/`·`comment-images/` 만 목록으로 비운다. 댓글 이미지는 글 문서가 남아 있는 동안 지운다. 글 문서가 먼저 사라지면 댓글 작성자가 아닌 파일은 글 작성자가 지우지 못한다.

목록 조회는 성공하지만 **개별 파일 삭제**가 거부되면, 위 [첨부파일 오류](#zip-등-첨부파일-storageunauthorized)와 같은 Firestore 조회 IAM 역할도 확인한다. 삭제 규칙 역시 글 소유권·사용자 역할을 Firestore에서 읽는다.

### monorepo `link:` / `file:` 로 개발할 때

링크하기 전에 패키지 의존성과 `dist`를 준비한다.

```bash
# memi-board 저장소
pnpm install
pnpm build

# 호스트 저장소
pnpm add link:../memi-board
```

| 수정 대상 | 반영 |
|-----------|------|
| `src/components/*` | 모듈이 링크 소스 직독 → **즉시** (dev HMR) |
| `useMemiBoard*Seo` (`src/composables/useMemiBoardSeo.ts`) | 호스트 Nuxt가 소스 컴파일 → **즉시** (dev 재시작이 필요할 수 있음) |
| `src/module.ts` · 그 외 core composable (`dist`) | **`pnpm build`** 후 호스트 dev 재시작 |

SEO composable은 `#imports`로 호스트 Nuxt 인스턴스를 쓴다. `dist/index.js`에 `nuxt/app`을 넣지 않으므로 link 시 Nuxt 이중 로딩(E1001)이 나지 않는다.

모듈이 Vue·Vue Router·VueFire·Firebase·TipTap dedupe를 자동 적용한다. 배포 전에는 의존성을 **npm 버전**으로 되돌린다.

링크 상태에서 새 Tailwind 클래스를 바로 시험하려면 호스트 CSS에 소스 경로를 하나 더 둔다.

```css
@source "../../../node_modules/memi-board/src/components";
@source "../../../node_modules/memi-board/dist/runtime/components";
```

### OG 메타가 비어 있거나 카톡 미리보기가 안 될 때

1. 공개 경로가 `ssr: false`로 꺼져 있지 않은지 (`routeRules`)
2. 페이지에 `await useMemiBoardListSeo` / `useMemiBoardPostSeo` 호출 여부
3. `memiBoard.seo.siteUrl` · `siteName` · `defaultOgImage`
4. `curl` / view-source 에 `og:title` 이 있는지 (Elements만 보지 말 것)
5. 글이 `listed` / 숨김 게시판이 아닌지 (숨김은 noindex)
6. 배포 URL로 재스크랩 (카톡·FB 캐시)

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

정리 기능의 권한 회귀 테스트(Java 21+와 Firebase CLI 필요):

```bash
pnpm build
pnpm test:cleanup
firebase emulators:exec --project demo-memi-cleanup-security --only auth,firestore,storage 'node --test tests/cleanup-rules.test.mjs'
```

공지(pinned) 권한 회귀 테스트:

```bash
firebase emulators:exec --project demo-memi-notice-rules --only auth,firestore 'node --test tests/notice-rules.test.mjs'
```

## npm 배포

npm Trusted Publishing(OIDC)을 사용한다. 장기 `NPM_TOKEN`이나 로컬 OTP는 저장하지 않는다.

1. `package.json`, `CHANGELOG.md`, 인앱 `versionHistory`의 버전을 갱신하고 `main`에 푸시한다.
2. `main` 푸시로 `.github/workflows/publish.yml`이 실행된다.
3. 이미 발행된 버전인지 확인한 뒤 빌드·타입 검사·회귀 테스트·Firebase 보안 규칙 테스트·패키지 dry-run을 거쳐 npm에 배포한다.

npm 패키지 설정의 Trusted Publisher는 GitHub 저장소 `fkkmemi/memi-board`, workflow `publish.yml`로 등록한다. GitHub Environment `npm-publish`에 승인자를 지정하면 워크플로 실행 뒤 실제 npm 배포 전에 한 번 더 승인할 수 있다.

## 버전 · 라이선스

- UI: `<MemiBoardVersionHistory />`
- 상세: [CHANGELOG.md](CHANGELOG.md)
- **MIT**

### 0.46 역할 및 서비스별 명칭

5개 역할과 게시판별 매니저 범위, `roleLabels`, 호스트 마이그레이션 절차는 [역할 마이그레이션](docs/roles-migration.md)을 참고한다. 설정 접근에는 `canConfigureBoard()`를 사용한다.
