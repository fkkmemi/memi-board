export interface VersionHistoryEntry {
  version: string
  date: string
  /** 한국어 문구 */
  highlights: string[]
  note?: string
  /** 영어 문구. 한국어가 아닌 모든 화면 언어에서 쓴다. */
  highlightsEn?: string[]
  noteEn?: string
}

/**
 * MemiBoardVersionHistory 컴포넌트가 그대로 보여주는 데이터.
 * 코드 수준의 자세한 변경 내역은 이 레포의 CHANGELOG.md를 참고 — 새 버전을 릴리스할 때 이 배열도 함께 갱신한다.
 * 한국어(highlights·note)와 영어(highlightsEn·noteEn)를 함께 적는다. 한국어가 아닌 화면은 영어를 쓴다.
 */
export const versionHistory: VersionHistoryEntry[] = [
  {
    version: '0.52.0',
    date: '2026-10-29',
    highlights: [
      '게시판마다 번역할 언어를 골라 원하는 언어로만 번역할 수 있어요',
      '전체 게시판 설정에서 번역 언어·자동 번역·게시판 언어를 모든 게시판에 한 번에 적용할 수 있어요',
      '번역이 안 된 게시판 이름·설명을 한 번에 번역할 수 있어요',
      '게시판 소개 문장이 10개 언어로 보이고, 버전 기록은 영어로도 볼 수 있어요',
    ],
    highlightsEn: [
      'Choose which languages each board is translated into',
      'Apply translation languages, auto-translation, and board language to all boards at once',
      'Translate the names and descriptions of untranslated boards in one go',
      'The board intro now appears in 10 languages, and the version history is available in English',
    ],
  },
  {
    version: '0.51.2',
    date: '2026-10-29',
    highlights: [
      '목록 카드의 작성자 이름이 오른쪽에 맞춰져요',
      '작성자 메모는 작성자 메뉴에서 열 수 있어요',
    ],
    highlightsEn: [
      'Author names on list cards are right-aligned',
      'Open author memos from the author menu',
    ],
  },
  {
    version: '0.51.1',
    date: '2026-10-29',
    highlights: [
      '글 수정 화면에서도 공지로 등록하거나 해제할 수 있어요',
    ],
    highlightsEn: [
      'Pin or unpin a notice from the post edit screen too',
    ],
  },
  {
    version: '0.51.0',
    date: '2026-10-29',
    highlights: [
      '게시판 매니저가 글을 공지로 지정하거나 해제할 수 있어요',
      '공지는 목록 맨 위에 따로 모여 보여요',
    ],
    highlightsEn: [
      'Board managers can pin posts as notices or unpin them',
      'Notices are grouped at the top of the list',
    ],
    note: '호스트 프로젝트의 Firestore 규칙과 인덱스도 함께 갱신해야 합니다.',
    noteEn: 'Hosts must also update their Firestore rules and indexes.',
  },
  {
    version: '0.50.0',
    date: '2026-10-29',
    highlights: [
      '게시판 설정에서 고아 파일·댓글·좋아요를 조회하고 선택 삭제할 수 있어요',
      '최근 업로드를 보호하고, 삭제 전에 연결과 관리자 권한을 다시 확인해요',
      '파일 목록과 비공개 댓글 조회의 보안 규칙을 강화했어요',
    ],
    highlightsEn: [
      'Find orphaned files, comments and likes in board settings and delete the ones you pick',
      'Recent uploads are protected, and links and admin rights are checked again before deleting',
      'Tightened security rules for file listing and private comment reads',
    ],
    note: '호스트 프로젝트의 Firestore·Storage 규칙도 함께 갱신해야 합니다.',
    noteEn: 'Hosts must also update their Firestore and Storage rules.',
  },
  {
    version: '0.49.0',
    date: '2026-10-29',
    highlights: [
      '보드 설정에서 글 작성 시 자동 번역을 켤 수 있어요. 기본값은 꺼짐이에요',
      '새 글의 제목·요약·본문을 10개 언어로 번역해 함께 저장해요',
    ],
    highlightsEn: [
      'Turn on automatic translation for new posts in board settings. It is off by default',
      'New posts save their title, summary and body in 10 languages',
    ],
  },
  {
    version: '0.48.1',
    date: '2026-10-29',
    highlights: [
      '댓글·답글·댓글 수정 입력창에 이미지를 붙여넣어 첨부할 수 있어요',
    ],
    highlightsEn: [
      'Paste images into the comment, reply and comment edit boxes to attach them',
    ],
  },
  {
    version: '0.48.0',
    date: '2026-10-29',
    highlights: [
      '댓글과 답글에 이미지를 한 장 첨부할 수 있어요',
      '큰 이미지는 올리기 전에 5MB 이하로 줄여요',
      '글을 지우면 댓글 이미지도 함께 지워요',
    ],
    highlightsEn: [
      'Attach one image to comments and replies',
      'Large images are shrunk to 5MB or less before upload',
      'Deleting a post also deletes its comment images',
    ],
  },
  {
    version: '0.47.1',
    date: '2026-10-29',
    highlights: [
      'AI 글쓰기 도우미가 실패하면 그 시도는 하루 횟수에서 빠져요',
      'App Check 연결 안내를 한 번용 토큰과 SPA에 맞게 고쳤어요',
    ],
    highlightsEn: [
      'Failed AI writing assistant attempts no longer count toward the daily limit',
      'Updated the App Check setup guide for one-time tokens and SPAs',
    ],
  },
  {
    version: '0.47.0',
    date: '2026-10-23',
    highlights: [
      '서비스에 따라 국제화를 끄고 한 언어로만 게시판을 사용할 수 있어요',
      '화면 언어 전환은 유지하면서 콘텐츠 번역만 끌 수도 있어요',
      '다른 사이트에 설치하는 방법과 번역 설정 안내를 정리했어요',
    ],
    highlightsEn: [
      'Turn off internationalization to run the board in a single language',
      'Or keep the language switcher and turn off only content translation',
      'Rewrote the guides for installing on other sites and setting up translation',
    ],
  },
  {
    version: '0.46.2',
    date: '2026-10-23',
    highlights: [
      '게시판 표시 라벨 옆 버튼으로 이름과 설명을 10개 언어로 번역할 수 있어요',
      '저장할 때 자동으로 번역할지도 선택할 수 있어요',
    ],
    highlightsEn: [
      'Translate board names and descriptions into 10 languages with the button next to the display label',
      'Choose whether to translate automatically on save',
    ],
  },
  {
    version: '0.46.1',
    date: '2026-10-22',
    highlights: [
      '게시판 이름과 설명을 저장하면 10개 언어로 번역해 둬요',
      '글쓰기 AI에서 한 번에 10개 언어로 번역해 저장할 수 있어요',
      '보는 언어로 제목과 본문이 보이고, 원문을 고치면 번역 대신 원문이 보여요',
    ],
    highlightsEn: [
      'Board names and descriptions are translated into 10 languages when saved',
      'The AI writing assistant can translate and save into 10 languages at once',
      'Titles and bodies show in the reader\'s language, and the original shows instead once it is edited',
    ],
  },
  {
    version: '0.46.0',
    date: '2026-10-21',
    highlights: [
      '일반 사용자·스태프·매니저·관리자·최고 관리자, 다섯 가지 역할을 지원해요',
      '게시판별 매니저가 설정과 스태프 배정을 관리할 수 있어요',
      '서비스에 맞게 역할 이름을 바꿀 수 있어요',
    ],
    highlightsEn: [
      'Five roles are supported: user, staff, manager, admin and owner',
      'Per-board managers can manage settings and staff assignments',
      'Rename roles to fit your service',
    ],
  },
  {
    version: '0.45.1',
    date: '2026-10-15',
    highlights: [
      '일반 계정 글쓰기·초안 조회와 태그 입력을 고쳤어요',
      '댓글·답글 수정과 좋아요가 다른 사용자에게 바로 반영돼요',
      '글 삭제·첨부파일 보호·게시판 공개 범위 변경을 보강했어요',
    ],
    highlightsEn: [
      'Fixed posting, draft viewing and tag input for regular accounts',
      'Comment and reply edits and likes show up for other users right away',
      'Strengthened post deletion, attachment protection and board visibility changes',
    ],
  },
  {
    version: '0.45.0',
    date: '2026-10-01',
    highlights: [
      '게시판을 10개 언어로 볼 수 있어요 (한국어·영어·일본어·독일어·프랑스어·스페인어·포르투갈어·중국어·아랍어·인도네시아어)',
      '게시판 설정에서 게시판마다 언어를 고정하거나 사이트 언어를 따르게 할 수 있어요',
    ],
    highlightsEn: [
      'View the board in 10 languages (Korean, English, Japanese, German, French, Spanish, Portuguese, Chinese, Arabic and Indonesian)',
      'In board settings, fix each board\'s language or follow the site language',
    ],
  },
  {
    version: '0.44.1',
    date: '2026-10-01',
    highlights: [
      'Mac Safari에서 한글을 입력하고 바로 등록 버튼을 누를 때 두 번 눌러야 하던 문제를 고쳤어요',
    ],
    highlightsEn: [
      'Fixed having to press submit twice after typing Korean in Mac Safari',
    ],
  },
  {
    version: '0.44.0',
    date: '2026-10-01',
    highlights: [
      '글을 저장하고 미리보기가 뜨기까지 기다리는 시간이 줄었어요 (특히 iPhone·Mac Safari)',
    ],
    highlightsEn: [
      'Less waiting between saving a post and seeing the preview (especially on iPhone and Mac Safari)',
    ],
  },
  {
    version: '0.42.0',
    date: '2026-08-27',
    highlights: [
      '글쓰기에서 문단 옆 + 버튼이나 / 입력으로 제목·목록·이미지 같은 블록을 빠르게 넣을 수 있어요',
      '문단 메뉴에서 블록을 다른 형식으로 바꾸거나 복제·이동·삭제할 수 있어요',
    ],
    highlightsEn: [
      'Quickly insert blocks such as headings, lists and images with the + button next to a paragraph or by typing /',
      'Convert, duplicate, move or delete blocks from the paragraph menu',
    ],
  },
  {
    version: '0.41.0',
    date: '2026-08-27',
    highlights: [
      'AI 도우미 결과를 바로 적용하지 않고 이전/이후를 비교해보고 적용할 수 있어요',
    ],
    highlightsEn: [
      'Compare before and after AI assistant results before applying them',
    ],
  },
  {
    version: '0.40.0',
    date: '2026-08-27',
    highlights: [
      'AI 글쓰기 도우미에서 원하는 문체를 직접 입력해 바꿀 수 있어요 (예: 경상도 사투리 스타일로)',
    ],
    highlightsEn: [
      'Type any writing style you like into the AI writing assistant (e.g. in a Gyeongsang dialect style)',
    ],
  },
  {
    version: '0.39.1',
    date: '2026-08-27',
    highlights: [
      '관리자는 글쓰기 하단 스위치로 비속어 필터를 끄고 글을 올릴 수 있어요',
    ],
    highlightsEn: [
      'Admins can turn off the profanity filter with a switch at the bottom of the editor',
    ],
  },
  {
    version: '0.39.0',
    date: '2026-08-21',
    highlights: [
      '사진 글에서 원하는 사진을 대표로 고를 수 있어요',
      '목록 모양과 글쓰기 폼을 각각 선택할 수 있어요',
    ],
    highlightsEn: [
      'Pick which photo represents a photo post',
      'Choose the list layout and the editor form separately',
    ],
  },
  {
    version: '0.38.1',
    date: '2026-08-21',
    highlights: [
      '내가 쓴 글을 지울 때 첨부 사진 때문에 막히던 문제를 고쳤어요',
    ],
    highlightsEn: [
      'Fixed deleting your own post being blocked by attached photos',
    ],
    note: '호스트는 Storage 예시 규칙의 memiBoardPosts/{postId}/{allPaths=**} 목록 블록을 넣고 배포해야 해요.',
    noteEn: 'Hosts must add and deploy the memiBoardPosts/{postId}/{allPaths=**} list block from the example Storage rules.',
  },
  {
    version: '0.38.0',
    date: '2026-08-21',
    highlights: [
      '숨김 게시판에는 댓글을 거의 쓰지 않아요. 필요하면 담당 스태프만 남길 수 있어요',
      '숨김 게시판 댓글은 공개 댓글 모음에 나오지 않아요',
    ],
    highlightsEn: [
      'Hidden boards rarely take comments. Only assigned staff can leave them when needed',
      'Comments on hidden boards don\'t appear in the public comment feed',
    ],
    note: '호스트는 Firestore 규칙·댓글 listed 인덱스를 다시 배포해야 해요. 공개 보드는 한 번 저장하면 예전 댓글이 목록에 다시 채워져요.',
    noteEn: 'Hosts must redeploy the Firestore rules and the comment listed index. Saving a public board once refills its older comments in the feed.',
  },
  {
    version: '0.36.0',
    date: '2026-08-19',
    highlights: [
      '게시물을 신고할 수 있어요. 담당 스태프가 내용을 확인해요',
      '스태프는 지정된 게시판만 관리해요',
    ],
    highlightsEn: [
      'Report posts. Assigned staff review them',
      'Staff manage only the boards assigned to them',
    ],
    note: '호스트는 Firestore 신고 규칙·인덱스를 배포해야 해요.',
    noteEn: 'Hosts must deploy the Firestore report rules and indexes.',
  },
  {
    version: '0.35.0',
    date: '2026-08-19',
    highlights: [
      '메인에 게시목록·게시물·댓글모음 섹션을 올릴 수 있어요',
      '댓글모음은 최신순이나 좋아요순으로 네 개부터 보여요',
    ],
    highlightsEn: [
      'Put post list, post and comment feed sections on the main page',
      'The comment feed starts with four comments, newest or most liked first',
    ],
  },
  {
    version: '0.34.0',
    date: '2026-08-19',
    highlights: [
      '댓글을 최신순이나 좋아요순으로 모아 볼 수 있어요',
    ],
    highlightsEn: [
      'Browse comments newest first or most liked first',
    ],
    note: '호스트는 좋아요순 목록용 Firestore 인덱스(likeCount + createdAt)를 배포해야 해요.',
    noteEn: 'Hosts must deploy the Firestore index for the most-liked list (likeCount + createdAt).',
  },
  {
    version: '0.33.0',
    date: '2026-08-19',
    highlights: [
      '댓글과 답글에도 좋아요를 누를 수 있어요',
      '글을 지우면 댓글 좋아요도 함께 삭제돼요',
    ],
    highlightsEn: [
      'Like comments and replies too',
      'Deleting a post also deletes its comment likes',
    ],
    note: '호스트는 Firestore 규칙과 좋아요 인덱스를 병합·배포해야 댓글 좋아요가 동작해요.',
    noteEn: 'Hosts must merge and deploy the Firestore rules and like indexes for comment likes to work.',
  },
  {
    version: '0.32.0',
    date: '2026-08-14',
    highlights: [
      '글쓰기에서 사진 파일을 올리거나 외부 이미지 주소를 넣을 수 있어요',
      '게시판을 지우면 그 안의 글·댓글·이미지도 함께 삭제돼요',
    ],
    highlightsEn: [
      'Upload photo files or add external image URLs while writing',
      'Deleting a board also deletes its posts, comments and images',
    ],
  },
  {
    version: '0.31.0',
    date: '2026-08-14',
    highlights: [
      '글쓰기 화면에 AI 도우미가 생겼어요. 맞춤법, 다듬기, 이어서 쓰기, 요약, 번역, 제목을 도와줘요',
      'AI 도우미는 하루 10번까지 사용할 수 있어요',
    ],
    highlightsEn: [
      'An AI assistant joins the editor. It helps with spelling, polishing, continuing, summarizing, translating and titles',
      'Use the AI assistant up to 10 times a day',
    ],
    note: '호스트는 Firestore 규칙에 AI 글쓰기 횟수 필드를 병합·배포해야 제한이 지켜져요.',
    noteEn: 'Hosts must merge and deploy the AI writing count fields in their Firestore rules for the limit to apply.',
  },
  {
    version: '0.30.2',
    date: '2026-08-14',
    highlights: [
      '일반 목록 썸네일을 조금 작은 라운드 사각으로 바꿨어요',
      '글쓰기 도구 모음을 서식 메뉴로 줄여 좁은 화면에서도 잘리지 않아요',
      '다시 로그인해도 바꿔 둔 프로필 이름과 사진이 유지돼요',
    ],
    highlightsEn: [
      'List thumbnails are now slightly smaller rounded squares',
      'The editor toolbar folds into a format menu so it fits on narrow screens',
      'Your changed profile name and photo stay after signing in again',
    ],
  },
  {
    version: '0.30.1',
    date: '2026-08-13',
    highlights: [
      '게시물 상단의 목록 버튼을 간결한 왼쪽 화살표로 바꿨어요',
      '이제 main 브랜치에 push하면 npm 배포가 자동으로 진행돼요',
    ],
    highlightsEn: [
      'The list button at the top of a post is now a simple left arrow',
      'Pushing to the main branch now publishes to npm automatically',
    ],
  },
  {
    version: '0.30.0',
    date: '2026-08-13',
    highlights: [
      '본문 글 없이 사진만 첨부해도 글을 올릴 수 있어요',
      '목록은 게시판 설정에서 정한 보기 방식을 사용하고, 테스트용 보기 전환 버튼은 숨겼어요',
      '글쓰기 중 사진 업로드 권한과 Storage 버킷 설정 안내를 보강했어요',
    ],
    highlightsEn: [
      'Post with only attached photos and no body text',
      'Lists use the view chosen in board settings, and the test view switcher is hidden',
      'Improved guidance on photo upload permissions and Storage bucket setup',
    ],
    note: '이미지 업로드가 거부되면 호스트의 Storage 규칙과 firebase.json 버킷 설정을 최신 예시로 확인해 주세요.',
    noteEn: 'If image uploads are rejected, check the host\'s Storage rules and firebase.json bucket settings against the latest example.',
  },
  {
    version: '0.29.1',
    date: '2026-08-13',
    highlights: [
      '프로필 이름이나 사진을 바꾸면 예전에 작성한 글과 댓글의 작성자 정보도 함께 바뀌어요',
      '나를 대상으로 작성된 답글의 표시 이름도 새 프로필 이름으로 맞춰져요',
    ],
    highlightsEn: [
      'Changing your profile name or photo also updates the author info on your earlier posts and comments',
      'Replies addressed to you show your new profile name too',
    ],
    note: '이 기능을 쓰려면 호스트가 Firestore 보안 규칙을 최신 예시로 갱신해야 해요.',
    noteEn: 'Hosts must update their Firestore security rules to the latest example to use this.',
  },
  {
    version: '0.27.0',
    date: '2026-08-12',
    highlights: [
      '일반 목록 디자인을 다듬었어요 — 사진이 있는 글은 제목과 작성자 사이에 동그란 미리보기로 보여요',
      '조밀 보기를 커뮤니티 게시판처럼 한 줄로 다시 짰어요 — 시간·작성자·조회·추천·게시판을 한 줄에, 사진 있으면 오른쪽에 작은 미리보기가 붙어요',
      '두 줄 이상으로 쓴 글은 목록 요약에서도 줄바꿈이 그대로 보여요',
    ],
    highlightsEn: [
      'Refined the default list. Posts with photos show a round preview between the title and author',
      'Rebuilt the dense view as a single line like a community board, with time, author, views, likes and board on one line and a small preview on the right when there is a photo',
      'Line breaks in multi-line posts are kept in list summaries',
    ],
  },
  {
    version: '0.26.0',
    date: '2026-08-12',
    highlights: [
      '다른 사람 글을 보다가 그 사람에 대해 나만 보는 메모를 남길 수 있어요 — 좋음/나쁨 표시도 같이 남겨요',
      '메모는 작성자 이름 옆 아이콘을 눌러서 쓰고, 다른 사람은(관리자 포함) 절대 못 봐요',
    ],
    highlightsEn: [
      'Leave a private memo about another author while reading their post, with a good or bad mark',
      'Write memos from the icon next to the author name. Nobody else, not even admins, can see them',
    ],
  },
  {
    version: '0.25.0',
    date: '2026-08-12',
    highlights: [
      '"작성글 보기"처럼 "작성한 댓글 보기"도 생겼어요 — 여러 게시판에 흩어진 내 댓글을 한 곳에서 모아 봐요',
    ],
    highlightsEn: [
      'Like "View posts", there is now "View comments" to gather your comments from every board in one place',
    ],
    note: '이 기능을 쓰려면 호스트가 Firestore 보안 규칙을 최신 예시로 갱신해야 해요.',
    noteEn: 'Hosts must update their Firestore security rules to the latest example to use this.',
  },
  {
    version: '0.24.0',
    date: '2026-08-11',
    highlights: [
      '사진 올리는 코드를 분리해서, 게시판이 더 안정적으로 빌드되고 열려요',
    ],
    highlightsEn: [
      'Split out the photo upload code so the board builds and loads more reliably',
    ],
  },
  {
    version: '0.23.0',
    date: '2026-08-11',
    highlights: [
      '글·댓글·좋아요를 게시판 아래 중첩시키지 않고 memiBoardPosts/memiBoardComments/memiBoardLikes로 따로 모아요 — 보드 ID는 각 글의 필드로 들어가요',
      '작성자별 글 모음이 더 가벼워졌어요 — 여러 게시판을 뒤지는 대신 한 번에 찾아요',
      '"내가 좋아요한 글" 같은 기능을 나중에 붙이기 쉬워졌어요',
      '날짜에 마우스를 올려야 보이던 작성 시각을 이제 눌러서 볼 수 있어요 — 폰에서도 똑같이 동작해요',
    ],
    highlightsEn: [
      'Posts, comments and likes now live in separate memiBoardPosts, memiBoardComments and memiBoardLikes collections instead of under each board. The board ID is a field on each post',
      'Per-author post lists are lighter, found in one query instead of searching every board',
      'Features like "posts I liked" are easier to add later',
      'Tap a date to see the exact time instead of hovering, which also works on phones',
    ],
    note: '기존 게시판 데이터와 호환되지 않아요 — 새로 설치하는 것처럼 다시 시작해야 해요.',
    noteEn: 'Not compatible with existing board data. Start over as if installing fresh.',
  },
  {
    version: '0.21.1',
    date: '2026-08-07',
    highlights: [
      '관리자가 쓴 댓글에 답글을 달 때 오류가 나던 문제를 고쳤어요',
    ],
    highlightsEn: [
      'Fixed an error when replying to a comment written by an admin',
    ],
  },
  {
    version: '0.21.0',
    date: '2026-08-06',
    highlights: [
      '카테고리 대신 게시판(보드)만 있어요 — 예전 카테고리 이름이 곧 보드 ID예요',
      '글은 memiBoards/{보드}/posts, 설정은 settings, 회원 역할은 memiBoardUsers 에 모아요',
    ],
    highlightsEn: [
      'Boards replace categories. The old category name is now the board ID',
      'Posts live in memiBoards/{board}/posts, settings in settings, and member roles in memiBoardUsers',
    ],
  },
  {
    version: '0.20.0',
    date: '2026-08-06',
    highlights: [
      '게시판 데이터를 memiBoards/{게시판ID}/… 아래에 모았어요 (여러 게시판을 같은 프로젝트에 둘 수 있어요)',
      '설정·글·사용자 경로가 게시판마다 분리돼요 — 호스트는 boardId만 맞추면 돼요',
    ],
    highlightsEn: [
      'Board data now lives under memiBoards/{boardId}/… (so several boards can share one project)',
      'Settings, post and user paths are separated per board. Hosts only need to match the boardId',
    ],
  },
  {
    version: '0.19.3',
    date: '2026-08-06',
    highlights: [
      '이미지 목록 게시판은 인스타처럼 제목 없이 사진+내용만 올리면 돼요',
      '사진을 여러 장 올리고 끌어 순서를 바꿀 수 있어요 (첫 장이 대표)',
    ],
    highlightsEn: [
      'Image list boards work like Instagram, with just photos and text and no title',
      'Upload several photos and drag to reorder them (the first one is the cover)',
    ],
  },
  {
    version: '0.19.2',
    date: '2026-08-06',
    highlights: [
      '이미지만 넣고 글 없이 올리는 건 막았어요 — 본문에 글자를 넣어야 해요',
    ],
    highlightsEn: [
      'Posting images without any text is blocked. The body needs some text',
    ],
  },
  {
    version: '0.19.1',
    date: '2026-08-06',
    highlights: [
      '공유 미리보기 이미지를 가벼운 썸네일로 쓰도록 바꿨어요 (카톡 등에 더 잘 맞아요)',
    ],
    highlightsEn: [
      'Share previews now use a lighter thumbnail image (better for messengers like KakaoTalk)',
    ],
  },
  {
    version: '0.19.0',
    date: '2026-08-06',
    highlights: [
      '게시판 목록·글 공유 미리보기(제목·설명·대표 이미지)를 모듈만으로 붙일 수 있어요',
      '호스트가 따로 SEO API를 만들 필요 없이, 공개 글 기준으로 미리보기가 채워져요',
    ],
    highlightsEn: [
      'Add share previews (title, description and cover image) for board lists and posts with just the module',
      'Previews are filled from public posts without the host building its own SEO API',
    ],
  },
  {
    version: '0.18.0',
    date: '2026-08-06',
    highlights: [
      '게시판을 보임/숨김으로 나눌 수 있어요 — 숨김은 일기장처럼 권한이 있는 사람만 볼 수 있어요',
      '권한이 없는 글·게시판은 로딩에 멈추지 않고 안내 메시지로 알려 줘요',
      '글 붙여넣기로 넣은 이미지가 파일명과 함께 두 번 들어가던 문제를 고쳤어요',
    ],
    highlightsEn: [
      'Boards can be visible or hidden. Hidden boards are like a diary that only people with access can see',
      'Posts and boards you can\'t access show a message instead of loading forever',
      'Fixed pasted images being inserted twice along with their file name',
    ],
  },
  {
    version: '0.17.0',
    date: '2026-08-06',
    highlights: [
      '게시글 조회수가 생겼어요 — 로그인하지 않아도 조회가 쌓여요',
      '목록과 상세에서 조회수를 바로 확인할 수 있어요',
      '댓글 수는 모든 목록 보기에서 제목 옆에 같은 방식으로 보여요',
    ],
    highlightsEn: [
      'Posts now have view counts, which count even without signing in',
      'See view counts right in the list and on the post',
      'Comment counts show next to the title the same way in every list view',
    ],
  },
  {
    version: '0.16.0',
    date: '2026-08-06',
    highlights: [
      '조밀한 목록 보기가 생겼어요 — 한 줄로 빠르게 훑을 수 있어요',
      '이미지 목록에서는 사진 위에 제목과 좋아요가 겹쳐 보여요',
      '영상 목록에서는 유튜브가 있으면 유튜브 썸네일을 먼저 보여 줘요',
      '시간·설명 툴팁이 마우스만 올려도 바로 떠요',
    ],
    highlightsEn: [
      'A new dense list view lets you scan posts one line at a time',
      'The image list overlays the title and likes on the photo',
      'The video list shows the YouTube thumbnail first when there is one',
      'Time and description tooltips appear as soon as you hover',
    ],
  },
  {
    version: '0.15.0',
    date: '2026-08-06',
    highlights: [
      '게시판마다 짧은 설명을 적어 두고, 제목에 마우스를 올리면 볼 수 있어요',
      '일반 목록 카드 여백과 썸네일 배치를 더 단정하게 다듬었어요',
    ],
    highlightsEn: [
      'Give each board a short description, shown when you hover over its title',
      'Tidied up the spacing and thumbnail layout of default list cards',
    ],
  },
  {
    version: '0.14.1',
    date: '2026-08-06',
    highlights: [
      '일반 리스트뷰에 정사각형 썸네일이 생기고, 작성자·시간·좋아요·댓글수를 오른쪽에 보기 좋게 정리했어요',
      '카테고리 안에서는 같은 카테고리 뱃지가 매 글마다 반복 표시되지 않아요',
    ],
    highlightsEn: [
      'The default list view gains square thumbnails, with author, time, likes and comment count neatly on the right',
      'Inside a category, the same category badge no longer repeats on every post',
    ],
  },
  {
    version: '0.14.0',
    date: '2026-08-06',
    highlights: [
      '게시판 설정에서 글쓰기·댓글쓰기 권한과 리스트뷰를 카드로 골라요',
      '목록 위에서 일반·이미지·영상 보기를 아이콘으로 바로 바꿔볼 수 있어요',
    ],
    highlightsEn: [
      'Pick write and comment permissions and the list view as cards in board settings',
      'Switch between default, image and video views with icons above the list',
    ],
  },
  {
    version: '0.13.0',
    date: '2026-08-06',
    highlights: [
      '게시판마다 담당 스태프를 따로 지정할 수 있어요',
      '댓글쓰기 권한도 게시판마다 다르게 정할 수 있어요',
      '유튜브 영상이 모바일과 여러 주소 형식에서도 잘 보여요',
    ],
    highlightsEn: [
      'Assign staff to each board separately',
      'Set comment permissions per board too',
      'YouTube videos play properly on mobile and with more URL formats',
    ],
  },
  {
    version: '0.11.0',
    date: '2026-08-05',
    highlights: [
      '게시글에 좋아요 버튼이 생겼어요',
      '글을 보는 동안 다른 사람의 좋아요·댓글 수가 화면에 바로 나타나요',
      '작성 시간을 몇 분 전처럼 쉽게 보고, 올리면 정확한 시각을 확인할 수 있어요',
    ],
    highlightsEn: [
      'Posts have a like button',
      'Other people\'s likes and comment counts update on screen while you read',
      'See times like "5 minutes ago" and hover for the exact time',
    ],
  },
  {
    version: '0.10.0',
    date: '2026-08-05',
    highlights: [
      '게시판 설치와 연결 설정이 한결 단순해졌어요',
      '게시판 아래에서 제작 정보와 지금까지의 버전 이야기를 볼 수 있어요',
    ],
    highlightsEn: [
      'Installing and connecting the board is much simpler',
      'See credits and the version story at the bottom of the board',
    ],
  },
  {
    version: '0.9.0',
    date: '2026-08-04',
    highlights: [
      '댓글에 답글을 달고 대화 흐름을 볼 수 있어요',
      '댓글을 이어서 불러오고, 새 댓글은 실시간으로 받아요',
    ],
    highlightsEn: [
      'Reply to comments and follow the conversation',
      'Load more comments as you go and get new ones in real time',
    ],
  },
  {
    version: '0.8.0',
    date: '2026-08-04',
    highlights: [
      '최근 댓글은 실시간으로 보고 이전 댓글은 이어서 불러올 수 있어요',
      '댓글 작성 영역을 대화 흐름의 맨 아래로 옮겼어요',
    ],
    highlightsEn: [
      'See recent comments in real time and load older ones as you go',
      'Moved the comment box to the bottom of the conversation',
    ],
  },
  {
    version: '0.7.0',
    date: '2026-08-04',
    highlights: [
      '카테고리마다 글쓰기 권한을 일반 이상·스태프 이상·관리자만으로 설정할 수 있어요',
      '게시판 설정 화면의 SSR hydration 경고를 해결했어요',
    ],
    highlightsEn: [
      'Set write permission per category to users and up, staff and up, or admins only',
      'Fixed the SSR hydration warning on the board settings screen',
    ],
  },
  {
    version: '0.6.0',
    date: '2026-08-04',
    highlights: [
      '관리자가 게시판 사용자를 확인하고 관리자·스태프·사용자 역할을 설정할 수 있어요',
      '스태프는 게시판 설정이나 사용자 역할은 바꾸지 않고 게시글과 댓글을 관리할 수 있어요',
    ],
    highlightsEn: [
      'Admins can review board users and set admin, staff and user roles',
      'Staff can manage posts and comments without changing board settings or user roles',
    ],
  },
  {
    version: '0.5.0',
    date: '2026-08-04',
    highlights: [
      '게시판마다 일반·이미지·영상 목록을 고르고, 유튜브를 본문에 넣을 수 있어요',
      '이전 글·목록·다음 글 이동과 카테고리 관리를 지원해요',
    ],
    highlightsEn: [
      'Choose a default, image or video list per board, and embed YouTube in posts',
      'Move to the previous post, the list or the next post, and manage categories',
    ],
  },
  {
    version: '0.2.0',
    date: '2026-07-31',
    highlights: [
      '글쓰기·댓글·첨부·로그인 권한으로 게시판을 바로 시작할 수 있어요',
      '부적절한 글·댓글은 AI 검열로 막을 수 있어요',
    ],
    highlightsEn: [
      'Start a board right away with posting, comments, attachments and sign-in permissions',
      'Block inappropriate posts and comments with AI moderation',
    ],
    note: '실제 보안은 호스트 Firebase 규칙 등록이 필요합니다.',
    noteEn: 'Real security requires registering the host\'s Firebase rules.',
  },
]
