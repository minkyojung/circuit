# Multi-Conversation Orchestration 설계 문서

## 개요

### 비전

Circuit에 "브랜치 플랜 기반 멀티 컨버세이션 오케스트레이션" 기능을 추가하여, 큰 작업을 여러 독립적인 conversation으로 분해하고 병렬/순차 실행을 자동화합니다. 이를 통해 개발자 혼자서 팀 전체의 생산성을 낼 수 있도록 합니다.

### 핵심 아이디어

```
브랜치 목표: "OAuth 인증 구현"
├─ [Conversation 1] 데이터베이스 스키마 (1시간)
│  ├─ Todo: users 테이블 설계
│  ├─ Todo: migration 생성
│  └─ 산출물: migrations/001_oauth.sql
│
├─ [Conversation 2] 백엔드 API (2시간) - Conv 1 완료 후 시작
│  ├─ Todo: /auth/login 구현
│  ├─ Todo: JWT 미들웨어
│  └─ 산출물: api/auth/*.ts
│
├─ [Conversation 3] 프론트엔드 UI (2시간) - Conv 1과 병렬 가능
│  ├─ Todo: Login 컴포넌트
│  └─ 산출물: components/auth/*.tsx
│
└─ [Conversation 4] 통합 테스트 (1시간) - Conv 2,3 완료 후 시작
   └─ 산출물: 모든 테스트 통과

순차 실행: 6시간
병렬 실행: 4시간 (33% 단축)
```

**목표:**
- 큰 작업을 논리적으로 분해
- 작업 간 의존성 자동 관리
- 병렬 실행으로 개발 속도 2-3배 향상
- 산출물 자동 검증

---

## 현재 상태 분석

### ✅ 이미 구현된 것

1. **Conversation 시스템**
   - 여러 conversation 생성 가능
   - 각 conversation별 독립적인 todo 리스트
   - Tab으로 전환 가능

2. **Todo 시스템**
   ```typescript
   interface Todo {
     id: string
     conversationId: string
     parentId?: string       // 계층 구조 지원
     order: number
     depth: number
     status: TodoStatus
     metadata?: {
       dependencies?: string[]  // Todo 의존성 필드 존재
     }
   }
   ```

3. **Block 기반 메시지**
   - 실행 가능한 semantic units
   - File, Code, Command, Diff 등 14+ 타입

4. **Agent 시스템**
   - Todo 기반 agent 실행
   - 격리된 context에서 작업

### ❌ 빠진 것

1. **브랜치 레벨 목표**
   - "이 브랜치의 최종 목표"를 정의할 entity 없음
   - 여러 conversation을 하나의 플랜으로 묶을 방법 없음

2. **Conversation 간 의존성**
   - Conversation A 완료 → Conversation B 시작 불가능
   - 각 conversation은 완전히 독립적

3. **병렬 실행 엔진**
   - 현재는 한 번에 하나의 agent만 실행
   - 여러 conversation을 동시에 실행할 orchestrator 없음

4. **산출물 명세 & 검증**
   - "이 conversation은 특정 파일을 생성해야 함" 명세 불가
   - 작업 완료를 자동으로 검증할 방법 없음

5. **전체 진행도 추적**
   - 브랜치 플랜의 전체 진행도 계산 불가
   - Conversation 간 연결 관계 시각화 없음

---

## 목표 아키텍처

### 설계 원칙

1. **관심사 분리**
   - **BranchPlan**: 전략 레이어 (무엇을 달성할 것인가)
   - **Conversation**: 실행 단위 (어떻게 달성할 것인가)
   - **Todo**: 원자적 작업 (개별 액션)

2. **명시적 의존성**
   - Conversation 의존성을 first-class citizen으로
   - DAG (Directed Acyclic Graph) 검증

3. **병렬 우선**
   - 기본은 병렬 실행
   - 의존성이 있을 때만 순차 실행

4. **검증 가능한 산출물**
   - 각 conversation의 deliverable 명시
   - 자동 검증 지원

### 계층 구조

```
Repository
└── Workspace (Git Worktree)
    └── BranchPlan (NEW!)
        ├── ConversationPlan 1 (NEW!)
        │   ├── Conversation 1
        │   │   ├── Message[]
        │   │   ├── Block[]
        │   │   └── Todo[]
        │   └── ConversationOutput[] (NEW!)
        │
        ├── ConversationPlan 2
        │   └── ...
        └── ...
```

---

## 구현 전략

### Phase 1: 단순화 버전 (v1) - 2-3주

**목표:** 멀티 conversation 계획 수립 및 자동 생성

**범위:**
- AI가 큰 작업을 여러 conversation으로 분해
- 각 conversation에 todo 자동 할당
- 유저가 수동으로 실행 (자동화 없음)

**얻는 것:**
- 멀티 conversation 계획 경험
- AI 분해 능력 검증
- 사용자 피드백 수집

**구현 내용:**
1. SimpleBranchPlan 데이터 구조
2. Plan Mode 프롬프트 확장
3. 플랜 승인 UI
4. Conversation 자동 생성 로직

### Phase 2: 전체 버전 (v2) - 8-10주

**목표:** 완전 자동화된 orchestration

**추가 기능:**
- Conversation 의존성 관리
- 자동 병렬 실행
- 산출물 검증
- 실시간 진행도 대시보드

---

## 데이터 모델

### v1: 단순화 버전

```typescript
/**
 * SimpleBranchPlan - 간단한 브랜치 플랜
 */
interface SimpleBranchPlan {
  id: string
  workspaceId: string

  // 목표
  goal: string              // "OAuth 인증 구현"
  description?: string      // 상세 설명

  // Conversation 구성
  conversations: Array<{
    title: string           // "데이터베이스 스키마"
    goal: string            // "OAuth용 DB 테이블 설계"
    description?: string
    todos: Array<{
      content: string       // "users 테이블 설계"
      activeForm?: string
      priority?: TodoPriority
      complexity?: TodoComplexity
      estimatedDuration?: number  // 초
    }>
    estimatedDuration: number  // 이 conversation의 예상 시간
  }>

  // 메타데이터
  createdAt: number
  createdBy: 'user' | 'ai'
  approvedAt?: number

  // 통계
  totalEstimatedDuration: number
  totalConversations: number
  totalTodos: number
}
```

### v2: 전체 버전

```typescript
/**
 * BranchPlan - 브랜치 전체의 실행 계획
 */
interface BranchPlan {
  id: string
  workspaceId: string
  branchName: string

  // 목표
  objective: string         // "OAuth 인증 구현"
  description: string       // 상세 요구사항

  // 메타데이터
  createdBy: 'user' | 'ai'
  createdAt: number
  approvedAt?: number

  // 실행 상태
  status: 'draft' | 'approved' | 'in_progress' | 'completed' | 'failed'

  // 포함된 conversation plans
  conversationPlanIds: string[]

  // 메트릭
  estimatedDuration: number  // 순차 실행 시 예상 시간 (초)
  estimatedParallelDuration: number  // 병렬 실행 시 예상 시간
  actualDuration?: number    // 실제 소요 시간
  startedAt?: number
  completedAt?: number
}

/**
 * ConversationPlan - 개별 conversation의 실행 계획
 */
interface ConversationPlan {
  id: string
  branchPlanId: string
  conversationId: string    // 실제 conversation ID

  // 목표
  goal: string              // "백엔드 API 구현"
  description: string

  // 의존성 (DAG)
  dependsOn: string[]       // 다른 ConversationPlan ID들

  // 예상 산출물
  outputs: ConversationOutput[]

  // 실행 제어
  executionMode: 'serial' | 'parallel'  // Todo 실행 방식
  autoStart: boolean        // 의존성 충족 시 자동 시작 여부

  // 상태
  status: 'blocked' | 'ready' | 'running' | 'completed' | 'failed'
  blockReason?: string      // blocked 이유

  // 메트릭
  estimatedDuration: number
  actualDuration?: number
  startedAt?: number
  completedAt?: number

  // 메타데이터
  createdAt: number
  updatedAt: number
}

/**
 * ConversationOutput - Conversation의 예상 산출물
 */
interface ConversationOutput {
  id: string
  conversationPlanId: string
  type: 'file' | 'directory' | 'test-pass' | 'custom'

  // 명세
  spec: {
    // 'file' 타입
    filePath?: string         // "src/api/auth.ts"
    filePattern?: string      // "src/api/*.ts"
    minLines?: number         // 최소 라인 수
    requiredContent?: string[]  // 포함되어야 할 내용

    // 'directory' 타입
    directoryPath?: string
    minFiles?: number

    // 'test-pass' 타입
    testCommand?: string      // "npm test auth"

    // 'custom' 타입
    validatorFn?: string      // 검증 함수 이름
  }

  // 검증 결과
  verified: boolean
  verifiedAt?: number
  verificationError?: string
  actualValue?: any         // 실제 생성된 값

  // 메타데이터
  createdAt: number
}

/**
 * Extended Todo - 실행 메타데이터 포함
 */
interface ExecutableTodo extends Todo {
  conversationPlanId?: string

  // Runtime state (메모리에만 존재, DB에는 저장 안 함)
  agentId?: string          // 실행 중인 agent ID
  runtime?: {
    startedAt: number
    heartbeatAt: number     // 마지막 heartbeat
    logs: string[]          // 실행 로그
  }
}
```

---

## Database Schema

### v1 Schema

```sql
-- SimpleBranchPlans 테이블
CREATE TABLE simple_branch_plans (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  goal TEXT NOT NULL,
  description TEXT,
  conversations TEXT NOT NULL,  -- JSON 배열
  created_at INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  approved_at INTEGER,
  total_estimated_duration INTEGER NOT NULL,
  total_conversations INTEGER NOT NULL,
  total_todos INTEGER NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX idx_simple_branch_plans_workspace ON simple_branch_plans(workspace_id);
CREATE INDEX idx_simple_branch_plans_created ON simple_branch_plans(created_at DESC);
```

### v2 Schema

```sql
-- BranchPlans 테이블
CREATE TABLE branch_plans (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  branch_name TEXT NOT NULL,
  objective TEXT NOT NULL,
  description TEXT,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  approved_at INTEGER,
  status TEXT NOT NULL CHECK (status IN ('draft', 'approved', 'in_progress', 'completed', 'failed')),
  estimated_duration INTEGER NOT NULL,
  estimated_parallel_duration INTEGER NOT NULL,
  actual_duration INTEGER,
  started_at INTEGER,
  completed_at INTEGER,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX idx_branch_plans_workspace ON branch_plans(workspace_id);
CREATE INDEX idx_branch_plans_status ON branch_plans(status);

-- ConversationPlans 테이블
CREATE TABLE conversation_plans (
  id TEXT PRIMARY KEY,
  branch_plan_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  goal TEXT NOT NULL,
  description TEXT,
  depends_on TEXT,              -- JSON 배열 (ConversationPlan IDs)
  outputs TEXT NOT NULL,        -- JSON 배열 (ConversationOutput[])
  execution_mode TEXT NOT NULL CHECK (execution_mode IN ('serial', 'parallel')),
  auto_start INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL CHECK (status IN ('blocked', 'ready', 'running', 'completed', 'failed')),
  block_reason TEXT,
  estimated_duration INTEGER NOT NULL,
  actual_duration INTEGER,
  started_at INTEGER,
  completed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (branch_plan_id) REFERENCES branch_plans(id) ON DELETE CASCADE,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE INDEX idx_conversation_plans_branch ON conversation_plans(branch_plan_id);
CREATE INDEX idx_conversation_plans_conversation ON conversation_plans(conversation_id);
CREATE INDEX idx_conversation_plans_status ON conversation_plans(status);

-- ConversationOutputs 테이블
CREATE TABLE conversation_outputs (
  id TEXT PRIMARY KEY,
  conversation_plan_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('file', 'directory', 'test-pass', 'custom')),
  spec TEXT NOT NULL,           -- JSON object
  verified INTEGER NOT NULL DEFAULT 0,
  verified_at INTEGER,
  verification_error TEXT,
  actual_value TEXT,            -- JSON (optional)
  created_at INTEGER NOT NULL,
  FOREIGN KEY (conversation_plan_id) REFERENCES conversation_plans(id) ON DELETE CASCADE
);

CREATE INDEX idx_conversation_outputs_plan ON conversation_outputs(conversation_plan_id);

-- Todos 테이블 확장
ALTER TABLE todos ADD COLUMN conversation_plan_id TEXT REFERENCES conversation_plans(id);
CREATE INDEX idx_todos_conversation_plan ON todos(conversation_plan_id);
```

---

## 실행 플로우

### v1: 단순화 버전

```
1. 유저가 Plan Mode에서 요청
   유저: "OAuth 인증 구현"

2. AI가 SimpleBranchPlan JSON 생성
   {
     "goal": "OAuth 인증 구현",
     "conversations": [
       {
         "title": "데이터베이스 스키마",
         "goal": "OAuth용 users 테이블 설계",
         "todos": [
           { "content": "users 테이블 설계" },
           { "content": "migration 파일 생성" }
         ],
         "estimatedDuration": 3600
       },
       { ... }
     ]
   }

3. UI에서 플랜 미리보기
   - 생성될 conversation 목록
   - 각 conversation의 todo 리스트
   - 전체 예상 시간

4. 유저 승인

5. 시스템이 자동으로:
   - SimpleBranchPlan을 DB에 저장
   - 각 conversation 생성
   - 각 conversation에 todo 할당

6. 유저에게 완료 알림
   "4개 conversation이 생성되었습니다!"

7. 유저가 수동으로 각 conversation의 todo 실행
```

**v1 구현 코드:**

```typescript
// 1. Plan Mode 프롬프트 수정
const planModePromptV1 = `
사용자의 요청을 분석하고 여러 conversation으로 분해하세요.

다음 JSON 형식으로 출력하세요:

\`\`\`json
{
  "goal": "전체 목표 (간단명료하게)",
  "conversations": [
    {
      "title": "Conversation 제목",
      "goal": "이 conversation이 달성할 목표",
      "todos": [
        {
          "content": "할 일 (명령형)",
          "activeForm": "진행 중 표시 (현재진행형)",
          "complexity": "trivial|simple|moderate|complex|very_complex",
          "priority": "low|medium|high|critical",
          "estimatedDuration": 900
        }
      ],
      "estimatedDuration": 3600
    }
  ]
}
\`\`\`

지침:
1. 논리적으로 독립적인 작업 그룹으로 분해
2. 각 conversation은 명확한 목표가 있어야 함
3. Conversation 수는 2~6개 권장
4. Todo는 conversation당 1~10개 권장
`;

// 2. SimpleBranchPlan 생성 함수
async function createSimpleBranchPlan(
  workspaceId: string,
  planData: any
): Promise<SimpleBranchPlan> {
  const plan: SimpleBranchPlan = {
    id: crypto.randomUUID(),
    workspaceId,
    goal: planData.goal,
    description: planData.description,
    conversations: planData.conversations,
    createdAt: Date.now(),
    createdBy: 'ai',
    totalEstimatedDuration: planData.conversations.reduce(
      (sum, c) => sum + c.estimatedDuration,
      0
    ),
    totalConversations: planData.conversations.length,
    totalTodos: planData.conversations.reduce(
      (sum, c) => sum + c.todos.length,
      0
    )
  };

  // DB에 저장
  await storage.saveSimpleBranchPlan(plan);

  return plan;
}

// 3. Plan 실행 (conversation + todo 생성)
async function executeSimpleBranchPlan(
  planId: string
): Promise<void> {
  const plan = await storage.getSimpleBranchPlan(planId);

  for (const convPlan of plan.conversations) {
    // Conversation 생성
    const conversation = await storage.createConversation({
      workspaceId: plan.workspaceId,
      title: convPlan.title
    });

    // Todo 생성
    for (const todoData of convPlan.todos) {
      await storage.createTodo({
        conversationId: conversation.id,
        messageId: '', // Plan에서 생성된 todo는 특정 메시지 없음
        content: todoData.content,
        activeForm: todoData.activeForm,
        status: 'pending',
        priority: todoData.priority,
        complexity: todoData.complexity,
        estimatedDuration: todoData.estimatedDuration,
        order: 0,
        depth: 0,
        thinkingStepIds: [],
        blockIds: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }
  }

  // Plan을 approved로 업데이트
  await storage.updateSimpleBranchPlan(planId, {
    approvedAt: Date.now()
  });
}

// 4. UI 컴포넌트
function SimpleBranchPlanPreview({ plan }: { plan: SimpleBranchPlan }) {
  const [isApproving, setIsApproving] = useState(false);

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      await executeSimpleBranchPlan(plan.id);
      alert(`${plan.totalConversations}개 conversation이 생성되었습니다!`);
    } catch (error) {
      alert(`생성 실패: ${error.message}`);
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <div className="branch-plan-preview">
      <h2>{plan.goal}</h2>

      <div className="stats">
        <div>생성될 Conversation: {plan.totalConversations}개</div>
        <div>총 Todo: {plan.totalTodos}개</div>
        <div>예상 시간: {Math.floor(plan.totalEstimatedDuration / 3600)}시간</div>
      </div>

      <div className="conversations">
        {plan.conversations.map((conv, idx) => (
          <div key={idx} className="conversation-preview">
            <h3>{conv.title}</h3>
            <p>{conv.goal}</p>
            <ul>
              {conv.todos.map((todo, todoIdx) => (
                <li key={todoIdx}>{todo.content}</li>
              ))}
            </ul>
            <div className="duration">
              예상: {Math.floor(conv.estimatedDuration / 60)}분
            </div>
          </div>
        ))}
      </div>

      <div className="actions">
        <button onClick={handleApprove} disabled={isApproving}>
          {isApproving ? '생성 중...' : '승인'}
        </button>
        <button onClick={() => {}}>수정</button>
        <button onClick={() => {}}>취소</button>
      </div>
    </div>
  );
}
```

### v2: 전체 버전

```
1. 유저가 요청 (v1과 동일)

2. AI가 BranchPlan + ConversationPlan 생성
   - 각 conversation 간 의존성 파악
   - 산출물 명세 작성
   - DAG 검증

3. 유저 승인

4. Orchestrator가 자동 실행:
   - 의존성 그래프 분석
   - 위상 정렬 (topological sort)
   - 레벨별 병렬 실행

   레벨 0: [Conv 1, Conv 3] 병렬 시작
   레벨 1: [Conv 2] Conv 1 완료 후 시작
   레벨 2: [Conv 4] Conv 2, 3 완료 후 시작

5. 각 conversation 완료 시 산출물 검증

6. 전체 완료
```

**v2 핵심 컴포넌트:**

```typescript
/**
 * BranchPlanOrchestrator - 실행 엔진
 */
class BranchPlanOrchestrator {
  private branchPlan: BranchPlan;
  private graph: ConversationDependencyGraph;
  private agentPool: AgentPoolManager;

  async execute(): Promise<void> {
    console.log(`[Orchestrator] 실행 시작: ${this.branchPlan.objective}`);

    // 1. 의존성 그래프 구축
    this.graph = new ConversationDependencyGraph(this.branchPlan);

    // 2. 순환 의존성 검증
    if (this.graph.hasCycle()) {
      throw new Error('순환 의존성 발견!');
    }

    // 3. 위상 정렬
    const levels = this.graph.topologicalSort();

    // 4. 레벨별 실행
    for (const level of levels) {
      console.log(`[Orchestrator] 레벨 ${level.index} 실행 (${level.nodes.length}개)`);

      // 같은 레벨 = 병렬 실행 가능
      await Promise.all(
        level.nodes.map(nodeId => this.executeConversationPlan(nodeId))
      );

      console.log(`[Orchestrator] 레벨 ${level.index} 완료`);
    }

    // 5. 전체 산출물 검증
    await this.verifyAllOutputs();

    console.log('[Orchestrator] 브랜치 플랜 완료!');
  }

  private async executeConversationPlan(planId: string): Promise<void> {
    const plan = await getConversationPlan(planId);

    // 상태 업데이트
    await updateConversationPlanStatus(planId, 'running');

    // Todo 가져오기
    const todos = await getTodosByConversation(plan.conversationId);

    // 실행 모드에 따라 처리
    if (plan.executionMode === 'parallel') {
      // 독립적인 todo들 병렬 실행
      const independentTodos = this.findIndependentTodos(todos);
      await Promise.all(
        independentTodos.map(todo => this.executeTodo(todo))
      );
    } else {
      // 순차 실행
      for (const todo of todos) {
        await this.executeTodo(todo);
      }
    }

    // 산출물 검증
    const outputsValid = await this.verifyConversationOutputs(plan);

    if (outputsValid) {
      await updateConversationPlanStatus(planId, 'completed');
    } else {
      throw new Error(`${plan.goal} 산출물 검증 실패`);
    }
  }

  private async executeTodo(todo: ExecutableTodo): Promise<void> {
    console.log(`[Orchestrator] Todo 시작: ${todo.content}`);

    // Agent 실행
    const agent = await this.agentPool.spawn(todo);

    // 완료 대기
    const result = await agent.waitForCompletion();

    if (result.success) {
      await updateTodoStatus(todo.id, 'completed');
    } else {
      throw new Error(`Todo 실패: ${todo.content}`);
    }
  }

  private async verifyConversationOutputs(
    plan: ConversationPlan
  ): Promise<boolean> {
    for (const output of plan.outputs) {
      const verified = await this.verifyOutput(output);

      if (!verified) {
        console.error(`[Orchestrator] 산출물 검증 실패: ${output.spec}`);
        return false;
      }
    }

    return true;
  }

  private async verifyOutput(output: ConversationOutput): Promise<boolean> {
    switch (output.type) {
      case 'file':
        return await FileOutputVerifier.verify(output, this.workspacePath);

      case 'directory':
        return await DirectoryOutputVerifier.verify(output, this.workspacePath);

      case 'test-pass':
        return await TestPassVerifier.verify(output, this.workspacePath);

      case 'custom':
        const validator = loadValidator(output.spec.validatorFn);
        return await validator(output);

      default:
        return false;
    }
  }
}

/**
 * ConversationDependencyGraph - 의존성 그래프
 */
class ConversationDependencyGraph {
  private nodes: Map<string, ConversationPlan> = new Map();
  private edges: Map<string, Set<string>> = new Map();

  constructor(branchPlan: BranchPlan) {
    this.buildGraph(branchPlan);
  }

  private buildGraph(branchPlan: BranchPlan): void {
    // 노드 추가
    for (const planId of branchPlan.conversationPlanIds) {
      const plan = getConversationPlan(planId);
      this.nodes.set(planId, plan);
      this.edges.set(planId, new Set());

      // 엣지 추가 (의존성)
      for (const depId of plan.dependsOn) {
        this.edges.get(depId)!.add(planId);
      }
    }
  }

  hasCycle(): boolean {
    const visited = new Set<string>();
    const recStack = new Set<string>();

    for (const nodeId of this.nodes.keys()) {
      if (this.hasCycleUtil(nodeId, visited, recStack)) {
        return true;
      }
    }

    return false;
  }

  private hasCycleUtil(
    nodeId: string,
    visited: Set<string>,
    recStack: Set<string>
  ): boolean {
    visited.add(nodeId);
    recStack.add(nodeId);

    for (const neighbor of this.edges.get(nodeId) || []) {
      if (!visited.has(neighbor)) {
        if (this.hasCycleUtil(neighbor, visited, recStack)) {
          return true;
        }
      } else if (recStack.has(neighbor)) {
        return true;
      }
    }

    recStack.delete(nodeId);
    return false;
  }

  topologicalSort(): Level[] {
    const levels: Level[] = [];
    const inDegree = new Map<string, number>();

    // In-degree 계산
    for (const nodeId of this.nodes.keys()) {
      inDegree.set(nodeId, 0);
    }

    for (const neighbors of this.edges.values()) {
      for (const neighbor of neighbors) {
        inDegree.set(neighbor, inDegree.get(neighbor)! + 1);
      }
    }

    // 레벨별로 그룹화 (Kahn's algorithm)
    let currentLevel = Array.from(this.nodes.keys()).filter(
      id => inDegree.get(id) === 0
    );
    let levelIndex = 0;

    while (currentLevel.length > 0) {
      levels.push({
        index: levelIndex,
        nodes: currentLevel
      });

      const nextLevel: string[] = [];

      for (const nodeId of currentLevel) {
        for (const neighbor of this.edges.get(nodeId) || []) {
          const newDegree = inDegree.get(neighbor)! - 1;
          inDegree.set(neighbor, newDegree);

          if (newDegree === 0) {
            nextLevel.push(neighbor);
          }
        }
      }

      currentLevel = nextLevel;
      levelIndex++;
    }

    return levels;
  }
}

/**
 * AgentPoolManager - Agent 풀 관리
 */
class AgentPoolManager {
  private maxConcurrent: number = 4;
  private running: Map<string, AgentHandle> = new Map();
  private queue: ExecutableTodo[] = [];

  async spawn(todo: ExecutableTodo): Promise<AgentHandle> {
    // 슬롯 대기
    while (this.running.size >= this.maxConcurrent) {
      await this.waitForSlot();
    }

    // Agent 생성
    const agent = await createAgent({
      conversationId: todo.conversationId,
      instruction: todo.content,
      workspacePath: this.workspacePath
    });

    this.running.set(todo.id, agent);

    // 완료 시 자동 제거
    agent.onComplete(() => {
      this.running.delete(todo.id);
    });

    return agent;
  }

  private async waitForSlot(): Promise<void> {
    return new Promise(resolve => {
      const interval = setInterval(() => {
        if (this.running.size < this.maxConcurrent) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });
  }

  async killAll(): Promise<void> {
    for (const agent of this.running.values()) {
      await agent.kill();
    }

    this.running.clear();
  }
}

/**
 * Output Verifiers
 */
class FileOutputVerifier {
  static async verify(
    output: ConversationOutput,
    workspacePath: string
  ): Promise<boolean> {
    const filePath = path.join(workspacePath, output.spec.filePath!);

    // 파일 존재 확인
    const exists = await fs.pathExists(filePath);
    if (!exists) {
      console.error(`[Verifier] 파일 없음: ${filePath}`);
      return false;
    }

    // 라인 수 확인
    if (output.spec.minLines) {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n').length;

      if (lines < output.spec.minLines) {
        console.error(`[Verifier] 라인 수 부족: ${lines} < ${output.spec.minLines}`);
        return false;
      }
    }

    // 필수 내용 확인
    if (output.spec.requiredContent) {
      const content = await fs.readFile(filePath, 'utf-8');

      for (const required of output.spec.requiredContent) {
        if (!content.includes(required)) {
          console.error(`[Verifier] 필수 내용 없음: ${required}`);
          return false;
        }
      }
    }

    return true;
  }
}

class TestPassVerifier {
  static async verify(
    output: ConversationOutput,
    workspacePath: string
  ): Promise<boolean> {
    const testCmd = output.spec.testCommand!;

    const result = await execCommand(testCmd, {
      cwd: workspacePath,
      timeout: 60000
    });

    if (result.exitCode !== 0) {
      console.error(`[Verifier] 테스트 실패: ${result.stderr}`);
      return false;
    }

    return true;
  }
}
```

---

## UI/UX 설계

### v1 UI

**1. Plan Preview Modal**
```
┌─────────────────────────────────────────────┐
│ 브랜치 플랜 미리보기                        │
├─────────────────────────────────────────────┤
│                                             │
│ 목표: OAuth 인증 구현                       │
│                                             │
│ 📊 통계                                     │
│   생성될 Conversation: 4개                  │
│   총 Todo: 12개                             │
│   예상 시간: 6시간                          │
│                                             │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                             │
│ 📋 Conversation 1: 데이터베이스 스키마      │
│    목표: OAuth용 DB 테이블 설계             │
│    예상: 1시간                              │
│    ├─ users 테이블 설계                     │
│    └─ migration 파일 생성                   │
│                                             │
│ 📋 Conversation 2: 백엔드 API               │
│    목표: 인증 엔드포인트 구현               │
│    예상: 2시간                              │
│    ├─ /auth/login 구현                      │
│    ├─ /auth/register 구현                   │
│    └─ JWT 미들웨어 추가                     │
│                                             │
│ ... (더 보기)                               │
│                                             │
├─────────────────────────────────────────────┤
│         [승인]  [수정]  [취소]              │
└─────────────────────────────────────────────┘
```

**2. Conversation List (생성 후)**
```
┌─────────────────────────────────────────────┐
│ Conversations (브랜치 플랜에서 생성됨)      │
├─────────────────────────────────────────────┤
│                                             │
│ [📋 데이터베이스 스키마] [2 todos]          │
│ [📋 백엔드 API] [3 todos]                   │
│ [📋 프론트엔드 UI] [4 todos]                │
│ [📋 통합 테스트] [3 todos]                  │
│                                             │
└─────────────────────────────────────────────┘
```

### v2 UI

**1. Branch Plan Dashboard**
```
┌───────────────────────────────────────────────────────────┐
│ OAuth 인증 구현                                           │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━ 65% 완료                      │
│                                                           │
│ 전체 진행도: 65%  |  남은 시간: 1.5시간                  │
│                                                           │
├───────────────────────────────────────────────────────────┤
│                                                           │
│ ┌─────────────────┐  ┌─────────────────┐                 │
│ │ ✓ DB 스키마     │  │ ✓ 프론트 UI     │                 │
│ │ 완료 (1h)       │  │ 완료 (2h)       │                 │
│ │ 2/2 todos       │  │ 4/4 todos       │                 │
│ └─────────────────┘  └─────────────────┘                 │
│                                                           │
│ ┌─────────────────┐  ┌─────────────────┐                 │
│ │ ▶ 백엔드 API    │  │ ⏸ 통합 테스트   │                 │
│ │ 진행 중 (1.2h)  │  │ 대기 중         │                 │
│ │ 2/3 todos       │  │ 백엔드 완료 필요│                 │
│ └─────────────────┘  └─────────────────┘                 │
│                                                           │
├───────────────────────────────────────────────────────────┤
│                                                           │
│ 실행 타임라인 (Gantt Chart)                              │
│                                                           │
│ DB 스키마    ████████░░░░░░░░░░░░░░░░                    │
│ 백엔드 API         ░░████████████░░░░                    │
│ 프론트 UI    ████████████░░░░░░░░░░░░                    │
│ 통합 테스트                    ░░░░░░░░                  │
│ ├──────┼──────┼──────┼──────┼                            │
│ 0h     1h     2h     3h     4h                           │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

**2. Conversation Card (상세)**
```
┌───────────────────────────────────────────┐
│ 백엔드 API                          ▶ 진행 중│
├───────────────────────────────────────────┤
│                                           │
│ 목표: 인증 엔드포인트 구현                │
│ 진행도: ████████░░░░ 67% (2/3 완료)       │
│                                           │
│ 의존성:                                   │
│   ← DB 스키마 (완료 ✓)                    │
│                                           │
│ Todo:                                     │
│   ✓ /auth/login 구현                      │
│   ✓ /auth/register 구현                   │
│   ▶ JWT 미들웨어 추가 (진행 중)           │
│                                           │
│ 산출물:                                   │
│   ⏳ api/auth/login.ts (검증 대기)        │
│   ⏳ api/auth/register.ts (검증 대기)     │
│   ❌ api/auth/middleware.ts (미생성)      │
│                                           │
│ 예상 시간: 2시간                          │
│ 경과 시간: 1.2시간                        │
│                                           │
└───────────────────────────────────────────┘
```

---

## 구현 로드맵

### Phase 1: v1 구현 (2-3주)

**Week 1:**
- [ ] SimpleBranchPlan 데이터 모델 정의
- [ ] Database schema 추가 (simple_branch_plans 테이블)
- [ ] Storage layer 구현 (CRUD)
- [ ] Plan Mode 프롬프트 수정

**Week 2:**
- [ ] Plan Preview UI 구현
- [ ] Plan 승인 로직
- [ ] Conversation 자동 생성 로직
- [ ] Todo 자동 할당 로직

**Week 3:**
- [ ] 통합 테스트
- [ ] 버그 수정
- [ ] 문서화
- [ ] 사용자 피드백 수집

### Phase 2: v2 구현 (8-10주)

**Week 1-2: 데이터 레이어**
- [ ] BranchPlan, ConversationPlan, ConversationOutput 테이블
- [ ] Migration scripts
- [ ] Storage layer 확장
- [ ] 단위 테스트

**Week 3-4: 의존성 그래프**
- [ ] ConversationDependencyGraph 구현
- [ ] DAG 검증 (순환 의존성 체크)
- [ ] 위상 정렬 알고리즘
- [ ] Graph 시각화 유틸리티

**Week 5-6: Orchestrator 엔진**
- [ ] BranchPlanOrchestrator 구현
- [ ] AgentPoolManager 구현
- [ ] 레벨별 병렬 실행 로직
- [ ] 에러 핸들링 & 롤백
- [ ] 일시정지/재개 기능

**Week 7: 산출물 검증**
- [ ] FileOutputVerifier
- [ ] DirectoryOutputVerifier
- [ ] TestPassVerifier
- [ ] Custom validator 지원
- [ ] 검증 결과 저장

**Week 8-9: UI/UX**
- [ ] Branch Plan Dashboard
- [ ] Conversation Card (상세)
- [ ] Gantt Chart 시각화
- [ ] 실시간 진행도 업데이트
- [ ] 에러/경고 표시

**Week 10: 마무리**
- [ ] E2E 테스트
- [ ] 성능 최적화
- [ ] 문서화
- [ ] 사용자 가이드

---

## 장단점 분석

### v1 장점
- ✅ 구현 간단 (2-3주)
- ✅ 낮은 리스크
- ✅ 빠른 검증
- ✅ 여전히 가치 제공 (작업 조직화)

### v1 단점
- ❌ 자동화 없음 (수동 실행)
- ❌ 병렬화 없음
- ❌ 의존성 강제 없음
- ❌ 산출물 검증 없음

### v2 장점
- ✅ 완전 자동화
- ✅ 병렬 실행으로 속도 2-3배
- ✅ 의존성 자동 관리
- ✅ 산출물 자동 검증
- ✅ Cursor/Claude Code 대비 차별화

### v2 단점
- ❌ 복잡도 높음
- ❌ 구현 기간 길음 (8-10주)
- ❌ 유저 학습 곡선
- ❌ 높은 리소스 소비 (병렬 agent)

---

## 잠재적 리스크

### 1. AI 계획 정확도
**문제:** AI가 작업을 잘못 분해하거나 의존성을 잘못 파악
**완화:** 유저가 플랜을 검토하고 수정할 수 있게 함

### 2. 복잡도 폭발
**문제:** 너무 많은 새 개념 → 유저 압도
**완화:** 선택사항으로 만들기, 기존 모드도 유지

### 3. 산출물 검증의 한계
**문제:** 일부 산출물은 자동 검증 어려움 (예: UX 품질)
**완화:** 검증을 선택사항으로, 수동 override 허용

### 4. 리소스 소비
**문제:** 여러 agent 병렬 실행 → CPU/메모리 부담
**완화:** 동시 실행 수 제한 (maxConcurrent), 리소스 모니터링

### 5. 파일 충돌
**문제:** 여러 conversation이 같은 파일 수정
**완화:** 파일 잠금 메커니즘, 충돌 감지 시 일시정지

---

## 성공 지표

### v1 성공 기준
- AI가 80% 이상의 경우 합리적인 conversation 분해
- 유저 만족도 4/5 이상
- 플랜 승인율 70% 이상
- 버그 리포트 < 5개/week

### v2 성공 기준
- 병렬 실행으로 30% 이상 시간 단축
- 산출물 자동 검증 정확도 90% 이상
- Orchestrator 안정성 99% 이상
- 리소스 소비 < 시스템의 50%
- 유저 만족도 4.5/5 이상

---

## 다음 단계

### 즉시 실행 가능한 작업

1. **v1 프로토타입 구현 시작**
   - SimpleBranchPlan 타입 정의
   - Database migration 작성
   - Plan Mode 프롬프트 초안

2. **사용자 리서치**
   - 어떤 작업에서 멀티 conversation이 유용한지 파악
   - 실제 사용 시나리오 수집

3. **기술 검증**
   - AI가 얼마나 정확하게 분해하는지 테스트
   - 병렬 agent 실행 시 리소스 소비 측정

### 의사결정 필요

- [ ] v1 먼저? vs v2 바로?
- [ ] 기본 활성화? vs 옵트인?
- [ ] 동시 agent 수 제한? (4개? 8개?)
- [ ] 산출물 검증을 필수로? vs 선택사항?

---

## 참고 자료

### 관련 기술

- **DAG (Directed Acyclic Graph)**: 의존성 표현
- **Topological Sort (Kahn's Algorithm)**: 실행 순서 결정
- **Agent Pool Pattern**: 제한된 리소스로 많은 작업 처리
- **Orchestration Pattern**: 여러 서비스를 조율

### 유사 시스템

- **GitHub Actions**: Workflow + Jobs + Dependencies
- **Airflow**: DAG 기반 task orchestration
- **Kubernetes Jobs**: Parallel execution with dependencies
- **Make**: Dependency-based build system

### Circuit 기존 문서

- `MULTI_CONVERSATION_DESIGN.md`: 기존 멀티 conversation 설계
- `block-based-conversation-system.md`: Block 아키텍처
- `workspace-chat-sync-architecture.md`: Workspace-conversation 관계

---

## 부록

### 예시 시나리오

#### 시나리오 1: 새 기능 개발

**요청:** "사용자 프로필 페이지 만들기"

**AI 분해:**
```
Conversation 1: 데이터 모델 (30분)
  - User 모델 확장 (bio, avatar 필드)
  - Profile 테이블 생성

Conversation 2: 백엔드 API (1시간)
  - GET /users/:id/profile
  - PUT /users/:id/profile
  - 이미지 업로드 엔드포인트

Conversation 3: 프론트엔드 (2시간)
  - ProfilePage 컴포넌트
  - ProfileEditForm
  - 아바타 업로드 UI

Conversation 4: 테스트 (1시간)
  - API 통합 테스트
  - UI 컴포넌트 테스트
```

**병렬화:**
- Conv 1 → 단독 시작
- Conv 2 → Conv 1 완료 후
- Conv 3 → Conv 1 완료 후 (Conv 2와 병렬)
- Conv 4 → Conv 2, 3 완료 후

**총 시간:** 순차 4.5시간 → 병렬 3시간

#### 시나리오 2: 버그 수정

**요청:** "로그인 시 토큰 만료 처리 버그 수정"

**AI 분해:**
```
Conversation 1: 문제 조사 (30분)
  - 현재 토큰 만료 로직 분석
  - 로그 확인
  - 재현 시나리오 작성

Conversation 2: 백엔드 수정 (1시간)
  - 토큰 갱신 로직 수정
  - 에러 핸들링 개선

Conversation 3: 프론트 수정 (1시간)
  - 토큰 만료 시 자동 갱신
  - 재로그인 플로우 개선

Conversation 4: 테스트 추가 (30분)
  - 토큰 만료 시나리오 테스트
  - Regression test
```

**병렬화:**
- Conv 1 → 단독 시작
- Conv 2, 3 → Conv 1 완료 후 병렬
- Conv 4 → Conv 2, 3 완료 후

**총 시간:** 순차 3시간 → 병렬 2.5시간

---

## 버전 히스토리

- **v0.1 (2025-01-12)**: 초안 작성
  - 비전 및 현재 상태 분석
  - v1, v2 구현 계획
  - 데이터 모델 설계

---

**작성자:** The Architect
**최종 수정:** 2025-01-12
**상태:** Draft
