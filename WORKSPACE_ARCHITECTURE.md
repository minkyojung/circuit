# Octave Workspace: 워크트리 기반 채팅 + 에디터

## 핵심 컨셉

Octave의 Workspace는 **Git Worktree 기반**으로 각 작업을 독립된 환경에서 진행하며, **채팅 + 코드 에디터**를 통해 Claude와 실시간으로 협업하는 개발 환경입니다.

### 핵심 특징
1. **워크트리 격리**: 각 작업은 독립된 Git worktree와 브랜치
2. **실시간 포커싱**: Claude가 코드를 수정하면 에디터가 자동으로 해당 위치로 이동
3. **멀티 워크스페이스**: 여러 작업을 병렬로 진행
4. **채팅 중심**: 자연어로 요청하고 결과를 확인

---

## 아키텍처

### 디렉토리 구조

```
Main Project: /Users/user/my-app
├─ .git/
├─ src/
├─ package.json
└─ .circuit/
    ├─ workspaces/
    │   ├─ feature-auth/        ← Worktree #1 (branch: feature-auth)
    │   │   ├─ .git             (링크)
    │   │   ├─ src/
    │   │   ├─ package.json
    │   │   └─ .circuit-meta.json
    │   │
    │   ├─ fix-bug-123/         ← Worktree #2 (branch: fix-bug-123)
    │   │   └─ ...
    │   │
    │   └─ docs-update/         ← Worktree #3 (branch: docs-update)
    │       └─ ...
    │
    └─ sessions.json
```

### UI 레이아웃

```
┌──────────────────────────────────────────────────────────────┐
│ Octave                    [feature-auth ▼] [+ New Workspace] │
├────────────────────────┬─────────────────────────────────────┤
│                        │                                     │
│  CHAT                  │  CODE EDITOR                        │
│  (Left 40%)            │  (Right 60%)                        │
│                        │                                     │
│  You: Add login btn    │  📁 src/auth/login.ts             │
│                        │  ┌─────────────────────────────────┐│
│  Claude: I'll add it   │  │ 40  const login = async () => {││
│  to LoginForm.tsx      │  │ 41    // Get credentials       ││
│                        │  │ 42 ▶  const { email, pass } = │││  ← 자동 포커싱!
│  [Editing...]          │  │ 43    await validateInput()   ││
│  • LoginForm.tsx:42    │  │ 44    return auth.login(...)  ││
│                        │  │ 45  }                          ││
│  Claude: Added the     │  └─────────────────────────────────┘│
│  button at line 42.    │                                     │
│                        │  Files Changed:                     │
│  Try it?               │  • src/components/LoginForm.tsx     │
│                        │                                     │
│  You: Yes, test it     │  [Save] [Revert] [Commit]          │
│                        │                                     │
│  [Type message...]     │                                     │
│  [Send]                │                                     │
│                        │                                     │
└────────────────────────┴─────────────────────────────────────┘
│ Status: Editing src/auth/login.ts... | Branch: feature-auth  │
└──────────────────────────────────────────────────────────────┘
```

---

## 핵심 기능

### 1. 워크스페이스 관리

#### 데이터 구조

```typescript
interface Workspace {
  id: string                    // "ws-abc123"
  name: string                  // "feature-auth"
  branch: string                // "feature-auth"
  worktreePath: string          // ".circuit/workspaces/feature-auth"
  claudeSessionId: string       // Claude Code 세션 ID
  createdAt: string
  status: 'active' | 'idle' | 'archived'
}
```

#### Git Worktree 생성

```bash
# 새 워크스페이스 생성
git worktree add .circuit/workspaces/feature-auth -b feature-auth

# 결과: 독립적인 작업 공간
# - 같은 .git 참조
# - 다른 브랜치
# - 완전히 독립된 파일 시스템
```

#### WorkspaceManager API

```typescript
class WorkspaceManager {
  // 워크스페이스 생성
  async createWorkspace(name: string, baseBranch = 'main'): Promise<Workspace>

  // 워크스페이스 삭제
  async deleteWorkspace(workspaceId: string): Promise<void>

  // 워크스페이스 전환
  async switchWorkspace(workspaceId: string): Promise<void>

  // 워크스페이스 목록
  async listWorkspaces(): Promise<Workspace[]>
}
```

---

### 2. 채팅 → 에디터 연동

#### Claude 출력 이벤트

```typescript
type ClaudeOutputEvent =
  | FileEditEvent        // 파일 편집 시작
  | FileSavedEvent       // 파일 저장 완료
  | MessageEvent         // 일반 메시지
  | CommandExecutedEvent // 명령 실행 결과

interface FileEditEvent {
  type: 'file-edit'
  filePath: string       // "src/auth/login.ts"
  lineNumber: number     // 42
  content: string        // 변경될 내용
}

interface FileSavedEvent {
  type: 'file-saved'
  filePath: string
  changes: {
    added: number
    removed: number
  }
}
```

#### 에디터 자동 포커싱

```typescript
class ClaudeOutputHandler {
  handleFileEdit(data: FileEditEvent) {
    const { filePath, lineNumber, content } = data

    // 1. 채팅에 표시
    chatView.addMessage({
      role: 'assistant',
      content: `Editing ${filePath}:${lineNumber}`,
      type: 'file-edit',
      metadata: { filePath, lineNumber }
    })

    // 2. 에디터 포커싱 🎯
    editor.openFile(filePath)
    editor.goToLine(lineNumber)
    editor.highlight(lineNumber, lineNumber + 5)

    // 3. 실시간 변경 표시 (diff)
    editor.showInlineDiff(content)

    // 4. 상태바 업데이트
    statusBar.setText(`Editing ${filePath}...`)
  }
}
```

---

### 3. 멀티 워크스페이스

#### 워크스페이스 스위처

```tsx
const WorkspaceSwitcher = () => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [current, setCurrent] = useState<Workspace | null>(null)

  return (
    <div className="flex items-center gap-2">
      {/* 현재 워크스페이스 */}
      <Select value={current?.id} onChange={switchWorkspace}>
        {workspaces.map(ws => (
          <option key={ws.id} value={ws.id}>
            {ws.status === 'active' ? '🟢' : '⚪'} {ws.name}
          </option>
        ))}
      </Select>

      {/* 새 워크스페이스 */}
      <button onClick={showCreateDialog}>
        + New Workspace
      </button>

      {/* 브랜치 정보 */}
      <span className="text-sm text-gray-400">
        Branch: {current?.branch}
      </span>
    </div>
  )
}
```

---

### 4. 변경사항 추적

#### 변경 파일 패널

```tsx
const ChangedFilesPanel = () => {
  const [files, setFiles] = useState<ChangedFile[]>([])

  return (
    <div className="border-t p-2">
      <h3 className="text-sm font-bold mb-2">Changes</h3>

      {files.map(file => (
        <div
          key={file.path}
          onClick={() => editor.openFile(file.path)}
          className="flex items-center gap-2 p-1 hover:bg-gray-800 cursor-pointer"
        >
          <File size={14} />
          <span className="flex-1 text-sm">{file.path}</span>
          <span className="text-xs text-green-400">+{file.added}</span>
          <span className="text-xs text-red-400">-{file.removed}</span>
        </div>
      ))}

      {files.length > 0 && (
        <div className="mt-2 flex gap-2">
          <button onClick={commitChanges} className="text-sm">
            Commit
          </button>
          <button onClick={revertAll} className="text-sm text-red-400">
            Revert All
          </button>
        </div>
      )}
    </div>
  )
}
```

---

### 5. Git 통합

#### 자동 커밋 & PR 생성

```typescript
class GitIntegration {
  async commitChanges(workspaceId: string, message: string) {
    const workspace = await workspaceManager.getWorkspace(workspaceId)

    // 해당 워크트리에서 커밋
    await execAsync(`git -C ${workspace.worktreePath} add .`)
    await execAsync(`git -C ${workspace.worktreePath} commit -m "${message}"`)

    // 채팅에 알림
    chatView.addMessage({
      role: 'system',
      content: `✓ Committed changes to ${workspace.branch}`
    })
  }

  async createPR(workspaceId: string) {
    const workspace = await workspaceManager.getWorkspace(workspaceId)

    // 푸시
    await execAsync(`git -C ${workspace.worktreePath} push origin ${workspace.branch}`)

    // GitHub PR 생성 (GitHub MCP 사용)
    const pr = await mcpClient.callTool('create_pull_request', {
      head: workspace.branch,
      base: 'main',
      title: `feat: ${workspace.name}`,
      body: '...'
    })

    // 채팅에 링크 표시
    chatView.addMessage({
      role: 'system',
      content: `✓ PR created: ${pr.url}`
    })
  }
}
```

---

## 전체 사용 흐름

### 시나리오: "로그인 기능 추가"

```
1. 사용자: "New Workspace" 클릭
   → Name: "feature-auth"
   → Base: "main"

2. Octave:
   ✓ Git worktree 생성
   ✓ 브랜치 "feature-auth" 생성
   ✓ Claude 세션 시작
   ✓ 에디터를 워크트리로 전환

3. 사용자 (채팅): "Add a login button to LoginForm"

4. Claude:
   "I'll add a login button. Let me edit LoginForm.tsx..."

5. Octave:
   ✓ 채팅에 "Editing src/components/LoginForm.tsx:42" 표시
   ✓ 에디터가 자동으로 LoginForm.tsx 열기
   ✓ 42번 라인으로 스크롤
   ✓ 해당 라인 하이라이트
   ✓ 실시간 변경사항 표시 (diff)

6. Claude:
   "✓ Added login button at line 42"

7. 사용자:
   - 에디터에서 직접 미세 조정 가능
   - "Commit" 버튼 클릭

8. Octave:
   ✓ git commit -m "feat: add login button"
   ✓ 채팅에 커밋 확인 메시지

9. 사용자: "Create PR"

10. Octave:
    ✓ git push origin feature-auth
    ✓ GitHub PR 생성 (MCP 사용)
    ✓ PR 링크 표시
```

---

## 기술 스택

| 컴포넌트 | 기술 |
|---------|------|
| **UI Framework** | React + Tailwind CSS |
| **Code Editor** | Monaco Editor (VSCode engine) |
| **Git Management** | `git worktree` + `simple-git` |
| **AI Backend** | Claude Code CLI wrapper |
| **IPC** | Electron IPC |
| **State Management** | React Context / Zustand |

---

## 구현 우선순위 & 작업량

### Phase 1: MVP (Day 1-2, 8-12h)

**P0 - 필수 기능**
- [x] 워크스페이스 관리 기본 (단일) - 4h
- [x] 채팅 UI - 2h
- [x] Monaco 에디터 통합 - 3h
- [x] Claude 세션 연결 - 3h

**결과**: 채팅 + 에디터가 연동된 단일 워크스페이스

### Phase 2: 에디터 연동 (Day 3, 6-8h)

**P0 - 필수 기능**
- [ ] Claude 출력 파싱 - 3h
- [ ] 에디터 자동 포커싱 - 2h
- [ ] 실시간 diff 표시 - 2h

**결과**: Claude가 코드를 수정하면 에디터가 자동으로 따라가는 기능

### Phase 3: 워크트리 (Day 4, 6-8h)

**P1 - 중요 기능**
- [ ] Git worktree 관리 - 4h
- [ ] 멀티 워크스페이스 전환 - 2h
- [ ] 워크스페이스 생성/삭제 UI - 2h

**결과**: 여러 작업을 병렬로 진행 가능

### Phase 4: Git 통합 (Day 5, 4-6h)

**P1 - 중요 기능**
- [ ] 변경 파일 추적 패널 - 2h
- [ ] Commit 기능 - 2h
- [ ] PR 생성 (GitHub MCP) - 2h

**결과**: 작업 완료 후 커밋/PR까지 자동화

### Phase 5: 폴리싱 (Day 6, 4-6h)

**P2 - 개선 사항**
- [ ] UI/UX 개선 - 2h
- [ ] 에러 핸들링 - 1h
- [ ] 성능 최적화 - 1h
- [ ] 문서화 - 1h

**총 예상: 28-40시간 (4-6일)**

---

## 핵심 차별화 포인트

### vs Devin

| Feature | Devin | Octave Workspace |
|---------|-------|-------------------|
| **배포** | 브라우저 (Cloud) | Electron (Local) |
| **격리** | VM | Git Worktree |
| **AI** | 자체 엔진 | Claude Code |
| **속도** | 느림 | 빠름 |
| **비용** | $500/월 | 오픈소스 |
| **확장성** | 제한적 | MCP 무한 확장 |
| **터미널** | 별도 패널 | 채팅에 통합 |
| **에디터** | 읽기 전용 | 직접 편집 가능 |

### 핵심 장점

1. **로컬 실행**: 빠르고 안전함
2. **워크트리 격리**: 각 작업이 완전히 독립적
3. **실시간 포커싱**: 에디터가 Claude를 따라감
4. **채팅 중심**: 간단한 UX
5. **MCP 네이티브**: 무한한 확장 가능성

---

## 다음 단계

1. [ ] WorkspaceTab 컴포넌트 생성
2. [ ] Git worktree 관리 로직 구현
3. [ ] Monaco 에디터 통합
4. [ ] Claude 세션 관리
5. [ ] 출력 파싱 & 포커싱 로직
6. [ ] 멀티 워크스페이스 UI

---

## 참고 자료

- [Git Worktree Documentation](https://git-scm.com/docs/git-worktree)
- [Monaco Editor API](https://microsoft.github.io/monaco-editor/)
- [Claude Code CLI](https://docs.claude.com/claude-code)
- [Devin Analysis](./DEVIN_ANALYSIS.md)
