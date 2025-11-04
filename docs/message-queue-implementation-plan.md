# 메시지 큐 시스템 구현 방안

> 작성일: 2025-11-03
> 목적: 프롬프트 실행 중에도 사용자가 새로운 메시지를 입력할 수 있도록 큐 시스템 구현

---

## 목차
1. [현재 아키텍처 분석](#1-현재-아키텍처-분석)
2. [베스트 프랙티스 조사 결과](#2-베스트-프랙티스-조사-결과)
3. [우리 코드베이스에 맞는 설계](#3-우리-코드베이스에-맞는-설계)
4. [마이그레이션 단계별 계획](#4-마이그레이션-단계별-계획)
5. [고려사항 및 트레이드오프](#5-고려사항-및-트레이드오프)
6. [구현 체크리스트](#6-구현-체크리스트)

---

## 1. 현재 아키텍처 분석

### 1.1 현재 메시지 처리 흐름
```
[사용자 입력]
  ↓
[ChatInput Component] → disabled={isSending || !sessionId || isLoadingConversation}
  ↓
[handleSend] → 검사: isSending이면 early return
  ↓
[executePrompt] → setIsSending(true)
  ↓
[ipcRenderer.send('claude:send-message')]
  ↓
[Electron Main Process] → activeSessions에서 세션 가져오기
  ↓
[Claude API 호출] → Streaming 응답
  ↓
[Event Emissions]
  - claude:thinking-start
  - claude:milestone (여러 번)
  - claude:thinking-complete
  - claude:response-complete
  ↓
[Frontend Handler] → setIsSending(false)
```

### 1.2 현재 상태 관리 (WorkspaceChatEditor.tsx)
```typescript
// 주요 상태들
const [isSending, setIsSending] = useState(false);          // Line 205
const [messages, setMessages] = useState<Message[]>([]);
const [input, setInput] = useState('');

// 전송 차단 로직
if (isSending || !sessionId) return;  // Line 1113
```

### 1.3 현재의 제약사항
- **단일 메시지 처리**: `isSending` 플래그로 동시 전송 차단
- **입력 차단**: 처리 중 사용자 입력 완전 비활성화
- **순차 처리 불가**: 다음 메시지를 미리 작성할 수 없음

---

## 2. 베스트 프랙티스 조사 결과

### 2.1 업계 표준 (Claude Code 기준)
- ✅ 사용자가 여러 메시지를 빠르게 입력 가능
- ✅ 스마트 컨텍스트 처리 (큐의 모든 메시지를 함께 고려)
- ✅ 피드백 필요 시 자동 실행 중단
- ✅ 완료 시 적절한 타이밍에 다음 메시지 자동 처리

### 2.2 React/TypeScript 큐 구현 패턴
```typescript
// 기본 구조 (참고용)
interface QueuedMessage {
  id: string
  content: string
  attachments: AttachedFile[]
  thinkingMode: ThinkingMode
  status: 'queued' | 'processing' | 'completed' | 'failed'
  timestamp: number
}

class MessageQueue {
  private queue: QueuedMessage[] = []
  private isProcessing: boolean = false

  enqueue(message: QueuedMessage) {
    this.queue.push(message)
    if (!this.isProcessing) {
      this.processNext()
    }
  }

  async processNext() {
    if (this.queue.length === 0) {
      this.isProcessing = false
      return
    }

    this.isProcessing = true
    const message = this.queue[0]

    try {
      await this.sendMessage(message)
      this.queue.shift() // 성공 시 제거
    } catch (error) {
      message.status = 'failed'
    }

    this.processNext() // 재귀 호출
  }
}
```

### 2.3 분산 시스템 원칙 (적용 가능한 부분)
- **Idempotency**: 동일한 메시지를 여러 번 보내도 안전해야 함
- **Acknowledgment**: 처리 완료 확인 메커니즘
- **Error Handling**: 실패 시 재시도 또는 사용자 알림
- **Monitoring**: 큐 상태 실시간 표시

---

## 3. 우리 코드베이스에 맞는 설계

### 3.1 아키텍처 레이어 분리

```
┌─────────────────────────────────────────────────────┐
│  Presentation Layer (UI Components)                 │
│  - ChatInput: 입력 필드 (항상 활성화)                │
│  - QueueIndicator: 큐 상태 표시                      │
│  - MessageList: 메시지 + 큐 항목 표시               │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│  State Management Layer (React State + Context)     │
│  - messageQueue: QueuedMessage[]                    │
│  - isProcessing: boolean                            │
│  - currentlyProcessing: QueuedMessage | null        │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│  Business Logic Layer (Queue Manager)               │
│  - enqueueMessage()                                 │
│  - processNextMessage()                             │
│  - cancelMessage()                                  │
│  - editQueuedMessage()                              │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│  IPC Layer (Electron Communication)                 │
│  - ipcRenderer.send('claude:send-message')          │
│  - Event listeners (response-complete, error, etc)  │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│  Backend Layer (Electron Main Process)              │
│  - 변경 불필요 (현재대로 한 번에 하나씩 처리)        │
└─────────────────────────────────────────────────────┘
```

### 3.2 데이터 구조 설계

#### 3.2.1 큐 아이템 타입
```typescript
// circuit/src/types/messageQueue.ts (신규 파일)
export type QueueStatus =
  | 'queued'      // 대기 중
  | 'processing'  // 현재 처리 중
  | 'completed'   // 완료됨
  | 'failed'      // 실패함
  | 'cancelled'   // 취소됨

export interface QueuedMessage {
  // 식별자
  id: string
  queuedAt: number  // 큐에 추가된 시간

  // 메시지 내용
  content: string
  attachments: AttachedFile[]
  thinkingMode: ThinkingMode

  // 상태 관리
  status: QueueStatus
  error?: string

  // UI 표시용
  preview: string  // 첫 50자 정도

  // 처리 결과 (완료 후)
  userMessageId?: string      // DB에 저장된 user message ID
  assistantMessageId?: string // DB에 저장된 assistant message ID
  processedAt?: number        // 처리 완료 시간
}

export interface MessageQueueState {
  queue: QueuedMessage[]
  isProcessing: boolean
  currentlyProcessing: QueuedMessage | null
}
```

#### 3.2.2 상태 관리 위치
```typescript
// WorkspaceChatEditor.tsx의 ChatPanelInner에 추가
const [messageQueue, setMessageQueue] = useState<QueuedMessage[]>([])
const [isProcessingQueue, setIsProcessingQueue] = useState(false)
const [currentQueueItem, setCurrentQueueItem] = useState<QueuedMessage | null>(null)

// 기존 isSending은 유지하되, 의미 변경
// Before: "메시지 전송 중인가?"
// After: "현재 큐 아이템이 처리 중인가?" (= isProcessingQueue와 동일)
```

### 3.3 핵심 함수 설계

#### 3.3.1 큐에 메시지 추가
```typescript
// handleSend 함수 수정
const handleSend = async (inputText: string, attachments: AttachedFile[], thinkingMode: ThinkingMode) => {
  if (!inputText.trim() && attachments.length === 0) return
  if (!sessionId) return

  // ❌ 기존: isSending 체크 (전송 중이면 막음)
  // if (isSending) return

  // ✅ 새로운: 큐에 추가 (항상 허용)
  const queuedMessage: QueuedMessage = {
    id: `queue-${Date.now()}-${Math.random()}`,
    queuedAt: Date.now(),
    content: inputText,
    attachments,
    thinkingMode,
    status: 'queued',
    preview: inputText.slice(0, 50) + (inputText.length > 50 ? '...' : '')
  }

  // 큐에 추가
  setMessageQueue(prev => [...prev, queuedMessage])

  // 입력 필드 즉시 클리어 (UX 개선)
  setInput('')

  // 처리 시작 (이미 처리 중이면 자동으로 대기)
  processQueue()
}
```

#### 3.3.2 큐 처리 로직
```typescript
const processQueue = useCallback(async () => {
  // 이미 처리 중이면 리턴 (중복 실행 방지)
  if (isProcessingQueue) {
    console.log('[Queue] Already processing, skipping')
    return
  }

  // 큐가 비어있으면 리턴
  if (messageQueue.length === 0) {
    console.log('[Queue] Queue is empty')
    setIsProcessingQueue(false)
    setCurrentQueueItem(null)
    return
  }

  // 처리 시작
  setIsProcessingQueue(true)

  // 첫 번째 큐 아이템 가져오기
  const queueItem = messageQueue[0]
  setCurrentQueueItem(queueItem)

  // 상태를 'processing'으로 변경
  setMessageQueue(prev =>
    prev.map((item, idx) =>
      idx === 0 ? { ...item, status: 'processing' } : item
    )
  )

  try {
    // 실제 메시지 전송 (기존 executePrompt 로직 사용)
    await executePromptFromQueue(queueItem)

    // 성공 시 큐에서 제거
    setMessageQueue(prev => {
      const updated = [...prev]
      updated[0] = { ...updated[0], status: 'completed', processedAt: Date.now() }
      // 완료된 아이템은 일정 시간 후 제거 (또는 즉시 제거)
      setTimeout(() => {
        setMessageQueue(queue => queue.filter(item => item.id !== queueItem.id))
      }, 2000)
      return updated
    })

  } catch (error) {
    console.error('[Queue] Failed to process message:', error)

    // 실패 시 상태 업데이트
    setMessageQueue(prev =>
      prev.map((item, idx) =>
        idx === 0 ? { ...item, status: 'failed', error: String(error) } : item
      )
    )
  } finally {
    setIsProcessingQueue(false)
    setCurrentQueueItem(null)

    // 다음 아이템 처리 (재귀적으로 호출)
    // setTimeout을 사용하여 스택 오버플로우 방지
    setTimeout(() => processQueue(), 100)
  }
}, [messageQueue, isProcessingQueue, sessionId])
```

#### 3.3.3 executePromptFromQueue (기존 executePrompt 수정)
```typescript
const executePromptFromQueue = async (queueItem: QueuedMessage) => {
  const { content, attachments, thinkingMode } = queueItem

  // conversationId 확인
  let activeConversationId = conversationId
  if (!activeConversationId) {
    const createResult = await ipcRenderer.invoke('conversation:create', workspace.id)
    if (!createResult.success) throw new Error('Failed to create conversation')
    activeConversationId = createResult.conversation.id
    setConversationId(activeConversationId)
  }

  // User message 생성
  const userMessage: Message = {
    id: `msg-${Date.now()}`,
    conversationId: activeConversationId,
    role: 'user',
    content,
    timestamp: Date.now(),
    metadata: {
      attachments: attachments.map(f => ({
        id: f.id, name: f.name, type: f.type, size: f.size
      })),
      queueItemId: queueItem.id  // 연결 정보 저장
    }
  }

  // UI에 즉시 표시
  setMessages(prev => [...prev, userMessage])

  // DB 저장
  await ipcRenderer.invoke('message:save', userMessage)

  // Pending ref 설정 (응답 핸들러용)
  pendingUserMessageRef.current = userMessage
  currentThinkingModeRef.current = thinkingMode

  // IPC로 메시지 전송 (비동기, 응답은 이벤트로 수신)
  ipcRenderer.send('claude:send-message', sessionId, content, attachments, thinkingMode)

  // Promise가 resolve되는 타이밍: claude:response-complete 이벤트 수신 시
  return new Promise((resolve, reject) => {
    const responseHandler = (_event: any, result: any) => {
      if (result.sessionId === sessionId) {
        ipcRenderer.removeListener('claude:response-complete', responseHandler)
        ipcRenderer.removeListener('claude:response-error', errorHandler)

        if (result.success) {
          // 큐 아이템에 결과 저장
          queueItem.userMessageId = userMessage.id
          queueItem.assistantMessageId = pendingAssistantMessageIdRef.current
          resolve(result)
        } else {
          reject(new Error(result.error))
        }
      }
    }

    const errorHandler = (_event: any, error: any) => {
      if (error.sessionId === sessionId) {
        ipcRenderer.removeListener('claude:response-complete', responseHandler)
        ipcRenderer.removeListener('claude:response-error', errorHandler)
        reject(error)
      }
    }

    ipcRenderer.once('claude:response-complete', responseHandler)
    ipcRenderer.once('claude:response-error', errorHandler)
  })
}
```

#### 3.3.4 큐 관리 함수들
```typescript
// 큐에서 특정 메시지 제거
const removeFromQueue = useCallback((queueId: string) => {
  setMessageQueue(prev => prev.filter(item => item.id !== queueId))
}, [])

// 큐의 메시지 편집
const editQueuedMessage = useCallback((queueId: string, newContent: string) => {
  setMessageQueue(prev =>
    prev.map(item =>
      item.id === queueId
        ? { ...item, content: newContent, preview: newContent.slice(0, 50) + '...' }
        : item
    )
  )
}, [])

// 큐 전체 취소
const clearQueue = useCallback(() => {
  // 현재 처리 중인 아이템은 취소할 수 없음 (진행 중)
  setMessageQueue(prev => prev.filter(item => item.status === 'processing'))

  // 처리 중인 메시지도 취소하려면 별도 로직 필요
  if (currentQueueItem) {
    handleCancel() // 기존 취소 함수 호출
  }
}, [currentQueueItem])

// 큐 재정렬 (drag & drop 지원)
const reorderQueue = useCallback((fromIndex: number, toIndex: number) => {
  setMessageQueue(prev => {
    const updated = [...prev]
    const [removed] = updated.splice(fromIndex, 1)
    updated.splice(toIndex, 0, removed)
    return updated
  })
}, [])
```

### 3.4 UI 컴포넌트 설계

#### 3.4.1 ChatInput 수정
```typescript
// ChatInput.tsx 수정 사항
// ❌ 기존: disabled={disabled}
// ✅ 새로운: disabled={!sessionId || isLoadingConversation}
//           (isSending 조건 제거)

<textarea
  ref={textareaRef}
  value={value}
  onChange={handleTextareaChange}
  onKeyDown={handleKeyDown}
  onPaste={handlePaste}
  placeholder={placeholder}
  disabled={!sessionId || isLoadingConversation}  // isSending 제거
  className="..."
/>

// 전송 버튼도 동일하게 수정
<button
  onClick={handleSend}
  disabled={(!value.trim() && attachedFiles.length === 0) || !sessionId || isLoadingConversation}
  // isSending 조건 제거
>
```

#### 3.4.2 QueueIndicator 컴포넌트 (신규)
```typescript
// circuit/src/components/workspace/QueueIndicator.tsx
interface QueueIndicatorProps {
  queue: QueuedMessage[]
  currentlyProcessing: QueuedMessage | null
  onRemove: (id: string) => void
  onEdit: (id: string, newContent: string) => void
  onClearAll: () => void
}

// UI 디자인:
// ┌────────────────────────────────────────┐
// │ 📤 Processing (1/3)                    │
// │ ┌────────────────────────────────────┐ │
// │ │ ⏳ "Fix the bug in..."          [x] │ │
// │ └────────────────────────────────────┘ │
// │                                        │
// │ 📋 Queue (2 messages)                  │
// │ ┌────────────────────────────────────┐ │
// │ │ 1. "Add new feature..."        [x] │ │
// │ │ 2. "Update documentation..."   [x] │ │
// │ └────────────────────────────────────┘ │
// │                                        │
// │ [Clear All]                            │
// └────────────────────────────────────────┘

export const QueueIndicator: React.FC<QueueIndicatorProps> = ({
  queue,
  currentlyProcessing,
  onRemove,
  onEdit,
  onClearAll
}) => {
  // 처리 중인 아이템과 대기 중인 아이템 분리
  const queuedItems = queue.filter(item => item.status === 'queued')
  const failedItems = queue.filter(item => item.status === 'failed')

  if (!currentlyProcessing && queuedItems.length === 0 && failedItems.length === 0) {
    return null  // 큐가 비어있으면 표시 안 함
  }

  return (
    <div className="queue-indicator">
      {/* 현재 처리 중 */}
      {currentlyProcessing && (
        <div className="processing-item">
          <Loader2 className="animate-spin" />
          <span>{currentlyProcessing.preview}</span>
        </div>
      )}

      {/* 대기 중인 메시지들 */}
      {queuedItems.length > 0 && (
        <div className="queued-items">
          <h4>Queue ({queuedItems.length})</h4>
          {queuedItems.map((item, idx) => (
            <QueueItem
              key={item.id}
              item={item}
              index={idx}
              onRemove={() => onRemove(item.id)}
              onEdit={(content) => onEdit(item.id, content)}
            />
          ))}
        </div>
      )}

      {/* 실패한 메시지들 */}
      {failedItems.length > 0 && (
        <div className="failed-items">
          {failedItems.map(item => (
            <FailedQueueItem
              key={item.id}
              item={item}
              onRetry={() => retryMessage(item.id)}
              onRemove={() => onRemove(item.id)}
            />
          ))}
        </div>
      )}

      {/* 전체 취소 버튼 */}
      {queuedItems.length > 0 && (
        <button onClick={onClearAll}>
          Clear All
        </button>
      )}
    </div>
  )
}
```

#### 3.4.3 QueueIndicator 배치 위치
```
Option 1: ChatInput 위에 floating으로 표시
  ┌────────────────────────────┐
  │ [Queue: 2 messages]   [x]  │ ← 작고 미니멀하게
  ├────────────────────────────┤
  │ Chat Input                 │
  └────────────────────────────┘

Option 2: 우측 사이드바에 Todo Panel과 함께 표시
  ┌─────────┬──────────────┐
  │         │ 📋 Todos     │
  │ Chat    │──────────────│
  │         │ 📤 Queue     │
  │         │  - Item 1    │
  │         │  - Item 2    │
  └─────────┴──────────────┘

Option 3 (추천): ChatInput 바로 위에 inline으로 표시
  ┌────────────────────────────┐
  │ Messages...                │
  │                            │
  ├────────────────────────────┤
  │ Queue: Processing (1/3)    │ ← 확장/축소 가능
  │  ⏳ "Fix bug..."       [x] │
  │  📋 "Add feature..."   [x] │
  ├────────────────────────────┤
  │ [Attach] [Mode]      [Send]│
  │ Type a message...          │
  └────────────────────────────┘
```

### 3.5 엣지 케이스 처리

#### 3.5.1 세션 종료 시
```typescript
// WorkspaceChatEditor.tsx useEffect cleanup
useEffect(() => {
  return () => {
    if (sessionId) {
      // 큐에 남은 메시지들 처리
      if (messageQueue.length > 0) {
        console.warn('[Queue] Session closing with pending messages:', messageQueue.length)

        // Option 1: 큐를 다른 세션으로 이전
        // Option 2: 큐를 로컬 스토리지에 저장
        // Option 3: 사용자에게 경고 표시

        // 임시 저장
        localStorage.setItem(
          `pending-queue-${workspace.id}`,
          JSON.stringify(messageQueue)
        )
      }

      ipcRenderer.invoke('claude:stop-session', sessionId)
    }
  }
}, [sessionId, messageQueue])

// 세션 시작 시 복원
useEffect(() => {
  if (sessionId) {
    // 저장된 큐 복원
    const saved = localStorage.getItem(`pending-queue-${workspace.id}`)
    if (saved) {
      const restored = JSON.parse(saved) as QueuedMessage[]
      setMessageQueue(restored)
      localStorage.removeItem(`pending-queue-${workspace.id}`)

      // 자동으로 처리 시작
      processQueue()
    }
  }
}, [sessionId])
```

#### 3.5.2 네트워크 에러 / API 에러
```typescript
// handleResponseError 수정
const handleResponseError = useCallback(async (_event: any, error: any) => {
  console.error('[WorkspaceChat] Response error:', error)

  // 현재 큐 아이템을 'failed' 상태로 변경
  setMessageQueue(prev =>
    prev.map(item =>
      item.status === 'processing'
        ? { ...item, status: 'failed', error: error.error || error.message }
        : item
    )
  )

  // 처리 플래그 해제
  setIsProcessingQueue(false)
  setCurrentQueueItem(null)

  // 다음 아이템 처리하지 않음 (사용자 개입 필요)
  // 사용자가 재시도 또는 제거할 때까지 대기

}, [])
```

#### 3.5.3 취소 동작
```typescript
// handleCancel 수정
const handleCancel = () => {
  if (!isProcessingQueue || !sessionId) return

  console.log('[ChatPanel] Cancelling current message')
  setIsCancelling(true)

  // 백엔드에 취소 요청
  ipcRenderer.send('claude:cancel-message', sessionId)

  // 현재 큐 아이템을 'cancelled' 상태로 변경
  setMessageQueue(prev =>
    prev.map(item =>
      item.status === 'processing'
        ? { ...item, status: 'cancelled' }
        : item
    )
  )

  // 취소 후 자동으로 다음 아이템 처리
  setTimeout(() => {
    setIsProcessingQueue(false)
    setIsCancelling(false)
    processQueue()  // 다음 아이템 처리
  }, 500)
}
```

#### 3.5.4 대화 전환 시
```typescript
// conversationId 변경 시 큐 처리
useEffect(() => {
  if (prevConversationId.current !== conversationId) {
    // 대화가 전환되면 큐 클리어 (또는 경고 표시)
    if (messageQueue.length > 0) {
      const shouldClear = confirm(
        `You have ${messageQueue.length} message(s) in queue. Clear queue?`
      )

      if (shouldClear) {
        setMessageQueue([])
        setIsProcessingQueue(false)
        setCurrentQueueItem(null)
      }
    }

    prevConversationId.current = conversationId
  }
}, [conversationId, messageQueue])
```

---

## 4. 마이그레이션 단계별 계획

### Phase 1: 기본 큐 시스템 구축 (1-2일)
1. 타입 정의 (`messageQueue.ts`)
2. 상태 추가 (WorkspaceChatEditor.tsx)
3. `handleSend` 수정 (큐에 추가)
4. `processQueue` 구현
5. `executePromptFromQueue` 구현
6. ChatInput `disabled` 조건 수정

### Phase 2: UI 구현 (1-2일)
1. `QueueIndicator` 컴포넌트 생성
2. 큐 아이템 표시 UI
3. 제거/편집 버튼
4. 처리 중 상태 표시 (로딩 스피너)

### Phase 3: 고급 기능 (선택적, 3-4일)
1. 큐 재정렬 (drag & drop)
2. 실패한 메시지 재시도
3. 큐 저장/복원 (세션 간)
4. 스마트 컨텍스트 병합 (여러 메시지를 하나로)

### Phase 4: 테스트 & 최적화 (1-2일)
1. 엣지 케이스 테스트
2. 성능 최적화 (useCallback, useMemo)
3. 에러 핸들링 강화
4. 사용자 피드백 반영

---

## 5. 고려사항 및 트레이드오프

### 5.1 장점
- ✅ **UX 개선**: 사용자가 기다리지 않고 계속 타이핑 가능
- ✅ **생산성 향상**: 여러 작업을 빠르게 큐잉
- ✅ **에러 복구**: 실패한 메시지를 쉽게 재시도
- ✅ **투명성**: 큐 상태를 시각적으로 확인 가능

### 5.2 단점 및 주의사항
- ⚠️ **복잡도 증가**: 상태 관리가 복잡해짐
- ⚠️ **컨텍스트 관리**: 큐의 메시지들이 서로 의존적일 수 있음
- ⚠️ **리소스 사용**: 큐가 너무 길어지면 메모리/API 비용 증가
- ⚠️ **사용자 혼란**: 큐 시스템을 이해하지 못하면 혼란 가능

### 5.3 대안 검토

#### Option A: 단순 버전 (권장)
- 큐에 최대 3개까지만 허용
- 단순한 FIFO 처리
- 편집/재정렬 없음
- **구현 시간: 1-2일**

#### Option B: 중간 버전
- 큐 길이 제한 없음
- 제거/편집 가능
- 실패 시 재시도
- **구현 시간: 3-4일**

#### Option C: 고급 버전 (Claude Code 수준)
- 스마트 컨텍스트 병합
- Drag & drop 재정렬
- 큐 분석 (예: "이 메시지들은 함께 처리하는 게 좋습니다")
- 조건부 실행 (피드백 필요 시 중단)
- **구현 시간: 1-2주**

### 5.4 권장 접근 방식
**"단순 버전으로 시작 → 사용자 피드백 수집 → 점진적 개선"**

---

## 6. 구현 체크리스트

### 백엔드 (Electron Main)
- [ ] 변경 불필요 (현재대로 한 번에 하나씩 처리)
- [ ] 필요 시: 세션별 큐 상태 추적 (선택적)

### 프론트엔드 (React)
- [ ] 타입 정의 파일 생성 (`circuit/src/types/messageQueue.ts`)
- [ ] 상태 추가 (`messageQueue`, `isProcessingQueue`, `currentQueueItem`)
- [ ] `handleSend` 수정 (큐 추가 로직)
- [ ] `processQueue` 구현
- [ ] `executePromptFromQueue` 구현
- [ ] 이벤트 핸들러 수정 (Promise 기반으로)
- [ ] `ChatInput` disabled 조건 수정
- [ ] `QueueIndicator` 컴포넌트 생성
- [ ] 큐 관리 함수들 (remove, edit, clear)
- [ ] 엣지 케이스 처리 (세션 종료, 에러, 취소)

### 테스트
- [ ] 단일 메시지 전송 (기존 동작 유지)
- [ ] 여러 메시지 큐잉
- [ ] 처리 중 취소
- [ ] 에러 발생 시 재시도
- [ ] 세션 전환 시 큐 처리
- [ ] 네트워크 에러 처리
- [ ] 큐에서 메시지 제거
- [ ] 큐 전체 클리어

### 문서화
- [ ] 사용자 가이드 (큐 시스템 사용법)
- [ ] 개발자 문서 (아키텍처 설명)
- [ ] 주석 추가 (복잡한 로직)

---

## 7. 핵심 요약

### 주요 변경 사항
1. **백엔드는 변경 불필요** - 현재대로 한 번에 하나씩 처리
2. **프론트엔드에 큐 로직 추가** - React 상태로 관리
3. **ChatInput 항상 활성화** - `disabled` 조건에서 `isSending` 제거
4. **processQueue 함수로 순차 처리** - 완료되면 자동으로 다음 아이템
5. **QueueIndicator로 시각적 피드백** - 사용자가 큐 상태 확인 가능

### 예상 효과
- 사용자는 처리 중에도 계속 메시지를 입력할 수 있음
- 여러 작업을 빠르게 큐잉하여 생산성 향상
- 에러 발생 시 쉽게 재시도하거나 편집 가능
- 큐 상태를 실시간으로 확인 가능

### 다음 단계
1. Phase 1 (기본 큐 시스템) 구현
2. 기본 동작 테스트
3. 사용자 피드백 수집
4. 필요시 Phase 2-3 (고급 기능) 추가

---

## 참고 자료

### 관련 파일
- `circuit/src/components/workspace/WorkspaceChatEditor.tsx` (메인 로직)
- `circuit/src/components/workspace/ChatInput.tsx` (입력 컴포넌트)
- `circuit/electron/main.cjs` (백엔드 IPC 핸들러)

### 외부 레퍼런스
- Claude Code의 메시지 큐 시스템
- React 비동기 큐 패턴 (ts-async-queue)
- 분산 시스템 메시지 큐 원칙

---

**문서 작성**: 2025-11-03
**최종 수정**: 2025-11-03
**작성자**: AI Analysis
**버전**: 1.0
