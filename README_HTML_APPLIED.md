# Task Message Studio - HTML Applied UX Version

업로드된 `task_message_studio.html`의 UI 방향을 기존 프로젝트에 적용한 버전입니다.

## 적용 내용
- 기존 프로젝트의 `index.html`, `js/app.js`, `js/generator.js` 기능 유지
- 관리자 화면: 흰색 배경, 로열블루 상단 라인, 폼형 카드 UI 적용
- 작업자 화면: 미리보기 화면을 더 분리된 작업 패널 형태로 정리
- 기존 ID/class 구조 유지: 기존 JS 연결이 끊기지 않도록 처리
- 작업자 탭 진입 시 `body.worker-mode` 자동 적용
- 화면 문구에서 과도한 LLM/AI 느낌을 줄이고 서비스형 문구로 정리

## 실행 방법
1. 압축 해제
2. `index.html`을 브라우저로 열기
3. 관리자 생성 화면에서 입력 후 `안내 메시지 만들기` 클릭
4. `작업자 미리보기` 탭에서 적용 결과 확인

## 참고
원본 업로드 HTML은 `docs/task_message_studio_uploaded_reference.html`에 보관했습니다.
