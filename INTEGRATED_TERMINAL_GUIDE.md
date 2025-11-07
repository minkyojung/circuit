# 통합 터미널 완벽 가이드

## 개요

Circuit에는 **이미 완전한 통합 터미널이 구현되어 있습니다!**

xterm.js + node-pty를 사용한 인터랙티브 쉘 환경으로, VSCode 터미널과 동일한 기능을 제공합니다.

---

## 현재 구조 (이미 구현됨)

### 아키텍처

```
┌─────────────────────────────────────────────────────┐
│                  Frontend (React)                   │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │         TerminalContext (Provider)           │  │
│  │  - 터미널 인스턴스 관리                       │  │
│  │  - 워크스페이스별 세션 관리                   │  │
│  │  - IPC 이벤트 리스닝                         │  │
│  └──────────────────────────────────────────────┘  │
│                       │                            │
│  ┌──────────────────────────────────────────────┐  │
│  │         ClassicTerminal Component            │  │
│  │  - xterm.js 렌더링                          │  │
│  │  - FitAddon으로 크기 자동 조정               │  │
│  │  - WebLinksAddon으로 링크 클릭              │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                       │
                  IPC Channel
                       │
┌─────────────────────────────────────────────────────┐
│              Backend (Electron Main)                │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │            Terminal IPC Handlers             │  │
│  │  - terminal:create-session                   │  │
│  │  - terminal:write                            │  │
│  │  - terminal:destroy-session                  │  │
│  └──────────────────────────────────────────────┘  │
│                       │                            │
│  ┌──────────────────────────────────────────────┐  │
│  │           node-pty (PTY Sessions)            │  │
│  │  - 실제 쉘 프로세스 실행 (bash, zsh 등)       │  │
│  │  - stdin/stdout/stderr 처리                  │  │
│  │  - 프로세스 라이프사이클 관리                 │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## 핵심 컴포넌트 설명

### 1. TerminalContext (상태 관리)

**위치**: `circuit/src/contexts/TerminalContext.tsx`

**역할**: 터미널의 전역 상태 관리

```tsx
// 제공하는 기능들
interface TerminalContextValue {
  // 터미널 인스턴스 가져오기/생성
  getOrCreateTerminal(workspaceId, workspacePath)

  // PTY 세션 생성 (쉘 프로세스 시작)
  createPtySession(workspaceId, workspacePath)

  // 터미널에 데이터 쓰기 (명령 실행)
  writeData(workspaceId, data)

  // 터미널 파괴 (정리)
  destroyTerminal(workspaceId)

  // UI 상태
  toggleTerminal()  // 열기/닫기
  setHeight(height) // 높이 조절
}
```

**핵심 기능**:

1. **워크스페이스별 터미널 인스턴스**
   ```tsx
   terminals: Map<workspaceId, TerminalData>
   ```
   - 각 워크스페이스는 독립적인 터미널을 가짐
   - 워크스페이스 전환 시 터미널도 전환

2. **IPC 이벤트 리스닝**
   ```tsx
   ipcRenderer.on('terminal:data', handleTerminalData)
   ipcRenderer.on('terminal:exit', handleTerminalExit)
   ```
   - 백엔드에서 오는 출력을 받아서 xterm.js에 표시
   - 터미널 종료 시 정리 작업 수행

3. **상태 영속화**
   ```tsx
   localStorage.setItem('circuit-terminal-state', JSON.stringify({
     isOpen: true,
     height: 300
   }))
   ```
   - 앱 재시작 후에도 터미널 상태 유지

---

### 2. ClassicTerminal Component

**위치**: `circuit/src/components/terminal/ClassicTerminal.tsx`

**역할**: xterm.js를 React 컴포넌트로 래핑

**주요 기능**:

1. **xterm.js 인스턴스 생성**
   ```tsx
   const terminal = new XTermTerminal({
     cursorBlink: true,
     fontSize: 12,
     fontFamily: 'JetBrains Mono, SF Mono, Menlo',
     theme: { /* 색상 테마 */ },
     scrollback: 1000,  // 스크롤백 라인 수
   })
   ```

2. **Addons 로드**
   ```tsx
   // 자동 크기 조절
   const fitAddon = new FitAddon()
   terminal.loadAddon(fitAddon)

   // 링크 클릭 가능
   const webLinksAddon = new WebLinksAddon()
   terminal.loadAddon(webLinksAddon)
   ```

3. **DOM 마운트**
   ```tsx
   useEffect(() => {
     if (containerRef.current) {
       terminal.open(containerRef.current)
       fitAddon.fit()
     }
   }, [])
   ```

4. **사용자 입력 처리**
   ```tsx
   terminal.onData((data) => {
     // 사용자가 입력한 내용을 백엔드로 전송
     writeData(workspaceId, data)
   })
   ```

---

### 3. Backend IPC Handlers (Electron Main)

**위치**: `circuit/electron/main.cjs` (추정)

**주요 핸들러**:

#### terminal:create-session
```javascript
ipcMain.handle('terminal:create-session', async (event, workspaceId, workspacePath) => {
  const pty = require('node-pty')

  // PTY 세션 생성
  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-color',
    cols: 80,
    rows: 20,
    cwd: workspacePath,  // 워크스페이스 경로에서 시작
    env: process.env
  })

  // 출력 데이터를 프론트엔드로 전송
  ptyProcess.onData((data) => {
    mainWindow.webContents.send('terminal:data', workspaceId, data)
  })

  // 종료 시 이벤트 전송
  ptyProcess.onExit((exitCode) => {
    mainWindow.webContents.send('terminal:exit', workspaceId, exitCode)
  })

  // 세션 저장
  ptyProcesses.set(workspaceId, ptyProcess)

  return { success: true }
})
```

#### terminal:write
```javascript
ipcMain.handle('terminal:write', async (event, workspaceId, data) => {
  const ptyProcess = ptyProcesses.get(workspaceId)

  if (ptyProcess) {
    ptyProcess.write(data)  // PTY에 데이터 쓰기
    return { success: true }
  }

  return { success: false, error: 'PTY session not found' }
})
```

#### terminal:destroy-session
```javascript
ipcMain.handle('terminal:destroy-session', async (event, workspaceId) => {
  const ptyProcess = ptyProcesses.get(workspaceId)

  if (ptyProcess) {
    ptyProcess.kill()  // 프로세스 종료
    ptyProcesses.delete(workspaceId)
  }

  return { success: true }
})
```

---

## 데이터 흐름

### 사용자 입력 → 쉘 실행

```
1. 사용자가 터미널에 "ls -la" 입력
   │
   ↓
2. xterm.js의 onData 콜백 호출
   terminal.onData((data) => writeData(workspaceId, data))
   │
   ↓
3. TerminalContext의 writeData 호출
   ipcRenderer.invoke('terminal:write', workspaceId, 'ls -la')
   │
   ↓
4. Backend IPC Handler 처리
   ptyProcess.write('ls -la')
   │
   ↓
5. node-pty가 실제 쉘에 전달
   bash/zsh가 명령 실행
```

### 쉘 출력 → 화면 표시

```
1. 쉘 프로세스가 출력 생성
   bash: "total 64\ndrwxr-xr-x  5 user ..."
   │
   ↓
2. node-pty의 onData 콜백 호출
   ptyProcess.onData((data) => { ... })
   │
   ↓
3. IPC 이벤트로 프론트엔드에 전송
   mainWindow.webContents.send('terminal:data', workspaceId, data)
   │
   ↓
4. TerminalContext의 IPC 리스너 수신
   ipcRenderer.on('terminal:data', handleTerminalData)
   │
   ↓
5. xterm.js에 출력
   terminal.write(data)
   │
   ↓
6. 화면에 표시
   사용자가 결과를 볼 수 있음
```

---

## 사용 방법

### 1. Provider 설정

`App.tsx`에서 이미 설정됨:

```tsx
import { TerminalProvider } from '@/contexts/TerminalContext'

function App() {
  return (
    <TerminalProvider>
      {/* 앱 컴포넌트들 */}
    </TerminalProvider>
  )
}
```

### 2. 터미널 사용

```tsx
import { useTerminal } from '@/contexts/TerminalContext'
import { Terminal } from '@/components/Terminal'

function MyComponent() {
  const { isOpen, toggleTerminal } = useTerminal()

  return (
    <>
      <button onClick={toggleTerminal}>
        Toggle Terminal
      </button>

      {isOpen && <Terminal workspace={currentWorkspace} />}
    </>
  )
}
```

### 3. 프로그래매틱 명령 실행

```tsx
const { writeData } = useTerminal()

// 터미널에 명령 전송
writeData(workspaceId, 'npm install\n')
```

---

## 현재 지원하는 기능

### ✅ 이미 구현됨

- **완전한 인터랙티브 쉘**: bash, zsh, fish 등
- **색상 지원**: ANSI 색상 코드 렌더링
- **커서 블링크**: 실제 터미널처럼 작동
- **링크 클릭**: 파일 경로, URL 클릭 가능
- **자동 크기 조절**: 패널 크기에 맞춰 터미널 크기 조절
- **스크롤백**: 1000줄 히스토리
- **워크스페이스별 세션**: 각 워크스페이스마다 독립적인 터미널
- **상태 영속화**: 앱 재시작 후에도 터미널 상태 유지

### 🚧 추가 가능한 기능

1. **여러 터미널 탭**
   - 워크스페이스당 1개 → 워크스페이스당 N개
   - 탭 전환 UI 추가

2. **터미널 분할**
   - 수평/수직 분할
   - VSCode처럼 여러 터미널 동시 표시

3. **커스터마이즈**
   - 폰트 크기 조절 (현재: 12px 고정)
   - 색상 테마 변경
   - 투명도 조절

4. **고급 기능**
   - 명령 히스토리 검색
   - 터미널 출력 검색 (Ctrl+F)
   - 셸 통합 (shell integration)
   - Task runner 통합

---

## 문제 해결

### 터미널이 열리지 않을 때

1. **PTY 세션 확인**
   ```tsx
   // TerminalContext에서 로그 확인
   console.log('[TerminalContext] Creating PTY session...')
   ```

2. **IPC 핸들러 확인**
   ```javascript
   // main.cjs에서 핸들러가 등록되었는지 확인
   ipcMain.handle('terminal:create-session', ...)
   ```

3. **node-pty 설치 확인**
   ```bash
   npm list node-pty
   # 또는
   yarn list node-pty
   ```

### 출력이 안 나올 때

1. **IPC 이벤트 리스너 확인**
   ```tsx
   // TerminalContext에서
   ipcRenderer.on('terminal:data', handleTerminalData)
   ```

2. **백엔드 이벤트 전송 확인**
   ```javascript
   // main.cjs에서
   mainWindow.webContents.send('terminal:data', workspaceId, data)
   ```

### 한글 입력이 안 될 때

node-pty 설정에서 UTF-8 인코딩 확인:

```javascript
const ptyProcess = pty.spawn(shell, [], {
  // ...
  env: {
    ...process.env,
    LANG: 'en_US.UTF-8',
    LC_ALL: 'en_US.UTF-8'
  }
})
```

---

## 성능 최적화

### 1. 출력 버퍼링

많은 출력이 한번에 올 때 성능 문제 방지:

```javascript
let buffer = ''
let timeoutId = null

ptyProcess.onData((data) => {
  buffer += data

  clearTimeout(timeoutId)
  timeoutId = setTimeout(() => {
    mainWindow.webContents.send('terminal:data', workspaceId, buffer)
    buffer = ''
  }, 16) // 60fps
})
```

### 2. WebGL 렌더링 (선택)

xterm.js의 WebGL 렌더러 사용:

```tsx
import { WebglAddon } from '@xterm/addon-webgl'

// 터미널 생성 후
try {
  const webglAddon = new WebglAddon()
  terminal.loadAddon(webglAddon)
} catch (e) {
  console.warn('WebGL not supported, falling back to canvas')
}
```

**장점**: 대량 출력 시 성능 향상
**단점**: GPU 자원 사용, 일부 환경에서 미지원

---

## 코드 예제

### 프로그래매틱 명령 실행

```tsx
import { useTerminal } from '@/contexts/TerminalContext'

function BuildButton({ workspaceId }: { workspaceId: string }) {
  const { writeData, toggleTerminal, isOpen } = useTerminal()

  const handleBuild = () => {
    // 터미널이 닫혀있으면 열기
    if (!isOpen) {
      toggleTerminal()
    }

    // 빌드 명령 실행
    writeData(workspaceId, 'npm run build\n')
  }

  return (
    <button onClick={handleBuild}>
      Build Project
    </button>
  )
}
```

### 여러 명령 순차 실행

```tsx
const { writeData } = useTerminal()

const runTests = (workspaceId: string) => {
  // 명령어들을 &&로 연결
  const commands = [
    'npm install',
    'npm run lint',
    'npm test'
  ].join(' && ')

  writeData(workspaceId, commands + '\n')
}
```

---

## 의존성

### Frontend
```json
{
  "@xterm/xterm": "^5.x",
  "@xterm/addon-fit": "^0.x",
  "@xterm/addon-web-links": "^0.x",
  "@xterm/addon-webgl": "^0.x" // 선택
}
```

### Backend
```json
{
  "node-pty": "^1.x"
}
```

### 설치

```bash
npm install @xterm/xterm @xterm/addon-fit @xterm/addon-web-links node-pty

# 또는
yarn add @xterm/xterm @xterm/addon-fit @xterm/addon-web-links node-pty
```

---

## 비교: 기존 vs 통합 터미널

### 기존 (명령 실행만)

```tsx
// 명령을 보내고 결과를 받음
const result = await ipcRenderer.invoke('command:execute', {
  command: 'ls -la',
  workingDirectory: '/path/to/workspace'
})

// 결과 표시
console.log(result.output)
```

**한계**:
- ❌ 인터랙티브 프로세스 불가 (vim, nano, git add -p 등)
- ❌ 실시간 출력 안 됨 (명령 완료 후에만 표시)
- ❌ 색상 안 됨
- ❌ 쉘 기능 없음 (aliases, environment variables 등)

### 통합 터미널 (현재)

```tsx
// 실제 쉘 프로세스
const { writeData } = useTerminal()

// 명령 입력
writeData(workspaceId, 'ls -la\n')

// 실시간으로 출력이 xterm.js에 표시됨
```

**장점**:
- ✅ 완전한 인터랙티브 쉘
- ✅ 실시간 출력
- ✅ 색상 지원
- ✅ 모든 쉘 기능 사용 가능
- ✅ VSCode와 동일한 경험

---

## 결론

Circuit의 통합 터미널은 **이미 완성되어 있으며**, VSCode 수준의 기능을 제공합니다.

### 핵심 아키텍처

1. **Frontend**: xterm.js + React Context
2. **IPC**: Electron IPC Channel
3. **Backend**: node-pty (PTY 세션 관리)

### 사용법

```tsx
// 1. Provider로 앱 감싸기 (이미 완료)
<TerminalProvider>
  <App />
</TerminalProvider>

// 2. 터미널 사용
const { toggleTerminal } = useTerminal()
<button onClick={toggleTerminal}>Terminal</button>

// 3. 명령 실행
const { writeData } = useTerminal()
writeData(workspaceId, 'npm install\n')
```

### 추가 개선 사항

필요하다면:
- 여러 터미널 탭 지원
- 터미널 분할 (split)
- 커스텀 테마
- 셸 통합 기능

하지만 **기본 기능은 이미 모두 구현되어 있습니다!**
