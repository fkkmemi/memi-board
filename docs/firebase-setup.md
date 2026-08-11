# Firebase 프로젝트 준비 (처음 설치하는 경우)

이 모듈을 처음 붙이는 프로젝트, 특히 Firebase를 아직 안 써본 프로젝트라면 README의 "설치" 섹션만으로는 부족하다. 여기 순서대로 하면 된다.

## 1. 사전 준비

- Node.js + pnpm (또는 npm/yarn)
- Nuxt **4.0 이상**, `@nuxt/ui` **4.0 이상**
- Firebase CLI: `npm i -g firebase-tools` 후 `firebase login`

## 2. Firebase 프로젝트 만들기 (아직 없다면)

1. [Firebase 콘솔](https://console.firebase.google.com)에서 새 프로젝트를 만든다.
2. **Firestore Database**를 사용 설정한다 (Native mode).
3. **Storage**를 사용 설정한다.
4. **Authentication**을 사용 설정하고, Sign-in method에서 쓸 provider(Google/Apple/이메일-비밀번호)를 켠다.

이미 있는 Firebase 프로젝트에 붙이는 거라면 이 단계는 건너뛰고, 위 세 서비스가 켜져 있는지만 확인한다.

## 3. `firebaseConfig` 값 가져오기

Firebase 콘솔 → 프로젝트 설정(톱니바퀴) → **일반** 탭 → "내 앱" 섹션 → 웹 앱이 없으면 추가 → "SDK 설정 및 구성"에서 `apiKey`/`authDomain`/`projectId`/`storageBucket`/`messagingSenderId`/`appId` 값을 그대로 복사해 `nuxt.config.ts`의 `vuefire.config`에 붙여넣는다(memi-board가 아니라 호스트의 nuxt-vuefire 설정이다 — README [설치](../README.md#설치) 참고).

## 4. 호스트 프로젝트를 Firebase CLI에 연결

프로젝트 루트에 아직 `firebase.json`/`.firebaserc`가 없다면:

```bash
firebase init firestore storage
```

또는 수동으로 만든다:

```json
// .firebaserc
{ "projects": { "default": "<your-project-id>" } }
```

```json
// firebase.json
{
  "firestore": { "rules": "firestore.rules" },
  "storage": { "rules": "storage.rules" }
}
```

이미 Firebase CLI를 쓰고 있는 프로젝트라면, `firebase.json`에 `firestore.rules`/`storage.rules` 경로가 이미 지정돼 있는지만 확인하면 된다.

## 5. 게시판 Security Rules 병합 + 배포

README의 [Security Model](../README.md#security-model--반드시-읽어야-하는-부분) 섹션대로 `docs/firestore.rules.example`/`docs/storage.rules.example`을 프로젝트 규칙 파일에 병합한 뒤:

```bash
firebase deploy --only firestore:rules,storage
```

**병합만 하고 배포를 안 하면 글쓰기·댓글에서 `permission-denied`가 난다** — 가장 흔한 설치 실수다.

## 6. 로그인 공급자 설정

### Google

Firebase 콘솔 → Authentication → Sign-in method에서 Google을 활성화하기만 하면 된다. 추가 설정 없음.

### Apple

Google보다 손이 더 간다:

1. Firebase 콘솔에서 Apple 로그인을 활성화한다.
2. [Apple Developer](https://developer.apple.com/account) 계정에서 **Services ID**를 새로 만든다.
3. 그 Services ID의 "Web Authentication Configuration"에 콜백 도메인을 등록한다 — Domains에 `{authDomain}`(Firebase 프로젝트의 authDomain, 보통 `<project-id>.firebaseapp.com`), Return URL에 `https://{authDomain}/__/auth/handler`.
4. Apple Developer의 **Keys**에서 "Sign in with Apple" 키를 새로 만든다 (기존에 다른 용도 키가 있어도 별도로 새로 만들어야 한다).
5. Team ID, 방금 만든 키의 Key ID, 그 키의 개인 키(`.p8` 파일 내용)를 Firebase 콘솔의 Apple 로그인 설정 화면에 입력한다.

자세한 건 [Firebase 공식 가이드](https://firebase.google.com/docs/auth/web/apple)를 따른다. 이 설정 없이 Apple 로그인 버튼을 누르면 에러가 난다.

## 7. Firebase AI Logic(Gemini) 활성화 — AI 검열용

1. Firebase 콘솔 → **AI Logic** 에서 활성화하고, **Gemini Developer API** 를 사용하도록 설정한다.
2. **요금제**: Spark에서도 되는 경우가 있으나 제한·쿼터가 있을 수 있다. 부족하면 Blaze.
3. 모델: 호스트 `nuxt.config.ts`의 `memiBoard.moderation.model`에 `gemini-3.5-flash-lite` 권장.
   `gemini-2.5-flash` 는 **신규 프로젝트에서 "no longer available to new users"** 로 404 날 수 있다.
4. `moderation.enabled` 기본이 `true` 이므로 활성화 후 글쓰기 시 자동 호출된다. 끄려면 `enabled: false`.

## 8. App Check 설정 (AI Logic Enforce 시 사실상 필수)

AI Logic / `firebaseml` 이 **Enforce** 이면 App Check 토큰 없이 검열 API가 실패한다. memi-board는 App Check를 초기화하지 않는다 — **호스트 책임**.

1. Firebase 콘솔 → App Check → **웹 앱**에 reCAPTCHA v3 등록 (사이트 키·시크릿).  
   등록하는 웹 앱의 **appId** 가 호스트 `vuefire.config.appId` 와 같아야 한다.
2. 호스트 클라이언트 플러그인에서 `initializeAppCheck` + `ReCaptchaV3Provider` (README App Check 절 예시).  
   `vuefire.appCheck` 옵션만 쓰는 방법도 있으나, AI Logic 연동 이슈 시 명시적 `initializeAppCheck` 를 쓴다.
3. **로컬:** `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true`(콘솔에 UUID 출력 후 App Check → 디버그 토큰 등록) 또는 등록된 고정 UUID.
4. **프로덕션:** 디버그 토큰 사용 금지. reCAPTCHA 도메인에 실제 호스트 도메인 등록.
5. (선택) Firestore/Storage Enforce — 켜면 토큰 없는 요청 거부. AI Logic 과 별개 토글이다.

## 9. Firestore 복합 인덱스

`memiBoardPosts`/`memiBoardComments`/`memiBoardLikes` 는 모두 최상위 flat 컬렉션이고, 보드/글 단위 스코핑은 `boardId`/`postId` 필드에 대한 `where` 동등 필터로 한다. [docs/firestore.indexes.json.example](firestore.indexes.json.example) 를 호스트 `firestore.indexes.json` 에 병합 후:

```bash
firebase deploy --only firestore:indexes
```

콘솔 에러에 인덱스 생성 링크가 뜨면 그걸 따라도 된다 — 위 예시 파일은 패키지가 실제로 실행하는 쿼리 기준으로 미리 정리해 둔 것이다. 컬렉션 이름을 커스터마이즈했다면(`memiBoard.postsCollection` 등) `collectionGroup` 값도 맞춰 바꾼다.
