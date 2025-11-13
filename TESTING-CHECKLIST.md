# Multi-Conversation System Testing Checklist

실제 Octave 앱에서 수동으로 테스트하면서 체크

## 📋 테스트 1: 기본 Conversation 관리

### 1.1 Conversation 생성
- [ ] Workspace 선택 후 [+] 버튼으로 conversation 생성
- [ ] 새 conversation이 `{workspace-name} {number}` 형식으로 이름 생성됨
- [ ] 생성된 conversation이 자동으로 활성화됨
- [ ] Tab이 UI에 정상적으로 표시됨

### 1.2 Conversation 전환
- [ ] 다른 tab 클릭 시 conversation이 전환됨
- [ ] 전환 시 해당 conversation의 메시지가 로드됨
- [ ] 전환 시 해당 conversation의 todos가 로드됨
- [ ] 활성 tab 스타일이 올바르게 적용됨 (bg-secondary)

### 1.3 Conversation 이름 변경
- [ ] Tab 더블클릭 시 input 필드로 전환됨
- [ ] 새 이름 입력 후 Enter 누르면 저장됨
- [ ] Escape 누르면 취소됨
- [ ] 이름 변경 후 DB에 반영됨
- [ ] 페이지 새로고침 후에도 변경된 이름 유지됨

### 1.4 Conversation 삭제
- [ ] X 버튼 hover 시 나타남
- [ ] X 버튼 클릭 시 삭제 확인 다이얼로그 표시됨
- [ ] "Cancel" 버튼 클릭 시 삭제 취소됨
- [ ] "Delete" 버튼 클릭 시 conversation 삭제됨
- [ ] 활성 conversation 삭제 시 다른 conversation으로 자동 전환됨
- [ ] 마지막 conversation은 삭제할 수 없음 (X 버튼 숨김)

### 1.5 Read/Unread 상태
- [ ] 활성 conversation은 CircleCheck 아이콘 표시
- [ ] 비활성 conversation은 Circle 아이콘 표시 (unread)
- [ ] Conversation 전환 시 아이콘 상태 업데이트됨

## 📦 테스트 2: Workspace 간 격리

### 2.1 Multiple Workspaces 생성
1. **bttrfly workspace 생성**
   - [ ] workspace 생성
   - [ ] 2-3개 conversation 생성
   - [ ] 각 conversation에 메시지 추가
   - [ ] 각 conversation에 todo 추가

2. **dingo workspace 생성**
   - [ ] workspace 생성
   - [ ] 2-3개 conversation 생성
   - [ ] 각 conversation에 메시지 추가
   - [ ] 각 conversation에 todo 추가

3. **circuit workspace 생성**
   - [ ] workspace 생성
   - [ ] 1-2개 conversation 생성
   - [ ] 각 conversation에 메시지 추가
   - [ ] 각 conversation에 todo 추가

### 2.2 Workspace 전환 테스트
- [ ] bttrfly로 전환 → bttrfly conversations만 표시됨
- [ ] dingo로 전환 → dingo conversations만 표시됨
- [ ] circuit로 전환 → circuit conversations만 표시됨
- [ ] 각 workspace의 conversation 개수가 올바름
- [ ] 다른 workspace의 conversation이 섞이지 않음

### 2.3 Conversation 데이터 격리
- [ ] bttrfly/conv1의 메시지가 dingo/conv1과 섞이지 않음
- [ ] bttrfly/conv1의 todos가 dingo/conv1과 섞이지 않음
- [ ] Workspace 전환 시 올바른 데이터만 로드됨

## 💾 테스트 3: SharedMemoryPool 캐싱

### 3.1 MemoryPoolMonitor 확인
- [ ] Todo Panel 하단에 Memory Pool Monitor 표시됨
- [ ] 현재 workspace의 캐시 상태 표시됨
- [ ] Cache: Active/Empty 상태가 정확함

### 3.2 캐시 생성 확인
1. **초기 상태**
   - [ ] 새 workspace 선택 시 Cache: Empty

2. **캐시 워밍업**
   - [ ] Conversation에 메시지 추가
   - [ ] Memory Pool Monitor에서 cache count 증가 확인
   - [ ] "Show details" 클릭 시 상세 정보 표시

3. **캐시 재사용**
   - [ ] 같은 workspace 내 conversation 전환
   - [ ] Cache age가 변경되지 않음 (재사용됨)
   - [ ] Global memory count가 유지됨

### 3.3 Workspace별 캐시 격리
- [ ] bttrfly workspace 선택 → bttrfly cache만 표시
- [ ] dingo workspace 선택 → dingo cache만 표시
- [ ] circuit workspace 선택 → circuit cache만 표시
- [ ] 다른 workspace의 cache가 섞이지 않음

### 3.4 캐시 정리
- [ ] "Clear Cache" 버튼 클릭
- [ ] Cache가 비워짐
- [ ] Cache: Empty로 변경됨
- [ ] 다시 conversation 사용 시 cache 재생성됨

### 3.5 Auto-Refresh
- [ ] 5초마다 자동으로 통계 업데이트됨
- [ ] Refresh 버튼 클릭 시 즉시 업데이트됨
- [ ] Loading 상태 표시됨 (spinner)

## 🔄 테스트 4: 성능 & 안정성

### 4.1 많은 Conversation 생성
- [ ] 10개 이상 conversation 생성
- [ ] Tab scroll이 정상 작동함
- [ ] Tab 전환이 빠름 (렉 없음)
- [ ] 메모리 사용량이 적정 수준 유지

### 4.2 긴 이름 처리
- [ ] 매우 긴 conversation 이름 입력
- [ ] Truncate가 정상 작동함 (max-w-[80px])
- [ ] Hover 시 전체 이름 표시 (title tooltip 추가 필요?)

### 4.3 에러 핸들링
- [ ] 네트워크 오류 시 적절한 에러 메시지
- [ ] DB 오류 시 앱이 crash하지 않음
- [ ] 삭제 실패 시 에러 표시

### 4.4 상태 동기화
- [ ] 페이지 새로고침 후 상태 유지
- [ ] Workspace 전환 후 돌아왔을 때 상태 유지
- [ ] 앱 재시작 후 데이터 유지

## 📊 테스트 5: 메모리 효율성

### 5.1 시나리오: 3 Workspaces, 각 3 Conversations
1. **준비**
   - bttrfly: 3 conversations, 각 10개 메시지
   - dingo: 3 conversations, 각 10개 메시지
   - circuit: 3 conversations, 각 10개 메시지

2. **캐시 통계 확인**
   - [ ] MemoryPoolMonitor에서 global memory count 확인
   - [ ] Conversation별 memory count 확인
   - [ ] Cache size 확인

3. **예상 메모리 절감**
   - [ ] Global memories가 중복 제거되어 공유됨
   - [ ] 전체 메모리 사용량이 50-70% 절감됨 (예상)

## ✅ 최종 검증

### 종합 테스트
- [ ] 모든 기능이 정상 작동함
- [ ] Workspace 격리가 완벽함
- [ ] Conversation 관리가 안정적임
- [ ] 캐시가 효율적으로 작동함
- [ ] UI/UX가 직관적임
- [ ] 성능이 양호함

### 발견된 버그
- [ ] 버그 없음 or 아래에 기록:

---

## 📝 테스트 결과 기록

### 테스트 환경
- OS: macOS
- Node.js: v24.1.0
- Electron: (버전 확인 필요)
- Date: 2025-11-01

### 발견된 이슈


### 개선 제안


### 다음 단계

