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

1. Firebase 콘솔 → AI Logic(또는 "Build" 메뉴 아래)에서 활성화하고, Gemini Developer API를 사용하도록 설정한다.
2. **요금제 확인**: 무료(Spark) 플랜에서 AI Logic 사용량·기능이 제한될 수 있다 — 실제로 검열 API를 호출하기 전에 콘솔에서 현재 프로젝트 요금제와 AI Logic 사용 가능 여부를 확인한다. 필요하면 Blaze(종량제)로 업그레이드한다.
3. 활성화만 하면 끝 — `configureMemiBoard({ moderation: { enabled: true } })`(기본값)면 자동으로 이 API를 호출한다.

## 8. App Check 설정 (선택, 권장)

1. Google reCAPTCHA 관리 콘솔 또는 Firebase 콘솔의 App Check 섹션에서 reCAPTCHA v3 사이트 키를 발급한다.
2. `nuxt.config.ts`의 `vuefire.appCheck`에 `{ provider: 'ReCaptchaV3', key: '...' }`를 넣는다(호스트의 nuxt-vuefire 설정이다 — memi-board는 App Check를 직접 다루지 않는다).
3. **중요**: 이 옵션을 켜는 것만으로는 아무것도 강제되지 않는다. 클라이언트가 App Check 토큰을 발급받아 요청에 붙이기 시작할 뿐이고, Firestore/Storage가 실제로 "App Check 토큰 없는 요청을 거부"하게 하려면 **Firebase 콘솔 → App Check → 각 API(Firestore/Storage)별로 "Enforce" 토글을 따로 켜야 한다.** 그 전까지는 모니터링(로그만 남기고 통과시킴) 상태다.
4. 로컬 개발 중에는 디버그 토큰을 발급받아 써야 reCAPTCHA 없이도 통과된다 — Firebase 콘솔의 App Check 디버그 토큰 발급 안내를 따른다.
