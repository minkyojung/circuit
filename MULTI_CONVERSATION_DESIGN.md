# Multi-Conversation + Todo 연동 시스템 설계

> Circuit 프로젝트의 멀티 대화 지원 및 에이전트 자율 실행 기능 설계 문서

---

## 목차

1. [개요](#개요)
2. [현재 상태 분석](#현재-상태-분석)
3. [핵심 문제점](#핵심-문제점)
4. [두 가지 접근 방식](#두-가지-접근-방식)
5. [실제 프로덕션 사례 및 구현 가능성](#실제-프로덕션-사례-및-구현-가능성)
6. [통합 솔루션](#통합-솔루션)
7. [구현 로드맵](#구현-로드맵)
8. [예상 효과](#예상-효과)

---

## 개요

### 목표
- **Multi-Conversation**: 하나의 workspace에서 여러 개의 독립적인 대화 실행
- **Todo 연동**: 각 conversation마다 별도의 todo 리스트 관리
- **에이전트 자율 실행**: Todo를 에이전트에게 위임하여 백그라운드에서 자동 실행
- **메모리 최적화**: 여러 conversation과 agent가 동시에 실행되어도 메모리 부하 최소화

### 사용 시나리오

```
Workspace: "feature-auth" (브랜치)
├── Conversation 1: "로그인 기능 추가"
│   ├── Message: "로그인 UI 만들어줘"
│   ├── Todo 1: Login.tsx 생성 ✓
│   ├── Todo 2: 인증 로직 구현 (Agent 실행 중 🤖)
│   └── Todo 3: 테스트 작성 (대기)
│
├── Conversation 2: "비밀번호 재설정"
│   ├── Message: "이메일로 비밀번호 리셋 기능"
│   ├── Todo 1: 이메일 템플릿 작성 ✓
│   └── Todo 2: API 엔드포인트 추가 (Agent 실행 중 🤖)
│
└── Conversation 3: "OAuth 통합"
    └── Message: "Google OAuth 연동"
        └─ (아직 todo 생성 전)
```

**사용자는**:
- 각 대화를 탭으로 전환하며 작업
- 각 대화의 todo를 에이전트에게 위임
- 에이전트가 백그라운드에서 작업하는 동안 다른 대화 진행
- 실시간으로 각 에이전트의 진행 상황 확인

---

## 현재 상태 분석

### 이미 구현된 것들

#### 1. 데이터베이스 레벨
- ✅ 하나의 workspace에 여러 conversation 저장 가능
- ✅ 각 conversation은 독립적인 message 리스트
- ✅ Todo는 `conversationId` 외래키로 연결
- ✅ 각 conversation마다 `isActive` 플래그
- ✅ SQLite로 영구 저장

#### 2. IPC Handler
- ✅ `conversation:list` - workspace의 모든 대화 조회
- ✅ `conversation:create` - 새 대화 생성
- ✅ `conversation:set-active` - 대화 전환
- ✅ `todos:load` - conversation별 todo 조회
- ✅ 모든 CRUD 작업 지원

#### 3. Context 관리
- ✅ `TodoContext`가 `conversationId` 변경 감지
- ✅ Conversation 전환 시 자동으로 todo 재로딩
- ✅ Message metadata에 `planResult` 저장

### 구현되지 않은 것들

#### 1. UI
- ❌ Conversation 전환 UI (탭 또는 드롭다운)
- ❌ 여러 conversation을 동시에 볼 수 있는 인터페이스
- ❌ Conversation별 상태 표시 (에이전트 실행 중 등)

#### 2. 에이전트 자율 실행
- ❌ 백그라운드 에이전트 executor
- ❌ Worker thread 기반 병렬 처리
- ❌ 에이전트 진행 상황 모니터링 UI
- ❌ 에이전트 일시정지/재개/중단 기능

#### 3. 메모리 최적화
- ❌ Message pagination (현재는 모든 메시지 로드)
- ❌ Virtual scrolling
- ❌ Block lazy loading
- ❌ Context window 관리 (오래된 메시지 요약)
- ❌ LRU 캐시 (사용하지 않는 conversation 정리)

---

## 핵심 문제점

### 문제 1: 메모리 부하 - 현재 구조

#### Process Level 메모리
```
Claude CLI 프로세스 (매 메시지마다 새로 spawn)
├─ 전체 conversation history
├─ 로드된 모든 파일 내용
├─ Tool 실행 결과
└─ 네트워크 버퍼
```

**문제**:
- 50개 메시지 대화 = 100K+ 토큰이 매번 Claude에게 전송됨
- 파일을 한 번 읽으면 계속 메모리에 유지됨
- Pagination이 없어 1000개 메시지를 모두 로드함

#### Multi-Agent 시나리오의 메모리 폭증
```
Main Session (5-10K tokens)
  ├─ Agent 1 실행 중 (8-15K tokens)
  ├─ Agent 2 실행 중 (8-15K tokens)
  └─ Agent 3 실행 중 (8-15K tokens)

Total: 29-55K tokens (파일 중복 포함 시 더 증가)
```

**중복 로딩 문제**:
```
src/types.ts 파일이:
- Main session에 1번
- Agent 1에 1번
- Agent 2에 1번
- Agent 3에 1번
= 총 4번 메모리에 로드됨
```

### 문제 2: 동시성 제약

**현재**:
- UI는 한 번에 하나의 conversation만 표시
- Claude CLI를 매번 새로 spawn (프로세스 재사용 없음)
- Task 실행이 동기적 (병렬 처리 불가)
- Main thread에서 모든 작업 처리 (UI 블로킹 가능)

**목표**:
- 여러 conversation을 탭으로 전환
- 2-3개 agent가 동시에 백그라운드 실행
- UI는 반응성 유지

---

## 두 가지 접근 방식

### 접근 1: 데이터 로딩 최적화

#### 핵심 개념
**비유**: 큰 도서관에서 책을 읽는 방식 개선
- 모든 책을 한 번에 가져오지 말고, 필요할 때마다 가져오기
- 화면에 보이는 책만 펼치기
- 오래된 책은 요약본으로 대체하기

#### 주요 기술

##### 1. Message Pagination
```
기존: 1000개 메시지를 한 번에 로드
개선: 최근 50개만 로드, 스크롤 시 추가 로드

메모리 절감: 95%
```

##### 2. Virtual Scrolling
```
기존: 1000개 메시지 컴포넌트를 모두 렌더링
개선: 화면에 보이는 10개만 렌더링

렌더링 성능: 100배 향상
```

##### 3. Block Lazy Loading
```
기존: 모든 메시지의 블록을 미리 로드
개선: 화면에 진입할 때만 블록 로드 (Intersection Observer)

추가 메모리 절감: 80%
```

##### 4. Context Window Management
```
기존: 50개 메시지 전체를 Claude에게 전송
개선: 최근 20개 + 오래된 메시지 요약본

컨텍스트 크기: 90% 감소
API 비용: 대폭 절감
```

##### 5. LRU Cache
```
기존: 모든 conversation이 메모리에 유지
개선: 최근 사용한 3개만 유지, 나머지는 unload

메모리 절감: 70% (10개 중 3개만 유지)
```

#### 장점
- 구현이 비교적 쉬움
- 기존 구조를 크게 바꾸지 않아도 됨
- UI/UX 개선 효과가 명확함

#### 한계
- 근본적인 문제 (파일 중복) 해결은 아님
- Agent별로 여전히 중복 데이터 가능

---

### 접근 2: 컨텍스트 최소화 (추천!)

#### 핵심 개념
**비유**: 여러 명의 전문가에게 일을 나눠주는 방식 개선

##### 기존 방식의 문제
```
상사(Main): "여기 회사 전체 문서 1000페이지야. 이 중에서 필요한 거 찾아서 써."
직원 A: [1000페이지 사본] + 작업
직원 B: [1000페이지 사본] + 작업
직원 C: [1000페이지 사본] + 작업

= 총 3000페이지 메모리 사용
```

##### 개선 방식
```
상사(Main): "너는 Login 기능만 만들면 되니까, 관련 파일 3개만 줄게."
직원 A: [3페이지] + 작업
직원 B: [3페이지] + 작업
직원 C: [3페이지] + 작업

= 총 9페이지 메모리 사용 (300배 감소!)
```

#### 주요 기술

##### 1. Minimal Context Forking

**원칙**: Agent에게 전체 프로젝트가 아닌 **필요한 파일만** 전달

```javascript
// ❌ 나쁜 예
agent.context = {
  allProjectFiles: [...1000개 파일],
  fullConversationHistory: [...50개 메시지]
}

// ✅ 좋은 예
agent.context = {
  task: "Login.tsx 생성",
  relevantFiles: [
    "src/components/types.ts",
    "src/theme.css",
    "src/utils/auth.ts"
  ], // 딱 3개만!
  sharedRules: sharedContext.codingConventions // 참조만
}
```

**구현 방법**:
- Todo 내용을 분석해서 필요한 파일 자동 추천
- 파일 dependency graph를 활용해 관련 파일만 선택
- 전체 컨텍스트의 0.1-1%만 전달

**효과**: 메모리 사용량 **99% 감소**

##### 2. Shared Context Pool

**원칙**: 모든 agent가 공통으로 사용하는 파일은 **한 번만 로드**

```javascript
// 프로젝트 시작 시 한 번만 로드
const sharedContext = {
  projectStructure: "src/, components/, utils/, ...",
  codingConventions: "ESLint rules, naming conventions, ...",
  commonTypes: "interface User { ... }, type Auth { ... }",
  styleGuide: "color palette, spacing system, ..."
}

// 각 Agent는 참조만
Agent 1: { shared: sharedContext, unique: [Login.tsx 관련] }
Agent 2: { shared: sharedContext, unique: [auth.ts 관련] }
Agent 3: { shared: sharedContext, unique: [test 관련] }
```

**효과**:
- 공통 파일의 중복 제거
- 10MB 파일을 3번 로드 → 1번만 로드
- 메모리 **67% 절약**

##### 3. Result Streaming & Summarization

**원칙**: Agent의 작업 과정은 **요약만** 저장, 전체 로그는 버림

```javascript
// ❌ 나쁜 예: 모든 과정을 저장
agent.log = [
  "9:00 - 파일 열었습니다",
  "9:01 - import 문 추가했습니다",
  "9:02 - 함수 정의했습니다",
  ...600개 메시지
]

// ✅ 좋은 예: 요약만 저장
agent.result = {
  status: "completed",
  summary: "Login.tsx 생성 완료",
  changes: [
    "- 이메일 validation 추가",
    "- 에러 처리 구현",
    "- 테스트 3개 작성"
  ],
  files: ["Login.tsx", "Login.test.tsx"]
}
```

**효과**:
- Agent 대화 히스토리를 메인 세션에 저장하지 않음
- 600개 메시지 → 3줄 요약
- 메모리 **99% 감소**

##### 4. Hierarchical Delegation

**원칙**: Main session은 **코디네이터 역할만**, 실제 작업은 Agent

```
User: "로그인 기능 추가해줘"
  ↓
Main Session (Coordinator):
  1. 요청 분석
  2. Todo 생성:
     - Todo 1: Login.tsx 생성
     - Todo 2: auth.ts 구현
     - Todo 3: 테스트 작성
  3. 각 Todo를 Agent에게 위임
  ↓
Agent 1 (전문가):
  - 입력: "Login.tsx 생성" + 관련 파일 3개
  - 작업: Claude CLI 실행하여 파일 생성
  - 출력: "완료" + 요약
  ↓
Main Session:
  - Agent 결과 요약만 받음
  - 사용자에게 보고
```

**효과**:
- Main session은 가볍게 유지
- Agent는 독립적으로 실행
- 병렬 처리 가능

#### 장점
- **근본적인 메모리 절감** (95%+)
- Agent 간 독립성 보장
- 확장성 우수 (Agent 10개도 문제없음)

#### 구현 난이도
- 중간 수준 (파일 분석 로직 필요)
- 하지만 효과가 매우 큼

---

## 실제 프로덕션 사례 및 구현 가능성

### 개요

Multi-agent 시스템의 메모리 최적화는 이미 여러 프로덕션 환경에서 검증된 기법들이 있습니다. 이 섹션에서는 실제 사례들을 분석하고, Circuit 환경에서의 구현 가능성을 평가합니다.

---

### 1. Letta (MemGPT) - Memory Blocks 방식

#### 개요
UC Berkeley 연구팀이 개발한 프로덕션 프레임워크로, "LLM Operating System" 개념을 구현. Agent가 자신의 컨텍스트와 외부 스토리지를 직접 편집하는 self-editing memory 방식 사용.

#### 핵심 기법

**Memory Blocks 구조**
- 컨텍스트를 discrete하고 functional한 단위로 구조화
- 각 메모리 블록을 개별적으로 DB에 persist
- 고유한 block_id로 관리

**Shared Memory Blocks**
- 여러 agent가 메모리 블록을 공유
- Sleep-time agent가 idle 시간에 정보를 처리해서 shared memory block에 "learned context" 작성
- 다른 agent들이 이를 참조

**실제 결과**
- 11x deep research agent: research state를 메모리 블록에 작성
- 여러 LLM 호출에 걸쳐 작업 상태 유지
- Derailment(작업 이탈) 방지

#### Circuit 구현 가능성: ✅ **이미 90% 구현됨!**

**현재 상태**
```typescript
// Circuit의 memory-server.ts는 이미 Memory Blocks 패턴 사용 중
interface ProjectMemory {
  id: string
  projectPath: string
  type: 'convention' | 'decision' | 'snippet' | 'rule' | 'note'
  key: string        // Block label과 동일
  value: string      // Block content
  priority: 'high' | 'medium' | 'low'
  usageCount: number // 사용 추적
}
```

**필요한 추가 작업**
1. **Conversation별 Memory Blocks** (난이도: ★☆☆☆☆)
   - DB 스키마에 `conversationId`, `scope` 컬럼 추가
   - `scope`: 'global' | 'conversation' | 'temporary'

2. **Agent별 Context 로딩** (난이도: ★★☆☆☆)
   - Global high-priority memories (모든 agent 공유)
   - Conversation memories (해당 대화만)
   - Todo-specific memories (해당 작업만)

3. **Shared Memory Pool** (난이도: ★☆☆☆☆)
   - 프로젝트 공통 파일 1번만 로드
   - 모든 agent가 참조로 사용
   - In-memory Map 캐시

**구현 우선순위**: Phase 1-2 (즉시 가능)

---

### 2. Mem0 - Graph Memory 방식

#### 개요
구조화된 persistent memory 메커니즘으로 91% p95 latency 감소, 90% 이상 토큰 비용 절감 달성.

#### 핵심 기법

**Graph Memory**
- 메모리를 directed, labeled graph로 저장
- Entity Extractor가 노드 식별
- Relations Generator가 labeled edge 추론
- Conflict Detector가 중복 노드/엣지 플래그
- LLM이 add, merge, invalidate 결정

**성능 개선**
- 26% relative improvement (LLM-as-a-Judge)
- Graph memory는 base 대비 2% 추가 개선
- Full-context 대비 엄청난 computational overhead 감소

#### Circuit 구현 가능성: ⚠️ **구현 가능하지만 복잡**

**필요한 작업**

1. **Graph 데이터베이스 스키마** (난이도: ★★★☆☆)
```sql
CREATE TABLE memory_nodes (
  id TEXT PRIMARY KEY,
  project_path TEXT NOT NULL,
  type TEXT NOT NULL,  -- 'file' | 'component' | 'function' | 'concept' | 'todo'
  name TEXT NOT NULL,
  metadata TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE memory_edges (
  id TEXT PRIMARY KEY,
  from_node_id TEXT NOT NULL,
  to_node_id TEXT NOT NULL,
  relation TEXT NOT NULL,  -- 'depends-on' | 'imports' | 'related-to'
  weight REAL DEFAULT 1.0,
  created_at INTEGER NOT NULL
);
```

2. **Graph Query 로직** (난이도: ★★★★☆)
   - BFS/DFS로 이웃 탐색
   - WITH RECURSIVE 쿼리 (SQLite 지원)

3. **Dependency 추출** (난이도: ★★★★★)
   - AST 파싱 (TypeScript: ts-morph)
   - Import 관계 자동 추출
   - Todo dependency 분석

**예상 효과**: 91% 토큰 절감 (매우 큼!)

**구현 우선순위**: Phase 4 (고도화)
- 효과는 크지만 구현 비용이 높음
- 기본 기능 완성 후 추가

---

### 3. MIRIX - 전문화된 메모리 타입

#### 개요
6개의 전문화된 메모리 컴포넌트를 가진 구조화된 아키텍처:
- Core, Episodic, Semantic, Procedural, Resource, Knowledge Vault

#### 성능
- ScreenshotVQA에서 RAG baseline 대비 35% 높은 정확도
- 99.9% 스토리지 요구사항 감소
- LOCOMO 벤치마크에서 85.4% SOTA 성능

#### Circuit 구현 가능성: ⚠️ **부분적으로 구현 가능**

**타입 확장**
```typescript
type MIRIXMemoryType =
  | 'core'         // 프로젝트 핵심 정보 (README, architecture)
  | 'episodic'     // 대화 히스토리, 작업 로그
  | 'semantic'     // 코딩 규칙, conventions
  | 'procedural'   // 반복 작업 패턴 (how-to)
  | 'resource'     // 파일 내용, 문서 링크
  | 'knowledge'    // 학습된 프로젝트별 지식
```

**Retention 정책**
```typescript
const retentionPolicy = {
  'core': 'permanent',
  'episodic': 'temporary',    // 대화 종료 후 삭제
  'semantic': 'permanent',
  'procedural': 'permanent',
  'resource': 'cache',        // LRU로 관리
  'knowledge': 'permanent'
}
```

**구현 난이도**: ★★☆☆☆
- 기존 memory 시스템에 타입만 추가
- Retention 정책 구현 필요

**구현 우선순위**: Phase 2-3

---

### 4. Intrinsic Memory Agents - Agent 학습

#### 개요
각 agent의 출력에서 직접 메모리를 생성하여 role-aligned context 유지. PDDL 데이터셋에서 기존 SOTA 대비 38.6% 개선.

#### 핵심 기법
- Agent output에서 직접 메모리 추출
- Role-aligned memory template 유지
- Task-relevant 정보에 집중
- Heterogeneity(다양성) 보장

#### Circuit 구현 가능성: ✅ **완전 구현 가능**

**구현 방법**

1. **Agent Output 파싱** (난이도: ★★★☆☆)
```typescript
async function extractMemoryFromOutput(agent: Agent, output: string) {
  const memories: ProjectMemory[] = []

  // 1. 코드 패턴 학습
  const patterns = extractCodePatterns(output)

  // 2. 결정사항 기록
  const decisions = extractDecisions(output)

  // 3. 에러 및 해결책
  const learnings = extractLearnings(output)

  return memories
}
```

2. **Role-aligned 메모리 로드** (난이도: ★★☆☆☆)
```typescript
async function loadRoleMemory(agent: Agent) {
  // Agent 역할별 메모리 필터링
  const roleMemories = await storage.getMemories({
    searchQuery: agent.role,  // 'frontend', 'backend', 'test'
    limit: 20
  })

  return roleMemories
}
```

**예상 효과**: Agent 성능 20-40% 향상

**구현 우선순위**: Phase 3

---

### 5. MemTool - 동적 MCP 관리

#### 개요
Multi-turn conversation에서 tool/MCP 서버 컨텍스트를 동적으로 관리하는 short-term memory 프레임워크.

#### 3가지 아키텍처
1. Autonomous Agent Mode: Full autonomy
2. Workflow Mode: Deterministic control
3. Hybrid Mode: 둘의 결합

#### Circuit 구현 가능성: ✅ **이미 80% 구현됨!**

**현재 mcp-manager.ts 기능**
- ✅ 서버 시작/중단/재시작
- ✅ Idle timeout (5분)
- ✅ Health check
- ✅ Auto-start

**추가 필요한 기능** (난이도: ★☆☆☆☆)

1. **Agent별 MCP 할당**
```typescript
async function determineRequiredMCPServers(todo: Todo): Promise<string[]> {
  const required: string[] = ['filesystem', 'memory']  // 기본

  // Todo 내용 분석
  if (todo.content.includes('git')) required.push('git')
  if (todo.content.includes('database')) required.push('database')
  if (todo.files?.some(f => f.endsWith('.test.ts'))) required.push('test-runner')

  return required
}
```

2. **Tool Usage Tracking**
```typescript
class AgentToolUsageTracker {
  private usedTools = new Set<string>()

  async optimizeToolSet() {
    // 사용하지 않는 tool의 서버 중단
    for (const [serverId, server] of mcpManager.servers) {
      const isUsed = server.tools.some(t => this.usedTools.has(t.name))
      if (!isUsed) await mcpManager.stop(serverId)
    }
  }
}
```

**예상 효과**: 메모리 30-40% 절감

**구현 우선순위**: Phase 1-2 (즉시 가능)

---

### 6. AutoGen + MemGPT - Long-term Memory

#### 개요
Stateful interaction 유지, 여러 세션에 걸쳐 컨텍스트 보존.

#### 사용 사례
- Customer Support: 이전 interaction 컨텍스트 유지
- Healthcare Assistant: 여러 세션에 걸친 환자 이력 추적

#### Circuit 구현 가능성: ✅ **SQLite로 구현 가능**

**Long-term Memory 구조**
```typescript
interface ConversationLongTermMemory {
  conversationId: string
  summary: string              // 대화 요약
  keyDecisions: string[]       // 중요한 결정사항
  fileChanges: Array<{         // 파일 변경 히스토리
    file: string
    action: 'created' | 'modified' | 'deleted'
    summary: string
  }>
  learnedPatterns: string[]    // 학습된 패턴
  pendingTasks: string[]       // 다음에 할 일
}
```

**구현 난이도**: ★★★☆☆

**구현 우선순위**: Phase 3-4

---

## Circuit 환경 종합 평가

### Circuit의 강점

#### 이미 갖춰진 인프라
1. **MCP 서버 관리 시스템** (mcp-manager.ts)
   - MemTool 스타일 쉽게 구현 가능
   - Idle timeout, health check 이미 존재

2. **SQLite 메모리 저장** (memoryStorage.ts)
   - Letta/MIRIX 스타일 바로 확장 가능
   - 영구 저장 및 쿼리 최적화

3. **Conversation 분리** (conversationStorage.ts)
   - Multi-conversation 준비 완료
   - 데이터 모델 이미 지원

4. **Block 기반 메시지**
   - 구조화된 메모리 추출 용이
   - Metadata 저장 가능

#### Circuit만의 장점
```
Claude CLI 사용 방식:
✅ MCP 서버를 필요시에만 시작/중단 (MemTool 완벽 적용)
✅ Process isolation이 자연스러움 (Agent별 독립성)
✅ SQLite로 모든 상태를 영구 저장 (AutoGen 스타일 쉬움)
```

---

## 구현 가능성 매트릭스

| 기법 | 난이도 | 효과 | 우선순위 | 예상 기간 |
|------|--------|------|----------|----------|
| **MemTool (동적 MCP)** | ★☆☆☆☆ | 30-40% 메모리 절감 | 🔥 즉시 | 1주 |
| **Letta (Shared Memory Pool)** | ★★☆☆☆ | 50-70% 메모리 절감 | 🔥 즉시 | 1-2주 |
| **MIRIX (메모리 타입)** | ★★☆☆☆ | 20-30% 효율 향상 | 중기 | 1-2주 |
| **Intrinsic Memory** | ★★★☆☆ | 20-40% 성능 향상 | 중기 | 2-3주 |
| **Mem0 (Graph)** | ★★★★★ | 91% 토큰 절감 | 장기 | 4-6주 |
| **AutoGen (Long-term)** | ★★★★☆ | 컨텍스트 재사용 | 장기 | 2-3주 |

---

## 최종 권장 로드맵

### Phase 1 (즉시, 1주)
```
✅ Dynamic MCP Management (MemTool 스타일)
✅ Shared Memory Pool (Letta 스타일)

효과: 메모리 50-70% 절감
이유: 구현 쉽고 효과 즉시 나타남
```

### Phase 2 (2주 후)
```
✅ Memory Type 확장 (MIRIX 스타일)
✅ Conversation Scope 추가
✅ Retention 정책

효과: 메모리 관리 정교화
이유: 기존 시스템 확장, 중간 난이도
```

### Phase 3 (4주 후)
```
✅ Agent별 Role Memory (Intrinsic 스타일)
✅ Output-based Learning
✅ Long-term Memory (AutoGen 스타일)

효과: Agent 성능 20-40% 향상
이유: 학습 효과 및 컨텍스트 재사용
```

### Phase 4 (6주 후, 선택)
```
⭐ Graph Memory (Mem0 스타일)

효과: 토큰 91% 절감 (최대 효과)
이유: 구현 비용 높지만 장기적으로 큰 이득
```

---

## 통합 솔루션

### 두 접근 방식의 관계

**둘은 상호 보완적입니다!**

```
┌─────────────────────────────────────────────┐
│ 접근 2: 전략적 아키텍처 (더 중요!)          │
│ "무엇을 어떻게 나눌 것인가"                 │
│                                             │
│ - Minimal Context Forking                   │
│ - Shared Context Pool                       │
│ - Result Summarization                      │
│ - Hierarchical Delegation                   │
└──────────────────┬──────────────────────────┘
                   │
                   │ 전략 수립
                   ↓
┌──────────────────┴──────────────────────────┐
│ 접근 1: 구현 기술 (보완)                    │
│ "어떻게 효율적으로 실행할 것인가"           │
│                                             │
│ - Worker Threads (병렬 처리)                │
│ - Virtual Scrolling (렌더링 최적화)         │
│ - Message Pagination (로딩 최적화)          │
│ - LRU Cache (메모리 관리)                   │
└─────────────────────────────────────────────┘
```

### 통합 아키텍처

#### 1단계: Context 설계 (접근 2)

```
대화 1: "로그인 기능 추가"
├─ Todo 1: 로그인 UI 만들기
│   └─ Agent Context:
│       ├─ 지시: "Login.tsx 생성"
│       ├─ 파일: [
│       │    "components/Button.tsx",
│       │    "theme/colors.ts"
│       │  ] (딱 2개!)
│       └─ 공유: sharedContext.codingRules (참조만)
│
├─ Todo 2: 인증 로직 구현
│   └─ Agent Context:
│       ├─ 지시: "auth.ts에 validation 추가"
│       ├─ 파일: [
│       │    "utils/auth.ts",
│       │    "types/user.ts"
│       │  ] (딱 2개!)
│       └─ 공유: 동일한 sharedContext 참조
│
└─ Todo 3: 테스트 작성
    └─ Agent Context:
        ├─ 지시: "Login.test.tsx 작성"
        ├─ 파일: [
        │    "Login.tsx",
        │    "test-utils.ts"
        │  ] (딱 2개!)
        └─ 공유: 동일한 sharedContext 참조
```

**결과**:
- 전체 프로젝트 1000개 파일 중 **각 Agent는 2개만 받음**
- 공통 규칙은 1번만 로드
- 메모리 사용량: 6개 파일 + 공통 1개 = **총 7개**
  (중복 없이 하면 1000개 → 7개 = **99.3% 감소**)

#### 2단계: 실행 최적화 (접근 1)

```
Main Session (UI Thread)
  ├─ Conversation 1 표시 (Virtual Scrolling)
  ├─ 최근 50개 메시지만 로드 (Pagination)
  └─ Background Agents 모니터링
      ↓
Background Executor (Worker Threads)
  ├─ Worker 1: Todo 1 실행
  │   ├─ Progress: 0% → 50% → 100%
  │   └─ Result: "Login.tsx 완료" (요약만!)
  │
  ├─ Worker 2: Todo 2 실행 (병렬!)
  │   ├─ Progress: 0% → 80% → 100%
  │   └─ Result: "auth.ts 완료" (요약만!)
  │
  └─ Worker 3 대기 중
      (Max 2개 동시 실행으로 제한)
```

**사용자 경험**:
```
┌─────────────────────────────────────────────┐
│ [대화1: 로그인] [대화2: 다크모드] [+]       │ ← Conversation Tabs
├─────────────────────────────────────────────┤
│                                             │
│ User: 로그인 기능 추가해줘                  │
│ Assistant: 3개 작업으로 나눴어요:           │
│   ✓ 1. Login.tsx 생성                       │
│   🤖 2. auth.ts 구현 (80%)                  │
│   ⏳ 3. 테스트 작성                          │
│                                             │
│ [최근 50개 메시지만 표시]                   │
│ [스크롤 업 → 과거 메시지 자동 로드]         │
│                                             │
└─────────────────────────────────────────────┘

┌─ 오른쪽 패널 ─────────────┐
│ 📋 실행 중인 Agent        │
├───────────────────────────┤
│ 🤖 대화1 - Todo 2         │
│    ████████░░ 80%         │
│    "auth.ts 구현 중..."   │
│                           │
│ ✅ 대화1 - Todo 1 완료    │
│    "Login.tsx 생성 완료"  │
└───────────────────────────┘
```

#### 3단계: 메모리 관리

```
메모리 사용량 비교:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ 최적화 전 (최악의 경우):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Main Session:
├─ 1000개 파일 내용 (100MB)
├─ 1000개 메시지 history (50MB)
└─ Rendered 1000 components (20MB)

Agent 1:
├─ 1000개 파일 복사 (100MB)
└─ Agent history (10MB)

Agent 2:
├─ 1000개 파일 복사 (100MB)
└─ Agent history (10MB)

Agent 3:
├─ 1000개 파일 복사 (100MB)
└─ Agent history (10MB)

총 메모리: 500MB+
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ 최적화 후:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Shared Context Pool:
└─ 공통 파일 10개 (1MB)

Main Session:
├─ 최근 50개 메시지만 (2.5MB)
├─ Virtual rendered 10 components (0.2MB)
└─ 활성 conversation 3개 cache (1MB)

Agent 1:
├─ 관련 파일 2개만 (0.2MB)
└─ 요약 결과만 저장 (0.01MB)

Agent 2:
├─ 관련 파일 2개만 (0.2MB)
└─ 요약 결과만 저장 (0.01MB)

Agent 3:
├─ 관련 파일 2개만 (0.2MB)
└─ 요약 결과만 저장 (0.01MB)

총 메모리: 5MB
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

절감률: 99% (500MB → 5MB)
```

---

## 구현 로드맵

### Phase 1: 기본 Multi-Conversation UI (1-2주)

#### 목표
사용자가 여러 대화를 전환할 수 있는 기본 UI

#### 작업
1. **Conversation Switcher 컴포넌트**
   - 상단 탭 UI 구현
   - Conversation 목록 표시
   - 새 대화 생성 버튼
   - 활성 대화 하이라이트

2. **LRU Conversation Cache**
   - 최근 사용한 3개만 메모리 유지
   - 전환 시 자동 load/unload
   - Context cleanup 로직

3. **Message Pagination**
   - 최근 50개만 로드
   - 무한 스크롤 (위로 스크롤 시 과거 메시지 로드)
   - Loading indicator

4. **Virtual Scrolling**
   - @tanstack/react-virtual 사용
   - 화면에 보이는 메시지만 렌더링
   - 성능 개선

#### 검증
- [ ] 3개 이상 대화 생성 및 전환 가능
- [ ] 각 대화의 메시지가 독립적으로 표시
- [ ] 메모리 사용량 70% 이하 (이전 대비)

---

### Phase 2: 메모리 최적화 (1주)

#### 목표
메모리 사용량을 근본적으로 줄임

#### 작업
1. **Block Lazy Loading**
   - Intersection Observer로 viewport 감지
   - 화면에 진입할 때만 블록 로드
   - 블록별 loading state

2. **Context Truncation**
   - Claude에게 보낼 때 최근 20개 메시지만
   - 오래된 메시지는 요약본으로 변환
   - 토큰 수 계산 유틸리티

3. **Shared Context Pool 구현**
   - 프로젝트 공통 파일 1번만 로드
   - 모든 conversation/agent가 참조
   - Memory-efficient Map 구조

4. **Cleanup 로직**
   - Component unmount 시 메모리 해제
   - Conversation 삭제 시 관련 데이터 정리
   - 주기적 garbage collection

#### 검증
- [ ] 10개 대화 열어도 메모리 10MB 이하
- [ ] 1000개 메시지 대화도 부드럽게 스크롤
- [ ] Claude API 토큰 사용량 50% 감소

---

### Phase 3: 에이전트 자율 실행 (2-3주)

#### 목표
Todo를 Agent에게 위임하여 백그라운드 실행

#### 작업
1. **Background Agent Executor**
   - Worker thread 기반 실행
   - Task queue (최대 2-3개 동시 실행)
   - Progress tracking
   - Error handling

2. **Minimal Context Builder**
   - Todo 내용 분석하여 필요한 파일 추천
   - Dependency graph 활용
   - Context 크기 최소화 (전체의 1% 이하)

3. **Agent Worker 구현**
   - Claude CLI 호출
   - Streaming progress updates
   - Result summarization
   - 일시정지/재개/중단 지원

4. **Autonomous Agent Panel UI**
   - 실행 중인 agent 목록
   - Progress bar와 현재 작업 표시
   - 실시간 로그 (최근 5개만)
   - Control buttons (pause/resume/stop)

5. **Agent-Conversation 연동**
   - Conversation별 실행 중인 agent 표시
   - Agent 완료 시 대화에 요약만 추가
   - Agent 상태 아이콘 (🤖)

#### 검증
- [ ] 3개 conversation에서 각각 2개 agent 동시 실행 가능
- [ ] Agent 실행 중에도 UI 반응성 유지
- [ ] Agent 완료 시 요약이 conversation에 표시
- [ ] 메모리 사용량 15MB 이하 (6개 agent 동시 실행 시)

---

### Phase 4: 고도화 (1주)

#### 목표
안정성과 사용자 경험 개선

#### 작업
1. **에러 처리 및 복구**
   - Agent 실패 시 retry 로직
   - Critical todo 실패 시 전체 중단
   - 에러 알림 및 로그

2. **Agent 우선순위 관리**
   - Todo priority에 따른 실행 순서
   - High priority는 먼저 실행
   - Queue 재정렬

3. **성능 모니터링**
   - 메모리 사용량 실시간 표시
   - Token 사용량 추적
   - Agent 실행 시간 통계

4. **UX 개선**
   - Conversation 검색
   - Todo 필터링 (status, priority)
   - Keyboard shortcuts
   - Drag & drop으로 todo 순서 변경

#### 검증
- [ ] Agent 에러 발생 시 자동 복구
- [ ] 성능 메트릭 대시보드 정상 작동
- [ ] 사용자 피드백 반영

---

### 구현 우선순위 요약

```
우선순위 1 (필수): Phase 2 - 메모리 최적화
이유: 가장 큰 효과 (95% 메모리 절감)
기간: 1주

우선순위 2 (중요): Phase 1 - Multi-Conversation UI
이유: 기본 기능 제공
기간: 1-2주

우선순위 3 (추가): Phase 3 - Agent 자율 실행
이유: UX 크게 개선, 병렬 작업 가능
기간: 2-3주

우선순위 4 (선택): Phase 4 - 고도화
이유: 안정성 및 편의성
기간: 1주
```

---

## 예상 효과

### 메모리 절감

| 항목 | 최적화 전 | 최적화 후 | 절감률 |
|------|-----------|-----------|--------|
| 파일 로딩 | 100MB × 4 = 400MB | 1MB (shared) + 0.2MB × 3 = 1.6MB | **99.6%** |
| 메시지 history | 50MB × 4 = 200MB | 2.5MB | **98.8%** |
| Rendered components | 20MB | 0.2MB | **99%** |
| **총 메모리** | **500MB+** | **5MB** | **99%** |

### 성능 개선

| 항목 | 개선 효과 |
|------|----------|
| 초기 로딩 속도 | **10배 빠름** (1000개 → 50개 로드) |
| 스크롤 성능 | **100배 향상** (virtual scrolling) |
| 대화 전환 속도 | **즉시** (LRU cache) |
| Agent 실행 속도 | **2-3배 병렬** (Worker threads) |

### 사용자 경험

#### Before
```
- 하나의 대화만 가능
- 긴 대화는 느림 (1000개 메시지)
- Agent 실행하면 UI 멈춤
- 메모리 부족으로 crash 가능
```

#### After
```
✅ 여러 대화를 탭으로 전환
✅ 10,000개 메시지도 부드러움
✅ 백그라운드에서 agent 실행 (UI 정상 작동)
✅ 메모리 안정적 (5MB 유지)
✅ 실시간 progress 확인
✅ 여러 작업을 병렬로 진행
```

### 비용 절감

| 항목 | 절감 효과 |
|------|----------|
| Claude API 토큰 | **50-70% 감소** (context truncation) |
| 서버 메모리 비용 | **99% 감소** (로컬 메모리만 사용) |
| 개발 시간 | **2-3배 빠름** (병렬 작업) |

---

## 핵심 Takeaways

### 1. 메모리 부하의 주범
- **파일 내용 중복 로딩** (가장 큰 부하)
- **대화 히스토리 무한 누적**
- **모든 메시지를 한 번에 렌더링**

### 2. 해결 방법
- **Minimal Context Forking**: Agent에게 필요한 것만 전달 (99% 절감)
- **Shared Context Pool**: 공통 파일 중복 제거 (67% 절감)
- **Result Summarization**: 전체 로그 대신 요약만 (99% 절감)
- **Virtual Scrolling**: 화면에 보이는 것만 렌더링 (100배 향상)

### 3. 구현 순서
```
1순위: Context 최소화 (접근 2) - 가장 큰 효과
2순위: Multi-Conversation UI (접근 1) - 기본 기능
3순위: Agent 병렬 실행 (접근 1+2) - UX 개선
```

### 4. 예상 결과
- **메모리: 500MB → 5MB (99% 감소)**
- **성능: 10-100배 향상**
- **UX: 여러 작업 동시 진행 가능**

---

## 다음 단계

### 즉시 시작 가능
1. Shared Context Pool 구현 (가장 효과적)
2. Message Pagination 추가
3. Conversation Switcher UI 개발

### 준비 필요
1. Worker Thread 아키텍처 설계 검토
2. 파일 dependency 분석 로직 연구
3. Claude CLI spawning 최적화 방안

### 논의 필요
1. Agent 최대 동시 실행 개수 (2개? 3개?)
2. Conversation 최대 개수 제한 (무제한? 10개?)
3. Context 요약 방식 (AI? 규칙 기반?)

---

## 참고 자료

### 학술 논문 및 프로젝트
- **Letta (MemGPT)**: UC Berkeley - LLM Operating System
- **Mem0**: Graph-based Memory with 91% latency reduction
- **MIRIX**: 6-component memory architecture, 99.9% storage reduction
- **Intrinsic Memory Agents**: 38.6% performance improvement on PDDL
- **MemTool**: Dynamic MCP server management framework
- **AutoGen + MemGPT**: Long-term stateful interaction

### Circuit 기술 스택
- **Electron**: Main process + Renderer
- **SQLite (better-sqlite3)**: 영구 저장소
- **MCP SDK**: Model Context Protocol 서버 관리
- **Claude CLI**: AI 실행 엔진
- **React + TypeScript**: UI 레이어

---

**문서 작성일**: 2025-11-01
**최종 업데이트**: 2025-11-01
**버전**: 2.0
**작성자**: Circuit Development Team

**변경 이력**:
- v1.0 (2025-11-01): 초기 설계 문서
- v2.0 (2025-11-01): 실제 프로덕션 사례 및 Circuit 구현 가능성 분석 추가
