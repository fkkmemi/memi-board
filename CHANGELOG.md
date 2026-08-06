# Changelog

이 프로젝트는 [Keep a Changelog](https://keepachangelog.com/ko/1.0.0/) 형식을, 버전 표기는 [Semantic Versioning](https://semver.org/lang/ko/)을 따른다.

## [0.14.1] - 2026-08-06

### Changed
- `ListDefault`(일반 리스트뷰) 카드 레이아웃 재구성 — 왼쪽에 정사각형 썸네일(이미지 없으면 아이콘 플레이스홀더), 오른쪽에 작성자·시간·좋아요·댓글수를 세로로 배치, 카드 안쪽 여백 축소
- `List`가 이미 특정 카테고리로 필터된 목록에서는 카테고리 뱃지를 숨기도록 `show-category`를 하위 리스트뷰에 전달(카테고리 페이지 안에서 같은 뱃지가 매 글마다 반복 노출되던 중복 제거)

## [0.14.0] - 2026-08-06

### Added
- `Settings`/`CategorySettings`의 글쓰기 권한·댓글쓰기 권한·리스트뷰 선택을 `USelect` 대신 카드형 선택지(`OptionCards`)로 변경 — 3개 선택지를 한 화면에서 바로 비교하고 고를 수 있고, 라벨을 필드 위쪽에 고정
- `List`가 목록 위 헤더(제목·"게시판 설정"·"새 글쓰기" 버튼)를 직접 그리도록 `title`/`settingsTo`/`canManageSettings`/`writeTo`/`canWrite` prop 추가 — 호스트는 링크와 권한 값만 넘기면 되고 버튼 배치를 직접 조립할 필요가 없다
- `List`에 일반/이미지/영상 뷰 전환 아이콘 버튼(`ListViewSwitch`) 추가 — 카테고리의 `listView` 설정은 처음 진입 시 기본값으로만 쓰이고, 화면에서 즉시 다른 방식으로 바꿔 볼 수 있다(새로고침하면 다시 설정값으로 돌아감)

## [0.13.3] - 2026-08-06

### Fixed
- `Detail`/`Editor`의 유튜브 반응형 `iframe` 스타일이 실제로는 `youtube.com` 도메인에만 적용되고 `youtube-nocookie.com`/`youtu.be`에는 적용되지 않던 문제 — Vue `:deep()`은 콤마로 구분한 여러 셀렉터를 한 번에 받지 못해 첫 셀렉터만 유효했다. 셀렉터별로 `:deep()`을 각각 감싸도록 수정

## [0.13.2] - 2026-08-06

### Fixed
- 글쓰기 화면(`Editor`)에 삽입한 유튜브 임베드가 모바일에서 고정 640px 너비로 넘치던 문제 — 상세 화면(`Detail`)에만 있던 반응형 `iframe` 스타일(`board-content` 클래스 + `width:100%; aspect-ratio:16/9`)을 `Editor`에도 동일하게 적용

## [0.13.1] - 2026-08-06

### Fixed
- `useMemiBoardUsers()`가 호출되는 즉시 `boardUsers` 컬렉션 전체를 필터 없이 구독해서, 관리자가 아니거나 role을 아직 확인 중인 사용자가 `Users`/`Settings`/`CategorySettings`를 열면 `permission-denied`로 화면이 죽었다(로컬 테스트로 직접 재현·확인함). `enabled` 옵션을 추가해 실제로 볼 권한이 있을 때만 쿼리를 시작하도록 수정 — 세 컴포넌트 모두 자신의 `canManage`/`canManageStaff` 값을 넘기게 함

## [0.13.0] - 2026-08-06

### Added
- 카테고리별 "허용 스태프" 지정(`BoardCategory.allowedStaffUids`) — `writeRole`/`commentWriteRole`가 'staff'일 때, 지정하면 그 uid 목록에 있는 스태프만 해당 카테고리에 글/댓글을 쓸 수 있다(비어있으면 지금처럼 스태프 전체 허용). 게시판마다 다른 소운영자를 두는 용도(예: A는 staff1·staff2, B는 staff2·staff3). `Settings`/`CategorySettings`에 스태프 멀티선택 UI 추가(`useMemiBoardUsers`로 스태프 목록 조회)
- `docs/firestore.rules.example`에 `isAllowedStaffForCategory` 추가 — `canWriteCategory`/`canWriteComment`의 'staff' 분기에서 함께 검증(관리자는 항상 통과)

### Fixed
- 스태프 본인이 `allowedStaffUids`(자기 접근 범위)를 직접 넓히지 못하도록 카테고리 문서 `update` 규칙을 관리자/스태프로 분리 — 스태프는 이 필드 값을 실제로 바꿀 수 없다(값이 기존과 같아야만 통과). `Settings`/`CategorySettings`도 `canManageStaff` prop(기본값은 board-role 관리자 여부)이 없으면 스태프에게 이 필드 자체를 숨긴다

## [0.12.0] - 2026-08-06

### Added
- 카테고리별 댓글쓰기 권한(`BoardCategory.commentWriteRole`) — 글쓰기 권한(`writeRole`)과 동일한 등급(일반/스태프/관리자)으로 댓글·답글 작성 최소 역할을 설정. `Settings`/`CategorySettings`에 "댓글쓰기 권한" 필드 추가, `docs/firestore.rules.example`에 `canWriteComment`/`canCommentOnPost` 규칙 추가(댓글의 부모 글 카테고리를 조회해 검증)
- `CommentForm`이 이제 `category` prop을 받아 클라이언트에서도 권한 없는 카테고리면 폼 대신 안내 문구를 보여준다(서버 쪽 실제 검증은 rules가 담당, UI는 편의 기능) — `Detail`/`CommentList`/`CommentThread`가 `category`를 전달하도록 함께 수정

## [0.11.1] - 2026-08-05

### Changed
- 게시글 목록(`List`) 로딩 방식을 변경 — 최신 글 `pageSize`(기본 10)개는 `onSnapshot`으로 실시간 구독해 목록에 보이는 동안 좋아요·댓글 수가 바로 갱신되고, 그 이전 글은 "더보기" 클릭 시에만 1회성 조회로 이어서 불러온다
- "더보기"에 `CommentList`와 동일한 `IntersectionObserver` 자동 로드를 추가하고, 트리거가 보인 뒤 500ms 지나도 계속 보일 때만 실제로 불러오게 해 스크롤 중 반복 요청을 방지
- 게시글 상세(`Detail`)를 1회성 조회 대신 VueFire `useDocument`로 실시간 구독하도록 변경(`useMemiBoardPost`) — 좋아요·댓글 수가 별도 로컬 갱신 없이 화면에 바로 반영된다

## [0.11.0] - 2026-08-05

### Added
- 게시글 좋아요 버튼(`LikeButton`, `useMemiBoardLikes`) — `likes/{uid}` 서브컬렉션으로 1인 1좋아요를 보장하고, 트랜잭션으로 토글해 대량(1000+) 좋아요에서도 카운터가 실제 문서 수와 어긋나지 않게 처리
- `PostModel.likeCount` 필드, 게시글 목록(`ListDefault`)에 좋아요 수 뱃지 노출

### Compatibility
- `docs/firestore.rules.example`에 `isLikeCountUpdate()`와 `memiBoardPosts/{postId}/likes/{uid}` 규칙 추가 — 설치 프로젝트가 실제 배포하는 `firestore.rules`에도 병합해야 좋아요가 동작한다

## [0.10.1] - 2026-08-05

### Added
- 게시글 목록·상세·댓글의 작성 시각을 Day.js 한국어 상대시간으로 표시하고 1분마다 갱신
- 댓글 모델에 향후 수정 기능을 위한 선택적 `updatedAt` 필드 추가, 새 댓글·답글 생성 시 초기값 저장
- 생성·수정 시각이 다를 때 두 시간을 구분해 보여주는 공통 `formatTimestampDetails` 런타임 유틸

### Changed
- 게시글 목록·상세·댓글 시간 툴팁을 동일한 Nuxt UI 기본 툴팁 표현으로 통일
- 생성·수정 시각이 같거나 기존 데이터에 수정 시각이 없으면 전체 날짜·시간 하나만 표시

### Fixed
- 여러 줄 시간 툴팁이 Nuxt UI 기본 고정 높이를 벗어나 테두리 밖으로 넘치던 문제

## [0.10.0] - 2026-08-05

### Added
- 패키지 루트 `memi-board`를 Nuxt 모듈 진입점으로 제공하고 런타임 API는 `memi-board/runtime`으로 분리
- `nuxt.config.ts`의 `memiBoard` 옵션을 런타임 설정으로 자동 연결하는 Nuxt 플러그인 생성
- 모듈이 필요한 Day.js 최적화와 Vue·Firebase·TipTap 의존성 중복 제거 설정을 자동 적용
- 게시판 하단 `powered by memi` 정보창에 기술 스택 카드와 버전 히스토리 탭 제공
- OTP 한 번으로 빌드·타입 검사·패키지 점검 후 배포하는 `pnpm release` 명령

### Changed
- 별도 `configureMemiBoard` 플러그인 없이 `nuxt.config.ts` 한 곳에서 게시판을 설치하고 설정하도록 단순화
- 게시글 목록 이동을 NuxtLink 기반으로 통일해 SSR·CSR 환경에서 동일하게 동작
- TipTap 핵심 패키지를 설치 프로젝트가 직접 버전에 맞춰 설치하지 않아도 되도록 패키지 내부 의존성으로 정리
- README와 Firebase 설정 문서를 Nuxt 4 설치, 관리자 초기화, 로컬 링크 개발 흐름에 맞게 전면 개편

### Fixed
- 설치 프로젝트의 Day.js 중복 인스턴스로 상세 페이지 이동이 멈출 수 있던 문제

### Compatibility
- 기존 `memi-board/nuxt` 모듈 경로는 호환 별칭으로 유지

## [0.9.1] - 2026-08-04

### Fixed
- npm 설치 환경에서 `MemiBoardUsers`가 패키지에 없는 상대경로 composable을 참조해 호스트 빌드가 실패하던 문제

## [0.9.0] - 2026-08-04

### Added
- 댓글 답글 스레드: 대상 사용자 표시, 최대 2단계 들여쓰기, 자동 펼침
- 댓글·대댓글 cursor 페이지네이션 종료 후 최신 1개 실시간 구독
- 뷰포트에 들어오면 자동 동작하는 실제 댓글 더보기 버튼과 로딩 스켈레톤

### Changed
- 일반 댓글은 시간순 10개, 대댓글은 시간순 5개 단위로 조회
- 라이브 데이터는 기존 페이지를 모두 읽은 뒤에만 누적해 페이지 데이터와 순서가 섞이지 않도록 변경
- 댓글과 대댓글 작성 폼·항목·스레드 컴포넌트를 유지보수 가능한 단위로 분리

### Fixed
- 최신 1개 실시간 결과가 기존 댓글을 교체하던 문제
- 답글 작성 브라우저만 첫 페이지로 초기화되던 문제
- 라이브 답글과 더보기 답글의 시간순서 및 불필요한 더보기 버튼 표시 문제

## [0.8.0] - 2026-08-04

### Added
- 최근 댓글 5개 실시간 구독과 이전 댓글 5개 cursor 조회를 결합한 하이브리드 목록
- Day.js 한국어 상대시간과 전체 날짜·시간 툴팁
- 개별 댓글과 로딩 스켈레톤 컴포넌트

### Changed
- 댓글 작성 폼을 시간순 목록 아래로 이동
- 이전 댓글 더보기와 5개 스켈레톤을 목록 상단에 배치
- 일반 사용자의 댓글 batch가 부모 게시글 `commentCount`만 ±1 갱신할 수 있도록 규칙 예제 보완

### Fixed
- 일반 사용자의 댓글 작성·삭제 batch가 게시글 update 권한에서 거부되던 문제

## [0.7.0] - 2026-08-04

### Added
- 카테고리별 글쓰기 최소 역할: 일반 이상·스태프 이상·관리자만
- VueFire 카테고리 쿼리의 명시적 SSR key

### Fixed
- 게시판 설정에서 서버와 클라이언트의 로딩 상태가 달라 발생하던 hydration 경고
- Nuxt 모듈 선언 생성 시 발생하던 비이식 타입 추론 경고

## [0.6.0] - 2026-08-04

### Added
- `MemiBoardUsers` 관리자 사용자 목록·역할 변경 UI
- `useMemiBoardUsers()` 실시간 사용자 구독과 역할 변경 API
- `admin`·`staff`·`user` 역할별 권한 설명

### Changed
- `staff`가 모든 게시글·댓글과 관련 Storage 파일을 관리할 수 있도록 권한 모델 확장
- 로그인 시 boardUsers 문서에 이메일과 프로필 사진 메타데이터 동기화
- 사용자 목록 읽기를 관리자 또는 본인 문서로 제한

## [0.5.0] - 2026-08-04

### Added
- 일반·이미지·영상 전용 리스트뷰 컴포넌트와 카테고리 설정 기반 자동 분기
- 공식 TipTap YouTube 확장: 툴바 입력·URL 붙여넣기 자동 임베드·반응형 읽기 화면
- 상세 하단 이전·목록·다음 탐색
- 게시글 목록용 요약·대표 이미지·영상 URL 메타데이터
- 카테고리 설정 패널별 저장·삭제·이동 및 해당 게시판 바로가기

### Changed
- Firestore 자동 ID를 게시글·Storage의 영구 내부 ID로 사용하고 공개 URL은 `category + slug`로 조회
- 카테고리를 `{prefix}Settings/config/categories/{categoryId}` 개별 문서로 저장하고 `order`로 실시간 정렬
- 상세 본문을 Nuxt UI Editor 읽기 전용 모드로 표시해 작성 화면과 문단 간격·서식을 통일
- 고정 카테고리 작성·수정 UI와 상세 작성자·관리 버튼 배치 정리
- 카테고리 기본값 자동 생성 및 프론트 fallback 제거

### Fixed
- 새 글 이미지·첨부파일이 `new-{timestamp}` 임시 폴더에 영구 잔류하던 구조
- 제목 수정 시 내부 문서·Storage 식별자가 달라질 수 있던 구조

## [0.4.15] - 2026-08-03

### Fixed
- npm 설치 환경에서 `MemiBoardSettings`가 배포되지 않은 상대경로 모듈을 참조해 호스트 빌드가 실패하던 문제

## [0.4.14] - 2026-08-03

### Added
- `MemiBoardSettings` 관리자 설정 컴포넌트: ID 기준 카테고리 확장 패널, 라벨·순서·삭제 관리
- 카테고리별 `listView`: `default`(일반)·`image`(이미지)·`video`(영상)
- `useMemiBoardSettings().saveCategories()` 일괄 저장 API

## [0.4.13] - 2026-08-03

### Fixed
- `deletePost`: 댓글·본문·`posts/{id}` Storage 폴더 외에, 첨부 path·본문 이미지 URL(임시 `new-*` 네임스페이스 포함)까지 삭제

## [0.4.12] - 2026-08-03

### Changed
- 에디터를 **Nuxt UI / shineb 축으로 슬림화** (유지보수)
  - `UEditor` + `UEditorToolbar` + `UEditorDragHandle`, `content-type="html"`
  - 이미지: 공식 `handlers.image` + 앱 레벨 paste/drop (TipTap Extension 없음)
  - 상세: 정적 HTML 렌더 유지 (읽기 전용 UEditor 미사용)
  - textarea 폴백 / PluginKey Extension 제거

## [0.4.11] - 2026-08-03

### Added
- 에디터 이미지 업로드 (shineb 동일 모델)
  - 원본 + 400px JPEG 썸네일 → Storage `{prefix}/posts/{id}/images/` · `.../thumbnails/`
  - 툴바 이미지 버튼 · 붙여넣기 · 드래그 앤 드롭
  - `uploadEditorImage` / `deleteEditorImage` / `extractEditorImageUrls`
  - 본문에서 빠진 고아 파일은 호스트 스케줄러로 정리 예정
- storage.rules 예시: `images/{allPaths=**}` (5MB, image/*)

## [0.4.10] - 2026-08-03

### Changed
- 글쓰기 본문: `UTextarea` → **Nuxt UI `UEditor`** (TipTap, markdown)
  - 툴바·드래그 핸들 (shineb `PostEditor` 패턴)
  - 상세 보기: 읽기 전용 `UEditor` 로 마크다운 렌더
  - 기존 일반 텍스트 글도 markdown 으로 호환 표시

## [0.4.9] - 2026-08-03

### Changed
- 검열 차단 메시지에 **무엇이 문제인지** 표시
  - 로컬 금칙어: 걸린 표현 안내 (예: 「시발」 같은 표현은…)
  - AI: reason/category 기반 사용자용 문구 + 경고 n/3 접미

## [0.4.8] - 2026-08-03

### Added
- 콘텐츠 검열 차단 누적 제한: `{prefix}Users.moderationBlockCount` / `moderationBlockAt`
  - 로컬·AI `flagged` 시 +1 (API 오류는 제외)
  - 기본 3회 이상 → 글·댓글 작성 약 24시간 제한 (24h lazy 차감, 매장 contentWarning 과 동일 모델)
  - `moderation.blockBanThreshold` / `blockBanDecayMs` (0 이면 off)
- Rules 예시: 경고 필드는 +1 만 허용, 감소·리셋은 admin

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
