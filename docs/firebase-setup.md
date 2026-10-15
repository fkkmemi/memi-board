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
  "storage": {
    "bucket": "<vuefire.config.storageBucket 과 동일한 값>",
    "rules": "storage.rules"
  }
}
```

`storage.bucket`은 호스트 `vuefire.config.storageBucket`과 **같아야** 한다. 예: `my-app.appspot.com`.

이미 Firebase CLI를 쓰고 있는 프로젝트라면, `firebase.json`에 `firestore.rules`/`storage.rules` 경로가 있는지만 보지 말고 **버킷 이름**도 확인한다.

구 프로젝트는 버킷이 두 개일 수 있다.

- `*.appspot.com` — 예전 웹 앱 SDK snippet 의 `storageBucket`
- `*.firebasestorage.app` — 콘솔/CLI 기본 버킷

`firebase deploy --only storage`에 `bucket`이 없으면 **기본 버킷**에만 규칙이 올라간다. 앱은 `appspot.com`에 올리는데 규칙은 `firebasestorage.app`에만 있으면, 에디터 이미지에서 `storage/unauthorized`가 난다. 둘 다 쓰면 배열로 같은 규칙을 올린다.

```json
"storage": [
  { "bucket": "my-app.appspot.com", "rules": "storage.rules" },
  { "bucket": "my-app.firebasestorage.app", "rules": "storage.rules" }
]
```

글 삭제가 `storage/unauthorized` (`access 'memiBoardPosts/{postId}'`) 로 실패하면 버킷이 아니라 **list 경로**다. `listAll` 접두사는 `memiBoardPosts/{postId}/` 이라 `match /memiBoardPosts/{postId} { allow list }` 만으로는 안 된다. `docs/storage.rules.example`의 `{postId}/{allPaths=**}` 블록을 그대로 넣고 `firebase deploy --only storage` 한다.

## 5. 게시판 Security Rules 병합 + 배포

README의 [Security Model](../README.md#security-model) 섹션대로 `docs/firestore.rules.example`/`docs/storage.rules.example`을 프로젝트 규칙 파일에 병합한 뒤:

```bash
firebase deploy --only firestore:rules,storage
```

**병합만 하고 배포를 안 하면 글쓰기·댓글에서 `permission-denied`가 난다** — 가장 흔한 설치 실수다.

### Storage 규칙의 Firestore 조회 권한 (부모/호스트 프로젝트 필수 설정)

Storage 예시 규칙은 첨부 업로드와 파일 삭제 시 `firestore.exists()` / `firestore.get()`으로 글의 존재 여부, `authorUid`, 사용자 `role`을 조회한다. 따라서 **호스트 Firebase 프로젝트의 Storage 서비스 계정**에 Firestore 조회 역할이 필요하다. 패키지 설치나 Firestore Rules 배포만으로 이 IAM 설정이 완료되지는 않는다.

호스트 프로젝트 관리자가 다음을 설정한다:

1. 호스트 저장소에서 위 배포 명령을 대화형으로 실행한다. Firebase CLI가 교차 서비스 규칙용 IAM 역할 추가를 물으면 승인한다. Firebase 콘솔에서 Storage Rules를 저장할 때 표시되는 연결 권한 안내로도 설정할 수 있다.
2. Google Cloud Console → **IAM 및 관리자 → IAM**에서 같은 Firebase 프로젝트를 선택하고 **Google 제공 역할 부여 포함(Include Google-provided role grants)**을 켠다.
3. `service-<PROJECT_NUMBER>@gcp-sa-firebasestorage.iam.gserviceaccount.com` 계정을 찾아 **Firebase Rules Firestore Service Agent** (`roles/firebaserules.firestoreServiceAgent`) 역할이 있는지 확인한다. `<PROJECT_NUMBER>`는 프로젝트 ID가 아니라 Firebase 프로젝트 설정의 숫자 프로젝트 번호다. 역할이 없으면 IAM 변경 권한이 있는 호스트 관리자가 이 서비스 계정에 추가한다.
4. 권한 반영 후 로그인 상태에서 새 글에 20MiB 미만의 작은 첨부파일을 올려 확인한다. 기존 글에서는 작성자·스태프의 첨부 작업도 확인한다.

이 역할은 프로젝트의 Firestore 문서 조회(`datastore.entities.get`)를 허용한다. 일반 사용자 계정에 부여하는 역할이 아니며, Firestore 쓰기·삭제 권한은 포함하지 않는다. Storage 규칙의 소유권·역할 검사는 그대로 유지한다.

**CI의 `--non-interactive` 배포 성공만으로 IAM 설정까지 완료됐다고 판단하지 않는다.** 최초 설정은 호스트 관리자가 대화형 배포 또는 IAM 콘솔에서 수행하고, 위 서비스 계정의 역할을 확인한다.

2MB ZIP처럼 용량 조건을 충족해도 이 권한이 없으면 `memiBoardPosts/{postId}/attachments/...`에서 `storage/unauthorized`가 날 수 있다. 새 글 문서가 아직 없어도 `firestore.exists()` 조회 자체에는 권한이 필요하다. 현재 본문 이미지 업로드는 Firestore를 조회하지 않으므로, 이미지 업로드가 성공해도 첨부 업로드·파일 삭제의 조회 권한이 정상이라는 뜻은 아니다.

공식 근거: [교차 서비스 Storage Rules 권한 설정](https://firebase.google.com/docs/rules/manage-deploy#manage_permissions_for_cross-service_cloud_storage_security_rules), [역할의 포함 권한](https://docs.cloud.google.com/iam/docs/roles-permissions/firebaserules#firebaserules.firestoreServiceAgent).

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
