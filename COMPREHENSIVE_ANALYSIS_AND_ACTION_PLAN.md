# Circuit - 상세 코드 분석 및 액션 플랜

**Branch**: `agent-feature-improvements`
**Date**: 2025-11-05
**Author**: Claude (DAR workspace)

---

## 목차

1. [개요](#개요)
2. [아젠다 1: Agent Work 기능 개선](#아젠다-1-agent-work-기능-개선)
3. [아젠다 2: 죽은 코드 삭제](#아젠다-2-죽은-코드-삭제)
4. [아젠다 3: 성능 최적화](#아젠다-3-성능-최적화)
5. [종합 우선순위 및 일정](#종합-우선순위-및-일정)

---

## 개요

### 분석 대상
- **프로젝트**: Circuit (Electron-based Desktop App)
- **주요 디렉토리**:
  - `circuit/electron/` - Main process (Node.js)
  - `circuit/src/` - Renderer process (React + TypeScript)

### 세 가지 아젠다
1. **Agent Work 기능 개선**: 백그라운드 Agent 실행 시스템 강화
2. **죽은 코드 삭제**: 사용되지 않는 파일 및 코드 제거
3. **성능 최적화**: 메모리 및 실행 속도 개선

---

## 아젠다 1: Agent Work 기능 개선

### 현재 구현 상태 분석

#### ✅ 이미 구현된 것들

| 컴포넌트 | 파일 | 상태 | 기능 |
|---------|------|------|------|
| **AgentManager** | `agentManager.ts` | ✅ MVP 완료 | Singleton 패턴, 기본 생명주기 관리 |
| **AgentWorker** | `agentWorker.ts` | ✅ MVP 완료 | Claude CLI spawn, 기본 실행 |
| **AgentHandlers** | `agentHandlers.ts` | ✅ MVP 완료 | IPC 핸들러, 입력 검증 |
| **EventBroadcaster** | `eventBroadcaster.ts` | ✅ 확장 완료 | Agent 이벤트 브로드캐스트 |

#### ❌ 구현되지 않은 것들 (Phase 1 설계 대비)

| 기능 | 설계 문서 위치 | 우선순위 | 비고 |
|-----|--------------|---------|------|
| **Stream-JSON 파싱** | AGENT_WORKER_ARCHITECTURE.md:586 | 🔴 HIGH | 실시간 progress 추적 필요 |
| **Progress 업데이트** | AGENT_WORKER_ARCHITECTURE.md:617 | 🔴 HIGH | Tool 사용 감지 및 % 계산 |
| **파일 변경 추적** | AGENT_WORKER_ARCHITECTURE.md:649 | 🟡 MEDIUM | filesModified/filesCreated 파싱 |
| **Queue 관리** | AGENT_WORKER_ARCHITECTURE.md:196 | 🟡 MEDIUM | 동시 실행 제한 (maxConcurrent) |
| **UI 통합** | AGENT_WORKER_ARCHITECTURE.md:927 | 🟡 MEDIUM | AgentContext Provider, TodoItem 확장 |
| **Timeout 처리** | AGENT_WORKER_ARCHITECTURE.md:1513 | 🟢 LOW | 10분 타임아웃 |
| **Retry 로직** | AGENT_WORKER_ARCHITECTURE.md:1500 | 🟢 LOW | 실패 시 재시도 |

### 상세 코드 분석

#### 1. AgentWorker.ts - 개선 필요 영역

**현재 구현 (Line 111-115)**:
```typescript
// Collect stdout
this.claudeProcess.stdout.on('data', (data: Buffer) => {
  this.fullOutput += data.toString()
  console.log(`[AgentWorker] stdout chunk: ${data.length} bytes`)
})
```

**문제점**:
- Stream-JSON 파싱 없음 → Progress 추적 불가
- Tool 사용 감지 불가 → 사용자에게 피드백 없음
- 파일 변경 정보 추출 불가 → filesModified/filesCreated 항상 빈 배열

**개선 방안**:
```typescript
// Stream-JSON 파싱 구현
let stdoutBuffer = ''
this.claudeProcess.stdout.on('data', (data: Buffer) => {
  stdoutBuffer += data.toString()
  const lines = stdoutBuffer.split('\n')
  stdoutBuffer = lines.pop() || ''  // 불완전한 줄 보관

  for (const line of lines) {
    if (!line.trim()) continue
    this.parseStreamEvent(line)  // 구현 필요
  }
})
```

**구체적 구현 필요 사항**:
1. `parseStreamEvent()` 메소드 (Line 586-614)
2. `handleToolUse()` 메소드 (Line 617-645)
3. `parseAssistantMessage()` 메소드 (Line 649-665)

#### 2. AgentManager.ts - Queue 관리 미구현

**현재 코드 (Line 20)**:
```typescript
private maxConcurrent = 2  // Phase 1: Hardcoded
```

**현재 코드 (Line 45-66)**:
```typescript
async startAgent(todo: Todo, context: AgentContext): Promise<void> {
  // ... 생략 ...

  // Phase 1: No concurrent limit check yet
  // Execute the agent
  try {
    await this.executeAgent(todo, context, worker)
  } catch (error) {
    this.activeAgents.delete(todo.id)
    throw error
  }
}
```

**문제점**:
- 동시 실행 제한 체크 없음
- Queue 관리 없음 → 무제한 동시 실행 가능 (메모리 폭증 위험)

**개선 방안**:
```typescript
async startAgent(todo: Todo, context: AgentContext): Promise<void> {
  // 동시 실행 수 확인
  if (this.activeAgents.size >= this.maxConcurrent) {
    console.log(`[AgentManager] Max concurrent reached, queueing task`)
    this.taskQueue.push({ todo, context, queuedAt: Date.now() })
    EventBroadcaster.broadcastAgentQueued(todo.id, this.taskQueue.length)
    return
  }

  // ... 기존 로직
}

private async processQueue(): Promise<void> {
  if (this.taskQueue.length === 0) return
  if (this.activeAgents.size >= this.maxConcurrent) return

  const task = this.taskQueue.shift()
  if (task) {
    await this.executeAgent(task.todo, task.context, worker)
  }
}
```

#### 3. UI 통합 - AgentContext 미구현

**설계 문서 (AGENT_WORKER_ARCHITECTURE.md:927-1117)**:
- `circuit/src/contexts/AgentContext.tsx` 파일 필요
- IPC 이벤트 리스너 (agent:started, agent:progress, etc.)
- TodoItem 컴포넌트 확장

**현재 상태**: 파일 존재하는지 확인 필요

### 액션 플랜

#### Phase 1: Stream-JSON 파싱 및 Progress (1-2 days)

**우선순위**: 🔴 HIGH

**작업 목록**:
1. [ ] `AgentWorker.ts`에 `parseStreamEvent()` 메소드 구현
   - Input: JSON line from stdout
   - Output: 타입별 이벤트 처리 (text_delta, tool_use, assistant)
   - Location: Line 586-614 참고

2. [ ] `handleToolUse()` 메소드 구현
   - Tool별 progress 맵핑 (Read: 20%, Edit: 50%, etc.)
   - EventBroadcaster 호출
   - Database 업데이트
   - Location: Line 617-645 참고

3. [ ] `parseAssistantMessage()` 메소드 구현
   - filesModified/filesCreated 추출
   - Tool result 파싱
   - Location: Line 649-665 참고

**검증 기준**:
- [ ] Agent 실행 시 progress가 0% → 50% → 100%로 업데이트
- [ ] Tool 사용 시 currentTask 표시 ("Using Read...", "Using Edit...")
- [ ] 완료 시 filesModified 정확히 파싱

#### Phase 2: Queue 관리 및 동시 실행 제한 (1 day)

**우선순위**: 🟡 MEDIUM

**작업 목록**:
1. [ ] `AgentManager.ts`에 `taskQueue` 추가
   ```typescript
   private taskQueue: QueuedTask[] = []
   ```

2. [ ] `startAgent()` 메소드 수정
   - 동시 실행 수 체크
   - Queue에 추가 로직

3. [ ] `processQueue()` 메소드 구현
   - FIFO 방식
   - Agent 완료 시 자동 호출

4. [ ] EventBroadcaster에 `broadcastAgentQueued()` 추가

**검증 기준**:
- [ ] 3개 Agent 동시 시작 시 2개만 실행, 1개는 queue
- [ ] 1개 완료 시 자동으로 다음 Agent 시작

#### Phase 3: UI 통합 (2 days)

**우선순위**: 🟡 MEDIUM

**작업 목록**:
1. [ ] `circuit/src/contexts/AgentContext.tsx` 생성
   - State management (Map<todoId, AgentState>)
   - IPC event listeners
   - Actions (startAgent, cancelAgent)

2. [ ] `TodoItem.tsx` 확장
   - "Run Agent" 버튼 추가
   - Progress bar 컴포넌트
   - Agent 상태 표시 (queued, running, completed, failed)

3. [ ] `App.tsx`에 AgentProvider 추가

**검증 기준**:
- [ ] Todo 항목에 "Run Agent" 버튼 표시
- [ ] 버튼 클릭 시 progress bar 나타남
- [ ] Progress 실시간 업데이트
- [ ] 완료 시 conversation에 요약 메시지 추가

#### Phase 4: Robustness (1 day)

**우선순위**: 🟢 LOW

**작업 목록**:
1. [ ] Timeout 구현 (10분)
2. [ ] Retry 로직 (실패 시 1회 재시도)
3. [ ] Error recovery (Agent 실패 시 다른 Agent 계속 실행)
4. [ ] Memory cleanup (Process kill 확실히 동작)

---

## 아젠다 2: 죽은 코드 삭제

### 발견된 죽은 코드

#### 1. Benchmark 스크립트 (Development Only)

**파일 목록**:
- `circuit/electron/benchmark-memory.ts` (273 lines)
- `circuit/electron/benchmark-memory-standalone.ts`
- `circuit/electron/benchmark-simple.ts`

**판단 근거**:
- Production 코드에서 import되지 않음
- 파일 상단 주석: "Measures memory usage..." → 개발용
- `console.log` 및 `process.exit()` 사용 → CLI 스크립트

**삭제 여부**:
- ✅ **권장**: 삭제
- ⚠️  **대안**: `/docs/benchmarks/` 또는 `/scripts/` 로 이동

**예상 이득**:
- 코드베이스 간소화
- 혼란 감소 (개발자가 실수로 import하는 것 방지)

#### 2. 사용되지 않는 TODO 주석

**발견된 위치**:
```
circuit/electron/agentWorker.ts:142:  filesModified: [],  // TODO: Parse from output
circuit/electron/agentWorker.ts:143:  filesCreated: [],   // TODO: Parse from output
circuit/electron/agentHandlers.ts:75:  * TODO: This is a placeholder...
circuit/electron/agentHandlers.ts:132: // TODO: Re-enable when storage.getConversation...
```

**판단**:
- Line 142-143: Phase 1에서 구현 예정 → 유지
- Line 75: Placeholder 주석 → **삭제 권장** (코드 이미 구현됨)
- Line 132: storage.getConversation 미구현 → **확인 필요**

#### 3. Deprecated 코드 패턴

**검색 필요**:
```bash
# HACK, FIXME, XXX 등 검색
grep -r "HACK\|FIXME\|XXX\|deprecated" circuit/electron/*.ts circuit/src/**/*.tsx
```

**현재 상태**: 일부 발견됨 (Grep 결과 참고)

### 액션 플랜

#### Step 1: Benchmark 파일 처리 (30 min)

**작업**:
1. [ ] `/scripts/` 디렉토리 생성
2. [ ] Benchmark 파일 이동:
   - `benchmark-memory.ts`
   - `benchmark-memory-standalone.ts`
   - `benchmark-simple.ts`
3. [ ] README 작성: `/scripts/README.md`
   ```markdown
   # Development Scripts

   ## Benchmarking
   - `benchmark-memory.ts`: Memory optimization tests
   - Run with: `npx tsx scripts/benchmark-memory.ts`
   ```

**대안** (더 aggressive):
1. [ ] 파일 삭제
2. [ ] Git history에 보존 (필요 시 복구 가능)

#### Step 2: TODO 주석 정리 (1 hour)

**작업**:
1. [ ] 모든 TODO 주석 목록화
   ```bash
   grep -rn "TODO\|FIXME\|HACK\|XXX" circuit/ --include="*.ts" --include="*.tsx" > todo-audit.txt
   ```

2. [ ] 각 TODO 분류:
   - **구현 예정** (Phase 1-4) → 유지
   - **이미 구현됨** → 삭제
   - **더 이상 관련 없음** → 삭제
   - **명확화 필요** → Issue 생성

3. [ ] 불필요한 TODO 주석 제거

**예시**:
```typescript
// Before
function getWorkspacePath(workspaceId: string): string | undefined {
  // TODO: This is a placeholder. Need to get actual workspace info from main.cjs
  console.warn('[AgentHandlers] Using cwd as workspace path (temporary)')
  return process.cwd()
}

// After (Option 1: 주석 삭제, 코드 개선 예정이면 Issue 생성)
function getWorkspacePath(workspaceId: string): string | undefined {
  // Using cwd as workspace path until workspace management is integrated
  return process.cwd()
}

// After (Option 2: 기능 구현 완료)
function getWorkspacePath(workspaceId: string): string | undefined {
  const workspace = workspaceManager.get(workspaceId)
  return workspace?.path
}
```

#### Step 3: Unused Imports 검사 (30 min)

**도구 사용**:
```bash
# TypeScript unused imports
npx tsc --noUnusedLocals --noUnusedParameters

# 또는 ESLint
npx eslint --ext .ts,.tsx circuit/ --rule 'no-unused-vars: error'
```

**작업**:
1. [ ] Unused imports 자동 제거
2. [ ] Unused variables 제거
3. [ ] Unused functions 확인 (신중히)

#### Step 4: Dead Code Elimination 도구 사용 (Optional)

**도구**:
- `unimported`: NPM 패키지, 사용되지 않는 파일 탐지
- `depcheck`: 사용되지 않는 dependencies

**명령어**:
```bash
npx unimported
npx depcheck
```

**주의사항**:
- False positive 가능 → 수동 검증 필요
- Electron main/renderer 분리 구조 고려

---

## 아젠다 3: 성능 최적화

### 성능 분석

#### 1. SharedMemoryPool - 이미 최적화됨 ✅

**파일**: `circuit/electron/sharedMemoryPool.ts`

**구현된 최적화**:
- ✅ LRU Cache (Line 220-231)
- ✅ Memory deduplication (Global memories shared)
- ✅ Lazy loading (Recent messages on-demand)
- ✅ TTL expiration (5 minutes)
- ✅ Max cache size (10 projects)

**Benchmark 결과** (benchmark-memory.ts 참고):
```
Without SharedMemoryPool: 600 memory objects (5 × 100 global + 5 × 20 conversation)
With SharedMemoryPool:    200 memory objects (100 global shared + 5 × 20 conversation)

Memory object reduction: 67%
```

**결론**: 추가 최적화 불필요 (이미 잘 설계됨)

#### 2. AgentWorker - Progress Throttling 미구현

**현재 문제** (가상 시나리오):
- Claude CLI가 stdout으로 초당 100개 JSON 라인 전송
- 각 라인마다 EventBroadcaster 호출 → IPC 폭주
- UI 렌더링 부하

**해결 방안** (설계 문서 Line 1672-1687):
```typescript
// AgentWorker에 throttle 추가
private lastProgressUpdate = 0
private progressThrottle = 500  // 500ms

private handleToolUse(toolName: string): void {
  this.progress = Math.min(90, this.progress + increment)

  const now = Date.now()
  if (now - this.lastProgressUpdate < this.progressThrottle) {
    return  // Skip this update
  }

  this.lastProgressUpdate = now
  EventBroadcaster.broadcastAgentProgress(this.todo.id, {
    progress: this.progress,
    currentTask: this.currentTask
  })
}
```

**예상 효과**:
- IPC 호출 빈도: 100/s → 2/s (98% 감소)
- CPU 사용량 감소
- UI 렌더링 부하 감소

#### 3. 메모리 누수 위험 - AgentWorker Process 관리

**현재 구현** (agentWorker.ts:201-225):
```typescript
cancel(): void {
  // Remove all listeners first to prevent memory leaks
  this.claudeProcess.stdout?.removeAllListeners()
  this.claudeProcess.stderr?.removeAllListeners()
  this.claudeProcess.removeAllListeners()

  this.claudeProcess.kill('SIGTERM')

  // Force kill after 5 seconds if still running
  const process = this.claudeProcess
  setTimeout(() => {
    if (process && !process.killed) {
      console.log(`[AgentWorker] Force killing process...`)
      process.kill('SIGKILL')
    }
  }, 5000)

  this.claudeProcess = null
}
```

**문제점**:
- setTimeout이 메모리에 남아있음 (5초 동안)
- 여러 Agent 취소 시 누적

**개선 방안**:
```typescript
private killTimeout: NodeJS.Timeout | null = null

cancel(): void {
  // Clear previous timeout
  if (this.killTimeout) {
    clearTimeout(this.killTimeout)
    this.killTimeout = null
  }

  // Remove listeners
  this.claudeProcess.stdout?.removeAllListeners()
  this.claudeProcess.stderr?.removeAllListeners()
  this.claudeProcess.removeAllListeners()

  this.claudeProcess.kill('SIGTERM')

  // Force kill after 5 seconds
  this.killTimeout = setTimeout(() => {
    if (this.claudeProcess && !this.claudeProcess.killed) {
      this.claudeProcess.kill('SIGKILL')
    }
    this.killTimeout = null
  }, 5000)

  this.claudeProcess = null
}
```

#### 4. Database 쿼리 최적화 (검증 필요)

**파일**: `circuit/electron/conversationStorage.ts` (읽지 않음, 추정)

**확인 필요 사항**:
1. [ ] Index 존재 여부 (todoId, conversationId)
2. [ ] N+1 쿼리 문제
3. [ ] Batch insert/update 사용 여부

**검증 방법**:
```sql
-- SQLite에서 실행
EXPLAIN QUERY PLAN SELECT * FROM todos WHERE conversationId = ?;
```

**최적화 예시**:
```typescript
// Bad: N+1 query
for (const todoId of todoIds) {
  const todo = storage.getTodo(todoId)  // 각 todoId마다 쿼리
}

// Good: Single query
const todos = storage.getTodosByIds(todoIds)  // 한 번에 조회
```

#### 5. React 렌더링 최적화 (UI 성능)

**확인 필요 사항**:
1. [ ] TodoList 컴포넌트에 virtualization 사용 여부
2. [ ] useMemo/useCallback 적절한 사용
3. [ ] 불필요한 re-render

**검증 방법**:
```bash
# React DevTools Profiler 사용
# 또는 Chrome DevTools Performance tab
```

**일반적인 문제**:
```typescript
// Bad: 매번 새 객체 생성 → re-render
<TodoItem key={todo.id} onClick={() => handleClick(todo.id)} />

// Good: useCallback 사용
const handleClick = useCallback((id: string) => {
  // ...
}, [])

<TodoItem key={todo.id} onClick={handleClick} />
```

### 액션 플랜

#### Phase 1: AgentWorker Throttling (2 hours)

**우선순위**: 🟡 MEDIUM

**작업**:
1. [ ] `lastProgressUpdate`, `progressThrottle` 필드 추가
2. [ ] `handleToolUse()` 메소드에 throttle 로직 추가
3. [ ] Test: 100개 tool 호출 시 IPC 호출 횟수 확인

**검증**:
```typescript
// Test code
let ipcCallCount = 0
EventBroadcaster.broadcastAgentProgress = () => {
  ipcCallCount++
}

// Simulate 100 tool calls in 1 second
for (let i = 0; i < 100; i++) {
  worker.handleToolUse('Read')
  await sleep(10)
}

console.log(`IPC calls: ${ipcCallCount}`)  // Should be ~2, not 100
```

#### Phase 2: 메모리 누수 방지 (1 hour)

**우선순위**: 🟢 LOW

**작업**:
1. [ ] `killTimeout` 필드 추가
2. [ ] `cancel()` 메소드 수정
3. [ ] Test: 10개 Agent 동시 취소 시 메모리 확인

#### Phase 3: Database 쿼리 검증 (2-3 hours)

**우선순위**: 🟢 LOW

**작업**:
1. [ ] `conversationStorage.ts` 읽고 분석
2. [ ] EXPLAIN QUERY PLAN 실행
3. [ ] Index 추가 (필요 시)
4. [ ] Batch query 구현 (필요 시)

#### Phase 4: React 렌더링 프로파일링 (Optional)

**우선순위**: 🟢 LOW

**작업**:
1. [ ] React DevTools Profiler로 TodoList 분석
2. [ ] 불필요한 re-render 식별
3. [ ] useMemo/useCallback 추가
4. [ ] Virtualization 고려 (Todo가 100개 이상일 경우)

---

## 종합 우선순위 및 일정

### 우선순위 매트릭스

| 아젠다 | Phase | 우선순위 | 예상 시간 | 임팩트 | 복잡도 |
|--------|-------|---------|----------|--------|--------|
| Agent Work | Phase 1: Stream 파싱 | 🔴 HIGH | 1-2 days | ⭐⭐⭐⭐⭐ | 높음 |
| Agent Work | Phase 2: Queue 관리 | 🟡 MEDIUM | 1 day | ⭐⭐⭐⭐ | 중간 |
| Agent Work | Phase 3: UI 통합 | 🟡 MEDIUM | 2 days | ⭐⭐⭐⭐⭐ | 중간 |
| Dead Code | Benchmark 이동 | 🟢 LOW | 30 min | ⭐⭐ | 낮음 |
| Dead Code | TODO 정리 | 🟢 LOW | 1 hour | ⭐⭐ | 낮음 |
| 성능 | Progress Throttling | 🟡 MEDIUM | 2 hours | ⭐⭐⭐ | 낮음 |
| 성능 | 메모리 누수 방지 | 🟢 LOW | 1 hour | ⭐⭐⭐ | 낮음 |

### 추천 일정 (1주)

#### Day 1 (Mon): Agent Work - Stream 파싱 (Part 1)
- [ ] `parseStreamEvent()` 메소드 구현
- [ ] Stream-JSON 포맷 파싱 로직
- [ ] Unit test 작성

#### Day 2 (Tue): Agent Work - Stream 파싱 (Part 2)
- [ ] `handleToolUse()` 메소드 구현
- [ ] Progress 계산 로직
- [ ] EventBroadcaster 통합

#### Day 3 (Wed): Agent Work - Queue 관리
- [ ] `taskQueue` 구현
- [ ] `processQueue()` 메소드
- [ ] 동시 실행 제한 테스트

#### Day 4 (Thu): Agent Work - UI 통합 (Part 1)
- [ ] AgentContext 생성
- [ ] IPC event listeners
- [ ] State management

#### Day 5 (Fri): Agent Work - UI 통합 (Part 2) + Dead Code
- [ ] TodoItem 확장
- [ ] Progress bar UI
- [ ] **Quick win**: Benchmark 파일 이동, TODO 정리

#### Day 6 (Sat): 성능 최적화 + Testing
- [ ] Progress Throttling 구현
- [ ] 메모리 누수 방지
- [ ] End-to-end 테스트

#### Day 7 (Sun): 통합 테스트 및 문서화
- [ ] 전체 기능 테스트
- [ ] 버그 수정
- [ ] README 업데이트

### Quick Wins (빠른 성과)

**할 수 있는 것 (1-2 hours)**:
1. ✅ Branch 이름 변경 (`dar` → `agent-feature-improvements`) - **완료**
2. [ ] Benchmark 파일 이동
3. [ ] TODO 주석 정리
4. [ ] Progress Throttling 구현

**임팩트**:
- 코드베이스 정리
- 문서 vs 구현 차이 명확화
- 성능 개선 (Throttling)

---

## 체크리스트

### Agent Work 기능 개선
- [x] 현재 구현 상태 분석
- [x] 미구현 기능 목록 작성
- [x] 상세 코드 분석 (AgentWorker, AgentManager)
- [x] Phase별 액션 플랜 작성
- [ ] Phase 1 구현 (Stream 파싱)
- [ ] Phase 2 구현 (Queue 관리)
- [ ] Phase 3 구현 (UI 통합)

### 죽은 코드 삭제
- [x] Benchmark 파일 발견
- [x] TODO 주석 목록 추출
- [x] 액션 플랜 작성
- [ ] Benchmark 파일 이동/삭제
- [ ] TODO 주석 정리
- [ ] Unused imports 제거

### 성능 최적화
- [x] SharedMemoryPool 분석 (이미 최적화됨)
- [x] AgentWorker Throttling 필요성 확인
- [x] 메모리 누수 위험 식별
- [x] 액션 플랜 작성
- [ ] Progress Throttling 구현
- [ ] 메모리 누수 방지 개선
- [ ] Database 쿼리 검증 (Optional)

---

## 참고 문서

- `AGENT_WORKER_ARCHITECTURE.md` - Agent 시스템 상세 설계
- `AGENT_WORKER_ANALYSIS.md` - 기존 코드 분석
- `MULTI_CONVERSATION_DESIGN.md` - 메모리 최적화 전략
- `TEST_FIX_LOOP_ARCHITECTURE.md` - Test-Fix Loop 설계

---

**End of Document**
