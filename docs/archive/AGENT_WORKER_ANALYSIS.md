# Background Agent Worker - 코드 분석 결과

> Circuit 프로젝트에서 Background Agent 병렬 실행을 구현하기 위한 기존 코드 분석

**날짜**: 2025-11-04
**분석자**: Claude (victoria workspace)

---

## 목차

1. [개요](#개요)
2. [핵심 발견사항](#핵심-발견사항)
3. [Claude CLI 실행 로직](#claude-cli-실행-로직)
4. [IPC 핸들러 구조](#ipc-핸들러-구조)
5. [Process 관리 패턴](#process-관리-패턴)
6. [유의사항 및 제약사항](#유의사항-및-제약사항)
7. [다음 단계](#다음-단계)

---

## 개요

### 분석 목표
Background에서 Agent를 병렬 실행하여 여러 Todo를 동시에 처리하는 시스템 구현을 위한 기존 코드 분석

### 분석 범위
- Claude CLI 실행 메커니즘
- IPC 통신 구조
- Process 관리 패턴
- Todo 실행 흐름

---

## 핵심 발견사항

### ✅ 이미 구현된 것들

1. **Todo 실행 트리거 존재**
   - `circuit/electron/todoHandlers.ts` (line 259-297)
   - `todos:trigger-execution` IPC 핸들러
   - Renderer로 `todos:execute-tasks` 이벤트 전송
   - 이미 Todo 실행 흐름이 설계되어 있음!

2. **Child Process 패턴**
   - `child_process.spawn()` 사용
   - Claude CLI, Terminal(PTY), MCP 서버 모두 spawn 사용
   - Worker threads는 사용하지 않음

3. **Event Broadcasting**
   - `EventBroadcaster` 클래스로 모든 윈도우에 이벤트 브로드캐스트
   - Todo 변경 시 자동으로 모든 UI 업데이트

4. **Session 관리**
   - `activeSessions` Map으로 세션 관리
   - 각 session에 `claudeProcess` 참조 저장
   - `isRunning` 플래그로 실행 상태 추적

### ❌ 구현되지 않은 것들

1. **Background Agent Executor**
   - Todo를 실제로 Agent에게 위임하는 로직 없음
   - `todos:execute-tasks` 이벤트를 받는 리스너 없음

2. **병렬 실행 관리**
   - 여러 Agent 동시 실행 관리
   - Task Queue 없음
   - 우선순위 관리 없음

3. **Progress 추적**
   - Agent 진행 상황 실시간 업데이트
   - Progress bar 없음

---

## Claude CLI 실행 로직

### 위치
`circuit/electron/main.cjs`

- **Line 1537**: `CLAUDE_CLI_PATH` 정의
- **Line 2719-3200**: `claude:send-message` IPC 핸들러 (메인 로직)
- **Line 3004-3014**: Claude CLI spawn 실행

### 실행 패턴

```javascript
// 1. Claude CLI Path
const CLAUDE_CLI_PATH = path.join(os.homedir(), '.claude/local/claude');

// 2. Spawn with arguments
const claude = spawn(CLAUDE_CLI_PATH, [
  '--print',
  '--verbose',
  '--output-format', 'stream-json',  // 실시간 스트리밍!
  '--include-partial-messages',
  '--model', 'sonnet',
  '--permission-mode', 'acceptEdits'  // 자동 승인
], {
  cwd: session.workspacePath,  // 작업 디렉토리
  stdio: ['pipe', 'pipe', 'pipe']  // stdin, stdout, stderr
});

// 3. Send input to stdin
const input = JSON.stringify({
  role: 'user',
  content: userMessage
});
claude.stdin.write(input);
claude.stdin.end();

// 4. Listen to stdout for streaming response
claude.stdout.on('data', (data) => {
  // stream-json 포맷 파싱
  // 실시간 progress 업데이트
});

// 5. Listen to stderr for errors
claude.stderr.on('data', (data) => {
  // 에러 로그
});

// 6. Handle process completion
claude.on('close', (code) => {
  // 완료 또는 에러 처리
});
```

### 중요 옵션

| 옵션 | 설명 |
|------|------|
| `--output-format stream-json` | 실시간 스트리밍 (progress 추적 가능!) |
| `--include-partial-messages` | 부분 메시지도 받음 |
| `--permission-mode acceptEdits` | 파일 수정 자동 승인 |
| `cwd: workspacePath` | 작업 디렉토리 설정 |

### Stream-JSON 포맷

```javascript
// stdout으로 줄단위 JSON 전송
{ "type": "stream_event", "event": { "type": "message_start" } }
{ "type": "stream_event", "event": { "type": "content_block_delta", "delta": { "type": "text_delta", "text": "..." } } }
{ "type": "stream_event", "event": { "type": "content_block_start", "content_block": { "type": "tool_use", "name": "Read" } } }
{ "type": "assistant", "message": { "content": [...], "stop_reason": "end_turn" } }
```

**활용 포인트**:
- 실시간 progress 업데이트 가능
- Tool 호출 감지 가능
- 현재 작업 내용 파악 가능

---

## IPC 핸들러 구조

### 패턴

```typescript
// 1. 리턴 값이 필요한 요청
ipcMain.handle('handler-name', async (event, ...args) => {
  try {
    // 로직 수행
    return { success: true, data: ... }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// 2. 이벤트만 전송
ipcMain.on('handler-name', async (event, ...args) => {
  // 로직 수행
  event.sender.send('response-event', data)
})
```

### Todo 관련 핸들러

**파일**: `circuit/electron/todoHandlers.ts`

```typescript
export function registerTodoHandlers(storage: ConversationStorage) {
  // Todo CRUD
  ipcMain.handle('todos:load', ...)           // 로드
  ipcMain.handle('todos:save', ...)           // 저장
  ipcMain.handle('todos:update-status', ...)  // 상태 업데이트
  ipcMain.handle('todos:delete', ...)         // 삭제

  // 🔥 중요: 실행 트리거
  ipcMain.handle('todos:trigger-execution', async (event, data) => {
    const senderWindow = BrowserWindow.fromWebContents(event.sender)

    // Renderer로 다시 이벤트 전송!
    senderWindow.webContents.send('todos:execute-tasks', {
      conversationId: data.conversationId,
      messageId: data.messageId,
      mode: data.mode,  // 'auto' | 'manual'
      todos: data.todos
    })

    return { success: true }
  })
}
```

**흐름**:
```
Renderer (UI)
  └─> IPC: todos:trigger-execution
       └─> Main Process (todoHandlers.ts)
            └─> IPC: todos:execute-tasks (다시 Renderer로)
                 └─> Renderer: 실행 로직 (구현 필요!)
```

### Event Broadcasting

**파일**: `circuit/electron/eventBroadcaster.ts`

```typescript
export class EventBroadcaster {
  static broadcastTodosChanged(conversationId: string, messageId?: string) {
    // 모든 윈도우에 브로드캐스트
    BrowserWindow.getAllWindows().forEach(window => {
      if (!window.isDestroyed()) {
        window.webContents.send('todos:changed', { conversationId, messageId })
      }
    })
  }

  static broadcastTodoDeleted(todoId: string, conversationId: string, messageId?: string) {
    // ...
  }
}
```

**활용**:
- Agent가 Todo 상태를 업데이트하면 자동으로 모든 UI 갱신
- 여러 conversation에서 동시 작업 시 실시간 동기화

---

## Process 관리 패턴

### 현재 사용 중인 패턴

#### 1. Child Process (spawn)

**사용처**:
- Claude CLI 실행
- Terminal (PTY)
- MCP 서버

**예시 - Claude CLI**:
```javascript
// Main.cjs:3004
const claude = spawn(CLAUDE_CLI_PATH, [...], {
  cwd: session.workspacePath,
  stdio: ['pipe', 'pipe', 'pipe']
})

// Session에 프로세스 참조 저장
session.claudeProcess = claude
session.isRunning = true

// 이벤트 리스너
claude.stdout.on('data', ...)
claude.stderr.on('data', ...)
claude.on('close', ...)
claude.on('error', ...)
```

#### 2. Session 관리

```javascript
// Main.cjs:2678
const activeSessions = new Map<string, {
  workspacePath: string,
  messages: any[],
  claudeProcess: ChildProcess | null,
  isRunning: boolean,
  sessionId: string
}>()

// Session 생성
ipcMain.handle('claude:start-session', async (event, workspacePath) => {
  const sessionId = crypto.randomUUID()
  activeSessions.set(sessionId, {
    workspacePath,
    messages: [],
    claudeProcess: null,
    isRunning: false,
    sessionId
  })
  return { success: true, sessionId }
})
```

#### 3. Process Lifecycle

```
spawn() → running → stdout/stderr events → close → cleanup
   ↓
session.claudeProcess = process
session.isRunning = true
```

**중단 (Cancel)**:
```javascript
// Main.cjs:3260
ipcMain.on('claude:cancel-message', async (event, sessionId) => {
  const session = activeSessions.get(sessionId)
  if (session && session.claudeProcess) {
    session.claudeProcess.kill('SIGTERM')  // 프로세스 종료
    session.isRunning = false
  }
})
```

### Worker Threads는 사용 안 함

**이유 추정**:
- Claude CLI가 외부 프로세스이므로 spawn이 자연스러움
- Main process에서 프로세스 관리가 더 간단
- IPC 통신이 이미 Electron 구조에 맞음

---

## 유의사항 및 제약사항

### 1. Main Process에서 Heavy Lifting

**현재 구조**:
```
Main Process (Electron)
├─ Claude CLI spawn
├─ Stream 파싱
├─ Session 관리
└─ IPC 통신

Renderer Process (React)
├─ UI 렌더링
└─ 사용자 인터랙션
```

**⚠️ 주의**:
- Main process에서 모든 로직 처리
- Renderer는 UI만 담당
- **Background Agent도 Main process에서 관리해야 함**

### 2. Session 단위 실행

**현재**:
- 하나의 session = 하나의 claude process
- Session별로 message history 관리
- `claude:send-message`는 한 번에 하나만 실행

**⚠️ 제약**:
- 기존 구조는 "순차적 대화" 전제
- 여러 Agent 동시 실행을 위해서는 **여러 session 필요**

### 3. Stream-JSON 파싱 복잡도

**stream-json 포맷**:
```javascript
// Line 단위로 오는 JSON
{ "type": "stream_event", ... }
{ "type": "assistant", ... }
```

**파싱 로직**:
```javascript
let stdoutBuffer = ''

claude.stdout.on('data', (data) => {
  stdoutBuffer += data.toString()
  const lines = stdoutBuffer.split('\n')
  stdoutBuffer = lines.pop() || ''  // 불완전한 줄 보관

  for (const line of lines) {
    const msg = JSON.parse(line)
    // 타입별 처리
  }
})
```

**⚠️ 복잡도**:
- 불완전한 JSON line 처리 필요
- 다양한 event type 핸들링
- **Agent별로 이 로직을 재사용해야 함**

### 4. Error Handling

**현재 에러 처리**:
```javascript
claude.on('error', (error) => {
  event.sender.send('claude:response-error', {
    success: false,
    error: error.message
  })
})

claude.on('close', (code) => {
  if (code !== 0) {
    // 에러 처리
  }
})
```

**⚠️ Agent 실행 시 고려사항**:
- Agent 실패 시 retry 로직
- 다른 Agent에 영향 없도록 isolation
- Critical todo 실패 시 전체 중단 여부

### 5. Memory & Resource 관리

**현재**:
- 각 claude process는 독립적
- Session 종료 시 process kill
- Memory cleanup은 수동

**⚠️ 병렬 실행 시**:
- 여러 claude process 동시 실행 = 메모리 폭증 가능
- Max concurrent agents 제한 필요 (예: 2-3개)
- Idle timeout 필요

### 6. Context 전달

**현재 (full context)**:
```javascript
// 전체 conversation history 전달
session.messages.push({
  role: 'user',
  content: userMessage
})

// 모든 메시지를 Claude에게 전송
```

**⚠️ Agent 실행 시 (minimal context)**:
- 전체 history 대신 **필요한 것만** 전달
- MULTI_CONVERSATION_DESIGN.md의 "Minimal Context Forking" 원칙 적용
- Todo description + 관련 파일만

---

## 다음 단계

### Step 2: 프로토타입 구현

#### 목표
하나의 Todo를 백그라운드에서 Agent로 실행하는 최소 기능

#### 구현 계획

**1. Agent Worker 모듈 작성**
```typescript
// circuit/electron/agentWorker.ts
export class AgentWorker {
  async execute(todo: Todo): Promise<AgentResult> {
    // Claude CLI spawn
    // Minimal context 전달
    // Stream 파싱
    // Progress 업데이트
  }
}
```

**2. Agent Manager 작성**
```typescript
// circuit/electron/agentManager.ts
export class AgentManager {
  private activeAgents = new Map<string, AgentWorker>()
  private maxConcurrent = 2

  async startAgent(todo: Todo) {
    // Queue 관리
    // Worker 생성 및 실행
    // Progress 브로드캐스트
  }
}
```

**3. IPC 핸들러 추가**
```typescript
// Main.cjs에 추가
ipcMain.handle('agent:start', async (event, todoId) => {
  const agentManager = getAgentManager()
  await agentManager.startAgent(todoId)
})

ipcMain.on('agent:cancel', async (event, todoId) => {
  const agentManager = getAgentManager()
  await agentManager.cancelAgent(todoId)
})
```

**4. Renderer 리스너 추가**
```typescript
// TodoList.tsx 또는 TodoContext.tsx
useEffect(() => {
  // todos:execute-tasks 이벤트 리스너
  ipcRenderer.on('todos:execute-tasks', (event, data) => {
    // Agent 시작 요청
    ipcRenderer.invoke('agent:start', data.todos[0].id)
  })
}, [])
```

**5. Progress UI**
```typescript
// TodoItem.tsx
{todo.status === 'in_progress' && todo.agentRunning && (
  <div className="progress-bar">
    <div style={{ width: `${todo.progress}%` }} />
    <span>{todo.progress}%</span>
  </div>
)}
```

#### 유의사항

1. **Minimal Context**
   ```typescript
   const context = {
     instruction: todo.content,
     files: getRelevantFiles(todo),  // 관련 파일만!
     sharedContext: getSharedContext()  // 공통 컨텍스트는 참조
   }
   ```

2. **Stream Progress**
   ```typescript
   claude.stdout.on('data', (data) => {
     // stream-json 파싱
     // Tool 호출 감지 → progress 업데이트
     EventBroadcaster.broadcastAgentProgress(todoId, {
       progress: 50,
       currentTask: 'Reading file...'
     })
   })
   ```

3. **Error Isolation**
   ```typescript
   try {
     await agent.execute(todo)
   } catch (error) {
     // 이 Agent만 실패, 다른 Agent는 계속
     storage.updateTodoStatus(todo.id, 'failed')
     EventBroadcaster.broadcastAgentError(todoId, error)
   }
   ```

4. **Resource Cleanup**
   ```typescript
   claude.on('close', () => {
     activeAgents.delete(todoId)
     session.claudeProcess = null
     // 메모리 정리
   })
   ```

### 검증 기준

- [ ] Todo "Run Agent" 버튼 클릭
- [ ] 백그라운드에서 Claude CLI 실행
- [ ] Progress bar 실시간 업데이트 (0% → 50% → 100%)
- [ ] 완료 시 대화에 요약 추가
- [ ] UI 블로킹 없음 (다른 대화 전환 가능)
- [ ] 에러 발생 시 실패 표시 및 다른 Agent 계속 실행

---

## 참고 자료

### 주요 파일

| 파일 | 설명 |
|------|------|
| `circuit/electron/main.cjs` | Main process entry, IPC 핸들러 |
| `circuit/electron/todoHandlers.ts` | Todo IPC 핸들러 (trigger-execution 있음!) |
| `circuit/electron/conversationHandlers.ts` | Conversation 관리 |
| `circuit/electron/eventBroadcaster.ts` | 이벤트 브로드캐스트 |
| `circuit/electron/terminalManager.ts` | PTY process 관리 예시 |
| `circuit/electron/mcp-manager.ts` | MCP 서버 관리 (child process) |

### 관련 문서

- `MULTI_CONVERSATION_DESIGN.md` - 메모리 최적화 전략
- `MCP_RUNTIME_ARCHITECTURE.md` - MCP 서버 구조

### 코드 레퍼런스

**Claude CLI 실행**:
- `main.cjs:1537` - CLAUDE_CLI_PATH
- `main.cjs:2719-3200` - claude:send-message 핸들러
- `main.cjs:3004-3014` - spawn 실행

**Todo 실행 트리거**:
- `todoHandlers.ts:259-297` - todos:trigger-execution

**Stream 파싱**:
- `main.cjs:3037-3200` - stream-json 파싱 로직

**Session 관리**:
- `main.cjs:2678` - claude:start-session
- `main.cjs:3260` - claude:cancel-message

---

**문서 작성일**: 2025-11-04
**다음 업데이트**: Step 2 프로토타입 구현 후
