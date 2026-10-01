export default {
  loading: '설정을 불러오고 있습니다.',
  noAccess: '접근 권한이 없습니다',
  notFound: {
    title: '없는 게시판입니다',
    checkAddress: '주소를 다시 확인해 주세요.',
    checkBoardAddress: '게시판 주소를 다시 확인해 주세요.',
  },
  newBoard: {
    title: '아직 없는 게시판입니다',
    description: '아래 정보를 입력하고 저장하면 이 ID로 새로 만들어집니다.',
  },
  noLabel: '라벨 없음',
  option: {
    default: '일반',
  },
  id: {
    label: '카테고리 ID',
    help: '주소와 데이터 기준값',
  },
  writeRole: {
    label: '글쓰기 권한',
    help: '이 카테고리에 글을 쓸 수 있는 최소 역할',
    helpShort: '글을 쓸 수 있는 최소 역할',
    options: {
      user: '일반 이상',
      staff: '스태프 이상',
      admin: '관리자만',
    },
  },
  commentWriteRole: {
    label: '댓글쓰기 권한',
    help: '이 카테고리에 댓글을 쓸 수 있는 최소 역할',
    helpShort: '댓글을 쓸 수 있는 최소 역할',
    hiddenHelp: '숨김 게시판은 댓글이 공개 피드에 안 나오고, 담당 스태프만 작성할 수 있습니다',
    hiddenFixed: '담당 스태프만 (숨김 보드 고정)',
  },
  staff: {
    label: '담당 스태프',
    help: '지정한 스태프만 이 보드를 설정·관리합니다. 비우면 관리자만',
    placeholder: '관리자만 (스태프 미지정)',
  },
  label: {
    label: '표시 라벨',
    help: '사용자에게 보이는 이름',
  },
  description: {
    label: '설명',
    help: '게시판 상단 등에 보이는 안내 문구',
    placeholder: '이 게시판에 대한 짧은 설명 (선택)',
  },
  visibility: {
    label: '공개 범위',
    help: '숨김이면 전체 필터에 안 나오고, 글은 관리자·담당 스태프·작성자만 읽을 수 있습니다. 댓글은 담당 스태프만 쓸 수 있습니다',
    options: {
      public: { label: '보임', description: '전체 목록·필터에 표시' },
      hidden: { label: '숨김', description: '일기장·비공개. 댓글은 담당 스태프만' },
    },
  },
  listView: {
    label: '리스트뷰',
    help: '게시글 목록 표시 방식',
    options: {
      dense: '조밀',
      video: '영상',
    },
  },
  editorType: {
    label: '입력 폼',
    help: '글쓰기 화면의 작성 방식',
    options: {
      default: '제목과 본문을 작성',
      image: '여러 사진과 대표사진을 작성',
    },
  },
  locale: {
    label: '게시판 언어',
    help: '비우면 사이트 언어를 따릅니다. 고르면 이 게시판은 항상 그 언어로 보입니다.',
    auto: '자동 (사이트 언어 따름)',
  },
  action: {
    moveDown: '아래로',
    goToBoard: '게시판으로 이동',
    deleteBoard: '게시판 삭제',
    create: '만들기',
  },
  newCategoryPlaceholder: '새 카테고리 이름',
  deleteConfirm: '‘{label}’ 게시판을 삭제하시겠습니까?\n\n이 게시판의 모든 게시물, 댓글, 대댓글, 본문 이미지와 첨부파일이 영구 삭제됩니다. 이 작업은 되돌릴 수 없습니다.',
  savedCategory: '‘{label}’ 카테고리를 저장했습니다.',
  savedSettings: '게시판 설정을 저장했습니다.',
  created: '게시판을 만들었습니다.',
  error: {
    orderFailed: '카테고리 순서를 저장하지 못했습니다.',
    deleteFailed: '게시판과 연결 데이터를 삭제하지 못했습니다.',
    saveFailed: '게시판 설정을 저장하지 못했습니다.',
    deleteAllFailed: '게시판 데이터를 삭제하지 못했습니다.',
  },
  danger: {
    title: '위험 영역',
    description: '모든 게시글, 댓글, 첨부파일과 카테고리 설정을 영구 삭제합니다. 게시판 사용자와 관리자 권한은 유지합니다.',
    confirmLabel: '확인을 위해 ‘{phrase}’를 입력하세요',
    phrase: '게시판 데이터 삭제',
    button: '모든 데이터 삭제',
    done: '게시판 데이터를 모두 삭제했습니다.',
  },
}
