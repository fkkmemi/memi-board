# 0.46 역할 마이그레이션

역할: user(일반 사용자), staff(콘텐츠 담당), manager(담당 게시판 설정·스태프 배정), admin(전체 관리), owner(관리자 지정).

`allowedStaffUids`는 콘텐츠 담당자, `allowedManagerUids`는 설정 담당자다. manager도 다른 게시판의 allowedStaffUids에만 배정되면 그 게시판에서는 콘텐츠만 관리한다. 글로벌 역할은 자격이고 실제 범위는 게시판 문서가 정한다. 매장 등 호스트의 조직을 게시판에 연결하고 배정을 동기화하는 책임은 호스트에 있다.

호환성을 위해 `isAdmin`은 owner를, `isStaff`는 manager를 포함한다. 정확한 역할은 `role`, `isOwner`, `isManager`로 확인한다. 설정 화면 진입에는 `canConfigureBoard(boardId)`, 콘텐츠 관리에는 `canManageBoard(boardId)`를 사용한다. 글·댓글 작성 최소 역할은 기존 user/staff/admin을 유지한다(manager는 staff 수준, owner는 admin 수준).

```ts
// nuxt.config.ts
memiBoard: {
  roleLabels: { user: '고객', staff: '매장 직원', manager: '매장 관리자', admin: '운영자', owner: '최고 관리자' }
}
```

생략하면 언어별 기본 명칭을 쓴다. 커스텀 명칭은 모든 언어에 동일하게 적용된다.

## 적용 순서

1. 호스트에 새 패키지와 역할 인식 코드를 반영한다.
2. Firestore·Storage 규칙 예제를 호스트의 기존 규칙에 병합하고 에뮬레이터로 검사한다.
3. 새 규칙을 배포한다. App Hosting 배포만으로 규칙이 갱신되지 않는다.
4. 신뢰할 수 있는 Admin SDK로 기존 admin을 owner로, 기존 staff를 manager로 옮긴다. 각 게시판의 기존 staff UID를 allowedManagerUids로 이전한다. 일반 사용자는 그대로 둔다. 기존 admin이 여럿이면 모두 owner로 이전하므로 사전에 수량을 검토한다.
5. 새 호스트를 배포하고 로그인 상태를 새로고침한다.

memi-dev의 scripts/migrate-board-roles.mjs는 기본 dry-run, --apply로 트랜잭션 적용한다. 이전 역할·배정은 클라이언트 접근이 막힌 memiBoardMigrations/roles-v046에 기록한다. 완료 마커가 있으면 재실행해도 신규 역할을 재승격하지 않는다. owner의 신규 지정·이관은 신뢰할 수 있는 서버 작업으로만 수행한다.

## 파일 권한

Storage 규칙의 Firestore 조회 제한 때문에 기본 규칙은 작성자와 전역 admin/owner만 타인 파일을 수정·삭제할 수 있게 한다. staff/manager에게 전역 파일 권한을 주지 않는다. staff/manager의 타인 글 삭제 시 파일 정리는 기존 best-effort 방식이므로 남은 파일은 호스트 서버에서 정리해야 한다. 담당자의 타인 이미지·첨부 교체가 필요한 호스트는 토큰과 해당 게시판 배정을 검증하는 서버 API를 구현해야 한다.

매니저는 공개 범위 변경·게시판 생성/삭제·자신의 매니저 배정 변경·전역 역할 변경을 할 수 없다. 담당 스태프 배정은 이미 staff/manager 자격을 가진 계정을 대상으로 한다.
