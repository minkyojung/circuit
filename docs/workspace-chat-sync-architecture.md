# 워크스페이스-채팅 동기화 아키텍처 설계

## 📋 목차
1. [현재 상황 분석](#현재-상황-분석)
2. [문제점 정의](#문제점-정의)
3. [제품 요구사항](#제품-요구사항)
4. [구조적 설계](#구조적-설계)
5. [구현 계획](#구현-계획)
6. [마이그레이션 전략](#마이그레이션-전략)

---

## 현재 상황 분석

### 워크스페이스 관리 방식

**저장 위치**: Git Worktrees (파일 시스템)
- 경로: `.conductor/{workspace-name}/`
- 관리: Electron Main Process (`electron/main.cjs`)
- 데이터 구조:
  ```typescript
  interface Workspace {
    id: string;              // UUID (불변)
    repositoryId: string;    // 상위 저장소
    displayName: string;     // 사용자 표시 이름
    branch: string;          // Git 브랜치명
    path: string;            // 절대 경로
    createdAt: string;       // 생성 시간
    updatedAt: string;       // 수정 시간
    isActive: boolean;
  }
  ```

**IPC 핸들러**:
- `workspace:create` - Git worktree + 브랜치 생성
- `workspace:list` - Git 메타데이터에서 worktree 목록 읽기
- `workspace:delete` - Worktree 삭제
- `workspace:get-status` - Git 상태 조회

### 채팅 내역 관리 방식

**저장 위치**: React 메모리 (휘발성)
- 파일: `WorkspaceChatEditor.tsx:168`
- 구현:
  ```typescript
  const [messages, setMessages] = useState<Message[]>([]);
  ```

**메시지 구조**:
```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}
```

**현재 라이프사이클**:
- 앱 종료 시: 사라짐 ❌
- 워크스페이스 전환 시: 사라짐 ❌
- 컴포넌트 리렌더링 시: 사라짐 ❌

### 기존 저장소 인프라

#### ✅ 이미 구현된 저장소

**1. Repository Configuration**
- 파일: `~/.config/Electron/Octave/repositories.json`
- 핸들러: `electron/repositoryHandlers.ts`
- 저장소 목록 관리

**2. MCP Call History**
- 파일: `~/.config/Electron/Octave/circuit-data/history.db` (SQLite)
- 구현: `electron/historyStorage.ts`
- MCP 도구 호출 이력 저장
- **채팅 메시지 저장 안 함** ⚠️

**3. Context Metrics (실시간 전용)**
- 구현: `electron/workspace-context-tracker.ts`
- Claude 세션의 컨텍스트 사용량 추적
- 영구 저장 안 함

---

## 문제점 정의

### 1️⃣ 채팅 내역 휘발성 문제
```
사용자 시나리오:
1. 워크스페이스 A에서 Claude와 10회 대화
2. 앱 종료
3. 앱 재실행
4. 결과: 대화 내역 모두 사라짐 ❌
```

### 2️⃣ 워크스페이스-채팅 비연동 문제
```
사용자 시나리오:
1. 워크스페이스 A에서 대화 중
2. 워크스페이스 B로 전환
3. 결과: A의 대화가 사라지고 복구 불가능 ❌
4. 워크스페이스 A로 재전환
5. 결과: 이전 대화 내역 없음 ❌
```

### 3️⃣ 세션 개념 부재
- Claude 세션 ID는 시작/종료만 추적
- 대화 히스토리와 세션의 연결 없음
- 여러 대화 스레드 관리 불가능

### 4️⃣ 데이터 레이어 분리 문제

**현재 구조**:
```
Workspace (파일 시스템)  ⚡ Chat (메모리)
        ↓                      ↓
   Git Worktree         React State
```
→ 두 시스템이 완전히 분리되어 있음

**필요한 구조**:
```
Workspace ←→ Database ←→ Chat
    ↓           ↓           ↓
Git Worktree  SQLite   React State
```

---

## 제품 요구사항

### 핵심 사용자 시나리오

**시나리오 1: 대화 지속성**
```
✅ 워크스페이스 A에서 Claude와 대화
✅ 앱 종료
✅ 앱 재실행 → 워크스페이스 A 선택
✅ 이전 대화 내역이 그대로 복원됨
```

**시나리오 2: 워크스페이스 격리**
```
✅ 워크스페이스 A: "로그인 기능 구현" 대화
✅ 워크스페이스 B: "결제 시스템 버그 수정" 대화
✅ A ↔ B 전환 시 각각의 대화가 독립적으로 유지
```

**시나리오 3: 다중 세션 지원** (선택사항)
```
✅ 워크스페이스 A에서 여러 주제의 대화를 별도 세션으로 관리
   - 세션 1: "로그인 기능 구현"
   - 세션 2: "UI 리팩토링"
   - 세션 3: "성능 최적화"
```

### 기능 요구사항

| 기능 | 우선순위 | 설명 |
|------|---------|------|
| 채팅 내역 영구 저장 | 🔴 필수 | SQLite DB에 메시지 저장 |
| 워크스페이스별 대화 격리 | 🔴 필수 | workspace_id로 바인딩 |
| 앱 재시작 시 복원 | 🔴 필수 | 마지막 활성 대화 자동 로드 |
| 워크스페이스 전환 시 자동 로드 | 🔴 필수 | 전환 시 해당 대화 불러오기 |
| 다중 세션 지원 | 🟡 선택 | 워크스페이스당 여러 대화 |
| 대화 제목 관리 | 🟡 선택 | 자동 생성 또는 수동 설정 |
| 대화 검색 | 🟢 나중 | 메시지 내용 검색 |
| 대화 내보내기 | 🟢 나중 | Markdown 등으로 내보내기 |

---

## 구조적 설계

### 데이터 모델

#### 1. Conversations (대화 세션)

```sql
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,              -- UUID
  workspace_id TEXT NOT NULL,       -- 워크스페이스 ID
  title TEXT,                       -- 대화 제목
  created_at TEXT NOT NULL,         -- ISO 타임스탬프
  updated_at TEXT NOT NULL,         -- 마지막 업데이트 시간
  is_active BOOLEAN DEFAULT 1,      -- 현재 활성 대화
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX idx_conversations_workspace
  ON conversations(workspace_id, updated_at DESC);
```

**TypeScript 타입**:
```typescript
interface Conversation {
  id: string;
  workspaceId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}
```

#### 2. Messages (메시지)

```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,              -- UUID
  conversation_id TEXT NOT NULL,    -- 대화 ID
  role TEXT NOT NULL,               -- 'user' | 'assistant'
  content TEXT NOT NULL,            -- 메시지 내용
  timestamp INTEGER NOT NULL,       -- Unix timestamp
  metadata TEXT,                    -- JSON (파일, 도구, 토큰)
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE INDEX idx_messages_conversation
  ON messages(conversation_id, timestamp);
```

**TypeScript 타입**:
```typescript
interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  metadata?: {
    files?: string[];        // 참조된 파일 경로
    toolCalls?: string[];    // MCP 도구 호출
    tokens?: number;         // 사용 토큰
  };
}
```

#### 3. Workspace Metadata (워크스페이스 메타데이터)

```sql
CREATE TABLE workspace_metadata (
  workspace_id TEXT PRIMARY KEY,
  last_active_conversation_id TEXT,  -- 마지막 활성 대화
  settings TEXT,                     -- JSON (UI 설정)
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);
```

**TypeScript 타입**:
```typescript
interface WorkspaceMetadata {
  workspaceId: string;
  lastActiveConversationId: string | null;
  settings?: Record<string, any>;
}
```

### 저장소 레이어 아키텍처

```
circuit/electron/
├─ databases/
│  └─ conversations.db              # SQLite 데이터베이스
├─ storage/
│  ├─ conversationStorage.ts        # 대화 CRUD
│  ├─ messageStorage.ts             # 메시지 CRUD
│  └─ workspaceMetadataStorage.ts   # 메타데이터 CRUD
└─ handlers/
   └─ conversationHandlers.ts       # IPC 핸들러
```

#### ConversationStorage API

```typescript
class ConversationStorage {
  /**
   * 워크스페이스의 모든 대화 조회
   */
  async getByWorkspaceId(workspaceId: string): Promise<Conversation[]>

  /**
   * 활성 대화 조회 (가장 최근 대화)
   */
  async getActiveConversation(workspaceId: string): Promise<Conversation | null>

  /**
   * 새 대화 생성
   */
  async create(workspaceId: string, title?: string): Promise<Conversation>

  /**
   * 대화 삭제
   */
  async delete(conversationId: string): Promise<void>

  /**
   * 대화 제목 수정
   */
  async updateTitle(conversationId: string, title: string): Promise<void>

  /**
   * 대화 업데이트 시간 갱신
   */
  async touch(conversationId: string): Promise<void>
}
```

#### MessageStorage API

```typescript
class MessageStorage {
  /**
   * 대화의 모든 메시지 조회 (시간순)
   */
  async getByConversationId(
    conversationId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<Message[]>

  /**
   * 메시지 저장 (단일)
   */
  async save(message: Message): Promise<void>

  /**
   * 메시지 일괄 저장 (트랜잭션)
   */
  async saveBatch(messages: Message[]): Promise<void>

  /**
   * 메시지 삭제
   */
  async delete(messageId: string): Promise<void>

  /**
   * 대화의 메시지 개수 조회
   */
  async countByConversation(conversationId: string): Promise<number>
}
```

### IPC 통신 설계

#### Electron Main → Renderer 핸들러

```typescript
// conversationHandlers.ts

// 대화 목록 조회
ipcMain.handle('conversation:list',
  async (_event, workspaceId: string) => {
    try {
      const conversations = await conversationStorage.getByWorkspaceId(workspaceId);
      return { success: true, conversations };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
);

// 활성 대화 조회
ipcMain.handle('conversation:get-active',
  async (_event, workspaceId: string) => {
    try {
      const conversation = await conversationStorage.getActiveConversation(workspaceId);
      return { success: true, conversation };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
);

// 새 대화 생성
ipcMain.handle('conversation:create',
  async (_event, workspaceId: string, title?: string) => {
    try {
      const conversation = await conversationStorage.create(workspaceId, title);
      return { success: true, conversation };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
);

// 대화 제목 수정
ipcMain.handle('conversation:update-title',
  async (_event, conversationId: string, title: string) => {
    try {
      await conversationStorage.updateTitle(conversationId, title);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
);

// 대화 삭제
ipcMain.handle('conversation:delete',
  async (_event, conversationId: string) => {
    try {
      await conversationStorage.delete(conversationId);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
);

// 메시지 로드
ipcMain.handle('message:load',
  async (_event, conversationId: string) => {
    try {
      const messages = await messageStorage.getByConversationId(conversationId);
      return { success: true, messages };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
);

// 메시지 저장
ipcMain.handle('message:save',
  async (_event, message: Message) => {
    try {
      await messageStorage.save(message);
      // 대화의 updated_at 갱신
      await conversationStorage.touch(message.conversationId);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
);

// 메시지 일괄 저장
ipcMain.handle('message:save-batch',
  async (_event, messages: Message[]) => {
    try {
      await messageStorage.saveBatch(messages);
      if (messages.length > 0) {
        await conversationStorage.touch(messages[0].conversationId);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
);
```

### React 상태 관리 재구성

#### 현재 구조 (문제)

```typescript
// WorkspaceChatEditor.tsx
const [messages, setMessages] = useState<Message[]>([]); // 휘발성 ❌
```

#### 새로운 구조 (해결)

```typescript
// WorkspaceChatEditor.tsx
const [conversationId, setConversationId] = useState<string | null>(null);
const [messages, setMessages] = useState<Message[]>([]);
const [isLoading, setIsLoading] = useState(true);

// 워크스페이스 변경 시 대화 로드
useEffect(() => {
  const loadConversation = async () => {
    setIsLoading(true);

    // 1. 활성 대화 조회
    let result = await ipcRenderer.invoke(
      'conversation:get-active',
      workspace.id
    );

    let conversation = result.conversation;

    // 2. 없으면 새로 생성
    if (!conversation) {
      const createResult = await ipcRenderer.invoke(
        'conversation:create',
        workspace.id,
        'New Conversation' // 기본 제목
      );
      conversation = createResult.conversation;
    }

    // 3. 메시지 로드
    const messageResult = await ipcRenderer.invoke(
      'message:load',
      conversation.id
    );

    setConversationId(conversation.id);
    setMessages(messageResult.messages || []);
    setIsLoading(false);
  };

  loadConversation();
}, [workspace.id]);

// 메시지 전송 (낙관적 업데이트)
const sendMessage = async (content: string) => {
  const userMessage: Message = {
    id: uuidv4(),
    conversationId: conversationId!,
    role: 'user',
    content,
    timestamp: Date.now(),
  };

  // 1. UI 즉시 업데이트 (낙관적)
  setMessages(prev => [...prev, userMessage]);

  // 2. DB 저장 (비동기, 백그라운드)
  ipcRenderer.invoke('message:save', userMessage).catch(err => {
    console.error('Failed to save user message:', err);
  });

  // 3. Claude에게 전송
  try {
    const response = await sendToClaude(content);

    // 4. 응답 저장
    const assistantMessage: Message = {
      id: uuidv4(),
      conversationId: conversationId!,
      role: 'assistant',
      content: response,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, assistantMessage]);
    await ipcRenderer.invoke('message:save', assistantMessage);
  } catch (error) {
    console.error('Failed to send message:', error);
    // 에러 처리 (재시도 로직 등)
  }
};
```

### 데이터 흐름 다이어그램

```
┌─────────────────────────────────────────────────────────────┐
│                        User Interface                        │
│                   (WorkspaceChatEditor.tsx)                  │
└─────────────────────────────────────────────────────────────┘
                              ↓ ↑
                         IPC 통신
                              ↓ ↑
┌─────────────────────────────────────────────────────────────┐
│                   Electron Main Process                      │
│                                                               │
│  ┌────────────────────────────────────────────────────┐    │
│  │           conversationHandlers.ts                  │    │
│  │  - conversation:list                               │    │
│  │  - conversation:get-active                         │    │
│  │  - conversation:create                             │    │
│  │  - message:load                                    │    │
│  │  - message:save                                    │    │
│  └────────────────────────────────────────────────────┘    │
│                           ↓ ↑                                │
│  ┌───────────────────┐   ┌──────────────────┐              │
│  │ Conversation      │   │ Message          │              │
│  │ Storage           │   │ Storage          │              │
│  │ - getByWorkspace  │   │ - getByConv      │              │
│  │ - getActive       │   │ - save           │              │
│  │ - create          │   │ - saveBatch      │              │
│  │ - delete          │   │ - delete         │              │
│  │ - updateTitle     │   │ - count          │              │
│  └───────────────────┘   └──────────────────┘              │
│                           ↓ ↑                                │
│  ┌────────────────────────────────────────────────────┐    │
│  │               conversations.db (SQLite)            │    │
│  │  - conversations table                             │    │
│  │  - messages table                                  │    │
│  │  - workspace_metadata table                        │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 오류 처리 전략

#### 1. DB 저장 실패
```typescript
// 재시도 로직
async function saveMessageWithRetry(message: Message, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await ipcRenderer.invoke('message:save', message);
      return { success: true };
    } catch (error) {
      if (i === maxRetries - 1) {
        console.error('Failed to save message after retries:', error);
        // 사용자에게 알림 또는 로컬 캐시에 저장
        return { success: false, error };
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}
```

#### 2. 대화 로드 실패
```typescript
// 폴백: 빈 대화 생성
const loadConversation = async () => {
  try {
    // ... 정상 로드 로직
  } catch (error) {
    console.error('Failed to load conversation:', error);
    // 폴백: 새 대화 생성
    const conversation = await createNewConversation(workspace.id);
    setConversationId(conversation.id);
    setMessages([]);
  }
};
```

#### 3. 데이터 정합성 보장
```typescript
// 트랜잭션 사용
async saveBatch(messages: Message[]): Promise<void> {
  const db = await this.getDatabase();

  await db.run('BEGIN TRANSACTION');
  try {
    for (const message of messages) {
      await db.run(
        'INSERT INTO messages (id, conversation_id, role, content, timestamp, metadata) VALUES (?, ?, ?, ?, ?, ?)',
        [message.id, message.conversationId, message.role, message.content, message.timestamp, JSON.stringify(message.metadata)]
      );
    }
    await db.run('COMMIT');
  } catch (error) {
    await db.run('ROLLBACK');
    throw error;
  }
}
```

---

## 구현 계획

### Phase 1: 기본 저장/복원 (필수) 🔴

**목표**: 앱 종료 후에도 대화가 보존되고, 워크스페이스 전환 시 자동 로드

#### Step 1.1: 데이터베이스 스키마 생성
- [ ] `conversations.db` SQLite 파일 생성
- [ ] `conversations` 테이블 생성
- [ ] `messages` 테이블 생성
- [ ] `workspace_metadata` 테이블 생성
- [ ] 인덱스 생성

**예상 시간**: 2시간

#### Step 1.2: Storage 클래스 구현
- [ ] `conversationStorage.ts` 작성
  - `getByWorkspaceId()`
  - `getActiveConversation()`
  - `create()`
  - `delete()`
  - `updateTitle()`
  - `touch()`
- [ ] `messageStorage.ts` 작성
  - `getByConversationId()`
  - `save()`
  - `saveBatch()`
  - `delete()`
  - `countByConversation()`
- [ ] `workspaceMetadataStorage.ts` 작성
  - `get()`
  - `set()`
  - `updateLastActive()`

**예상 시간**: 6시간

#### Step 1.3: IPC 핸들러 추가
- [ ] `conversationHandlers.ts` 작성
- [ ] 모든 IPC 핸들러 구현
- [ ] `electron/main.cjs`에 핸들러 등록

**예상 시간**: 3시간

#### Step 1.4: React 컴포넌트 통합
- [ ] `WorkspaceChatEditor.tsx` 수정
  - 대화 로드 로직 추가
  - 메시지 저장 로직 추가
  - 워크스페이스 전환 시 대화 전환
- [ ] 로딩 상태 UI 추가
- [ ] 에러 처리 추가

**예상 시간**: 4시간

#### Step 1.5: 테스트 및 디버깅
- [ ] 단위 테스트 작성
- [ ] 통합 테스트
- [ ] 앱 재시작 테스트
- [ ] 워크스페이스 전환 테스트

**예상 시간**: 3시간

**Phase 1 총 예상 시간**: 18시간 (~2-3일)

---

### Phase 2: 다중 대화 지원 (선택) 🟡

**목표**: 워크스페이스당 여러 대화 스레드 관리

#### Step 2.1: 대화 목록 UI 추가
- [ ] 사이드바에 "Conversations" 섹션 추가
- [ ] 대화 목록 렌더링
- [ ] 활성 대화 표시

**예상 시간**: 3시간

#### Step 2.2: 대화 전환 기능
- [ ] 대화 클릭 시 전환 로직
- [ ] 메시지 자동 로드
- [ ] 활성 상태 동기화

**예상 시간**: 2시간

#### Step 2.3: 새 대화 생성
- [ ] "New Chat" 버튼 추가
- [ ] 빈 대화 생성 로직
- [ ] 자동 제목 생성 (첫 메시지 기반)

**예상 시간**: 2시간

#### Step 2.4: 대화 관리 기능
- [ ] 대화 제목 수동 편집
- [ ] 대화 삭제 (확인 다이얼로그)
- [ ] 대화 정렬 (최신순)

**예상 시간**: 3시간

**Phase 2 총 예상 시간**: 10시간 (~1-2일)

---

### Phase 3: 고급 기능 (나중에) 🟢

#### 대화 검색
- [ ] 전체 메시지 검색 기능
- [ ] 검색 결과 하이라이팅
- [ ] 대화 필터링

**예상 시간**: 4시간

#### 메시지 북마크
- [ ] 중요한 메시지 표시
- [ ] 북마크 목록 UI
- [ ] 북마크로 빠른 이동

**예상 시간**: 3시간

#### 대화 내보내기
- [ ] Markdown 포맷으로 내보내기
- [ ] PDF 생성 (선택)
- [ ] 코드 블록 포맷팅 유지

**예상 시간**: 4시간

#### 메시지 편집/재생성
- [ ] 이전 메시지 편집
- [ ] 특정 지점부터 대화 재생성
- [ ] 브랜치 대화 생성

**예상 시간**: 6시간

**Phase 3 총 예상 시간**: 17시간 (~2-3일)

---

## 마이그레이션 전략

### 기존 사용자 처리

#### 상황
- 현재 사용자는 저장된 대화가 없음 (메모리 전용)
- DB 스키마만 생성하고 빈 상태로 시작

#### 초기 실행 시
1. `conversations.db` 파일 확인
2. 없으면 자동 생성 및 스키마 초기화
3. 각 워크스페이스 첫 선택 시 자동으로 첫 대화 생성

```typescript
// Migration logic
async function initializeDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'circuit-data', 'conversations.db');
  const dbExists = await fs.pathExists(dbPath);

  if (!dbExists) {
    console.log('[Migration] Creating conversations database...');
    await createDatabase(dbPath);
    await runMigrations(dbPath);
  }
}
```

### 데이터베이스 위치

```
~/.config/Electron/Octave/circuit-data/
├─ history.db           (기존 MCP 히스토리)
└─ conversations.db     (신규 대화 히스토리)
```

### 스키마 버전 관리

```sql
CREATE TABLE schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

INSERT INTO schema_version (version, applied_at)
VALUES (1, datetime('now'));
```

**향후 마이그레이션 예시**:
```typescript
const migrations = [
  {
    version: 1,
    up: async (db) => {
      // 초기 스키마
      await db.exec(`CREATE TABLE conversations (...)`);
      await db.exec(`CREATE TABLE messages (...)`);
    }
  },
  {
    version: 2,
    up: async (db) => {
      // 메타데이터 컬럼 추가
      await db.exec(`ALTER TABLE messages ADD COLUMN metadata TEXT`);
    }
  }
];
```

---

## 기술적 고려사항

### 성능 최적화

#### 1. 메시지 페이지네이션
```typescript
// 대화가 길어질 경우 페이지별 로드
async getByConversationId(
  conversationId: string,
  options: { limit: number; offset: number } = { limit: 50, offset: 0 }
): Promise<Message[]>
```

#### 2. 인덱스 최적화
```sql
-- 자주 사용되는 쿼리 패턴에 인덱스 추가
CREATE INDEX idx_messages_conversation_timestamp
  ON messages(conversation_id, timestamp DESC);

CREATE INDEX idx_conversations_workspace_updated
  ON conversations(workspace_id, updated_at DESC);
```

#### 3. 대용량 메시지 처리
```typescript
// 매우 긴 메시지는 압축 저장
import zlib from 'zlib';

async save(message: Message): Promise<void> {
  let content = message.content;

  // 10KB 이상 메시지는 압축
  if (content.length > 10240) {
    content = zlib.gzipSync(content).toString('base64');
    message.metadata = { ...message.metadata, compressed: true };
  }

  // DB 저장
  await this.insertMessage(message);
}
```

### 데이터 정합성

#### 1. Foreign Key 제약조건
```typescript
// SQLite에서 Foreign Key 활성화
await db.run('PRAGMA foreign_keys = ON');
```

#### 2. 트랜잭션 사용
```typescript
// 여러 메시지 저장 시 트랜잭션으로 원자성 보장
async saveBatch(messages: Message[]): Promise<void> {
  await this.db.run('BEGIN TRANSACTION');
  try {
    for (const message of messages) {
      await this.insertMessage(message);
    }
    await this.db.run('COMMIT');
  } catch (error) {
    await this.db.run('ROLLBACK');
    throw error;
  }
}
```

#### 3. 워크스페이스 삭제 시 CASCADE
```sql
-- 워크스페이스 삭제 시 관련 대화도 자동 삭제
FOREIGN KEY (workspace_id)
  REFERENCES workspaces(id)
  ON DELETE CASCADE
```

### 보안

#### 1. SQL Injection 방지
```typescript
// Prepared Statements 사용
await db.run(
  'INSERT INTO messages (id, content) VALUES (?, ?)',
  [message.id, message.content]  // 파라미터 바인딩
);
```

#### 2. 민감 정보 처리
```typescript
// API 키, 비밀번호 등은 메시지에서 제거
function sanitizeMessage(content: string): string {
  return content.replace(/api[_-]?key\s*[:=]\s*[a-zA-Z0-9]+/gi, 'API_KEY_REDACTED');
}
```

---

## 참고 자료

### 관련 파일

**현재 구현**:
- `circuit/src/App.tsx` - 앱 메인 레이아웃
- `circuit/src/components/workspace/WorkspaceChatEditor.tsx` - 채팅 UI
- `circuit/electron/main.cjs` - Electron 메인 프로세스
- `circuit/electron/historyStorage.ts` - 기존 히스토리 저장소 (참고용)
- `circuit/electron/workspace-context-tracker.ts` - 컨텍스트 추적기
- `circuit/src/types/workspace.ts` - 워크스페이스 타입

**새로 생성할 파일**:
- `circuit/electron/storage/conversationStorage.ts`
- `circuit/electron/storage/messageStorage.ts`
- `circuit/electron/storage/workspaceMetadataStorage.ts`
- `circuit/electron/handlers/conversationHandlers.ts`
- `circuit/electron/databases/conversations.db`
- `circuit/src/types/conversation.ts`

### 기술 스택

- **Database**: SQLite3
- **IPC**: Electron IPC (Main ↔ Renderer)
- **State Management**: React Hooks (useState, useEffect)
- **UUID**: `uuid` 패키지
- **TypeScript**: 타입 안정성

---

## 체크리스트

### Phase 1 구현 체크리스트

- [ ] 데이터베이스 스키마 설계 완료
- [ ] `ConversationStorage` 클래스 구현
- [ ] `MessageStorage` 클래스 구현
- [ ] IPC 핸들러 추가
- [ ] `WorkspaceChatEditor` 통합
- [ ] 대화 로드 로직 구현
- [ ] 메시지 저장 로직 구현
- [ ] 워크스페이스 전환 시 대화 전환 구현
- [ ] 에러 처리 추가
- [ ] 단위 테스트 작성
- [ ] 통합 테스트 수행
- [ ] 앱 재시작 테스트 통과
- [ ] 워크스페이스 전환 테스트 통과
- [ ] 문서 업데이트

---

## 연락처

문제 발생 시: [humans@conductor.build](mailto:humans@conductor.build)

---

**문서 버전**: 1.0
**작성일**: 2025-10-28
**작성자**: Claude (Sonnet 4.5)
**상태**: ✅ 설계 완료, 구현 대기 중
