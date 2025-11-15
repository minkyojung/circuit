# Browser Mode Architecture - Updated

> **최종 업데이트**: 2025-01-15
> **기반**: BROWSER_MODE_UPDATED_SPEC.md

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Component Design](#component-design)
3. [Data Flow](#data-flow)
4. [Implementation Details](#implementation-details)
5. [Platform Support](#platform-support)
6. [API Reference](#api-reference)

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        OCTAVE APP                            │
├───────────────┬──────────────────────────┬──────────────────┤
│               │                          │                  │
│  Left         │   Center Content         │   Right Sidebar  │
│  Sidebar      │   (Tabs)                 │                  │
│               │                          │                  │
│  - Workspaces │  ┌────────────────────┐  │  ┌────────────┐  │
│  - Files      │  │  Tab Bar           │  │  │            │  │
│  - Git        │  ├────────────────────┤  │  │   Chat     │  │
│               │  │                    │  │  │   Panel    │  │
│               │  │  Browser Tab       │  │  │            │  │
│               │  │  or                │  │  │            │  │
│               │  │  File Editor Tab   │  │  ├────────────┤  │
│               │  │                    │  │  │            │  │
│               │  ├────────────────────┤  │  │   Todo     │  │
│               │  │  Inspector Panel   │  │  │   Panel    │  │
│               │  │  (Browser Tab only)│  │  │            │  │
│               │  └────────────────────┘  │  └────────────┘  │
└───────────────┴──────────────────────────┴──────────────────┘
```

### Key Architectural Decisions

#### 1. Inspector Panel Location
**Decision**: Inspector Panel은 Browser Tab **내부**에 하단 패널로 위치

**Rationale**:
- Chrome DevTools와 유사한 UX
- Right Sidebar는 기존 Octave 구조 유지 (Chat + Todo)
- 브라우저 컨텍스트와 물리적으로 가까움
- 탭 전환 시 Inspector도 함께 숨겨짐 (컨텍스트 명확성)

#### 2. Chat + Todo in Right Sidebar
**Decision**: Right Sidebar는 기존 구조 유지

**Rationale**:
- 기존 Octave 사용자 경험 일관성
- Chat은 모든 탭에서 접근 가능 (persistent)
- Todo는 작업 추적에 필수
- Element Inspector는 브라우저 전용 기능이므로 분리

#### 3. Console Logs Context Injection
**Decision**: Chat Input에 🐛 버튼 추가 (Plan Mode 우측)

**Rationale**:
- 한 번의 클릭으로 모든 로그 주입
- 수동 복붙 제거
- Element Context와 동일한 UX 패턴

---

## Component Design

### 1. Type System

**File**: `octave/src/types/editor.ts`

```typescript
// Tab Type 확장
export type TabType =
  | 'conversation'
  | 'file'
  | 'settings'
  | 'browser' // 🆕

// Browser Tab Data
export interface BrowserTabData {
  url: string
  title?: string
  favicon?: string
  isLoading?: boolean
  canGoBack?: boolean
  canGoForward?: boolean
  devServerPort?: number
  workspaceId?: string
}

export interface BrowserTab extends BaseTab {
  type: 'browser'
  data: BrowserTabData
}

// Element Context (AI에게 전달될 데이터)
export interface ElementContext {
  type: 'browser-element'
  selector: string          // CSS Selector
  tagName: string           // e.g., "BUTTON"
  html: string              // Outer HTML
  computedStyles: Record<string, string>
  boxModel: {
    width: number
    height: number
    margin: [number, number, number, number]
    padding: [number, number, number, number]
    border: [number, number, number, number]
  }
  screenshot: string        // base64 PNG
  url: string               // 페이지 URL
  timestamp: number
  filepath?: string         // 소스 파일 경로 (추정)
}

// Console Logs Context (🆕)
export interface ConsoleLogsContext {
  type: 'console-logs'
  source: 'browser-tab'
  url: string
  timestamp: number
  logs: ConsoleLog[]
  summary: {
    total: number
    errors: number
    warnings: number
    info: number
  }
}

export interface ConsoleLog {
  level: 'log' | 'warn' | 'error' | 'info'
  message: string
  stackTrace?: string
  line?: number
  file?: string
  timestamp: number
}
```

---

### 2. BrowserTab Component

**File**: `octave/src/components/browser/BrowserTab.tsx`

**Responsibilities**:
- Browser Toolbar 렌더링 (URL bar, navigation buttons)
- WebContentsView 생성 및 관리 (via IPC)
- Inspector Panel 통합
- Inspect Mode 상태 관리

**Component Structure**:

```typescript
interface BrowserTabProps {
  url: string
  workspaceId?: string
  onElementSelected?: (element: ElementContext) => void
  onConsoleLog?: (log: ConsoleLog) => void
}

export function BrowserTab({ url, workspaceId, ... }: BrowserTabProps) {
  const [inspectorVisible, setInspectorVisible] = useState(true)
  const [activeInspectorTab, setActiveInspectorTab] = useState<
    'elements' | 'console' | 'network' | 'element'
  >('console')
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLog[]>([])
  const [selectedElement, setSelectedElement] = useState<ElementContext | null>(null)

  return (
    <div className="flex flex-col h-full">
      {/* Browser Toolbar */}
      <BrowserToolbar
        url={url}
        onNavigate={...}
        onInspectModeToggle={...}
        onConsoleToggle={() => setInspectorVisible(!inspectorVisible)}
      />

      {/* Resizable: Browser Content + Inspector Panel */}
      <ResizablePanelGroup direction="vertical">
        {/* Browser Content */}
        <ResizablePanel defaultSize={70}>
          <BrowserContent viewId={viewId} />
        </ResizablePanel>

        {/* Inspector Panel (Toggleable) */}
        {inspectorVisible && (
          <>
            <ResizableHandle />
            <ResizablePanel defaultSize={30}>
              <InspectorPanel
                activeTab={activeInspectorTab}
                consoleLogs={consoleLogs}
                selectedElement={selectedElement}
                onTabChange={setActiveInspectorTab}
                onAddToChat={handleAddToChat}
              />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
  )
}
```

---

### 3. BrowserToolbar Component

**File**: `octave/src/components/browser/BrowserToolbar.tsx`

```typescript
interface BrowserToolbarProps {
  url: string
  canGoBack: boolean
  canGoForward: boolean
  isLoading: boolean
  inspectModeActive: boolean
  onNavigate: (url: string) => void
  onBack: () => void
  onForward: () => void
  onRefresh: () => void
  onInspectModeToggle: () => void
  onConsoleToggle: () => void
  onDevToolsOpen: () => void
}

export function BrowserToolbar({ ... }: BrowserToolbarProps) {
  return (
    <div className="flex items-center gap-2 p-2 border-b">
      {/* Navigation */}
      <Button onClick={onBack} disabled={!canGoBack}>←</Button>
      <Button onClick={onForward} disabled={!canGoForward}>→</Button>
      <Button onClick={onRefresh} disabled={isLoading}>
        {isLoading ? <Spinner /> : <RefreshCw />}
      </Button>

      {/* URL Bar */}
      <Input
        value={url}
        onChange={...}
        onKeyDown={e => e.key === 'Enter' && onNavigate(url)}
        className="flex-1"
      />

      {/* Tools */}
      <Button
        onClick={onInspectModeToggle}
        variant={inspectModeActive ? 'default' : 'ghost'}
        title="Inspect Mode (Click element)"
      >
        🔍
      </Button>

      <Button onClick={onConsoleToggle} title="Toggle Console">
        🐛
      </Button>

      <Button onClick={onDevToolsOpen} title="Open DevTools">
        <MoreVertical />
      </Button>
    </div>
  )
}
```

---

### 4. InspectorPanel Component

**File**: `octave/src/components/browser/InspectorPanel.tsx`

```typescript
type InspectorTab = 'elements' | 'console' | 'network' | 'element'

interface InspectorPanelProps {
  activeTab: InspectorTab
  consoleLogs: ConsoleLog[]
  selectedElement: ElementContext | null
  onTabChange: (tab: InspectorTab) => void
  onAddToChat: (context: ElementContext | ConsoleLogsContext) => void
}

export function InspectorPanel({ activeTab, ... }: InspectorPanelProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Tab Bar */}
      <div className="flex border-b">
        <TabButton active={activeTab === 'elements'} onClick={() => onTabChange('elements')}>
          Elements
        </TabButton>
        <TabButton active={activeTab === 'console'} onClick={() => onTabChange('console')}>
          Console ({consoleLogs.length})
        </TabButton>
        <TabButton active={activeTab === 'network'} onClick={() => onTabChange('network')}>
          Network
        </TabButton>
        <TabButton active={activeTab === 'element'} onClick={() => onTabChange('element')}>
          Element
        </TabButton>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'elements' && <ElementsTab />}
        {activeTab === 'console' && <ConsoleTab logs={consoleLogs} />}
        {activeTab === 'network' && <NetworkTab />}
        {activeTab === 'element' && (
          <ElementTab
            element={selectedElement}
            onAddToChat={() => selectedElement && onAddToChat(selectedElement)}
          />
        )}
      </div>
    </div>
  )
}
```

---

### 5. ElementTab Component (Inspector 내부)

**File**: `octave/src/components/browser/inspector/ElementTab.tsx`

```typescript
interface ElementTabProps {
  element: ElementContext | null
  onAddToChat: () => void
}

export function ElementTab({ element, onAddToChat }: ElementTabProps) {
  if (!element) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <Target size={48} className="mx-auto mb-4 opacity-50" />
          <p>Enable Inspect Mode and click an element</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {/* Preview */}
      <Section title="📸 Preview">
        <img
          src={element.screenshot}
          alt={element.selector}
          className="w-full border rounded"
        />
      </Section>

      {/* Selector */}
      <Section title="📍 Selector">
        <div className="flex items-center gap-2">
          <code className="flex-1 p-2 bg-muted rounded font-mono text-sm">
            {element.selector}
          </code>
          <Button size="sm" onClick={() => copyToClipboard(element.selector)}>
            Copy
          </Button>
        </div>
      </Section>

      {/* HTML */}
      <CollapsibleSection title="📄 HTML" defaultOpen={false}>
        <SyntaxHighlighter language="html" code={element.html} />
      </CollapsibleSection>

      {/* Styles */}
      <CollapsibleSection title="🎨 Styles" defaultOpen={true}>
        <KeyValueList data={getKeyStyles(element.computedStyles)} />
      </CollapsibleSection>

      {/* Box Model */}
      <CollapsibleSection title="📦 Box Model" defaultOpen={false}>
        <BoxModelDiagram boxModel={element.boxModel} />
      </CollapsibleSection>

      {/* Actions */}
      <Button className="w-full" onClick={onAddToChat}>
        Add to Chat
      </Button>
    </div>
  )
}
```

---

### 6. ChatPanel Updates - Console Logs Button

**File**: `octave/src/components/workspace/ChatPanel.tsx` (수정)

**Changes**:
- Chat Input 영역에 🐛 Console Logs 버튼 추가
- `ConsoleLogs Context` 지원

```typescript
interface ChatPanelProps {
  // ... 기존 props
  browserConsoleLogs?: ConsoleLog[] // 🆕
}

export function ChatPanel({ browserConsoleLogs, ... }: ChatPanelProps) {
  const handleInjectConsoleLogs = () => {
    if (!browserConsoleLogs || browserConsoleLogs.length === 0) {
      toast.error('No console logs available')
      return
    }

    const consoleContext: ConsoleLogsContext = {
      type: 'console-logs',
      source: 'browser-tab',
      url: currentBrowserUrl,
      timestamp: Date.now(),
      logs: browserConsoleLogs,
      summary: {
        total: browserConsoleLogs.length,
        errors: browserConsoleLogs.filter(l => l.level === 'error').length,
        warnings: browserConsoleLogs.filter(l => l.level === 'warn').length,
        info: browserConsoleLogs.filter(l => l.level === 'log' || l.level === 'info').length,
      }
    }

    addContextToChat(consoleContext)
    toast.success(`Added ${browserConsoleLogs.length} console logs to context`)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-auto">
        {messages.map(...)}
      </div>

      {/* Context Pills */}
      {contexts.length > 0 && (
        <div className="p-2 border-t">
          <div className="text-xs text-muted-foreground mb-2">📎 Context:</div>
          <div className="flex flex-wrap gap-2">
            {contexts.map(ctx => (
              <ContextPill key={ctx.id} context={ctx} onRemove={...} />
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-3 border-t">
        <div className="flex items-center gap-2 mb-2">
          {/* Plan Mode Dropdown */}
          <Select value={planMode} onValueChange={setPlanMode}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="off">Off</SelectItem>
              <SelectItem value="basic">Basic</SelectItem>
              <SelectItem value="advanced">Advanced</SelectItem>
            </SelectContent>
          </Select>

          {/* File Attach */}
          <Button variant="ghost" size="icon">
            <Paperclip size={16} />
          </Button>

          {/* Image Attach */}
          <Button variant="ghost" size="icon">
            <Image size={16} />
          </Button>

          {/* 🆕 Console Logs Inject */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleInjectConsoleLogs}
            disabled={!browserConsoleLogs || browserConsoleLogs.length === 0}
            title={`Inject ${browserConsoleLogs?.length || 0} console logs`}
          >
            <Bug size={16} />
          </Button>
        </div>

        <Textarea
          value={input}
          onChange={...}
          placeholder="Type your message..."
          className="min-h-20"
        />

        <div className="flex justify-end mt-2">
          <Button onClick={handleSend}>
            Send ⌘↵
          </Button>
        </div>
      </div>
    </div>
  )
}
```

---

### 7. BrowserManager (Main Process)

**File**: `octave/electron/browserManager.ts`

```typescript
import { BrowserWindow, WebContentsView } from 'electron'
import CDP from 'chrome-remote-interface'

class BrowserManager {
  private browserView: WebContentsView | null = null
  private mainWindow: BrowserWindow | null = null
  private cdpClient: CDP.Client | null = null
  private viewId: string | null = null

  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window
  }

  async createBrowserView(url: string): Promise<{ success: boolean; viewId?: string }> {
    if (!this.mainWindow) {
      throw new Error('Main window not set')
    }

    // 기존 뷰 제거
    if (this.browserView) {
      this.destroyBrowserView()
    }

    // WebContentsView 생성
    this.browserView = new WebContentsView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        devTools: true,
      }
    })

    this.viewId = `browser-${Date.now()}`
    this.mainWindow.contentView.addChildView(this.browserView)

    // CDP 초기화
    await this.initializeCDP()

    // 이벤트 리스너 설정
    this.setupEventListeners()

    // URL 로드
    try {
      await this.browserView.webContents.loadURL(url)
      return { success: true, viewId: this.viewId }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  private async initializeCDP() {
    if (!this.browserView) return

    const port = this.browserView.webContents.debugger.attach('1.3')

    this.cdpClient = await CDP({
      port,
      target: this.browserView.webContents
    })

    // Enable domains
    await this.cdpClient.Overlay.enable()
    await this.cdpClient.DOM.enable()
    await this.cdpClient.CSS.enable()
    await this.cdpClient.Page.enable()
  }

  private setupEventListeners() {
    if (!this.browserView || !this.mainWindow) return

    // Console 로그 캡처
    this.browserView.webContents.on('console-message', (event, level, message, line, sourceId) => {
      const log: ConsoleLog = {
        level: ['log', 'warn', 'error', 'info'][level] as any,
        message,
        line,
        file: sourceId,
        timestamp: Date.now()
      }
      this.mainWindow!.webContents.send('browser:console-log', log)
    })

    // Navigation
    this.browserView.webContents.on('did-navigate', (event, url) => {
      this.mainWindow!.webContents.send('browser:navigated', {
        url,
        canGoBack: this.browserView!.webContents.canGoBack(),
        canGoForward: this.browserView!.webContents.canGoForward()
      })
    })

    // Load finish
    this.browserView.webContents.on('did-finish-load', () => {
      this.mainWindow!.webContents.send('browser:loaded')
    })

    // Error
    this.browserView.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      this.mainWindow!.webContents.send('browser:error', { errorCode, errorDescription })
    })
  }

  async setInspectMode(enabled: boolean) {
    if (!this.cdpClient) return

    if (enabled) {
      await this.cdpClient.Overlay.setInspectMode({
        mode: 'searchForNode',
        highlightConfig: {
          showInfo: true,
          showStyles: true,
          contentColor: { r: 111, g: 168, b: 220, a: 0.66 },
          paddingColor: { r: 147, g: 196, b: 125, a: 0.55 },
          borderColor: { r: 255, g: 229, b: 153, a: 0.66 },
          marginColor: { r: 246, g: 178, b: 107, a: 0.66 }
        }
      })

      // Listen for element selection
      this.cdpClient.Overlay.on('inspectNodeRequested', async ({ backendNodeId }) => {
        const elementData = await this.extractElementData(backendNodeId)
        this.mainWindow!.webContents.send('browser:element-selected', elementData)
      })
    } else {
      await this.cdpClient.Overlay.setInspectMode({ mode: 'none' })
    }
  }

  private async extractElementData(backendNodeId: number): Promise<ElementContext> {
    if (!this.cdpClient) throw new Error('CDP not initialized')

    // Get node details
    const { node } = await this.cdpClient.DOM.describeNode({ backendNodeId })

    // Get computed styles
    const { computedStyle } = await this.cdpClient.CSS.getComputedStyleForNode({ nodeId: node.nodeId })
    const styles = Object.fromEntries(
      computedStyle.map(s => [s.name, s.value])
    )

    // Get box model
    const { model } = await this.cdpClient.DOM.getBoxModel({ nodeId: node.nodeId })

    // Generate selector
    const selector = await this.generateSelector(node)

    // Capture screenshot
    const screenshot = await this.captureElementScreenshot(model)

    return {
      type: 'browser-element',
      selector,
      tagName: node.nodeName,
      html: node.outerHTML || '',
      computedStyles: styles,
      boxModel: {
        width: model.width,
        height: model.height,
        margin: model.margin as any,
        padding: model.padding as any,
        border: model.border as any
      },
      screenshot,
      url: this.browserView!.webContents.getURL(),
      timestamp: Date.now()
    }
  }

  private async generateSelector(node: CDP.DOM.Node): Promise<string> {
    // Priority: ID > data-testid > class > nth-child
    if (node.attributes) {
      const attrs = this.parseAttributes(node.attributes)

      if (attrs.id) return `#${attrs.id}`
      if (attrs['data-testid']) return `[data-testid="${attrs['data-testid']}"]`
      if (attrs.class) {
        const classes = attrs.class.split(' ').filter(c => c.trim())
        if (classes.length > 0) {
          return `${node.nodeName.toLowerCase()}.${classes.join('.')}`
        }
      }
    }

    // Fallback: nth-child path
    return `${node.nodeName.toLowerCase()}:nth-child(${node.nodeIndex || 1})`
  }

  private parseAttributes(attrArray: string[]): Record<string, string> {
    const result: Record<string, string> = {}
    for (let i = 0; i < attrArray.length; i += 2) {
      result[attrArray[i]] = attrArray[i + 1]
    }
    return result
  }

  private async captureElementScreenshot(boxModel: CDP.DOM.BoxModel): Promise<string> {
    if (!this.browserView) return ''

    const image = await this.browserView.webContents.capturePage({
      x: Math.round(boxModel.border[0]),
      y: Math.round(boxModel.border[1]),
      width: Math.round(boxModel.width),
      height: Math.round(boxModel.height)
    })

    return image.toDataURL()
  }

  setBounds(bounds: { x: number; y: number; width: number; height: number }) {
    if (this.browserView) {
      this.browserView.setBounds(bounds)
    }
  }

  reload() {
    this.browserView?.webContents.reload()
  }

  goBack() {
    this.browserView?.webContents.goBack()
  }

  goForward() {
    this.browserView?.webContents.goForward()
  }

  openDevTools() {
    this.browserView?.webContents.openDevTools({ mode: 'detach' })
  }

  destroyBrowserView() {
    if (this.browserView && this.mainWindow) {
      this.mainWindow.contentView.removeChildView(this.browserView)
      this.cdpClient?.close()
      this.browserView.webContents.close()
      this.browserView = null
      this.cdpClient = null
    }
  }
}

export const browserManager = new BrowserManager()
```

---

## Data Flow

### Element Selection Flow

```
1. User clicks 🔍 Inspect button
   └─> BrowserToolbar sends: onInspectModeToggle()
       └─> BrowserTab calls IPC: 'browser:set-inspect-mode' { enabled: true }
           └─> BrowserManager.setInspectMode(true)
               └─> CDP: Overlay.setInspectMode({ mode: 'searchForNode' })

2. User hovers over element
   └─> CDP highlights element with box model overlay

3. User clicks element
   └─> CDP fires: 'inspectNodeRequested' { backendNodeId }
       └─> BrowserManager.extractElementData(backendNodeId)
           ├─> DOM.describeNode() → HTML, attributes
           ├─> CSS.getComputedStyleForNode() → styles
           ├─> DOM.getBoxModel() → dimensions
           ├─> generateSelector() → CSS selector
           └─> captureElementScreenshot() → image

4. Element data sent to renderer
   └─> IPC: 'browser:element-selected' { ElementContext }
       └─> BrowserTab receives event
           └─> setSelectedElement(elementData)
               └─> InspectorPanel - Element Tab displays data

5. User clicks [Add to Chat]
   └─> onAddToChat(elementContext)
       └─> ChatPanel.addContextToChat(elementContext)
           └─> Context Pill created
```

### Console Logs Injection Flow

```
1. Browser executes console.log/warn/error
   └─> WebContents 'console-message' event fires
       └─> BrowserManager captures log
           └─> IPC: 'browser:console-log' { ConsoleLog }
               └─> BrowserTab receives
                   └─> Adds to consoleLogs state array
                       └─> InspectorPanel - Console Tab updates

2. User clicks 🐛 Console Logs button (in Chat Input)
   └─> ChatPanel.handleInjectConsoleLogs()
       ├─> Collects all consoleLogs from current browser tab
       ├─> Creates ConsoleLogsContext object
       ├─> addContextToChat(consoleLogsContext)
       └─> Context Pill created with expandable log list

3. AI receives message with context
   └─> Analyzes logs
   └─> Generates fix
   └─> Updates code
```

---

## Platform Support

### Supported Platforms

| Platform | Support Level | Dev Server | Element Inspect | Notes |
|----------|---------------|------------|-----------------|-------|
| **React (Vite)** | ✅ Full | localhost:5173 | ✅ | Cursor confirmed |
| **Next.js** | ✅ Full | localhost:3000 | ✅ | Cursor confirmed |
| **Vue** | ✅ Full | localhost:8080 | ✅ | Full compatibility |
| **Angular** | ✅ Full | localhost:4200 | ✅ | Full compatibility |
| **Svelte** | ✅ Full | localhost:5000 | ✅ | Vite-based |
| **React Native** | ⚠️ Limited | Extension required | ❌ | Radon IDE extension |
| **Expo Web** | ✅ Full | localhost:19006 | ✅ | Compiles to web |
| **Electron (Web)** | ⚠️ Partial | localhost:9080 | ✅ | Renderer only |
| **Flutter Web** | ⚠️ Estimated | localhost | ⚠️ | Not officially tested |
| **iOS/Android** | ❌ None | N/A | ❌ | Simulator required |

### Technical Limitations

Based on Cursor research:

**Works:**
- HTML5, CSS3, ES Modules
- React/Next.js dev servers
- DevTools (Elements, Console, Network)

**Limited:**
- Service Workers (unstable)
- WebAuthn (limited)
- Push Notifications (limited)
- Hardware-backed credentials (limited)

**Recommendation:**
> Use Octave Browser Mode for rapid development. Validate auth, caching, and device features in actual browsers.

---

## API Reference

### IPC Handlers (Main Process)

#### `browser:create`
```typescript
ipcMain.handle('browser:create', async (event, url: string) => {
  return await browserManager.createBrowserView(url)
})
// Response: { success: boolean, viewId?: string, error?: string }
```

#### `browser:set-bounds`
```typescript
ipcMain.handle('browser:setBounds', (event, bounds: Rectangle) => {
  browserManager.setBounds(bounds)
  return { success: true }
})
```

#### `browser:set-inspect-mode`
```typescript
ipcMain.handle('browser:set-inspect-mode', async (event, enabled: boolean) => {
  await browserManager.setInspectMode(enabled)
  return { success: true }
})
```

#### `browser:navigate`
```typescript
ipcMain.handle('browser:navigate', async (event, url: string) => {
  await browserManager.navigate(url)
  return { success: true }
})
```

#### `browser:reload`
```typescript
ipcMain.handle('browser:reload', () => {
  browserManager.reload()
  return { success: true }
})
```

#### `browser:go-back`
```typescript
ipcMain.handle('browser:goBack', () => {
  browserManager.goBack()
  return { success: true }
})
```

#### `browser:go-forward`
```typescript
ipcMain.handle('browser:goForward', () => {
  browserManager.goForward()
  return { success: true }
})
```

#### `browser:open-devtools`
```typescript
ipcMain.handle('browser:openDevTools', () => {
  browserManager.openDevTools()
  return { success: true }
})
```

#### `browser:destroy`
```typescript
ipcMain.handle('browser:destroy', () => {
  browserManager.destroyBrowserView()
  return { success: true }
})
```

---

### IPC Events (Main → Renderer)

#### `browser:console-log`
```typescript
ipcRenderer.on('browser:console-log', (event, log: ConsoleLog) => {
  // Handle console log
})
```

#### `browser:element-selected`
```typescript
ipcRenderer.on('browser:element-selected', (event, element: ElementContext) => {
  // Handle selected element
})
```

#### `browser:navigated`
```typescript
ipcRenderer.on('browser:navigated', (event, data: { url: string, canGoBack: boolean, canGoForward: boolean }) => {
  // Update navigation state
})
```

#### `browser:loaded`
```typescript
ipcRenderer.on('browser:loaded', () => {
  // Page loaded
})
```

#### `browser:error`
```typescript
ipcRenderer.on('browser:error', (event, error: { errorCode: number, errorDescription: string }) => {
  // Handle error
})
```

---

## Implementation Phases

### Phase 1: Basic Browser Tab (2-3 days)
- Browser Tab type
- BrowserPanel component
- BrowserManager (Main Process)
- WebContentsView integration

### Phase 2: Inspector Panel (2 days)
- InspectorPanel component
- 4 tabs (Elements, Console, Network, Element)
- Console log capture
- Resizable panel

### Phase 3: Element Inspection (3-4 days)
- CDP integration
- Inspect Mode
- Element data extraction
- Screenshot capture

### Phase 4: Chat Integration (2 days)
- Element Context Pills
- Console Logs button (🐛)
- AI message format extension

### Phase 5: Dev Server Auto-detection (1 day)
- package.json parsing
- Port detection
- Auto-create browser tab

### Phase 6: Polish & Testing (2 days)
- Error handling
- Performance optimization
- Memory leak prevention

---

**Total Estimated Time: 12-16 days**
