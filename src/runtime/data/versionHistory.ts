export interface VersionHistoryEntry {
  version: string
  date: string
  highlights: string[]
  note?: string
}

/**
 * MemiBoardVersionHistory 컴포넌트가 그대로 보여주는 데이터.
 * 코드 수준의 자세한 변경 내역은 이 레포의 CHANGELOG.md를 참고 — 새 버전을 릴리스할 때 이 배열도 함께 갱신한다.
 */
export const versionHistory: VersionHistoryEntry[] = [
  {
    version: '0.2.0',
    date: '2026-07-31',
    highlights: [
      '글쓰기 / 수정 / 삭제 — 제목, 본문, 태그를 자유롭게 작성',
      '파일 첨부 — 이미지·문서를 게시글에 첨부, 이미지는 미리보기 제공',
      '댓글 — 실시간으로 댓글을 달고 지울 수 있음',
      '로그인 / 권한 — 로그인해야 글을 쓸 수 있고, 본인 글만 수정·삭제 가능(관리자는 전체 관리)',
      'AI 자동 검열 — 욕설·부적절한 내용이 담긴 글/댓글은 AI가 자동으로 걸러 게시를 막음',
      '한 줄 설정으로 바로 시작 — pages: true 옵션 하나로 게시판 화면이 바로 만들어짐',
    ],
    note: '서버 없이 동작하는 모듈이라, 실제 보안은 Firebase 프로젝트에 규칙 파일을 등록해야 완성됩니다. README의 Security Model 안내를 꼭 따라주세요.',
  },
  {
    version: '0.1.0',
    date: '2026-07-27',
    highlights: [
      '프로젝트 최초 생성 (아직 게시판 기능은 없는 빈 Nuxt 4 프로젝트)',
    ],
  },
]
