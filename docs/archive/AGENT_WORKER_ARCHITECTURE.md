# Background Agent Worker - 아키텍처 설계

> Circuit 프로젝트의 Background Agent 병렬 실행 시스템 상세 설계

**날짜**: 2025-11-04
**버전**: 1.0 (Prototype)
**작성자**: Claude (victoria workspace)

---

## 목차

1. [개요](#개요)
2. [시스템 아키텍처](#시스템-아키텍처)
3. [컴포넌트 상세 설계](#컴포넌트-상세-설계)
4. [데이터 흐름](#데이터-흐름)
5. [API 명세](#api-명세)
6. [에러 처리 전략](#에러-처리-전략)
7. [성능 및 리소스 관리](#성능-및-리소스-관리)
8. [구현 단계](#구현-단계)
9. [검토 체크리스트](#검토-체크리스트)

---

## 개요

### 목표

**Phase 1 (Prototype)**: 하나의 Todo를 백그라운드에서 Agent로 실행
- Todo "Run Agent" 버튼 클릭
- 백그라운드에서 Claude CLI 실행
- 실시간 progress 표시
- 완료 시 결과를 conversation에 추가
- UI 블로킹 없음

### 설계 원칙

1. **Isolation**: 각 Agent는 독립적으로 실행, 실패 시 다른 Agent에 영향 없음
2. **Minimal Context**: 전체 conversation history 대신 필요한 것만 전달
3. **Real-time Feedback**: Stream-json으로 실시간 progress 업데이트
4. **Resource Management**: 최대 2-3개 Agent만 동시 실행
5. **Graceful Degradation**: Agent 실패 시에도 시스템 안정성 유지

### 비기능 요구사항

| 항목 | 요구사항 |
|------|----------|
| **응답성** | UI 블로킹 없음, 버튼 클릭 후 즉시 피드백 |
| **동시성** | 최대 2-3개 Agent 동시 실행 |
| **메모리** | Agent 1개당 최대 100MB (Minimal Context) |
| **신뢰성** | Agent 실패 시 자동 재시도 (최대 1회) |
| **가시성** | 실시간 progress 표시 (0-100%) |

---

## 시스템 아키텍처

### 전체 구조

```
┌────────────────────────────────────────────────────────────┐
│                    Renderer Process (React)                 │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────┐         ┌──────────────────┐        │
│  │   TodoList.tsx   │         │  AgentPanel.tsx  │        │
│  ├──────────────────┤         ├──────────────────┤        │
│  │ • "Run Agent" 버튼│         │ • Active Agents  │        │
│  │ • Progress Bar   │         │ • Progress       │        │
│  │ • Status Icon    │         │ • Logs           │        │
│  └────────┬─────────┘         └────────┬─────────┘        │
│           │                            │                   │
│           │         ┌──────────────────┴─────┐            │
│           │         │   AgentContext.tsx     │            │
│           │         │  (State Management)    │            │
│           │         └──────────┬─────────────┘            │
│           │                    │                           │
└───────────┼────────────────────┼───────────────────────────┘
            │                    │
            │  IPC (Electron)    │
            │                    │
┌───────────┼────────────────────┼───────────────────────────┐
│           ▼                    ▼      Main Process         │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              AgentManager (Singleton)               │  │
│  ├─────────────────────────────────────────────────────┤  │
│  │ • activeAgents: Map<todoId, AgentWorker>           │  │
│  │ • taskQueue: Todo[]                                 │  │
│  │ • maxConcurrent: 2                                  │  │
│  │                                                     │  │
│  │ Methods:                                            │  │
│  │ • startAgent(todo)                                  │  │
│  │ • cancelAgent(todoId)                               │  │
│  │ • getAgentStatus(todoId)                            │  │
│  └─────────────────┬───────────────────────────────────┘  │
│                    │                                       │
│                    │ manages                               │
│                    ▼                                       │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              AgentWorker (Instance)                 │  │
│  ├─────────────────────────────────────────────────────┤  │
│  │ • todo: Todo                                        │  │
│  │ • claudeProcess: ChildProcess                       │  │
│  │ • progress: number                                  │  │
│  │ • currentTask: string                               │  │
│  │ • startTime: number                                 │  │
│  │                                                     │  │
│  │ Methods:                                            │  │
│  │ • execute(): Promise<AgentResult>                   │  │
│  │ • cancel(): void                                    │  │
│  │ • parseStream(data): void                           │  │
│  └─────────────────┬───────────────────────────────────┘  │
│                    │                                       │
│                    │ spawns                                │
│                    ▼                                       │
│  ┌─────────────────────────────────────────────────────┐  │
│  │            Claude CLI Process                       │  │
│  ├─────────────────────────────────────────────────────┤  │
│  │ spawn(CLAUDE_CLI_PATH, [                            │  │
│  │   '--print',                                        │  │
│  │   '--output-format', 'stream-json',                 │  │
│  │   '--model', 'sonnet',                              │  │
│  │   '--permission-mode', 'acceptEdits'                │  │
│  │ ])                                                  │  │
│  │                                                     │  │
│  │ stdin  ← { role: 'user', content: minimalContext } │  │
│  │ stdout → stream-json events                         │  │
│  │ stderr → error logs                                 │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              EventBroadcaster                       │  │
│  ├─────────────────────────────────────────────────────┤  │
│  │ • broadcastAgentStarted(todoId)                     │  │
│  │ • broadcastAgentProgress(todoId, progress)          │  │
│  │ • broadcastAgentCompleted(todoId, result)           │  │
│  │ • broadcastAgentFailed(todoId, error)               │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │          ConversationStorage (Database)             │  │
│  ├─────────────────────────────────────────────────────┤  │
│  │ • updateTodoStatus(todoId, status, progress)        │  │
│  │ • saveTodo(todo)                                    │  │
│  │ • saveMessage(conversationId, message)              │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 레이어 분리

| 레이어 | 책임 | 구현 위치 |
|--------|------|-----------|
| **Presentation** | UI 렌더링, 사용자 인터랙션 | Renderer (React) |
| **State Management** | Agent 상태 관리, IPC 통신 | AgentContext.tsx |
| **Business Logic** | Agent 실행 관리, Queue 관리 | AgentManager (Main) |
| **Execution** | Claude CLI 실행, Stream 파싱 | AgentWorker (Main) |
| **Persistence** | Database 저장 | ConversationStorage |
| **Communication** | Event Broadcasting | EventBroadcaster |

---

## 컴포넌트 상세 설계

### 1. AgentManager (Main Process)

**책임**: Agent 생명주기 관리, 동시 실행 제어

#### 인터페이스

```typescript
/**
 * Agent Manager - Singleton
 *
 * 여러 Agent의 실행을 관리하는 중앙 컨트롤러
 */
export class AgentManager {
  private static instance: AgentManager | null = null
  private activeAgents: Map<string, AgentWorker> = new Map()
  private taskQueue: QueuedTask[] = []
  private maxConcurrent = 2

  static getInstance(): AgentManager {
    if (!AgentManager.instance) {
      AgentManager.instance = new AgentManager()
    }
    return AgentManager.instance
  }

  /**
   * Agent 시작 요청
   * - 동시 실행 수가 max 미만이면 즉시 실행
   * - 아니면 queue에 추가
   */
  async startAgent(todo: Todo, context: AgentContext): Promise<void> {
    console.log(`[AgentManager] Start request for todo: ${todo.id}`)

    // 이미 실행 중인지 확인
    if (this.activeAgents.has(todo.id)) {
      throw new Error(`Agent for todo ${todo.id} is already running`)
    }

    // 동시 실행 수 확인
    if (this.activeAgents.size >= this.maxConcurrent) {
      console.log(`[AgentManager] Max concurrent reached, queueing task`)
      this.taskQueue.push({ todo, context, queuedAt: Date.now() })
      EventBroadcaster.broadcastAgentQueued(todo.id, this.taskQueue.length)
      return
    }

    // Agent Worker 생성 및 실행
    await this.executeAgent(todo, context)
  }

  /**
   * Agent 실행 (내부)
   */
  private async executeAgent(todo: Todo, context: AgentContext): Promise<void> {
    const worker = new AgentWorker(todo, context)
    this.activeAgents.set(todo.id, worker)

    try {
      // Todo 상태 업데이트: pending → in_progress
      await storage.updateTodoStatus(todo.id, 'in_progress', 0)

      // Agent 시작 이벤트
      EventBroadcaster.broadcastAgentStarted(todo.id)

      // 실행
      const result = await worker.execute()

      // 성공 처리
      await this.handleAgentSuccess(todo, result)

    } catch (error) {
      // 실패 처리
      await this.handleAgentFailure(todo, error)

    } finally {
      // Cleanup
      this.activeAgents.delete(todo.id)

      // Queue에서 다음 작업 실행
      await this.processQueue()
    }
  }

  /**
   * Agent 성공 처리
   */
  private async handleAgentSuccess(todo: Todo, result: AgentResult): Promise<void> {
    console.log(`[AgentManager] Agent completed: ${todo.id}`)

    // Todo 상태 업데이트
    await storage.updateTodoStatus(todo.id, 'completed', 100, Date.now())

    // Conversation에 요약 추가
    const message = {
      id: generateId(),
      conversationId: todo.conversationId,
      role: 'assistant',
      content: this.formatAgentResult(todo, result),
      timestamp: Date.now(),
      metadata: {
        agentGenerated: true,
        todoId: todo.id,
        duration: result.duration
      }
    }
    await storage.saveMessage(message)

    // 완료 이벤트
    EventBroadcaster.broadcastAgentCompleted(todo.id, result)
  }

  /**
   * Agent 실패 처리
   */
  private async handleAgentFailure(todo: Todo, error: Error): Promise<void> {
    console.error(`[AgentManager] Agent failed: ${todo.id}`, error)

    // Todo 상태 업데이트
    await storage.updateTodoStatus(todo.id, 'failed', undefined, Date.now())

    // 실패 이벤트
    EventBroadcaster.broadcastAgentFailed(todo.id, {
      message: error.message,
      stack: error.stack
    })
  }

  /**
   * Queue 처리
   */
  private async processQueue(): Promise<void> {
    if (this.taskQueue.length === 0) return
    if (this.activeAgents.size >= this.maxConcurrent) return

    const task = this.taskQueue.shift()
    if (task) {
      console.log(`[AgentManager] Processing queued task: ${task.todo.id}`)
      await this.executeAgent(task.todo, task.context)
    }
  }

  /**
   * Agent 취소
   */
  async cancelAgent(todoId: string): Promise<void> {
    const worker = this.activeAgents.get(todoId)
    if (!worker) {
      // Queue에 있는지 확인
      const queueIndex = this.taskQueue.findIndex(t => t.todo.id === todoId)
      if (queueIndex >= 0) {
        this.taskQueue.splice(queueIndex, 1)
        EventBroadcaster.broadcastAgentCancelled(todoId)
      }
      return
    }

    console.log(`[AgentManager] Cancelling agent: ${todoId}`)
    worker.cancel()
    this.activeAgents.delete(todoId)

    // Todo 상태 업데이트
    await storage.updateTodoStatus(todoId, 'pending', 0)

    // 취소 이벤트
    EventBroadcaster.broadcastAgentCancelled(todoId)
  }

  /**
   * Agent 상태 조회
   */
  getAgentStatus(todoId: string): AgentStatus | null {
    const worker = this.activeAgents.get(todoId)
    if (!worker) {
      // Queue에 있는지 확인
      const queueIndex = this.taskQueue.findIndex(t => t.todo.id === todoId)
      if (queueIndex >= 0) {
        return {
          todoId,
          state: 'queued',
          queuePosition: queueIndex + 1
        }
      }
      return null
    }

    return worker.getStatus()
  }

  /**
   * 모든 Agent 상태 조회
   */
  getAllAgentStatuses(): AgentStatus[] {
    const statuses: AgentStatus[] = []

    // Active agents
    for (const [todoId, worker] of this.activeAgents) {
      statuses.push(worker.getStatus())
    }

    // Queued tasks
    this.taskQueue.forEach((task, index) => {
      statuses.push({
        todoId: task.todo.id,
        state: 'queued',
        queuePosition: index + 1
      })
    })

    return statuses
  }

  /**
   * 결과 포맷팅 (Conversation 메시지용)
   */
  private formatAgentResult(todo: Todo, result: AgentResult): string {
    return `**Agent completed: ${todo.content}**

**Duration**: ${Math.floor(result.duration / 1000)}s

**Summary**:
${result.summary}

**Files modified**:
${result.filesModified.map(f => `- ${f}`).join('\n')}

---
_This message was generated by a background agent._`
  }
}
```

#### 타입 정의

```typescript
interface QueuedTask {
  todo: Todo
  context: AgentContext
  queuedAt: number
}

interface AgentContext {
  // Minimal context for agent
  conversationId: string
  workspacePath: string
  instruction: string
  relevantFiles: string[]  // 관련 파일 경로만
  sharedContext?: SharedContext  // 공통 컨텍스트 (참조)
}

interface SharedContext {
  projectStructure: string
  codingConventions: string
  // ... 프로젝트 공통 정보
}

interface AgentResult {
  success: boolean
  summary: string
  filesModified: string[]
  filesCreated: string[]
  duration: number  // milliseconds
  tokens?: number
  cost?: number
}

interface AgentStatus {
  todoId: string
  state: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress?: number  // 0-100
  currentTask?: string
  queuePosition?: number
  startedAt?: number
  duration?: number
  error?: string
}
```

### 2. AgentWorker (Main Process)

**책임**: Claude CLI 실행, Stream 파싱, Progress 추적

#### 인터페이스

```typescript
/**
 * Agent Worker
 *
 * 하나의 Todo를 실행하는 Worker
 * Claude CLI를 spawn하고 stream을 파싱
 */
export class AgentWorker {
  private todo: Todo
  private context: AgentContext
  private claudeProcess: ChildProcess | null = null
  private progress = 0
  private currentTask = 'Initializing...'
  private startTime = 0
  private filesModified: string[] = []
  private filesCreated: string[] = []
  private fullOutput = ''
  private cancelled = false

  constructor(todo: Todo, context: AgentContext) {
    this.todo = todo
    this.context = context
  }

  /**
   * Agent 실행
   */
  async execute(): Promise<AgentResult> {
    this.startTime = Date.now()
    console.log(`[AgentWorker] Executing todo: ${this.todo.id}`)

    return new Promise((resolve, reject) => {
      try {
        // Claude CLI spawn
        this.claudeProcess = spawn(CLAUDE_CLI_PATH, [
          '--print',
          '--verbose',
          '--output-format', 'stream-json',
          '--include-partial-messages',
          '--model', 'sonnet',
          '--permission-mode', 'acceptEdits'
        ], {
          cwd: this.context.workspacePath,
          stdio: ['pipe', 'pipe', 'pipe']
        })

        // Minimal context 생성
        const input = this.buildMinimalContext()
        this.claudeProcess.stdin.write(JSON.stringify(input))
        this.claudeProcess.stdin.end()

        // Stream 파싱
        let stdoutBuffer = ''
        this.claudeProcess.stdout.on('data', (data: Buffer) => {
          stdoutBuffer += data.toString()
          const lines = stdoutBuffer.split('\n')
          stdoutBuffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.trim()) continue
            this.parseStreamEvent(line)
          }
        })

        // Error handling
        let stderrBuffer = ''
        this.claudeProcess.stderr.on('data', (data: Buffer) => {
          stderrBuffer += data.toString()
          console.error(`[AgentWorker] stderr: ${data}`)
        })

        // Completion
        this.claudeProcess.on('close', (code: number) => {
          if (this.cancelled) {
            reject(new Error('Agent was cancelled'))
            return
          }

          if (code !== 0) {
            reject(new Error(`Claude CLI exited with code ${code}: ${stderrBuffer}`))
            return
          }

          const duration = Date.now() - this.startTime
          console.log(`[AgentWorker] Completed in ${duration}ms`)

          resolve({
            success: true,
            summary: this.extractSummary(),
            filesModified: this.filesModified,
            filesCreated: this.filesCreated,
            duration
          })
        })

        // Error handling
        this.claudeProcess.on('error', (error: Error) => {
          reject(new Error(`Failed to spawn Claude CLI: ${error.message}`))
        })

      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Minimal Context 빌드
   */
  private buildMinimalContext(): { role: string; content: string } {
    // 필요한 것만 포함
    let content = `You are a helpful coding assistant working on a specific task.

**Your task**:
${this.context.instruction}

**Relevant files** (read only these if needed):
${this.context.relevantFiles.map(f => `- ${f}`).join('\n')}

**Instructions**:
1. Read the relevant files if needed
2. Complete the task
3. Provide a brief summary of what you did
4. IMPORTANT: Be concise and focused on this specific task only

Start working on the task now.`

    return {
      role: 'user',
      content
    }
  }

  /**
   * Stream Event 파싱
   */
  private parseStreamEvent(line: string): void {
    try {
      const event = JSON.parse(line)

      // Text delta - 출력 누적
      if (event.type === 'stream_event' && event.event?.type === 'content_block_delta') {
        if (event.event.delta?.type === 'text_delta') {
          this.fullOutput += event.event.delta.text
        }
      }

      // Tool use - progress 업데이트
      else if (event.type === 'stream_event' && event.event?.type === 'content_block_start') {
        if (event.event.content_block?.type === 'tool_use') {
          const toolName = event.event.content_block.name
          this.handleToolUse(toolName)
        }
      }

      // Assistant message - 최종 결과
      else if (event.type === 'assistant' && event.message) {
        this.parseAssistantMessage(event.message)
      }

    } catch (error) {
      console.error('[AgentWorker] Failed to parse stream event:', error)
    }
  }

  /**
   * Tool 사용 처리 (Progress 업데이트)
   */
  private handleToolUse(toolName: string): void {
    console.log(`[AgentWorker] Tool use: ${toolName}`)

    // Tool별 progress 추정
    const progressMap: Record<string, number> = {
      'Read': 20,
      'Glob': 15,
      'Grep': 15,
      'Edit': 50,
      'Write': 60,
      'Bash': 40
    }

    // Progress 업데이트 (최대 90%까지, 100%는 완료 시에만)
    const increment = progressMap[toolName] || 10
    this.progress = Math.min(90, this.progress + increment)
    this.currentTask = `Using ${toolName}...`

    // Progress 이벤트 전송
    EventBroadcaster.broadcastAgentProgress(this.todo.id, {
      progress: this.progress,
      currentTask: this.currentTask
    })

    // Database 업데이트
    storage.updateTodoStatus(this.todo.id, 'in_progress', this.progress)
  }

  /**
   * Assistant 메시지 파싱 (파일 변경 추적)
   */
  private parseAssistantMessage(message: any): void {
    if (!message.content || !Array.isArray(message.content)) return

    for (const block of message.content) {
      // Tool result에서 파일 변경 추적
      if (block.type === 'tool_use') {
        const toolName = block.name
        const input = block.input

        if (toolName === 'Edit' && input?.file_path) {
          this.filesModified.push(input.file_path)
        } else if (toolName === 'Write' && input?.file_path) {
          this.filesCreated.push(input.file_path)
        }
      }
    }
  }

  /**
   * 요약 추출 (출력에서)
   */
  private extractSummary(): string {
    // 전체 출력에서 요약 추출
    // 간단하게 처음 500자 + 파일 변경 정보
    const preview = this.fullOutput.substring(0, 500)
    const fileInfo = `\nModified ${this.filesModified.length} files, created ${this.filesCreated.length} files.`
    return preview + (this.fullOutput.length > 500 ? '...' : '') + fileInfo
  }

  /**
   * Agent 취소
   */
  cancel(): void {
    console.log(`[AgentWorker] Cancelling todo: ${this.todo.id}`)
    this.cancelled = true

    if (this.claudeProcess) {
      this.claudeProcess.kill('SIGTERM')
      this.claudeProcess = null
    }
  }

  /**
   * 상태 조회
   */
  getStatus(): AgentStatus {
    return {
      todoId: this.todo.id,
      state: 'running',
      progress: this.progress,
      currentTask: this.currentTask,
      startedAt: this.startTime,
      duration: Date.now() - this.startTime
    }
  }
}
```

### 3. IPC Handlers (Main Process)

**파일**: `circuit/electron/agentHandlers.ts` (신규)

```typescript
/**
 * Agent IPC Handlers
 */
import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { AgentManager } from './agentManager'
import type { Todo } from './conversationStorage'

export function registerAgentHandlers(storage: ConversationStorage) {
  const agentManager = AgentManager.getInstance()

  /**
   * Agent 시작
   */
  ipcMain.handle('agent:start', async (_event: IpcMainInvokeEvent, data: {
    todoId: string
    relevantFiles?: string[]
  }) => {
    try {
      console.log('[AgentHandlers] Starting agent for todo:', data.todoId)

      // Todo 조회
      const todo = storage.getTodo(data.todoId)
      if (!todo) {
        return { success: false, error: 'Todo not found' }
      }

      // Workspace path 조회
      const conversation = storage.getConversation(todo.conversationId)
      if (!conversation) {
        return { success: false, error: 'Conversation not found' }
      }

      // Context 생성
      const context = {
        conversationId: todo.conversationId,
        workspacePath: conversation.workspacePath,  // 필요 시 추가
        instruction: todo.content,
        relevantFiles: data.relevantFiles || []
      }

      // Agent 시작
      await agentManager.startAgent(todo, context)

      return { success: true }

    } catch (error) {
      console.error('[AgentHandlers] Failed to start agent:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  /**
   * Agent 취소
   */
  ipcMain.handle('agent:cancel', async (_event: IpcMainInvokeEvent, todoId: string) => {
    try {
      console.log('[AgentHandlers] Cancelling agent for todo:', todoId)
      await agentManager.cancelAgent(todoId)
      return { success: true }

    } catch (error) {
      console.error('[AgentHandlers] Failed to cancel agent:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  /**
   * Agent 상태 조회
   */
  ipcMain.handle('agent:get-status', async (_event: IpcMainInvokeEvent, todoId: string) => {
    try {
      const status = agentManager.getAgentStatus(todoId)
      return { success: true, status }

    } catch (error) {
      console.error('[AgentHandlers] Failed to get agent status:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  /**
   * 모든 Agent 상태 조회
   */
  ipcMain.handle('agent:get-all-statuses', async (_event: IpcMainInvokeEvent) => {
    try {
      const statuses = agentManager.getAllAgentStatuses()
      return { success: true, statuses }

    } catch (error) {
      console.error('[AgentHandlers] Failed to get all agent statuses:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  console.log('[AgentHandlers] Agent IPC handlers registered')
}
```

### 4. EventBroadcaster 확장

**파일**: `circuit/electron/eventBroadcaster.ts` (기존 파일 확장)

```typescript
// 기존 EventBroadcaster에 추가

/**
 * Agent 이벤트 브로드캐스트
 */
export class EventBroadcaster {
  // ... 기존 메소드들 ...

  /**
   * Agent 시작 이벤트
   */
  static broadcastAgentStarted(todoId: string): void {
    BrowserWindow.getAllWindows().forEach(window => {
      if (!window.isDestroyed()) {
        window.webContents.send('agent:started', { todoId, timestamp: Date.now() })
      }
    })
  }

  /**
   * Agent Progress 이벤트
   */
  static broadcastAgentProgress(todoId: string, data: {
    progress: number
    currentTask: string
  }): void {
    BrowserWindow.getAllWindows().forEach(window => {
      if (!window.isDestroyed()) {
        window.webContents.send('agent:progress', {
          todoId,
          progress: data.progress,
          currentTask: data.currentTask,
          timestamp: Date.now()
        })
      }
    })
  }

  /**
   * Agent 완료 이벤트
   */
  static broadcastAgentCompleted(todoId: string, result: AgentResult): void {
    BrowserWindow.getAllWindows().forEach(window => {
      if (!window.isDestroyed()) {
        window.webContents.send('agent:completed', {
          todoId,
          result,
          timestamp: Date.now()
        })
      }
    })
  }

  /**
   * Agent 실패 이벤트
   */
  static broadcastAgentFailed(todoId: string, error: { message: string; stack?: string }): void {
    BrowserWindow.getAllWindows().forEach(window => {
      if (!window.isDestroyed()) {
        window.webContents.send('agent:failed', {
          todoId,
          error,
          timestamp: Date.now()
        })
      }
    })
  }

  /**
   * Agent 취소 이벤트
   */
  static broadcastAgentCancelled(todoId: string): void {
    BrowserWindow.getAllWindows().forEach(window => {
      if (!window.isDestroyed()) {
        window.webContents.send('agent:cancelled', { todoId, timestamp: Date.now() })
      }
    })
  }

  /**
   * Agent Queue 이벤트
   */
  static broadcastAgentQueued(todoId: string, queuePosition: number): void {
    BrowserWindow.getAllWindows().forEach(window => {
      if (!window.isDestroyed()) {
        window.webContents.send('agent:queued', {
          todoId,
          queuePosition,
          timestamp: Date.now()
        })
      }
    })
  }
}
```

### 5. UI Components (Renderer Process)

#### AgentContext (State Management)

**파일**: `circuit/src/contexts/AgentContext.tsx` (신규)

```typescript
/**
 * Agent Context - State Management
 */
import React, { createContext, useContext, useEffect, useState } from 'react'

interface AgentState {
  todoId: string
  state: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress: number
  currentTask: string
  queuePosition?: number
  error?: string
}

interface AgentContextValue {
  agents: Map<string, AgentState>
  startAgent: (todoId: string, relevantFiles?: string[]) => Promise<void>
  cancelAgent: (todoId: string) => Promise<void>
  getAgentState: (todoId: string) => AgentState | undefined
}

const AgentContext = createContext<AgentContextValue | undefined>(undefined)

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const [agents, setAgents] = useState<Map<string, AgentState>>(new Map())

  // IPC Event Listeners
  useEffect(() => {
    const { ipcRenderer } = window.require('electron')

    // Agent started
    const handleAgentStarted = (_event: any, data: { todoId: string }) => {
      setAgents(prev => {
        const next = new Map(prev)
        next.set(data.todoId, {
          todoId: data.todoId,
          state: 'running',
          progress: 0,
          currentTask: 'Starting...'
        })
        return next
      })
    }

    // Agent progress
    const handleAgentProgress = (_event: any, data: {
      todoId: string
      progress: number
      currentTask: string
    }) => {
      setAgents(prev => {
        const next = new Map(prev)
        const current = next.get(data.todoId)
        if (current) {
          next.set(data.todoId, {
            ...current,
            progress: data.progress,
            currentTask: data.currentTask
          })
        }
        return next
      })
    }

    // Agent completed
    const handleAgentCompleted = (_event: any, data: { todoId: string }) => {
      setAgents(prev => {
        const next = new Map(prev)
        next.set(data.todoId, {
          todoId: data.todoId,
          state: 'completed',
          progress: 100,
          currentTask: 'Completed'
        })
        return next
      })

      // 3초 후 자동 제거
      setTimeout(() => {
        setAgents(prev => {
          const next = new Map(prev)
          next.delete(data.todoId)
          return next
        })
      }, 3000)
    }

    // Agent failed
    const handleAgentFailed = (_event: any, data: {
      todoId: string
      error: { message: string }
    }) => {
      setAgents(prev => {
        const next = new Map(prev)
        next.set(data.todoId, {
          todoId: data.todoId,
          state: 'failed',
          progress: 0,
          currentTask: 'Failed',
          error: data.error.message
        })
        return next
      })
    }

    // Agent cancelled
    const handleAgentCancelled = (_event: any, data: { todoId: string }) => {
      setAgents(prev => {
        const next = new Map(prev)
        next.delete(data.todoId)
        return next
      })
    }

    // Agent queued
    const handleAgentQueued = (_event: any, data: {
      todoId: string
      queuePosition: number
    }) => {
      setAgents(prev => {
        const next = new Map(prev)
        next.set(data.todoId, {
          todoId: data.todoId,
          state: 'queued',
          progress: 0,
          currentTask: 'Queued',
          queuePosition: data.queuePosition
        })
        return next
      })
    }

    ipcRenderer.on('agent:started', handleAgentStarted)
    ipcRenderer.on('agent:progress', handleAgentProgress)
    ipcRenderer.on('agent:completed', handleAgentCompleted)
    ipcRenderer.on('agent:failed', handleAgentFailed)
    ipcRenderer.on('agent:cancelled', handleAgentCancelled)
    ipcRenderer.on('agent:queued', handleAgentQueued)

    return () => {
      ipcRenderer.removeListener('agent:started', handleAgentStarted)
      ipcRenderer.removeListener('agent:progress', handleAgentProgress)
      ipcRenderer.removeListener('agent:completed', handleAgentCompleted)
      ipcRenderer.removeListener('agent:failed', handleAgentFailed)
      ipcRenderer.removeListener('agent:cancelled', handleAgentCancelled)
      ipcRenderer.removeListener('agent:queued', handleAgentQueued)
    }
  }, [])

  // Actions
  const startAgent = async (todoId: string, relevantFiles?: string[]) => {
    const { ipcRenderer } = window.require('electron')
    const result = await ipcRenderer.invoke('agent:start', { todoId, relevantFiles })

    if (!result.success) {
      throw new Error(result.error)
    }
  }

  const cancelAgent = async (todoId: string) => {
    const { ipcRenderer } = window.require('electron')
    const result = await ipcRenderer.invoke('agent:cancel', todoId)

    if (!result.success) {
      throw new Error(result.error)
    }
  }

  const getAgentState = (todoId: string): AgentState | undefined => {
    return agents.get(todoId)
  }

  return (
    <AgentContext.Provider value={{ agents, startAgent, cancelAgent, getAgentState }}>
      {children}
    </AgentContext.Provider>
  )
}

export function useAgent() {
  const context = useContext(AgentContext)
  if (!context) {
    throw new Error('useAgent must be used within AgentProvider')
  }
  return context
}
```

#### TodoItem 컴포넌트 확장

**파일**: `circuit/src/components/todo/TodoItem.tsx` (기존 파일 확장)

```tsx
// TodoItem.tsx에 추가

import { useAgent } from '@/contexts/AgentContext'
import { PlayCircle, StopCircle, Clock } from 'lucide-react'

export function TodoItem({ todo }: { todo: Todo }) {
  const { startAgent, cancelAgent, getAgentState } = useAgent()
  const agentState = getAgentState(todo.id)
  const [isRunningAgent, setIsRunningAgent] = useState(false)

  const handleRunAgent = async () => {
    try {
      setIsRunningAgent(true)
      await startAgent(todo.id)
    } catch (error) {
      console.error('Failed to start agent:', error)
      alert(`Failed to start agent: ${error}`)
    } finally {
      setIsRunningAgent(false)
    }
  }

  const handleCancelAgent = async () => {
    try {
      await cancelAgent(todo.id)
    } catch (error) {
      console.error('Failed to cancel agent:', error)
    }
  }

  return (
    <div className="todo-item">
      {/* ... 기존 Todo UI ... */}

      {/* Agent Controls */}
      <div className="agent-controls">
        {!agentState && todo.status === 'pending' && (
          <button
            onClick={handleRunAgent}
            disabled={isRunningAgent}
            className="btn-run-agent"
            title="Run with Agent"
          >
            <PlayCircle size={16} />
            Run Agent
          </button>
        )}

        {agentState?.state === 'running' && (
          <>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${agentState.progress}%` }}
              />
              <span className="progress-text">
                {agentState.progress}% - {agentState.currentTask}
              </span>
            </div>
            <button
              onClick={handleCancelAgent}
              className="btn-cancel-agent"
              title="Cancel Agent"
            >
              <StopCircle size={16} />
            </button>
          </>
        )}

        {agentState?.state === 'queued' && (
          <div className="agent-queued">
            <Clock size={16} />
            <span>Queued (#{agentState.queuePosition})</span>
          </div>
        )}

        {agentState?.state === 'completed' && (
          <div className="agent-completed">
            ✅ Completed by agent
          </div>
        )}

        {agentState?.state === 'failed' && (
          <div className="agent-failed">
            ❌ Failed: {agentState.error}
          </div>
        )}
      </div>
    </div>
  )
}
```

---

## 데이터 흐름

### 1. Agent 시작 흐름

```
1. User clicks "Run Agent" button
   ├─> TodoItem.tsx: handleRunAgent()
   │
2. AgentContext: startAgent(todoId)
   ├─> IPC: agent:start
   │
3. Main Process: agentHandlers.ts
   ├─> AgentManager.startAgent(todo, context)
   │
4. AgentManager
   ├─> Check concurrent limit
   ├─> If OK: executeAgent()
   ├─> If full: queue task
   │
5. AgentWorker.execute()
   ├─> spawn Claude CLI
   ├─> Send minimal context to stdin
   │
6. Stream events
   ├─> parseStreamEvent()
   ├─> handleToolUse()
   ├─> EventBroadcaster.broadcastAgentProgress()
   │
7. UI updates
   ├─> IPC: agent:progress
   ├─> AgentContext updates state
   ├─> TodoItem re-renders with progress bar
```

### 2. Progress 업데이트 흐름

```
Claude CLI (stdout)
  ↓ stream-json events
AgentWorker.parseStreamEvent()
  ↓ detect tool use
AgentWorker.handleToolUse()
  ↓ calculate progress
EventBroadcaster.broadcastAgentProgress()
  ↓ IPC: agent:progress
AgentContext (Renderer)
  ↓ setState
TodoItem re-renders
  ↓
Progress bar updates
```

### 3. Agent 완료 흐름

```
Claude CLI closes with code 0
  ↓
AgentWorker.execute() resolves
  ↓
AgentManager.handleAgentSuccess()
  ├─> storage.updateTodoStatus('completed')
  ├─> storage.saveMessage(summary)
  ├─> EventBroadcaster.broadcastAgentCompleted()
  └─> processQueue() (start next agent if queued)
       ↓
UI updates
  ├─> IPC: agent:completed
  ├─> AgentContext updates state
  ├─> TodoItem shows "Completed"
  └─> Conversation shows new message
```

### 4. Error 처리 흐름

```
Error occurs (e.g., Claude CLI fails)
  ↓
AgentWorker.execute() rejects
  ↓
AgentManager.handleAgentFailure()
  ├─> storage.updateTodoStatus('failed')
  ├─> EventBroadcaster.broadcastAgentFailed()
  └─> processQueue() (continue with next)
       ↓
UI updates
  ├─> IPC: agent:failed
  ├─> AgentContext updates state
  └─> TodoItem shows error message
```

---

## API 명세

### IPC Handlers (Main → Renderer)

#### `agent:start`

**Request**:
```typescript
{
  todoId: string
  relevantFiles?: string[]  // Optional: 관련 파일 명시
}
```

**Response**:
```typescript
{
  success: boolean
  error?: string
}
```

#### `agent:cancel`

**Request**:
```typescript
todoId: string
```

**Response**:
```typescript
{
  success: boolean
  error?: string
}
```

#### `agent:get-status`

**Request**:
```typescript
todoId: string
```

**Response**:
```typescript
{
  success: boolean
  status?: AgentStatus
  error?: string
}
```

#### `agent:get-all-statuses`

**Request**: (none)

**Response**:
```typescript
{
  success: boolean
  statuses?: AgentStatus[]
  error?: string
}
```

### IPC Events (Main → Renderer)

#### `agent:started`

```typescript
{
  todoId: string
  timestamp: number
}
```

#### `agent:progress`

```typescript
{
  todoId: string
  progress: number  // 0-100
  currentTask: string
  timestamp: number
}
```

#### `agent:completed`

```typescript
{
  todoId: string
  result: AgentResult
  timestamp: number
}
```

#### `agent:failed`

```typescript
{
  todoId: string
  error: {
    message: string
    stack?: string
  }
  timestamp: number
}
```

#### `agent:cancelled`

```typescript
{
  todoId: string
  timestamp: number
}
```

#### `agent:queued`

```typescript
{
  todoId: string
  queuePosition: number
  timestamp: number
}
```

---

## 에러 처리 전략

### 1. Agent 실행 에러

**케이스**:
- Claude CLI not found
- Claude CLI spawn 실패
- stdin/stdout 통신 실패

**처리**:
```typescript
try {
  await agentManager.startAgent(todo, context)
} catch (error) {
  // UI에 에러 표시
  EventBroadcaster.broadcastAgentFailed(todo.id, {
    message: error.message
  })

  // Todo 상태 유지 (pending)
  // 사용자가 재시도 가능
}
```

### 2. Stream 파싱 에러

**케이스**:
- 잘못된 JSON 라인
- 예상치 못한 event type

**처리**:
```typescript
try {
  const event = JSON.parse(line)
  // ...
} catch (error) {
  console.error('[AgentWorker] Failed to parse stream event:', error)
  // 무시하고 계속 진행
  // (한 라인 파싱 실패가 전체를 막지 않도록)
}
```

### 3. Claude CLI 비정상 종료

**케이스**:
- exit code !== 0
- SIGTERM/SIGKILL

**처리**:
```typescript
claude.on('close', (code) => {
  if (code !== 0) {
    reject(new Error(`Claude CLI exited with code ${code}`))
  }
})

// AgentManager에서:
try {
  await worker.execute()
} catch (error) {
  await this.handleAgentFailure(todo, error)
  // Queue에서 다음 작업 계속
}
```

### 4. Timeout

**케이스**:
- Agent가 너무 오래 실행 (예: 10분 이상)

**처리**:
```typescript
// AgentManager.executeAgent()에 추가:
const timeout = setTimeout(() => {
  worker.cancel()
  reject(new Error('Agent execution timeout (10 minutes)'))
}, 10 * 60 * 1000)

try {
  const result = await worker.execute()
  clearTimeout(timeout)
  // ...
} catch (error) {
  clearTimeout(timeout)
  // ...
}
```

### 5. Database 저장 실패

**케이스**:
- SQLite 쓰기 실패
- Disk full

**처리**:
```typescript
try {
  await storage.updateTodoStatus(todo.id, 'completed')
} catch (error) {
  console.error('[AgentManager] Failed to save todo status:', error)
  // Agent는 성공했지만 DB 저장 실패
  // EventBroadcaster로라도 UI 업데이트
  EventBroadcaster.broadcastAgentCompleted(todo.id, result)
}
```

### 6. IPC 통신 실패

**케이스**:
- Window destroyed
- Renderer process crashed

**처리**:
```typescript
// EventBroadcaster에서:
static broadcastAgentProgress(todoId: string, data: any): void {
  BrowserWindow.getAllWindows().forEach(window => {
    if (!window.isDestroyed()) {  // ✅ Check before send
      try {
        window.webContents.send('agent:progress', data)
      } catch (error) {
        console.error('[EventBroadcaster] Failed to send event:', error)
        // 무시 (다른 window는 계속)
      }
    }
  })
}
```

---

## 성능 및 리소스 관리

### 1. Concurrent Agent 제한

**목표**: 메모리 폭증 방지

**구현**:
```typescript
// AgentManager
private maxConcurrent = 2  // 최대 2개만 동시 실행

// 초과 시 Queue에 추가
if (this.activeAgents.size >= this.maxConcurrent) {
  this.taskQueue.push(task)
}
```

**근거**:
- Claude CLI 1개 ≈ 50-100MB 메모리
- 2개 동시 실행 = 100-200MB (허용 가능)
- 3개 이상 = 메모리 부담 증가

### 2. Minimal Context

**목표**: Context 크기 최소화 (MULTI_CONVERSATION_DESIGN.md 원칙)

**구현**:
```typescript
// ❌ 나쁜 예: 전체 conversation history
const context = {
  messages: session.messages  // 50개 메시지 전체
}

// ✅ 좋은 예: 필요한 것만
const context = {
  instruction: todo.content,  // Task description만
  relevantFiles: ['src/Login.tsx']  // 관련 파일 1-2개만
}
```

**효과**:
- 전체 history: 10K+ tokens
- Minimal context: 500-1K tokens
- **90% 토큰 절감**

### 3. Queue 관리

**FIFO (First In First Out)**:
```typescript
// Task 추가 (끝에)
this.taskQueue.push(task)

// Task 꺼내기 (앞에서)
const task = this.taskQueue.shift()
```

**우선순위 지원 (Phase 2)**:
```typescript
// High priority task는 앞에 삽입
if (todo.priority === 'high') {
  this.taskQueue.unshift(task)
} else {
  this.taskQueue.push(task)
}
```

### 4. Memory Cleanup

**Agent 종료 시**:
```typescript
// AgentManager.executeAgent() finally 블록
finally {
  // Agent 참조 제거
  this.activeAgents.delete(todo.id)

  // Worker 내부 정리
  worker.cancel()  // Process kill

  // 다음 작업 시작
  await this.processQueue()
}
```

**Process 종료 확인**:
```typescript
// AgentWorker.cancel()
if (this.claudeProcess) {
  this.claudeProcess.kill('SIGTERM')
  this.claudeProcess = null  // 참조 제거
}
```

### 5. Progress 업데이트 throttling

**문제**: Stream event가 너무 자주 발생 → IPC 부하

**해결**:
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
  EventBroadcaster.broadcastAgentProgress(...)
}
```

**효과**:
- IPC 호출 빈도: 100/s → 2/s
- CPU 부하 감소

### 6. Timeout 설정

**Agent 실행 제한**:
```typescript
const MAX_AGENT_DURATION = 10 * 60 * 1000  // 10분

const timeout = setTimeout(() => {
  worker.cancel()
  reject(new Error('Agent execution timeout'))
}, MAX_AGENT_DURATION)
```

**근거**:
- 대부분 Task는 1-3분 이내
- 10분 초과 = 무한 루프 또는 stuck 가능성

---

## 구현 단계

### Phase 1: 기본 구조 (Day 1-2)

1. **파일 생성**
   - [ ] `circuit/electron/agentManager.ts`
   - [ ] `circuit/electron/agentWorker.ts`
   - [ ] `circuit/electron/agentHandlers.ts`
   - [ ] `circuit/src/contexts/AgentContext.tsx`

2. **Main Process 구현**
   - [ ] AgentManager 클래스
   - [ ] AgentWorker 클래스 (기본)
   - [ ] IPC handlers 등록

3. **EventBroadcaster 확장**
   - [ ] Agent 이벤트 메소드 추가

4. **컴파일 및 기본 테스트**
   - [ ] TypeScript 컴파일 에러 수정
   - [ ] Import 경로 수정

### Phase 2: Claude CLI 통합 (Day 3-4)

1. **AgentWorker.execute() 구현**
   - [ ] Claude CLI spawn
   - [ ] Minimal context 생성
   - [ ] stdin/stdout/stderr 처리

2. **Stream 파싱**
   - [ ] parseStreamEvent() 구현
   - [ ] Tool use 감지
   - [ ] Text delta 수집

3. **Progress 추적**
   - [ ] handleToolUse() 구현
   - [ ] Progress 계산 로직
   - [ ] EventBroadcaster 호출

4. **테스트**
   - [ ] 간단한 Todo로 테스트
   - [ ] Console 로그 확인

### Phase 3: UI 통합 (Day 5)

1. **AgentContext 구현**
   - [ ] State management
   - [ ] IPC event listeners
   - [ ] Actions (start/cancel)

2. **TodoItem 확장**
   - [ ] "Run Agent" 버튼
   - [ ] Progress bar
   - [ ] Status 표시

3. **App.tsx에 Provider 추가**
   ```tsx
   <AgentProvider>
     <TodoProvider>
       {/* ... */}
     </TodoProvider>
   </AgentProvider>
   ```

4. **스타일링**
   - [ ] Progress bar CSS
   - [ ] Agent status 아이콘

### Phase 4: 테스트 및 디버깅 (Day 6-7)

1. **기능 테스트**
   - [ ] Agent 시작
   - [ ] Progress 업데이트
   - [ ] 완료 처리
   - [ ] 에러 처리
   - [ ] 취소 기능

2. **Edge Cases**
   - [ ] 여러 Agent 동시 실행
   - [ ] Queue 동작
   - [ ] Agent 실패 후 재시도
   - [ ] Window 닫았다 열기

3. **성능 테스트**
   - [ ] 메모리 사용량 확인
   - [ ] CPU 부하 확인
   - [ ] Progress 업데이트 빈도

### Phase 5: 문서화 및 정리 (Day 8)

1. **코드 주석 추가**
2. **사용자 가이드 작성**
3. **알려진 이슈 문서화**

---

## 검토 체크리스트

### 아키텍처 설계

- [x] **컴포넌트 분리**: AgentManager, AgentWorker, Handlers 명확히 분리
- [x] **Singleton 패턴**: AgentManager는 한 인스턴스만 (Main Process)
- [x] **Event-driven**: EventBroadcaster로 느슨한 결합
- [x] **Minimal Context**: 전체 history 대신 필요한 것만 전달
- [ ] **⚠️ Workspace Path 조회**: Conversation에 workspacePath 필드 있는지 확인 필요

### 데이터 흐름

- [x] **Uni-directional**: Renderer → Main → Renderer (IPC)
- [x] **State 관리**: AgentContext로 중앙 집중
- [x] **Progress 실시간 업데이트**: Stream-json 파싱 → EventBroadcaster
- [x] **Database 동기화**: Todo 상태를 SQLite에도 저장

### 에러 처리

- [x] **Isolation**: 한 Agent 실패가 다른 Agent에 영향 없음
- [x] **Graceful Degradation**: 에러 발생 시에도 시스템 안정
- [x] **Retry 로직**: 실패 시 재시도 가능 (UI에서)
- [x] **Timeout**: 10분 초과 시 자동 취소
- [ ] **⚠️ Network Error**: Claude CLI가 API 호출 실패 시 처리 방법 확인 필요

### 성능

- [x] **Concurrent 제한**: 최대 2-3개만 동시 실행
- [x] **Queue 관리**: FIFO 방식
- [x] **Memory Cleanup**: Agent 종료 시 참조 제거
- [x] **Progress Throttling**: 500ms 간격으로 업데이트
- [ ] **⚠️ Large Output**: Claude CLI 출력이 매우 클 경우 (1MB+) 처리 방법 고민 필요

### UI/UX

- [x] **즉시 피드백**: 버튼 클릭 후 즉시 상태 변경
- [x] **Progress 표시**: 0-100% bar + 현재 작업 표시
- [x] **Queue 표시**: Queue 위치 표시
- [x] **Error 표시**: 실패 시 에러 메시지
- [ ] **⚠️ 완료 알림**: Agent 완료 시 알림 (토스트?) 필요할지 검토

### 보안

- [x] **Input Validation**: Todo ID 검증
- [x] **File Path Sanitization**: relevantFiles 경로 검증 (TODO: 구현 필요)
- [x] **Permission Mode**: `acceptEdits` 사용 (자동 승인)
- [ ] **⚠️ Sandbox**: Claude CLI가 workspace 밖 파일 접근 불가하도록 확인 필요

### 호환성

- [x] **기존 코드와 충돌 없음**: 새로운 파일만 추가
- [x] **EventBroadcaster 확장**: 기존 메소드에 영향 없음
- [x] **Database 스키마 변경 없음**: 기존 Todo 타입 그대로 사용
- [ ] **⚠️ Main.cjs 수정**: agentHandlers 등록 위치 확인 필요

### 테스트 가능성

- [x] **Unit Test 가능**: AgentManager, AgentWorker 독립 테스트
- [x] **Mock 가능**: Claude CLI spawn을 mock 가능
- [x] **IPC Test 가능**: IPC 이벤트를 emit하여 테스트
- [ ] **⚠️ E2E Test**: 전체 플로우 테스트 방법 고민 필요

---

## 리스크 및 완화 전략

### 리스크 1: Claude CLI 호환성

**리스크**: Claude CLI 버전에 따라 stream-json 포맷이 다를 수 있음

**완화**:
- 현재 main.cjs에서 사용 중인 포맷과 동일하게 구현
- 파싱 에러 시 graceful fallback
- Version check 추가 (선택)

### 리스크 2: 메모리 누수

**리스크**: Agent가 종료되지 않고 계속 실행

**완화**:
- Timeout 설정 (10분)
- Process.kill() 확실히 호출
- activeAgents Map에서 제거 확인
- Memory profiling으로 검증

### 리스크 3: Race Condition

**리스크**: 여러 Agent가 같은 파일 수정

**완화**:
- Phase 1에서는 사용자 책임 (주의 필요)
- Phase 2에서 파일 lock 고려
- Minimal Context로 파일 중복 최소화

### 리스크 4: UI 블로킹

**리스크**: Progress 업데이트가 너무 자주 발생

**완화**:
- Progress throttling (500ms)
- IPC batching 고려
- Virtual scrolling (TodoList 많을 경우)

### 리스크 5: Database Corruption

**리스크**: Agent가 중간에 실패하면 Todo 상태 불일치

**완화**:
- Transaction 사용 (SQLite)
- Atomic 업데이트
- 실패 시 rollback

---

## 다음 단계

### 검토 완료 후

1. **검토 회의**
   - 이 문서를 리뷰
   - 리스크 평가
   - ⚠️ 표시된 항목 확인

2. **구현 시작**
   - Phase 1부터 순차적으로
   - 각 Phase 완료 시 테스트

3. **점진적 배포**
   - 먼저 1개 Agent만
   - 안정화 후 Queue 추가
   - 최종적으로 병렬 2-3개

---

**문서 작성일**: 2025-11-04
**리뷰 필요 사항**: ⚠️ 표시된 6개 항목
**예상 구현 기간**: 7-8일
**우선순위**: High (MVP 기능)
