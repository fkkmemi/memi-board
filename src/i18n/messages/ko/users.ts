export default {
  title: '보드 사용자',
  sort: {
    label: '사용자 정렬 기준',
    name: '이름순',
    role: '역할순',
    direction: '정렬 방향',
    asc: '오름차순',
    desc: '내림차순',
  },
  pagination: {
    label: '사용자 목록 페이지 이동',
    pageSize: '페이지당 사용자 수',
    perPage: '{count}명씩',
    status: '{page}페이지 · {count}명',
  },
  loadFailed: '사용자 목록을 불러오지 못했습니다.',
  changeRoleFailed: '역할을 변경하지 못했습니다.',
  confirmRole: {
    title: '사용자 권한 변경',
    description: '{name}님의 역할을 {from}에서 {to}(으)로 변경하시겠습니까?',
    confirm: '변경하기',
  },
  loading: '사용자 목록을 불러오고 있습니다.',
  noPermission: {
    title: '권한이 없습니다',
    description: '보드 관리자만 사용자 역할을 관리할 수 있습니다.',
  },
  empty: '보드에 로그인한 사용자가 없습니다.',
  noName: '이름 없음',
  noEmail: '이메일 없음',
  emailLoadFailed: '이메일을 불러오지 못했습니다.',
  aiUsage: {
    writing: '글쓰기 {used}/{limit}',
    image: '그림 {used}/{limit}',
  },
  roleGroup: '역할 선택',
  warningReset: {
    button: '경고 초기화',
    done: '경고를 초기화했어요',
    failed: '콘텐츠 경고를 초기화하지 못했습니다.',
  },
  aiReset: {
    button: 'AI 횟수 초기화',
    done: '초기화했어요',
    failed: 'AI 사용 횟수를 초기화하지 못했습니다.',
  },
  moderationWarnings: '콘텐츠 경고 {count}회',
}
