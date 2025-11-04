# Browser Preview Implementation Guide

## 목차
1. [개요](#개요)
2. [Cursor의 In-App Browser 기능 분석](#cursor의-in-app-browser-기능-분석)
3. [Electron 브라우저 임베딩 방식](#electron-브라우저-임베딩-방식)
4. [Circuit 아키텍처 통합](#circuit-아키텍처-통합)
5. [구현 방법](#구현-방법)
6. [단계별 구현 계획](#단계별-구현-계획)

---

## 개요

이 문서는 Circuit에 Cursor 스타일의 **In-App Browser Preview** 기능을 구현하는 방법을 설명합니다.

### 목표
- 개발 서버(localhost)를 IDE 내부에서 직접 프리뷰
- Hot reload 지원
- Console/Network 로그 확인
- AI Agent와 브라우저 통합 (스크린샷, JavaScript 실행 등)

### 예상 효과
- 브라우저 전환 없이 코드-프리뷰 루프 단축
- UI/API 디버깅 시간 10-20% 절감
- AI가 UI를 직접 검증하고 수정하는 자동화 루프 구현

---

## Cursor의 In-App Browser 기능 분석

### 주요 특징

**1. 네이티브 브라우저 통합**
- IDE 내부에 완전한 Chromium 브라우저 임베드
- Chrome/Safari로 전환 필요 없음
- 코드 옆에서 바로 웹 앱 테스트

**2. 개발 서버 지원**
- React (Vite), Next.js dev server 자동 감지
- Hot reload 완벽 지원
- Multiple ports 관리

**3. DevTools 통합**
- Console 로그 실시간 확인
- Network 요청 모니터링
- Element inspection 가능

**4. AI Agent 통합**
- AI가 브라우저와 직접 상호작용
- 자동화된 피드백 루프:
  ```
  AI 코드 수정 → 브라우저 리로드 → UI 검증 → 버그 감지 → 재수정
  ```

### 사용자 워크플로우

```
┌─────────────┬──────────────┬─────────────┐
│             │              │             │
│   Code      │   Preview    │   Console   │
│   Editor    │   Browser    │   Logs      │
│             │              │             │
└─────────────┴──────────────┴─────────────┘
     ↑               ↑               ↑
     └───── Hot Reload ─────┘       │
     └──────── AI Debugging ────────┘
```

---

## Electron 브라우저 임베딩 방식

### 방식 비교

| 방식 | 난이도 | 기능 | DevTools | AI 통합 | 권장도 | 상태 |
|------|--------|------|----------|---------|--------|------|
| **iframe** | ⭐ | 기본 프리뷰 | ❌ | ⚠️ 제한적 | ⭐⭐ | Active |
| **webview tag** | ⭐⭐ | 중급 | ⚠️ | ✅ | ❌ | **Deprecated** |
| **BrowserView** | ⭐⭐⭐ | 고급 | ✅ | ✅ | ❌ | **Deprecated** |
| **WebContentsView** | ⭐⭐⭐⭐ | 완전한 브라우저 | ✅ | ✅ | ⭐⭐⭐⭐⭐ | **권장** |

---

### 방식 1: iframe (간단한 MVP)

#### 작동 원리
```
┌──────────────────────────────┐
│   React Component            │
│  ┌────────────────────────┐  │
│  │  <iframe>              │  │
│  │  src="localhost:5173"  │  │
│  │                        │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

#### 장점
- 구현 매우 간단 (30분 이내)
- Main 프로세스 수정 불필요
- React 컴포넌트만으로 구현 가능

#### 단점
- Same-origin policy 제약
- CORS 문제 발생 가능
- DevTools 접근 불가
- Console 로그 못 봄
- AI가 페이지 내용 접근 어려움

#### 적합한 경우
- 빠른 POC (Proof of Concept)
- 자체 개발 서버만 프리뷰 (localhost)
- DevTools 불필요한 단순 미리보기

#### 코드 예시
```typescript
function SimpleBrowserView({ url }: { url: string }) {
  return (
    <iframe
      src={url}
      className="w-full h-full border-0"
      sandbox="allow-scripts allow-same-origin"
    />
  );
}
```

---

### 방식 2: WebContentsView (프로덕션 권장)

#### 작동 원리

```
┌─────────────────────────────────────┐
│   BrowserWindow (Main Window)       │
│  ┌──────────────────────────────┐   │
│  │ React Renderer Process       │   │
│  │ (Circuit UI)                 │   │
│  │                              │   │
│  │  <div ref={containerRef}>    │   │ ← 빈 컨테이너 (위치 표시)
│  │  </div>                      │   │
│  └──────────────────────────────┘   │
│  ┌──────────────────────────────┐   │
│  │ WebContentsView              │   │ ← 실제 브라우저 (오버레이)
│  │ (별도 Chromium 프로세스)      │   │
│  │ http://localhost:5173        │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

#### 핵심 개념

1. **DOM의 일부가 아님**: WebContentsView는 Main 프로세스에서 생성
2. **오버레이 방식**: React의 빈 div 위에 정확히 겹쳐서 배치
3. **위치 동기화**: React가 컨테이너 크기/위치를 계산해서 Main 프로세스에 전달
4. **IPC 통신**: Renderer ↔ Main 프로세스 간 통신 필요

#### 구현 흐름

```
┌──────────────┐         IPC          ┌──────────────┐
│              │  'browser:create'    │              │
│  React       │ ──────────────────→  │  Main        │
│  Component   │                      │  Process     │
│              │                      │              │
│  containerRef│                      │  creates     │
│  .getBounds()│  'browser:setBounds' │  WebContents │
│ ─────────────────────────────────→  │  View        │
│              │                      │              │
│              │  'browser:console'   │              │
│  handleLog() │ ←─────────────────── │  captures    │
│              │                      │  events      │
└──────────────┘                      └──────────────┘
```

#### 장점
- **완전한 Chromium 브라우저 엔진**
- **DevTools 접근 가능**: 별도 창으로 열기
- **Console/Network 로그 캡처**: IPC로 전달
- **AI 통합 완벽 지원**:
  - 스크린샷 캡처: `captureImage()`
  - JavaScript 실행: `executeJavaScript(code)`
  - DOM 조작 가능
- **보안**: Sandbox, Context Isolation 완벽 지원
- **별도 프로세스**: 메인 UI 영향 없음

#### 단점
- **구현 복잡도 높음**: Main/Renderer 프로세스 모두 수정
- **위치 동기화 필요**: ResizeObserver, window resize 처리
- **IPC 오버헤드**: 통신 레이어 관리
- **z-index 문제**: 오버레이 방식이라 레이어 관리 필요

#### 적합한 경우
- **프로덕션 환경**
- DevTools 필수
- AI Agent와 브라우저 통합 필요
- 완전한 브라우저 기능 요구

---

## Circuit 아키텍처 통합

### 현재 Circuit 구조

```
┌────────────┬─────────────────┬──────────┐
│            │                 │          │
│ AppSidebar │ WorkspaceChatEditor│ TodoPanel│
│  (좌측)    │     (중앙)      │  (우측)  │
│            │                 │          │
│ - Workspaces│ ViewMode:      │ - Plans  │
│ - Files    │  • chat        │ - Todos  │
│            │  • editor      │          │
│            │  • split       │          │
└────────────┴─────────────────┴──────────┘
```

### 통합 후 구조

```
┌────────────┬─────────────────────────────┬──────────┐
│            │                             │          │
│ AppSidebar │ WorkspaceChatEditor         │ TodoPanel│
│  (좌측)    │     (중앙 - 동적 레이아웃) │  (우측)  │
│            │                             │          │
│ - Workspaces│ ViewMode:                  │ - Plans  │
│ - Files    │  • chat                    │ - Todos  │
│            │  • editor                  │          │
│            │  • split                   │          │
│            │  • browser        ← 🆕     │          │
│            │  • split-browser  ← 🆕     │          │
└────────────┴─────────────────────────────┴──────────┘
```

### ViewMode 확장

```typescript
// 기존
type ViewMode = 'chat' | 'editor' | 'split'

// 새로운 타입
type ViewMode =
  | 'chat'           // 채팅만
  | 'editor'         // 에디터만
  | 'split'          // 채팅 + 에디터
  | 'browser'        // 🆕 브라우저만
  | 'split-browser'  // 🆕 채팅 + 브라우저
  | 'triple'         // 🆕 채팅 + 에디터 + 브라우저 (선택적)
```

### 레이아웃 예시

#### ViewMode: 'browser'
```
┌─────────────────────────┐
│                         │
│    Browser Preview      │
│    localhost:5173       │
│                         │
└─────────────────────────┘
```

#### ViewMode: 'split-browser'
```
┌────────────┬────────────┐
│            │            │
│   Chat     │  Browser   │
│            │  Preview   │
│            │            │
└────────────┴────────────┘
```

#### ViewMode: 'triple' (Advanced)
```
┌──────┬────────┬─────────┐
│      │        │         │
│ Chat │ Editor │ Browser │
│      │        │         │
└──────┴────────┴─────────┘
```

---

## 구현 방법

### 옵션 A: ViewMode 확장 (권장 ⭐⭐⭐⭐⭐)

**접근:**
- 현재 ViewMode 시스템 확장
- 중앙 영역을 동적으로 전환
- ResizablePanel 활용

**장점:**
- 기존 아키텍처와 일관성 유지
- 사용자가 익숙한 패턴
- 점진적 구현 가능

**구현 파일:**
- `App.tsx`: ViewMode 타입 확장
- `WorkspaceChatEditor.tsx`: 브라우저 영역 추가
- `circuit/src/components/browser/`: 새 컴포넌트
- `electron/main.cjs`: IPC handlers 추가
- `electron/browser-manager.cjs`: 브라우저 관리 로직

---

### 옵션 B: Tab 시스템 확장

**접근:**
- `UnifiedTabs`에 브라우저 탭 타입 추가
- 파일 탭 옆에 "Preview" 탭

**장점:**
- Cursor와 유사한 UX
- 탭 간 빠른 전환
- 기존 탭 시스템 재사용

**단점:**
- Split view 구현 복잡
- Tab 로직 복잡도 증가

---

### 옵션 C: Floating Window

**접근:**
- `new BrowserWindow()` 사용
- 별도 윈도우로 브라우저 띄우기

**장점:**
- 멀티 모니터 활용
- 메인 UI 영향 없음

**단점:**
- 윈도우 관리 복잡
- Cursor와 다른 UX

---

## 구현 방법 상세

### 방법 1: iframe 기반 간단한 MVP (30분 구현)

#### 1단계: 컴포넌트 생성

**파일: `circuit/src/components/browser/SimpleBrowserView.tsx`**

```typescript
import { useState, useEffect } from 'react'
import { RefreshCw, ExternalLink, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SimpleBrowserViewProps {
  url: string
  onUrlChange?: (url: string) => void
}

export function SimpleBrowserView({ url, onUrlChange }: SimpleBrowserViewProps) {
  const [currentUrl, setCurrentUrl] = useState(url)
  const [inputUrl, setInputUrl] = useState(url)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    setCurrentUrl(url)
    setInputUrl(url)
  }, [url])

  const handleRefresh = () => {
    setIsLoading(true)
    setHasError(false)
    setCurrentUrl(currentUrl + '?_t=' + Date.now()) // Force refresh
  }

  const handleNavigate = () => {
    setCurrentUrl(inputUrl)
    onUrlChange?.(inputUrl)
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* URL Bar */}
      <div className="flex items-center gap-2 p-2 border-b border-border">
        <button
          onClick={handleRefresh}
          className="p-1.5 rounded hover:bg-secondary"
          title="Refresh"
        >
          <RefreshCw size={16} className={cn(isLoading && "animate-spin")} />
        </button>

        <input
          type="text"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleNavigate()}
          className="flex-1 px-3 py-1.5 text-sm bg-secondary rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="http://localhost:5173"
        />

        <button
          onClick={() => window.require('electron').shell.openExternal(currentUrl)}
          className="p-1.5 rounded hover:bg-secondary"
          title="Open in browser"
        >
          <ExternalLink size={16} />
        </button>
      </div>

      {/* Error State */}
      {hasError && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive text-sm">
          <AlertCircle size={16} />
          <span>Failed to load {currentUrl}. Check if server is running.</span>
        </div>
      )}

      {/* Browser Frame */}
      <iframe
        src={currentUrl}
        className="flex-1 w-full border-0"
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false)
          setHasError(true)
        }}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
      />
    </div>
  )
}
```

#### 2단계: App.tsx 수정

```typescript
// App.tsx
import { SimpleBrowserView } from '@/components/browser/SimpleBrowserView'

type ViewMode = 'chat' | 'editor' | 'split' | 'browser'

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('chat')
  const [browserUrl, setBrowserUrl] = useState('http://localhost:5173')

  // ... 기존 코드
}
```

#### 3단계: WorkspaceChatEditor 수정

```typescript
// WorkspaceChatEditor.tsx
import { SimpleBrowserView } from '@/components/browser/SimpleBrowserView'

export function WorkspaceChatEditor({ viewMode, browserUrl }: Props) {
  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Chat */}
      {(viewMode === 'chat' || viewMode === 'split') && (
        <div className="flex-1">
          {/* Chat UI */}
        </div>
      )}

      {/* Editor */}
      {(viewMode === 'editor' || viewMode === 'split') && (
        <ResizablePanel>
          {/* Monaco Editor */}
        </ResizablePanel>
      )}

      {/* 🆕 Browser */}
      {viewMode === 'browser' && (
        <div className="flex-1">
          <SimpleBrowserView url={browserUrl} />
        </div>
      )}
    </div>
  )
}
```

#### 4단계: 툴바 버튼 추가

```typescript
// App.tsx 헤더 부분
import { Globe } from 'lucide-react'

<button
  onClick={() => setViewMode('browser')}
  className="flex h-7 w-7 items-center justify-center rounded-md transition-colors"
  title="Open Browser Preview"
>
  <Globe size={16} />
</button>
```

---

### 방법 2: WebContentsView 완전 구현 (2-3일)

#### Phase 1: Main 프로세스 - Browser Manager

**파일: `circuit/electron/browser-manager.cjs` (새 파일)**

```javascript
const { BrowserWindow, WebContentsView } = require('electron');

class BrowserManager {
  constructor() {
    this.browserView = null;
    this.mainWindow = null;
  }

  setMainWindow(window) {
    this.mainWindow = window;
  }

  async createBrowserView(url) {
    console.log('[BrowserManager] Creating browser view for:', url);

    if (!this.mainWindow) {
      throw new Error('Main window not set');
    }

    // 기존 뷰가 있으면 제거
    if (this.browserView) {
      this.destroyBrowserView();
    }

    // 새 WebContentsView 생성
    this.browserView = new WebContentsView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        devTools: true, // DevTools 허용
      }
    });

    // 메인 윈도우에 추가
    this.mainWindow.contentView.addChildView(this.browserView);

    // Console 로그 캡처
    this.browserView.webContents.on('console-message', (event, level, message, line, sourceId) => {
      const logData = { level, message, line, sourceId };
      this.mainWindow.webContents.send('browser:console-log', logData);
    });

    // Navigation 이벤트
    this.browserView.webContents.on('did-navigate', (event, url) => {
      this.mainWindow.webContents.send('browser:navigated', url);
    });

    // 페이지 로드 완료
    this.browserView.webContents.on('did-finish-load', () => {
      this.mainWindow.webContents.send('browser:loaded');
    });

    // 에러 처리
    this.browserView.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      this.mainWindow.webContents.send('browser:error', { errorCode, errorDescription });
    });

    // URL 로드
    try {
      await this.browserView.webContents.loadURL(url);
      return { success: true };
    } catch (error) {
      console.error('[BrowserManager] Failed to load URL:', error);
      return { success: false, error: error.message };
    }
  }

  setBounds(bounds) {
    if (this.browserView) {
      this.browserView.setBounds(bounds);
    }
  }

  reload() {
    if (this.browserView) {
      this.browserView.webContents.reload();
    }
  }

  goBack() {
    if (this.browserView && this.browserView.webContents.canGoBack()) {
      this.browserView.webContents.goBack();
    }
  }

  goForward() {
    if (this.browserView && this.browserView.webContents.canGoForward()) {
      this.browserView.webContents.goForward();
    }
  }

  openDevTools() {
    if (this.browserView) {
      this.browserView.webContents.openDevTools({ mode: 'detach' });
    }
  }

  async captureScreenshot() {
    if (!this.browserView) return null;

    const image = await this.browserView.webContents.capturePage();
    return image.toDataURL();
  }

  async executeJavaScript(code) {
    if (!this.browserView) return null;

    try {
      const result = await this.browserView.webContents.executeJavaScript(code);
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  destroyBrowserView() {
    if (this.browserView) {
      console.log('[BrowserManager] Destroying browser view');
      this.mainWindow.contentView.removeChildView(this.browserView);
      this.browserView.webContents.close();
      this.browserView = null;
    }
  }
}

// Singleton instance
const browserManager = new BrowserManager();

module.exports = { browserManager };
```

#### Phase 2: Main 프로세스 IPC Handlers

**파일: `circuit/electron/main.cjs` 수정**

```javascript
// 기존 imports...
const { browserManager } = require('./browser-manager.cjs');

// app.whenReady() 안에서
app.whenReady().then(async () => {
  // ... 기존 코드

  // Browser manager 초기화
  browserManager.setMainWindow(mainWindow);

  // Browser IPC handlers 등록
  setupBrowserHandlers();
});

function setupBrowserHandlers() {
  // 브라우저 뷰 생성
  ipcMain.handle('browser:create', async (event, url) => {
    return await browserManager.createBrowserView(url);
  });

  // 위치/크기 설정
  ipcMain.handle('browser:setBounds', (event, bounds) => {
    browserManager.setBounds(bounds);
    return { success: true };
  });

  // 리로드
  ipcMain.handle('browser:reload', () => {
    browserManager.reload();
    return { success: true };
  });

  // 뒤로 가기
  ipcMain.handle('browser:goBack', () => {
    browserManager.goBack();
    return { success: true };
  });

  // 앞으로 가기
  ipcMain.handle('browser:goForward', () => {
    browserManager.goForward();
    return { success: true };
  });

  // DevTools 열기
  ipcMain.handle('browser:openDevTools', () => {
    browserManager.openDevTools();
    return { success: true };
  });

  // 스크린샷 캡처 (AI용)
  ipcMain.handle('browser:captureScreenshot', async () => {
    const dataUrl = await browserManager.captureScreenshot();
    return { success: true, dataUrl };
  });

  // JavaScript 실행 (AI용)
  ipcMain.handle('browser:executeJS', async (event, code) => {
    return await browserManager.executeJavaScript(code);
  });

  // 브라우저 뷰 제거
  ipcMain.handle('browser:destroy', () => {
    browserManager.destroyBrowserView();
    return { success: true };
  });
}
```

#### Phase 3: Renderer 프로세스 - React 컴포넌트

**파일: `circuit/src/components/browser/NativeBrowserView.tsx`**

```typescript
import { useState, useEffect, useRef } from 'react'
import { RefreshCw, ExternalLink, Code, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NativeBrowserViewProps {
  url: string
  workspace?: any
  onConsoleLog?: (log: ConsoleLog) => void
}

interface ConsoleLog {
  level: number
  message: string
  line: number
  sourceId: string
}

export function NativeBrowserView({ url, workspace, onConsoleLog }: NativeBrowserViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [currentUrl, setCurrentUrl] = useState(url)
  const [inputUrl, setInputUrl] = useState(url)
  const [isLoading, setIsLoading] = useState(true)
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLog[]>([])
  const [showConsole, setShowConsole] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ipcRenderer = window.require('electron').ipcRenderer

  useEffect(() => {
    setCurrentUrl(url)
    setInputUrl(url)
  }, [url])

  // 브라우저 뷰 생성 및 관리
  useEffect(() => {
    let mounted = true

    const createBrowser = async () => {
      setIsLoading(true)
      setError(null)

      const result = await ipcRenderer.invoke('browser:create', currentUrl)

      if (mounted) {
        if (result.success) {
          updateBounds()
          setIsLoading(false)
        } else {
          setError(result.error)
          setIsLoading(false)
        }
      }
    }

    createBrowser()

    // Console 로그 리스너
    const handleConsoleLog = (_event: any, log: ConsoleLog) => {
      setConsoleLogs(prev => [...prev, log])
      onConsoleLog?.(log)
    }

    // Navigation 리스너
    const handleNavigated = (_event: any, newUrl: string) => {
      setInputUrl(newUrl)
    }

    // 로드 완료 리스너
    const handleLoaded = () => {
      setIsLoading(false)
      setError(null)
    }

    // 에러 리스너
    const handleError = (_event: any, errorData: { errorCode: number; errorDescription: string }) => {
      setError(errorData.errorDescription)
      setIsLoading(false)
    }

    ipcRenderer.on('browser:console-log', handleConsoleLog)
    ipcRenderer.on('browser:navigated', handleNavigated)
    ipcRenderer.on('browser:loaded', handleLoaded)
    ipcRenderer.on('browser:error', handleError)

    // ResizeObserver로 크기 변경 감지
    const resizeObserver = new ResizeObserver(updateBounds)
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    // Window resize도 감지
    window.addEventListener('resize', updateBounds)

    return () => {
      mounted = false
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateBounds)
      ipcRenderer.removeListener('browser:console-log', handleConsoleLog)
      ipcRenderer.removeListener('browser:navigated', handleNavigated)
      ipcRenderer.removeListener('browser:loaded', handleLoaded)
      ipcRenderer.removeListener('browser:error', handleError)
      ipcRenderer.invoke('browser:destroy')
    }
  }, [currentUrl])

  // 브라우저 뷰 위치/크기 업데이트
  const updateBounds = () => {
    if (!containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()

    // Console이 열려있으면 하단 30% 제외
    const height = showConsole ? rect.height * 0.7 : rect.height

    ipcRenderer.invoke('browser:setBounds', {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(height)
    })
  }

  // Console 토글시 bounds 업데이트
  useEffect(() => {
    updateBounds()
  }, [showConsole])

  const handleRefresh = () => {
    setIsLoading(true)
    ipcRenderer.invoke('browser:reload')
  }

  const handleNavigate = () => {
    setCurrentUrl(inputUrl)
  }

  const handleBack = () => {
    ipcRenderer.invoke('browser:goBack')
  }

  const handleForward = () => {
    ipcRenderer.invoke('browser:goForward')
  }

  const handleOpenDevTools = () => {
    ipcRenderer.invoke('browser:openDevTools')
  }

  const handleExternalOpen = () => {
    window.require('electron').shell.openExternal(currentUrl)
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* URL Bar */}
      <div className="flex items-center gap-2 p-2 border-b border-border">
        <button
          onClick={handleBack}
          className="p-1.5 rounded hover:bg-secondary"
          title="Back"
        >
          <ChevronLeft size={16} />
        </button>

        <button
          onClick={handleForward}
          className="p-1.5 rounded hover:bg-secondary"
          title="Forward"
        >
          <ChevronRight size={16} />
        </button>

        <button
          onClick={handleRefresh}
          className="p-1.5 rounded hover:bg-secondary"
          title="Refresh"
          disabled={isLoading}
        >
          <RefreshCw size={16} className={cn(isLoading && "animate-spin")} />
        </button>

        <input
          type="text"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleNavigate()}
          className="flex-1 px-3 py-1.5 text-sm bg-secondary rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="http://localhost:5173"
        />

        <button
          onClick={() => setShowConsole(!showConsole)}
          className={cn(
            "p-1.5 rounded hover:bg-secondary",
            showConsole && "bg-secondary"
          )}
          title="Toggle Console"
        >
          <Code size={16} />
        </button>

        <button
          onClick={handleOpenDevTools}
          className="p-1.5 rounded hover:bg-secondary"
          title="Open DevTools"
        >
          <AlertCircle size={16} />
        </button>

        <button
          onClick={handleExternalOpen}
          className="p-1.5 rounded hover:bg-secondary"
          title="Open in browser"
        >
          <ExternalLink size={16} />
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive text-sm">
          <AlertCircle size={16} />
          <span>Failed to load: {error}</span>
        </div>
      )}

      {/* Browser Container */}
      <div ref={containerRef} className="flex-1 relative bg-muted">
        {/* 로딩 오버레이 */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
            <RefreshCw className="animate-spin" size={24} />
          </div>
        )}

        {/* 실제 브라우저는 이 영역 위에 오버레이됨 */}
        <div className="w-full h-full" />
      </div>

      {/* Console Panel */}
      {showConsole && (
        <div className="h-[30%] border-t border-border bg-background overflow-auto">
          <div className="p-2 border-b border-border flex justify-between items-center">
            <span className="text-sm font-medium">Console</span>
            <button
              onClick={() => setConsoleLogs([])}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          </div>
          <div className="p-2 font-mono text-xs space-y-1">
            {consoleLogs.map((log, i) => (
              <div
                key={i}
                className={cn(
                  "p-1 rounded",
                  log.level === 0 && "text-muted-foreground", // log
                  log.level === 1 && "text-yellow-500", // warning
                  log.level === 2 && "text-red-500"  // error
                )}
              >
                {log.message}
              </div>
            ))}
            {consoleLogs.length === 0 && (
              <div className="text-muted-foreground">No console output</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
```

#### Phase 4: WorkspaceChatEditor 통합

```typescript
// circuit/src/components/workspace/WorkspaceChatEditor.tsx
import { NativeBrowserView } from '@/components/browser/NativeBrowserView'

export type WorkspaceViewMode =
  | 'chat'
  | 'editor'
  | 'split'
  | 'browser'
  | 'split-browser'

interface WorkspaceChatEditorProps {
  viewMode: WorkspaceViewMode
  browserUrl?: string
  // ... other props
}

export function WorkspaceChatEditor({
  viewMode,
  browserUrl = 'http://localhost:5173',
  // ... other props
}: WorkspaceChatEditorProps) {

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Chat */}
      {(viewMode === 'chat' || viewMode === 'split' || viewMode === 'split-browser') && (
        <div className="flex-1">
          {/* Chat UI */}
        </div>
      )}

      {/* Editor */}
      {(viewMode === 'editor' || viewMode === 'split') && (
        <ResizablePanel defaultSize={50}>
          {/* Monaco Editor */}
        </ResizablePanel>
      )}

      {/* Browser */}
      {(viewMode === 'browser' || viewMode === 'split-browser') && (
        <ResizablePanel defaultSize={50}>
          <NativeBrowserView
            url={browserUrl}
            workspace={workspace}
            onConsoleLog={(log) => {
              // AI에게 Console 로그 전달 가능
              console.log('Browser console:', log)
            }}
          />
        </ResizablePanel>
      )}
    </div>
  )
}
```

---

## 단계별 구현 계획

### Phase 1: iframe MVP (1일)

**목표:** 기본 프리뷰 기능 구현

**작업:**
1. ✅ `SimpleBrowserView` 컴포넌트 생성
2. ✅ ViewMode에 'browser' 추가
3. ✅ WorkspaceChatEditor 통합
4. ✅ 툴바 버튼 추가

**검증:**
- [ ] localhost:5173 프리뷰 확인
- [ ] Hot reload 동작
- [ ] URL 입력/변경 가능

---

### Phase 2: WebContentsView 기반 구현 (3일)

**목표:** 완전한 브라우저 기능

**작업:**
1. ✅ `browser-manager.cjs` 생성
2. ✅ Main 프로세스 IPC handlers
3. ✅ `NativeBrowserView` 컴포넌트
4. ✅ Console 로그 캡처
5. ✅ DevTools 통합

**검증:**
- [ ] WebContentsView 정상 동작
- [ ] 위치/크기 동기화
- [ ] Console 로그 표시
- [ ] DevTools 열기

---

### Phase 3: 개발 서버 자동 감지 (1일)

**목표:** 터미널에서 dev server 감지

**작업:**
1. 터미널 출력 파싱 (`listening on`, `localhost:xxxx`)
2. 포트 번호 자동 추출
3. "Preview?" 알림 표시
4. 자동 브라우저 열기 옵션

**검증:**
- [ ] `npm run dev` 감지
- [ ] 포트 번호 자동 인식
- [ ] 알림 클릭시 브라우저 열림

---

### Phase 4: AI Agent 통합 (2일)

**목표:** AI가 브라우저 조작 가능

**작업:**
1. 스크린샷 캡처 API
2. JavaScript 실행 API
3. AI Agent에 브라우저 도구 추가
4. 자동 디버깅 루프 구현

**검증:**
- [ ] AI가 스크린샷 캡처
- [ ] AI가 DOM 조작 가능
- [ ] AI가 UI 버그 자동 수정

---

### Phase 5: 고급 기능 (선택적, 2일)

**작업:**
1. Network 요청 모니터링
2. Performance 메트릭
3. Multiple ports 관리
4. Screenshot history

---

## 구현 우선순위 및 추천

| Phase | 난이도 | 시간 | 가치 | 우선순위 |
|-------|--------|------|------|----------|
| Phase 1 (iframe MVP) | ⭐ | 1일 | ⭐⭐⭐ | 🔥 높음 |
| Phase 2 (WebContentsView) | ⭐⭐⭐⭐ | 3일 | ⭐⭐⭐⭐⭐ | 🔥 높음 |
| Phase 3 (자동 감지) | ⭐⭐ | 1일 | ⭐⭐⭐⭐ | 중간 |
| Phase 4 (AI 통합) | ⭐⭐⭐ | 2일 | ⭐⭐⭐⭐⭐ | 🔥 높음 |
| Phase 5 (고급) | ⭐⭐⭐ | 2일 | ⭐⭐ | 낮음 |

---

## 추천 실행 계획

### 빠른 검증 (1주)
```
Day 1: Phase 1 (iframe MVP)
       → 사용자 반응 확인

Day 2-4: Phase 2 (WebContentsView)
         → 프로덕션 품질 구현

Day 5: Phase 3 (자동 감지)
       → UX 개선
```

### 완전한 구현 (2주)
```
Week 1: Phase 1-2 (MVP + WebContentsView)
Week 2: Phase 3-4 (자동 감지 + AI 통합)
```

---

## 참고 자료

### Electron 공식 문서
- [Web Embeds](https://www.electronjs.org/docs/latest/tutorial/web-embeds)
- [WebContentsView API](https://www.electronjs.org/docs/latest/api/web-contents-view)
- [BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window)

### Cursor 관련
- [Cursor 2.0 In-App Browser](https://skywork.ai/blog/vibecoding/cursor-2-0-in-app-browser/)
- [Cursor Changelog](https://cursor.com/changelog)

### Circuit 아키텍처
- `ARCHITECTURE_ANALYSIS.md`
- `WORKSPACE_ARCHITECTURE.md`
- `TERMINAL_INTEGRATION.md`

---

## 다음 단계

1. **결정:** iframe MVP vs. WebContentsView 직접 구현
2. **시작:** Phase 1 또는 Phase 2 선택
3. **테스트:** 기본 프리뷰 동작 확인
4. **반복:** 사용자 피드백 수집 및 개선

**질문이나 구현 중 문제가 발생하면 이 문서를 업데이트하세요.**
