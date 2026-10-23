# 다른 Nuxt 사이트에 memi-board 붙이기

[README](../README.md) · [국제화·번역 설정](internationalization.md) · [Firebase 준비](firebase-setup.md) · [역할 마이그레이션](roles-migration.md)

기존 Nuxt 4 사이트에 게시판을 추가하는 절차다. 호스트는 라우트·Firebase 연결·규칙 배포를 맡고, memi-board는 게시판 컴포넌트와 composable을 제공한다.

이 가이드의 국제화·번역 옵션을 포함한 예제는 **memi-board 0.47.0 이상**을 기준으로 한다. 필수 버전은 Nuxt 4+, Nuxt UI 4+, Firebase 12+, Vue 3.5+, VueFire 3.2+다.

## 1. 필요한 패키지 설치

기존 Nuxt 프로젝트 루트에서 실행한다.

```bash
pnpm add memi-board@^0.47.0 @nuxt/ui nuxt-vuefire vuefire firebase
```

`dayjs`는 필요 없다. `@nuxtjs/i18n`은 사이트 언어 전환이 필요할 때만 추가한다. 운영 환경에서는 검증한 memi-board 버전과 lockfile을 함께 관리한다.

## 2. 먼저 언어 모드 선택

| 서비스 | 권장 설정 |
|---|---|
| 한국어 공지·문의 게시판 | `locale: 'ko', i18n: { enabled: false }` |
| 영어 전용 서비스 | `locale: 'en', i18n: { enabled: false }` |
| 여러 언어 UI, 글은 작성한 언어 그대로 | `i18n: { enabled: true }, translation: { enabled: false }` |
| 게시판·글을 여러 언어로 번역 | `i18n: { enabled: true }, translation: { enabled: true }` |

설정 생략 시 두 기능은 모두 활성 상태다. 콘텐츠 번역에는 별도 Firebase AI Logic 준비가 필요하다. 자동 번역 토글의 의미와 실제 실행 시점은 [국제화·번역 설정](internationalization.md#4-번역이-실행되고-저장되는-시점)을 참고한다.

## 3. Nuxt 설정에 병합

다음은 **한국어 전용, AI 검열·번역을 사용하지 않는** 시작 예제다. 기존 `modules`, CSS, Firebase 설정이 있다면 중복 등록하지 않고 병합한다.

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@nuxt/ui', 'nuxt-vuefire', 'memi-board'],
  css: ['~/assets/css/main.css'],
  vuefire: {
    config: {
      apiKey: 'FIREBASE_WEB_API_KEY',
      authDomain: 'YOUR_PROJECT.firebaseapp.com',
      projectId: 'YOUR_PROJECT',
      storageBucket: 'YOUR_ACTUAL_BUCKET',
      messagingSenderId: 'YOUR_SENDER_ID',
      appId: 'YOUR_WEB_APP_ID'
    },
    auth: { enabled: true }
  },
  memiBoard: {
    locale: 'ko',
    i18n: { enabled: false },
    auth: { providers: ['google'] },
    moderation: { enabled: false },
    seo: {
      siteName: '우리 서비스',
      siteUrl: 'https://example.com',
      basePath: '/board'
    }
  },
  routeRules: {
    '/board/**/new': { ssr: false },
    '/board/**/edit': { ssr: false },
    '/board-settings': { ssr: false },
    '/board-settings/**': { ssr: false },
    '/board-users': { ssr: false }
  }
})
```

Firebase 값은 **붙일 사이트의 Firebase 웹 앱 설정**을 사용한다. Storage 버킷 이름은 프로젝트마다 다를 수 있으므로 콘솔의 실제 값을 복사한다. Firebase Admin 서비스 계정 키는 클라이언트 설정에 넣지 않는다.

공개 목록·상세의 SSR은 유지한다. `moderation.enabled: false`여도 기본 로컬 금칙어 검사는 남는다. 글쓰기 AI의 교정·문장 다듬기까지 끄는 옵션은 이 설정에 포함되지 않으며, 해당 AI 메뉴를 사용할 때는 AI Logic 연결이 필요하다.

## 4. 스타일과 UApp 연결

```css
/* app/assets/css/main.css */
@import "tailwindcss";
@import "@nuxt/ui";
@source "../../../node_modules/memi-board/dist/runtime/components";
```

`@source`는 위 CSS 파일 위치 기준이다. 다른 위치의 CSS를 쓰면 상대 경로를 맞춘다.

```vue
<!-- app/app.vue — 기존 UApp이 있으면 중복으로 감싸지 않는다 -->
<template>
  <UApp>
    <NuxtPage />
  </UApp>
</template>
```

레이아웃이 있는 앱은 기존 `<NuxtLayout>` 구조를 유지한다. Nuxt UI 내부 문구도 한국어로 고정하려면 `@nuxt/ui/locale`의 `ko`를 가져와 `<UApp :locale="ko">`로 지정한다. 호스트의 `<html lang>`도 호스트가 관리한다.

## 5. 규칙과 인덱스 배포

설치한 패키지의 다음 파일을 호스트 파일에 병합한다. 이미 사이트 규칙이 있으면 통째로 덮어쓰지 않는다.

| 패키지 파일 | 호스트 파일 |
|---|---|
| `node_modules/memi-board/docs/firestore.rules.example` | `firestore.rules` |
| `node_modules/memi-board/docs/storage.rules.example` | `storage.rules` |
| `node_modules/memi-board/docs/firestore.indexes.json.example` | `firestore.indexes.json` |

```bash
firebase deploy --only firestore:rules,storage,firestore:indexes
```

`firebase.json`에는 인덱스 파일 경로도 지정한다. Storage 규칙의 배포 버킷은 `vuefire.config.storageBucket`과 같아야 한다. 교차 서비스 IAM까지 포함한 최초 설정은 [Firebase 준비](firebase-setup.md#storage-규칙의-firestore-조회-권한-부모호스트-프로젝트-필수-설정)를 따른다. npm 설치나 웹 사이트 배포가 이 배포를 대신하지 않는다.

## 6. 관리 페이지와 첫 게시판 만들기

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

로그인용 페이지 또는 기존 계정 화면에 `<MemiBoardSignIn />`을 추가하고 다음 순서로 초기화한다.

1. Firebase Authentication에서 Google 공급자와 사이트의 승인 도메인을 설정한다.
2. 게시판의 로그인 컴포넌트로 로그인하여 `memiBoardUsers/{uid}` 문서를 생성한다. 호스트 자체 로그인만 있다면 게시판 인증 composable도 사용하는 페이지를 연다.
3. 신뢰할 수 있는 Firebase Console 또는 서버 Admin SDK에서 해당 문서의 `role`을 `owner`로 지정한다.
4. 새로고침 또는 재로그인 후 `/board-settings`에서 ID가 `free`인 게시판을 만든다.
5. `/board-users`에서 필요한 계정에 `admin`·`manager`·`staff` 역할을 지정하고, 게시판 설정에서 담당자를 배정한다.

최초 owner 지정과 owner 이관은 클라이언트 역할 선택 메뉴로 하지 않는다. 라우트 접근 가드는 호스트가 추가하고, 실제 데이터 접근은 규칙으로 검증한다. 호스트 로그인 공급자가 게시판과 같은 Firebase Auth를 사용하면 로그인 상태를 공유한다.

## 7. 목록·글쓰기·상세 페이지 연결

권장 경로는 다음과 같다. `/board` 시작 페이지와 메뉴 구성은 호스트가 정한다.

| 파일 | URL | 전달할 값 |
|---|---|---|
| `app/pages/board/[boardId]/index.vue` | `/board/free` | 목록의 `boardId` |
| `app/pages/board/[boardId]/new.vue` | `/board/free/new` | 에디터의 `boardId` |
| `app/pages/board/[boardId]/[slug]/index.vue` | `/board/free/글-slug` | slug를 조회해 상세의 `postId`로 전달 |
| `app/pages/board/[boardId]/[slug]/edit.vue` | `/board/free/글-slug/edit` | 조회한 문서 ID로 기존 글 수정 |

컴포넌트는 Nuxt 모듈이 auto-import한다. `memi-board/runtime`에서는 composable과 타입만 가져온다.

### 목록

```vue
<!-- app/pages/board/[boardId]/index.vue -->
<script setup lang="ts">
const route = useRoute()
const boardId = computed(() => String(route.params.boardId || ''))
const { isSignedIn, canConfigureBoard } = useMemiBoardAuth()
const { boardLabel } = useMemiBoardSettings()
await useMemiBoardListSeo({
  category: boardId,
  path: computed(() => `/board/${encodeURIComponent(boardId.value)}`)
})
</script>

<template>
  <MemiBoardList
    :board-id="boardId"
    :title="boardLabel(boardId)"
    :get-post-link="post => `/board/${encodeURIComponent(boardId)}/${encodeURIComponent(post.slug)}`"
    :write-to="`/board/${boardId}/new`"
    :can-write="isSignedIn"
    :settings-to="`/board-settings/${boardId}`"
    :can-manage-settings="canConfigureBoard(boardId)"
  />
  <MemiBoardSignIn v-if="!isSignedIn" />
</template>
```

`canWrite`는 이 예제에서 로그인 여부만 표시한다. 스태프·관리자 전용 게시판을 운영할 때는 호스트가 게시판의 `writeRole`과 담당 범위까지 검사해 버튼을 표시한다. 규칙은 버튼 표시와 별개로 쓰기 권한을 검증한다.

목록의 개별 설정 링크에 대응하는 페이지도 만든다.

```vue
<!-- app/pages/board-settings/[boardId].vue -->
<script setup lang="ts">
const route = useRoute()
const boardId = computed(() => String(route.params.boardId || ''))
</script>

<template>
  <MemiBoardCategorySettings :category-id="boardId" />
</template>
```

매니저 진입 가드에는 `canConfigureBoard(boardId)`, 콘텐츠 관리에는 `canManageBoard(boardId)`를 사용한다. 설정 컴포넌트도 기본적으로 담당 설정 권한을 확인한다.

### 글쓰기

```vue
<!-- app/pages/board/[boardId]/new.vue -->
<script setup lang="ts">
const route = useRoute()
const boardId = computed(() => String(route.params.boardId || ''))
const { isSignedIn, rolePending } = useMemiBoardAuth()
</script>

<template>
  <MemiBoardEditor
    v-if="!rolePending && isSignedIn"
    :board-id="boardId"
    @saved="slug => navigateTo(`/board/${boardId}/${encodeURIComponent(slug)}`)"
    @cancel="navigateTo(`/board/${boardId}`)"
  />
  <MemiBoardSignIn v-else-if="!rolePending" />
</template>
```

새 글의 `saved` 이벤트는 **slug**를 전달하고, 기존 글 수정의 `saved` 이벤트는 **Firestore 문서 ID**를 전달한다. 수정 페이지에서는 현재 URL의 slug를 유지해 이동한다. 에디터 자체가 게시판 언어를 적용한다.

### 상세

```vue
<!-- app/pages/board/[boardId]/[slug]/index.vue -->
<script setup lang="ts">
const route = useRoute()
const boardId = computed(() => String(route.params.boardId || ''))
const slug = computed(() => String(route.params.slug || ''))
const { post: seoPost } = await useMemiBoardPostSeo({
  category: boardId,
  slug,
  path: computed(() => `/board/${encodeURIComponent(boardId.value)}/${encodeURIComponent(slug.value)}`)
})
const { resolvePostIdBySlug } = useMemiBoardPosts(boardId)
const postId = ref('')
const unavailable = ref(false)
watch([boardId, slug, seoPost], async ([board, currentSlug, seo], _, onCleanup) => {
  let active = true
  onCleanup(() => { active = false })
  postId.value = ''
  unavailable.value = false
  if (seo?.id && seo.category === board && seo.slug === currentSlug) {
    postId.value = seo.id
    return
  }
  if (import.meta.server) return
  const result = await resolvePostIdBySlug(currentSlug)
  if (!active) return
  postId.value = result.status === 'ok' ? result.id : ''
  unavailable.value = result.status !== 'ok'
}, { immediate: true })
</script>

<template>
  <MemiBoardDetail
    v-if="postId"
    :board-id="boardId"
    :post-id="postId"
    @edit="navigateTo(`/board/${boardId}/${encodeURIComponent(slug)}/edit`)"
    @navigate="post => navigateTo(`/board/${boardId}/${encodeURIComponent(post.slug)}`)"
    @list="navigateTo(`/board/${boardId}`)"
    @deleted="navigateTo(`/board/${boardId}`)"
  />
  <p v-else-if="unavailable">글을 찾을 수 없거나 접근 권한이 없습니다.</p>
  <p v-else>불러오는 중입니다.</p>
</template>
```

`boardId`는 게시판 설정의 문서 ID, `postId`는 글의 Firestore 문서 ID, `slug`는 URL용 문자열이다. 상세 컴포넌트에 slug를 `postId`로 넣지 않는다. 위 예제의 공개 상세 SEO는 SSR에서 채우고, 초안·비공개 글의 클라이언트 조회는 로그인과 규칙을 따른다.

### 수정

```vue
<!-- app/pages/board/[boardId]/[slug]/edit.vue -->
<script setup lang="ts">
const route = useRoute()
const boardId = computed(() => String(route.params.boardId || ''))
const slug = computed(() => String(route.params.slug || ''))
const { rolePending, isSignedIn, canEdit } = useMemiBoardAuth()
const { resolvePostIdBySlug, getPost } = useMemiBoardPosts(boardId)
const postId = ref('')
const pending = ref(true)
watch([boardId, slug, rolePending, isSignedIn], async (_, __, onCleanup) => {
  let active = true
  onCleanup(() => { active = false })
  postId.value = ''
  pending.value = true
  if (rolePending.value) return
  if (isSignedIn.value) {
    try {
      const result = await resolvePostIdBySlug(slug.value)
      const post = result.status === 'ok' ? await getPost(result.id) : null
      if (active && post && canEdit(post)) postId.value = post.id ?? ''
    }
    catch {
      // 로그인·권한·삭제·네트워크 오류는 아래 안내로 처리한다.
    }
  }
  if (active) pending.value = false
}, { immediate: true })
</script>

<template>
  <p v-if="pending">불러오는 중입니다.</p>
  <MemiBoardEditor
    v-else-if="postId"
    :board-id="boardId"
    :post-id="postId"
    @saved="navigateTo(`/board/${boardId}/${encodeURIComponent(slug)}`)"
    @cancel="navigateTo(`/board/${boardId}/${encodeURIComponent(slug)}`)"
  />
  <p v-else>글을 수정할 권한이 없거나 글을 불러올 수 없습니다.</p>
</template>
```

## 8. 역할과 서비스별 명칭

```ts
memiBoard: {
  roleLabels: {
    user: '고객',
    staff: '매장 직원',
    manager: '매장 관리자',
    admin: '운영자',
    owner: '최고 관리자'
  }
}
```

명칭만 바뀌며 권한은 바뀌지 않는다. manager는 `allowedManagerUids`에 지정된 게시판의 설정과 스태프 배정을 관리한다. 매장·조직과 게시판을 연결하고 담당 배정을 동기화하는 책임은 호스트에 있다. 단순히 같은 Firebase 프로젝트를 쓴다고 조직 경계가 자동 생성되지 않는다.

기본 파일 규칙에서 타인 파일 수정·삭제는 전역 admin/owner만 가능하다. 담당 staff/manager의 타인 첨부 교체·파일 정리가 필요한 서비스는 게시판 배정을 확인하는 서버 API를 추가한다. 기본 Storage 파일 읽기는 공개다. 자세한 역할과 기존 데이터 이전은 [역할 마이그레이션](roles-migration.md)을 따른다.

## 9. 다른 사이트와 데이터 분리

| 구성 | 권장 방식 |
|---|---|
| 별도 서비스·고객사의 독립 사이트 | Firebase 프로젝트도 분리 |
| 같은 서비스 안의 여러 게시판 | 같은 프로젝트에서 `boardId`로 구분 |
| 한 프로젝트 안의 다른 컬렉션 이름 | `postsCollection` 등 6개 이름과 Rules·Storage 경로·인덱스를 함께 변경 |

컬렉션 이름 옵션이나 `boardId`는 그 자체로 보안상 테넌트 격리를 보장하지 않는다. 기본 admin/owner는 해당 컬렉션 전체를 관리한다. 서로 독립적인 관리자 경계가 필요하면 프로젝트를 분리하거나 호스트 규칙을 별도로 설계한다.

## 10. 배포 전 확인

- 첫 owner 로그인 후 `free` 게시판 생성, 일반 계정의 글·댓글 작성 확인.
- 글 상세 진입 시 slug → 문서 ID 조회와 원문 표시 확인.
- 선택한 국제화 모드에 맞춰 언어·번역 UI와 AI 요청 여부 확인.
- 매니저가 담당 게시판만 설정하고 다른 게시판은 설정하지 못하는지 확인.
- 앱이 쓰는 Storage 버킷에 규칙이 배포됐는지 확인하고 이미지·첨부 업로드 확인.
- 공개 목록·상세 HTML에 OG 메타가 있는지 배포 URL에서 확인.
- 웹 앱 배포와 Firebase 규칙·인덱스 배포 결과를 각각 확인.

오류별 확인 순서는 [README 문제 해결](../README.md#문제-해결)을 참고한다.
