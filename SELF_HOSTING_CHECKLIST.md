# Octave Self-Hosting Readiness Checklist

## 목표
Octave로 Octave를 개발하기 위한 최소 요구사항 체크리스트

---

## Tier 0: CRITICAL PATH (이것 없이는 불가능)

### 1. 파일 열기/편집 기본
- [✅] Octave 소스코드 디렉토리 탐색 가능
- [✅] .tsx, .ts, .json 파일 편집 가능
- [✅] 파일 저장 시 즉시 반영
- [ ] **테스트**: octave/src/App.tsx를 열어서 주석 추가하고 저장

### 2. Git 기본 워크플로우
- [✅] 변경사항 확인 (git status/diff)
- [✅] Commit 생성
- [ ] Branch 전환
- [ ] **테스트**: 작은 변경 → commit → 새 branch 생성

### 3. 터미널 명령 실행
- [✅] npm run dev 실행 가능
- [✅] npm run build 실행 가능
- [ ] 출력 결과 확인 가능
- [ ] **테스트**: "npm run type-check" 실행하고 에러 확인

### 4. 에이전트 코딩 지원
- [✅] Claude에게 코드 수정 요청 가능
- [✅] 생성된 코드 리뷰 가능
- [✅] 수정사항 바로 적용 가능
- [ ] **테스트**: "이 함수 리팩토링해줘" 요청 → 결과 확인

---

## Tier 1: PRODUCTIVITY ESSENTIALS (실용적으로 필요)

### 5. 코드 검색
- [✅] 파일명으로 검색
- [ ] 코드 내용으로 검색 (grep)
- [ ] 함수/변수 정의 찾기
- [ ] **테스트**: "TodoPanel" 검색 → 모든 사용처 찾기

### 6. Git 고급 기능
- [✅] Branch merge
- [ ] Conflict 해결
- [✅] Push/Pull
- [ ] **테스트**: feature branch → main merge 시도

### 7. 멀티파일 편집
- [✅] 여러 파일 동시에 열기
- [✅] 파일 간 빠른 전환
- [✅] 변경사항 동시 추적
- [ ] **테스트**: 3개 파일 동시 수정하는 기능 개발

### 8. 에러 디버깅
- [ ] TypeScript 에러 확인
- [ ] 빌드 실패 원인 파악
- [ ] Console 로그 확인
- [ ] **테스트**: 의도적 에러 → 원인 찾아 수정

---

## Tier 2: QUALITY OF LIFE (효율성 향상)

### 9. 코드 네비게이션
- [ ] 함수 정의로 점프
- [ ] 사용처로 역추적
- [ ] 파일 구조 트리 뷰
- [ ] **테스트**: App.tsx → TodoPanel 정의로 이동

### 10. 자동화 워크플로우
- [ ] Pre-commit hook 실행
- [ ] 자동 포맷팅
- [ ] Lint 에러 확인
- [ ] **테스트**: eslint/prettier 자동 실행

### 11. 성능 모니터링
- [ ] 개발 서버 실행 상태 확인
- [ ] 빌드 시간 측정
- [ ] Hot reload 동작 확인
- [ ] **테스트**: 변경 → 1초 내 반영 확인

### 12. 문서 작성
- [ ] Markdown 편집
- [ ] 코드 블록 syntax highlighting
- [ ] Preview 기능
- [ ] **테스트**: README.md 수정하며 확인

---

## Tier 3: ADVANCED (나중에 추가)

### 13. Visual debugging
- [ ] Breakpoint 설정
- [ ] Step-through debugging
- [ ] Variable inspection

### 14. Testing integration
- [ ] 테스트 실행
- [ ] Coverage 확인
- [ ] Failed test 빠른 이동

### 15. Refactoring tools
- [ ] 자동 rename
- [ ] Extract function
- [ ] Import 정리

---

## 즉시 테스트해야 할 것들 (우선순위)

### Priority 1: 지금 당장 확인
1. [ ] Octave로 octave/src/App.tsx 열기
2. [ ] 주석 하나 추가해보기
3. [ ] 저장되는지 확인
4. [ ] 터미널에서 "ls" 실행해보기
5. [ ] Claude에게 "이 파일 설명해줘" 요청

### Priority 2: 개발 루틴 시뮬레이션
1. [ ] 새 기능 아이디어 떠올리기
2. [ ] Claude에게 구현 요청
3. [ ] 생성된 코드 리뷰
4. [ ] 수정사항 요청
5. [ ] Commit 생성
6. [ ] npm run build 실행

### Priority 3: 버그 픽스 시뮬레이션
1. [ ] 기존 코드에서 버그 발견
2. [ ] 해당 파일 열기
3. [ ] Claude에게 "이 버그 고쳐줘" 요청
4. [ ] 수정 확인
5. [ ] 테스트
6. [ ] Commit

---

## Critical Gaps (확인 필요)

### Gap 1: Editor 컴포넌트 실체 ⭐⭐⭐⭐⭐
- **문제**: EditorPanel이 실제로 편집 가능한지 확인 필요
- **확인**: `octave/src/components/workspace/WorkspaceChatEditor.tsx`

### Gap 2: 파일 저장 메커니즘 ⭐⭐⭐⭐⭐
- **문제**: onUnsavedChange는 있는데 실제 저장 IPC가 명확하지 않음
- **확인**: EditorPanel 내부 구현

### Gap 3: Terminal 실행 능력 ⭐⭐⭐⭐
- **문제**: Terminal 컴포넌트가 실제 명령 실행 가능한지 불명
- **확인**: `octave/src/components/Terminal.tsx`

---

## 성공 지표

다음 질문에 "Yes"라고 답할 수 있을 때 Self-Hosting 준비 완료:

1. [ ] Octave로 1시간 이상 중단 없이 코딩할 수 있나?
2. [ ] Git workflow 전체를 Octave 안에서 처리 가능한가?
3. [ ] 버그 발견 시 Octave 내에서 디버깅할 수 있나?
4. [ ] 코드 검색/리팩토링이 효율적인가?
5. [ ] 다른 도구가 그립지 않은가?

---

## 전환 로드맵

### Stage 0: Foundation (현재)
- 다른 도구로 개발
- 목표: 기본 기능 완성

### Stage 1: First Taste
- Octave로 작은 것부터:
  - README 수정
  - 간단한 버그 픽스
  - 주석 추가

### Stage 2: Partial Adoption
- 주요 개발 50% Octave
- 나머지 50% 기존 도구

### Stage 3: Full Dogfooding
- 모든 개발을 Octave로
- 긴급 상황만 다른 도구

---

**마지막 업데이트**: 2025-11-10
