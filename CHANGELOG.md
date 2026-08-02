# Changelog

이 프로젝트는 [Keep a Changelog](https://keepachangelog.com/ko/1.0.0/) 형식을, 버전 표기는 [Semantic Versioning](https://semver.org/lang/ko/)을 따른다.

## [0.3.0] - 2026-08-01

### Changed

- Nuxt 모듈과 자동 라우트 생성을 제거하고 호스트 Firebase/VueFire를 재사용하는 Vue 컴포넌트 패키지로 전환
- `configureMemiBoard()`와 컴포넌트·composable을 ESM 공개 API로 제공
- Vite 라이브러리 빌드와 이식 가능한 TypeScript 선언 생성, npm 패키지 메타데이터 및 MIT 라이선스 추가
- 게시물 삭제를 댓글 450개 단위 배치 → 본문 → 첨부파일 → 부모 문서 순서로 변경
- 게시물 작성자가 부모 글 삭제 시 다른 사용자가 작성한 댓글도 정리할 수 있도록 Security Rules 예제 수정

### Removed

- `defineNuxtModule`, `pages: true`, 자동 미들웨어와 패키지 내부 Nuxt 페이지

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
