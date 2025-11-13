# SimpleBranchPlan Implementation Checklist

> 현재 상태 기준으로 실제 구현 체크리스트

## Phase 0: 인프라 (1주) 🔥 URGENT

### Storage Layer
- [ ] **planStorage.ts 생성**
  - [ ] DB 스키마 추가 (simple_branch_plans 테이블)
  - [ ] `createPlan(plan: SimpleBranchPlan): Promise<void>`
  - [ ] `getPlan(planId: string): Promise<SimpleBranchPlan | null>`
  - [ ] `listPlans(workspaceId: string): Promise<SimpleBranchPlan[]>`
  - [ ] `updatePlanStatus(planId: string, status: PlanStatus): Promise<void>`
  - [ ] `deletePlan(planId: string): Promise<void>`

### Execution Engine
- [ ] **planExecutor.ts 생성**
  - [ ] `executePlan(planId: string): Promise<PlanExecutionResult>`
    - 각 conversation 생성
    - 각 conversation에 todo 생성
    - planId를 conversation에 연결
    - 에러 핸들링

### IPC Handlers
- [ ] **main.ts에 IPC handlers 추가**
  ```typescript
  - ipcMain.handle('plan:create', ...)
  - ipcMain.handle('plan:get', ...)
  - ipcMain.handle('plan:list', ...)
  - ipcMain.handle('plan:update-status', ...)
  - ipcMain.handle('plan:execute', ...)
  - ipcMain.handle('plan:delete', ...)
  - ipcMain.handle('plan:get-progress', ...)
  ```

### Tests
- [ ] **planStorage.test.ts**
  - CRUD 테스트
  - 에러 케이스
- [ ] **planExecutor.test.ts**
  - Conversation 생성 검증
  - Todo 생성 검증

### DB Migration
- [ ] **simple_branch_plans 테이블 추가**
  ```sql
  CREATE TABLE simple_branch_plans (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    goal TEXT NOT NULL,
    description TEXT,
    conversations TEXT NOT NULL,  -- JSON array
    total_conversations INTEGER NOT NULL,
    total_todos INTEGER NOT NULL,
    total_estimated_duration INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'completed', 'cancelled', 'archived')),
    ai_analysis TEXT,  -- JSON object
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    started_at INTEGER,
    completed_at INTEGER,
    cancelled_at INTEGER,
    archived_at INTEGER,
    metadata TEXT,  -- JSON object
    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
  );

  CREATE INDEX idx_simple_branch_plans_workspace ON simple_branch_plans(workspace_id);
  CREATE INDEX idx_simple_branch_plans_status ON simple_branch_plans(status);
  CREATE INDEX idx_simple_branch_plans_created ON simple_branch_plans(created_at DESC);
  ```

### Conversation Schema Update
- [ ] **conversations 테이블에 plan_id 추가**
  ```sql
  ALTER TABLE conversations ADD COLUMN plan_id TEXT REFERENCES simple_branch_plans(id);
  CREATE INDEX idx_conversations_plan_id ON conversations(plan_id);
  ```

---

## Phase 1: Plan Mode UI (2주)

### Backend: Plan Generation
- [ ] **planGenerator.ts (AI 통합)**
  - [ ] `analyzePlanGoal(goal: string): Promise<PlanAnalysisResult>`
    - AI가 목표 분석
    - 명확화 질문 생성
  - [ ] `generatePlan(goal: string, answers: AIQuestionAnswers): Promise<SimpleBranchPlan>`
    - AI가 conversation 분해
    - Todo 생성
    - 예상 시간 계산

### Frontend: Plan Mode Modal

#### Stage 1: User Input
- [ ] **PlanModeModal.tsx 생성**
  - [ ] 목표 입력 폼
  - [ ] "Generate Plan" 버튼
  - [ ] 로딩 상태

#### Stage 2: AI Analysis
- [ ] **AI 분석 중 표시**
  - [ ] 스피너 + "Analyzing your goal..."
  - [ ] 진행 상태 표시

#### Stage 3: AI Questions
- [ ] **AIQuestionsForm.tsx**
  - [ ] Single-select (라디오)
  - [ ] Multi-select (체크박스)
  - [ ] Text input
  - [ ] Number input
  - [ ] Confirmation (Yes/No)
  - [ ] "Generate Detailed Plan" 버튼

#### Stage 4: Plan Preview
- [ ] **PlanPreview.tsx**
  - [ ] 전체 goal 표시
  - [ ] Conversation 카드 리스트
    - Title
    - Goal
    - Todo 리스트
    - 예상 시간
  - [ ] 통계 표시
    - Total conversations
    - Total todos
    - Total estimated time
  - [ ] 액션 버튼
    - [Approve & Execute]
    - [Edit]
    - [Cancel]

#### Plan Execution
- [ ] **Execution Progress 표시**
  - [ ] "Creating conversations..."
  - [ ] Progress bar
  - [ ] 생성된 conversation 링크 표시
  - [ ] 완료 메시지

### Context & Hooks
- [ ] **useBranchPlan.ts 확장**
  - [ ] `createPlan(goal: string)`
  - [ ] `executePlan(planId: string)`
  - [ ] `getCurrentPlan(workspaceId: string)`
  - [ ] `updatePlanStatus(planId: string, status: PlanStatus)`

### UI Components
- [ ] **PlanBadge.tsx**
  - Conversation 헤더에 "Plan: OAuth Implementation" 표시
  - Plan 진행도 표시
- [ ] **PlanProgressWidget.tsx**
  - Sidebar에 현재 플랜 진행도 표시
  - 2/4 conversations completed

---

## Phase 2: Progress Tracking (1주)

### Backend
- [ ] **planProgressTracker.ts**
  - [ ] `calculatePlanProgress(planId: string): Promise<PlanProgress>`
    - 생성된 conversation 수
    - 완료된 todo 수
    - 진행률 계산
  - [ ] Todo 상태 변경 시 자동 업데이트

### Frontend
- [ ] **PlanProgressPanel.tsx**
  - [ ] Overall progress bar
  - [ ] Conversation별 진행도
    - Title
    - Todo completion (3/5)
    - Status badge
  - [ ] Time tracking
    - Estimated vs. Actual

### Real-time Updates
- [ ] **Todo 완료 시 plan progress 업데이트**
- [ ] **Conversation 상태 변경 감지**
- [ ] **UI 자동 갱신**

---

## Phase 3: Command Palette (2주)

### Backend
- [ ] **searchService.ts**
  - [ ] `searchConversations(query: string, filters: SearchFilters)`
  - [ ] `searchMessages(query: string)`
  - [ ] `searchBlocks(query: string, blockType?: BlockType)`
  - [ ] Full-text search 최적화

### Frontend
- [ ] **CommandPalette.tsx**
  - [ ] Cmd+K 단축키
  - [ ] 검색 입력
  - [ ] 결과 리스트
    - Conversations
    - Messages
    - Code blocks
    - Bookmarks
  - [ ] 필터 버튼
    - Workspace
    - Date range
    - Block type
  - [ ] 키보드 네비게이션 (↑↓ Enter Esc)

### Search Features
- [ ] **Fuzzy search**
- [ ] **Special queries**
  - `@workspace`
  - `>code`
  - `>command`
  - `#bookmarked`
- [ ] **Highlighting**
  - 검색어 하이라이트
  - 매칭된 블록으로 스크롤

---

## Phase 4: Block Actions (1주)

### Command Execution
- [ ] **commandExecutor.ts**
  - [ ] `executeCommand(blockId: string): Promise<BlockExecution>`
  - [ ] Result 블록 자동 생성
  - [ ] 실행 히스토리 저장

### Block UI
- [ ] **Block 컴포넌트 개선**
  - [ ] 호버 시 액션 버튼
    - [Copy]
    - [Bookmark]
    - [Run] (command 블록)
    - [⋮] 드롭다운
  - [ ] Command 블록에 [Run] 버튼
  - [ ] Result 블록 렌더링

### Bookmarks
- [ ] **Bookmark 기능**
  - [ ] 블록 북마크 토글
  - [ ] Block bookmark 저장
  - [ ] Command Palette에서 북마크 검색

---

## Testing Strategy

### Unit Tests
- [ ] planStorage CRUD
- [ ] planExecutor conversation 생성
- [ ] searchService 검색 정확도
- [ ] commandExecutor 실행

### Integration Tests
- [ ] Plan 생성 → Execution → Progress tracking
- [ ] Command Palette 검색 → 결과 표시
- [ ] Block 실행 → Result 생성

### E2E Tests
- [ ] 사용자가 목표 입력 → Plan 승인 → Conversation 생성
- [ ] Cmd+K 검색 → Enter로 점프
- [ ] Command 블록 실행 → Result 확인

---

## Success Criteria

### Phase 0 완료 조건
- ✓ Plan 생성/저장/조회 가능
- ✓ Plan 실행 시 conversation + todo 자동 생성
- ✓ DB migration 완료

### Phase 1 완료 조건
- ✓ 사용자가 목표 입력 → AI 분석 → Plan 생성 → 승인 → Execution
- ✓ 생성된 conversation에 todo 자동 할당
- ✓ Plan 진행도 표시

### Phase 2 완료 조건
- ✓ Real-time progress tracking
- ✓ Conversation 상태 자동 업데이트
- ✓ Time estimation vs. actual

### Phase 3 완료 조건
- ✓ Cmd+K로 모든 대화/메시지 검색
- ✓ Enter로 선택한 항목으로 점프
- ✓ 블록 타입별 필터링

### Phase 4 완료 조건
- ✓ Command 블록 실행
- ✓ Result 블록 자동 생성
- ✓ 블록 북마크

---

## Immediate Next Steps (Today)

1. **Create planStorage.ts**
   ```bash
   touch octave/electron/planStorage.ts
   ```

2. **Add DB migration**
   - simple_branch_plans 테이블
   - conversations.plan_id 컬럼

3. **Create IPC handlers**
   - plan:create
   - plan:execute

4. **Write simple test**
   ```typescript
   test('should create and retrieve plan', async () => {
     const plan = await planStorage.createPlan({ ... })
     const retrieved = await planStorage.getPlan(plan.id)
     expect(retrieved).toEqual(plan)
   })
   ```

---

## Resources

### Existing Code to Reference
- `/octave/src/types/plan.ts` - Type definitions
- `/octave/electron/conversationStorage.ts` - Storage pattern
- `/octave/electron/messageParser.ts` - Block parsing

### Design Documents
- `MULTI_CONVERSATION_ORCHESTRATION.md` - Overall strategy
- `block-based-conversation-system.md` - UX design

---

**Created**: 2025-11-13
**Status**: Phase 0 - Ready to start
**Priority**: 🔥 HIGH
