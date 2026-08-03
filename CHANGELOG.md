# Changelog

이 프로젝트는 [Keep a Changelog](https://keepachangelog.com/ko/1.0.0/) 형식을, 버전 표기는 [Semantic Versioning](https://semver.org/lang/ko/)을 따른다.

## [0.4.7] - 2026-08-03

### Changed
- README 전면 정리 — 다른 Nuxt 호스트 재사용 체크리스트, 잘못된 `import { MemiBoardEditor }` 제거, List/Editor props, 검열 옵션·모델, App Check 실제 절차
- npm 패키지에 `docs/` 포함 (rules 예시·firebase-setup)
- firebase-setup: AI 모델·App Check·카테고리 인덱스 절 보강

## [0.4.6] - 2026-08-03

### Removed
- 검열 단계별 콘솔 스팸 (`[memi-board:moderation] start/local-pass/ai-raw` 등)
- 에디터 화면의 **검열 디버그** 줄 (via/flagged 요약)

### Changed
- AI 실패 시만 `console.warn` 한 줄; 사용자 메시지는 기술 용어 없이 안내

## [0.4.5] - 2026-08-03

### Changed
- 기본 AI 검열 모델: `gemini-2.5-flash` → `gemini-3.5-flash-lite` (신규 프로젝트에서 2.5 Flash 미제공)
- `moderation.useLimitedUseAppCheckTokens` — App Check limited-use 토큰 on/off (기본 true)

### Fixed
- 로컬 금칙어 목록 보강 (`시이발` 등)

## [0.4.4] - 2026-08-03

### Added
- 검열 디버그: `via`(local/ai/ai-error-allow 등), 콘솔 `[memi-board:moderation]` 단계 로그, 에디터 화면에 검열 결과 요약

### Fixed
- 댓글 삭제 전 confirm
- 카테고리 추가 시에도 AI Logic 검열

## [0.4.3] - 2026-08-03

### Added
- `getPosts({ category })` — 카테고리 필터 목록 조회
- `MemiBoardList`: `category`, `postLinkBase`, `getPostLink(post)` (호스트가 `/board/:cat/:id` 등 자유 구성)
- `MemiBoardEditor` `fixedCategory` — path 로 카테고리 고정 시 선택 UI 숨김·그 값으로 저장

### Deprecated
- `MemiBoardList` 의 `linkBase` — `getPostLink` / `postLinkBase` 사용 권장

## [0.4.2] - 2026-08-03


### Added
- **카테고리 관리 (`boardSettings` / `{prefix}Settings/config`)**: `useMemiBoardSettings().addCategory()` · `ensureSettings()` — 로그인 사용자가 옵션 추가 가능
- 글 작성/수정 에디터: 카테고리는 설정 문서 목록에서만 선택, **카테고리 추가** UI 제공 (목록에 없는 임의 값 저장 불가)

### Changed
- 설정 문서 시드: 관리자만이 아니라 로그인 사용자 방문/추가 시에도 기본 카테고리 생성
- `docs/firestore.rules.example` — boardSettings 쓰기를 로그인 사용자 + categories 필드 제한으로 완화

## [0.4.1] - 2026-08-03


### Fixed
- **글 수정 로드**: `postId` prop 을 `onMounted` 한 번만 보던 것을 `watch(..., { immediate: true })` 로 바꿔 라우트/prop 타이밍에 글이 안 불러와지던 경우 수정
- **수정 저장 에러 메시지**: `permission-denied` 를 한국어로 안내
- **updatePost**: 본문 `setDoc` 에 `merge: true`, 카테고리 미선택 시 `deleteField()` 로 정리

## [0.4.0] - 2026-08-03

### Changed (Breaking)

- **UI 전달 방식 재설계**: Vite 로 Vue SFC 를 한 파일에 prebundle 하던 방식을 폐기. prebundle 결과의 `resolveComponent('UButton')` 은 Nuxt UI 자동 import 와 맞지 않아 호스트에서 빈 화면이 났음
- **thin Nuxt 모듈 추가** (`memi-board/nuxt`): `addComponentsDir` 로 소스 SFC 만 호스트 파이프라인에 올림 → 호스트가 컴파일하므로 `<UButton>` 등 auto-import 정상. **vuefire / 라우트 / 미들웨어 / Firebase config 는 건드리지 않음**
- 메인 엔트리(`memi-board`)는 **core 전용** (configure / composables / types). 컴포넌트 named export 제거 — Nuxt 모듈 auto-import 사용 (`MemiBoardList` 등)
- 런타임 설정은 기존과 동일하게 호스트 플러그인의 `configureMemiBoard()` 만 사용 (모듈 options 로 흡수하지 않음)
- Tailwind `@source` 대상: `node_modules/memi-board/dist/runtime/components`

### Migration

```ts
// nuxt.config.ts
modules: ['@nuxt/ui', 'nuxt-vuefire', 'memi-board/nuxt']
// U* global hooks / transpile 핵 불필요
```

```css
@source "../../../node_modules/memi-board/dist/runtime/components";
```

```vue
<script setup>
// 컴포넌트는 모듈 auto-import — from 'memi-board' 로 가져오지 않음
import { useMemiBoardAuth } from 'memi-board'
</script>
<template>
  <MemiBoardList link-base="/board" />
</template>
```

## [0.3.1] - 2026-08-03

같은 목표(Nuxt 모듈 제거)로 독립적으로 작업된 다른 세션의 커밋(`abd8ef0`)과 히스토리가 갈라져 병합하며 발견한 것들. 두 구현을 비교해 실제 버그 2개를 찾아 고치고, 설계상 더 나은 선택 몇 가지를 반영했다.

### Fixed

- **글 삭제 시 다른 사람이 쓴 댓글에서 `permission-denied`**: 댓글 삭제 규칙이 댓글 작성자·관리자만 허용했는데, `deletePost()`는 글쓴이가 다른 사용자의 댓글까지 한꺼번에 지운다 — 글쓴이 본인도 지울 수 있도록 `docs/firestore.rules.example`에 `isOwner(parent post)` 조건 추가
- **댓글 500개 넘는 글 삭제 시 실패**: Firestore write batch는 최대 500건인데 `deletePost()`가 댓글을 전부 한 batch에 넣었음 — 450건씩 나눠 커밋하도록 수정
- **글 삭제 순서로 인한 permission-denied**: 본문(`body`)·첨부파일 Storage 규칙이 부모 글 문서의 소유권을 조회하는데, `deletePost()`가 부모 문서를 다른 것들과 동시에(병렬로) 지워서 순서에 따라 조회가 실패할 수 있었음 — 본문 → Storage → 부모 문서 순으로 고정
- Tailwind v4는 기본적으로 `node_modules`를 스캔하지 않아 memi-board 컴포넌트의 유틸리티 클래스가 호스트 CSS에서 통째로 누락될 수 있음 — README에 `@source` 설정 안내 추가, playground/README 예시에도 반영

### Changed

- `List.vue`의 내부 링크를 `resolveComponent('NuxtLink')`(Nuxt 전용) 대신 `vue-router`의 `RouterLink`로 변경 — Nuxt 의존을 한 겹 더 걷어냄
- `peerDependencies`에서 `nuxt`/`nuxt-vuefire` 제거(코드에서 직접 import한 적이 없어 불필요했음), `vue-router` 추가(RouterLink 직접 import로 실제 필요해짐). `vite.config.ts`의 external 목록에도 `vue-router` 추가 — 빠뜨리면 vue-router가 번들에 같이 딸려 들어가 호스트와 다른 라우터 인스턴스가 되는, vuefire/firebase 때와 같은 부류의 버그가 남
- `tsconfig.json`을 playground의 Nuxt 생성 tsconfig 확장 대신 `src/`만 보는 독립 설정으로 교체 — `pnpm typecheck`가 이제 실제로 라이브러리 소스를 검사한다(이전엔 playground 앱 코드만 검사되고 있었음)
- `package.json`에 `sideEffects: false`, `keywords` 추가

## [0.3.0] - 2026-07-31

### Changed (Breaking)

- **Nuxt 모듈 구조를 전부 제거하고 순수 Vue 3 컴포넌트/composable 패키지로 전환**. `src/module.ts`(`defineNuxtModule`), `installModule('nuxt-vuefire', ...)`, `nuxt.config`의 `memiBoard` 커스텀 키, `pages: true` 자동 라우트 등록, `memi-board-auth` 라우트 미들웨어를 모두 삭제
- 목적: 같은 플랫폼(Nuxt+Firebase)을 쓰는 여러 프로젝트에서 게시판을 재사용할 때, 호스트가 이미 갖추고 있는 nuxt-vuefire 설정과 memi-board의 설정이 서로 다른 지점(모듈 설치 vs nuxt.config 키)에서 충돌할 여지를 없앤다 — 이제 Firebase/nuxt-vuefire 설정은 항상 호스트 프로젝트 하나에만 있다
- 설정 방식 변경: `nuxt.config.ts`의 `memiBoard: {...}` 대신 `configureMemiBoard({ collectionPrefix, auth, moderation })`를 호스트가 직접 만든 Nuxt 플러그인에서 앱 부팅 시 한 번 호출
- 라우팅 변경: 자동 페이지 등록(`pages: true`) 제거 — 컴포넌트를 호스트가 자신의 `pages/`에 직접 배치하는 방식만 남음(기존에도 지원하던 방식). 글쓰기/수정 라우트 가드도 호스트가 직접 작성(README에 `vuefire`의 `getCurrentUser()`를 쓰는 예시 미들웨어 수록)
- 빌드 도구 교체: `@nuxt/module-builder`(`nuxt-module-build`) → 플레인 Vite 라이브러리 빌드(`@vitejs/plugin-vue` + `vite-plugin-dts`). `dist/module.mjs` → `dist/index.js`
- `src/runtime/*` 디렉터리 구조를 `src/*`로 평탄화(Nuxt 모듈 관례였던 `runtime/` 접두사 제거)
- 모든 컴포넌트/composable이 Nuxt 자동 임포트(`useRuntimeConfig`, `ref`/`computed`/`watch`, `useFirestore` 등)에 의존하지 않도록 명시적 `import`로 전환 — 플레인 Vite로 라이브러리를 빌드할 수 있게 됐고, 어떤 Nuxt 프로젝트 설정에서도 동일하게 동작함이 보장됨

## [0.2.4] - 2026-07-31

### Fixed

- `firebase`/`vuefire`/`nuxt-vuefire`를 `dependencies`에서 `peerDependencies`로 이동 — memi-board가 이 패키지들을 자체 번들하고 있으면, 호스트 프로젝트가 설치한 버전과 서로 다른 모듈 인스턴스가 생겨 `useCurrentUser()`가 항상 `undefined`를 반환하거나 `useCurrentUser() called before the VueFireAuth module was added` 에러가 나는 문제가 실제로 재현됨(vuefire의 인증 상태가 모듈 인스턴스별 WeakMap으로 관리되기 때문). 설치 안내와 README에 문제 해결 섹션 추가

## [0.2.3] - 2026-07-31

### Changed

- 신규 설치 시나리오를 처음부터 검토해 README의 설치 안내 공백 6가지를 보완: Firebase CLI/`.firebaserc`/`firebase.json` 사전 준비, 신규 프로젝트에서 Firestore/Storage/Auth 활성화, `firebaseConfig` 값 위치, AI Logic의 Blaze 요금제 필요 가능성, App Check는 옵션을 켜는 것만으론 강제되지 않고 콘솔에서 Enforce를 따로 켜야 한다는 점, Node/Nuxt 버전 요구사항
- 위 내용 중 상세 설명(Firebase 콘솔 클릭 경로, Apple 로그인 발급 절차 등)은 README를 간결하게 유지하기 위해 새 문서 [`docs/firebase-setup.md`](docs/firebase-setup.md)로 분리하고 README에서는 짧은 요약 + 링크만 남김

## [0.2.2] - 2026-07-31

### Added

- 게시글 카테고리 — `{prefix}Settings/config` 문서에 카테고리 목록을 두고, 글쓰기/목록/상세에서 선택·표시(`useMemiBoardSettings`, `BoardCategory`/`BoardSettingsModel` 타입, `PostModel.category`)
- 설정 문서가 없으면 코드 내장 기본 카테고리(자유/공지/질문)로 계속 동작하다가, 관리자(`role: 'admin'`)가 게시판에 처음 들어오는 순간 그 기본값으로 문서를 자동 생성 — 일반 사용자는 이 문서를 절대 쓰지 않음
- `docs/firestore.rules.example`에 `{prefix}Settings` 규칙 추가 (읽기 전체 공개, 쓰기는 관리자만)

## [0.2.1] - 2026-07-31

### Fixed

- 호스트 프로젝트가 이미 `nuxt-vuefire`를 쓰고 있으면(자체 Admin SDK 서버 기능이 있는 앱 등) 모듈이 `installModule('nuxt-vuefire', ...)`을 또 호출해 setup()이 두 번 실행되던 문제 — `nuxt-vuefire`엔 중복 설치 가드가 없어 플러그인·서버 라우트(`/api/__session` 등)가 중복 등록될 수 있었음. `hasNuxtModule()`로 이미 등록돼 있는지 확인해 있으면 재사용, 없으면 기존처럼 설치

### Changed

- README에 "이미 nuxt-vuefire를 쓰는 프로젝트에 붙이는 경우" 섹션 추가 — 호스트 쪽 설정에 `auth.enabled: true`가 필요하다는 점 명시
- README에 Security Rules를 **배포까지 해야 함**을 명확히 함 — 예시 규칙을 프로젝트 파일에 병합만 하고 `firebase deploy --only firestore:rules,storage`를 안 돌리면 글쓰기 시 `permission-denied`가 나는 실수가 실제로 재현돼서, 설치 섹션 상단에 경고를 추가하고 배포 명령을 명시함

## [0.2.0] - 2026-07-31

### Added

- Nuxt 모듈 스캐폴딩: `@nuxt/module-builder` 기반 `src/module.ts` + `src/runtime/` 구조, `playground/`로 개발용 앱 분리
- `defineNuxtModule` 옵션 스키마 (`MemiBoardModuleOptions`): `firebaseConfig`, `appCheck`, `collectionPrefix`, `auth`, `moderation`, `pages`, `emulators`
- `setup()`에서 `installModule('nuxt-vuefire', ...)` 호출로 Firebase Auth/Firestore/Storage 연동 (Admin SDK 미사용, 클라이언트 전용)
- 게시글 CRUD — `useMemiBoardPosts`
  - `{prefix}Posts/{slug}` (메타) + `{prefix}Posts/{slug}/body/main` (본문) 문서 분리
  - `slugify()` 기반 문서 ID, 충돌 시 `-2`, `-3`… 접미사
  - 목록 커서 페이지네이션 (`getPosts`), 캐스케이드 삭제(댓글 서브컬렉션 batch 삭제 → 메타/본문 삭제 → Storage 폴더 재귀 삭제)
- 첨부파일 — `useMemiBoardStorage`, `MemiBoardAttachments`
  - `uploadBytesResumable` 기반 업로드/진행률, 이미지 인라인 미리보기, 비이미지 다운로드 링크
- 댓글 — `useMemiBoardComments`, `MemiBoardCommentList`, `MemiBoardCommentForm`
  - `{prefix}Posts/{slug}/comments/{commentId}` 서브컬렉션, `vuefire`의 `useCollection`으로 실시간 반영
  - 댓글 작성/삭제 시 부모 글 `commentCount`를 같은 `writeBatch`로 증감
- 인증/권한 — `useMemiBoardAuth`, `MemiBoardSignIn`
  - Google / 이메일·비밀번호 로그인
  - `{prefix}Users/{uid}.role` 문서 기반 역할(`user`/`admin`), 최초 로그인 시 `role: 'user'`로 자동 생성, 모듈은 `admin` 승격을 절대 수행하지 않음
  - `canEdit`/`canDelete`/`canDeleteComment` — 작성자 본인 또는 admin만 허용
- AI 검열 — `useMemiBoardModeration`
  - 로컬 비속어 블록리스트(기본 제공 + `moderation.localBlocklist`로 확장) 1차 필터
  - Firebase AI Logic(`firebase/ai`, Gemini) 구조화 JSON 응답(`flagged`/`category`/`reason`) 2차 검열
  - `moderation.onError`(`'allow' | 'block'`)로 검열 API 장애 시 정책 선택, 기본값 `'allow'`
  - 글쓰기/댓글 작성 모두 제출 전 블로킹 검사 (Firestore/Storage 쓰기 전 차단)
- `pages: true` 옵션 — `extendPages`로 `/board`, `/board/new`, `/board/:id`, `/board/:id/edit` 자동 등록, 글쓰기/수정 라우트에 `memi-board-auth` 미들웨어 적용
- Security Rules 예시 — `docs/firestore.rules.example`, `docs/storage.rules.example`
- Firebase Local Emulator Suite 연동 — `emulators: true` 옵션, `firebase.json`
- 버전 히스토리 — `MemiBoardVersionHistory` 컴포넌트(`src/runtime/data/versionHistory.ts`가 단일 소스), `pages: true`일 때 `${base}/version-history`에 자동 등록. 게시판을 설치한 사이트에서도 비개발자가 markdown 없이 바로 볼 수 있게 하기 위함

### Fixed

- `pages: true` 라우트에서 한글 slug가 포함된 경로의 `base` 계산을 문자열 슬라이싱으로 하던 방식이 깨지는 문제 → 각 페이지의 `route.meta.memiBoardBase`를 모듈에서 직접 주입하는 방식으로 교체
- `MemiBoardList`에서 `<component :is="'NuxtLink'">`처럼 문자열로 동적 컴포넌트를 지정하면 Nuxt의 컴파일타임 auto-import 컴포넌트가 해석되지 않아 실제 링크가 렌더링되지 않던 문제 → `#components`에서 `NuxtLink`를 직접 import해서 컴포넌트 참조로 전달
- `vuefire`가 `nuxt-vuefire`의 전이 의존성으로만 존재해 `src/runtime/*`에서 직접 import 시 타입체크가 깨지던 문제 → `vuefire`를 직접 의존성으로 추가

## [0.1.0] - 2026-07-27

- `nuxi init`으로 프로젝트 최초 생성 (Nuxt 4 기본 스타터, 게시판 기능 없음)
