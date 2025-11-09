# Browser Tab & Element Inspection Architecture

## Overview

This document describes the architecture for adding browser preview capabilities with element inspection to Octave, enabling developers to inspect UI elements, capture their context, and seamlessly integrate that information into AI-assisted coding workflows.

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Solution Architecture](#solution-architecture)
3. [Component Design](#component-design)
4. [Implementation Roadmap](#implementation-roadmap)
5. [Technical Decisions](#technical-decisions)
6. [API Reference](#api-reference)

---

## Problem Statement

### User Need

Developers need to:
- Preview their web application while coding
- Inspect UI elements visually
- Capture element context (HTML, CSS, selectors)
- Send that context to AI for code suggestions
- Implement changes and see results immediately

### Current Limitations

- No integrated browser preview
- No element inspection capability
- Manual copy-paste of HTML/CSS to chat
- Context switching between browser, editor, and chat
- No visual context in AI conversations

### Success Criteria

A successful implementation allows a developer to:
1. Open a browser tab showing their dev server
2. Enable inspect mode with one click
3. Hover over any element to see its box model
4. Click to select and capture element data
5. Add element context to chat with one click
6. Receive AI-generated code that targets the correct element
7. See changes reflected in browser via hot reload

---

## Solution Architecture

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
│               │  │  Browser View      │  │  │            │  │
│               │  │  (BrowserPanel)    │  │  │            │  │
│               │  │                    │  │  ├────────────┤  │
│               │  │  or                │  │  │            │  │
│               │  │                    │  │  │  Element   │  │
│               │  │  File Editor       │  │  │ Inspector  │  │
│               │  │  (EditorPanel)     │  │  │            │  │
│               │  │                    │  │  └────────────┘  │
│               │  └────────────────────┘  │                  │
│               │                          │                  │
└───────────────┴──────────────────────────┴──────────────────┘
```

### Process Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Renderer Process                          │
│  ┌──────────────┐        ┌──────────────┐                   │
│  │ BrowserPanel │        │  ChatPanel   │                   │
│  │   (React)    │        │   (React)    │                   │
│  └──────┬───────┘        └──────▲───────┘                   │
│         │                       │                            │
│         │ IPC                   │ IPC                        │
└─────────┼───────────────────────┼────────────────────────────┘
          │                       │
          ▼                       ▼
┌─────────────────────────────────────────────────────────────┐
│                     Main Process                             │
│  ┌──────────────────────────────────────────────┐            │
│  │         BrowserManager                       │            │
│  │  - BrowserView Lifecycle                     │            │
│  │  - Bounds Management                         │            │
│  │  - CDP Session Management                    │            │
│  └────────────────┬─────────────────────────────┘            │
│                   │                                          │
│                   ▼                                          │
│  ┌──────────────────────────────────────────────┐            │
│  │      ElementInspector (CDP Client)           │            │
│  │  - Overlay.setInspectMode()                  │            │
│  │  - DOM.describeNode()                        │            │
│  │  - CSS.getComputedStyleForNode()             │            │
│  │  - Page.captureScreenshot()                  │            │
│  └──────────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│              BrowserView Process (Chromium)                  │
│  - Actual web page rendering                                 │
│  - DevTools Protocol endpoint                                │
│  - JavaScript execution sandbox                              │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow: Element Selection

```
1. User clicks "Inspect" button
   └─> BrowserPanel sends IPC: 'browser:set-inspect-mode'
       └─> BrowserManager enables CDP Overlay.setInspectMode()

2. User hovers over element
   └─> CDP highlights element with box model overlay
   └─> Tooltip shows tag, size, selector

3. User clicks element
   └─> CDP fires 'inspectNodeRequested' event
       └─> ElementInspector.extractElementData()
           ├─> DOM.describeNode() → HTML, attributes
           ├─> CSS.getComputedStyleForNode() → styles
           ├─> DOM.getBoxModel() → dimensions
           ├─> generateSelector() → CSS selector
           └─> Page.captureScreenshot() → image

4. Element data sent to renderer
   └─> IPC: 'browser:element-selected'
       └─> ContextInspectorPanel displays data

5. User clicks "Add to Chat"
   └─> Element context added to ChatPanel
       └─> AI receives structured element data
```

---

## Component Design

### 1. Type System Extension

**File**: `octave/src/types/editor.ts`

```typescript
// New tab type
export type TabType = 'conversation' | 'file' | 'settings' | 'browser'

// Browser tab data structure
export interface BrowserTabData {
  url: string
  title?: string
  favicon?: string
  isLoading?: boolean
  devServerPort?: number
  workspaceId?: string
}

export interface BrowserTab extends BaseTab {
  type: 'browser'
  data: BrowserTabData
}

// Element context structure
export interface ElementContext {
  type: 'browser-element'
  selector: string
  tagName: string
  html: string
  computedStyles: Record<string, string>
  boxModel: {
    width: number
    height: number
    margin: [number, number, number, number]
    padding: [number, number, number, number]
    border: [number, number, number, number]
  }
  screenshot: string  // base64
  url: string
  timestamp: number
  filepath?: string   // Source file (if detectable)
}
```

### 2. BrowserPanel Component

**File**: `octave/src/components/browser/BrowserPanel.tsx`

**Responsibilities**:
- Render browser controls (URL bar, navigation)
- Manage BrowserView lifecycle via IPC
- Handle inspect mode toggle
- Display connection status
- Forward user interactions to main process

**Key Features**:
- Auto-detect dev server URL from workspace
- Toolbar with back/forward, refresh, DevTools
- Inspect mode toggle with visual feedback
- Loading indicator
- Error handling (server not running, etc.)

**Props**:
```typescript
interface BrowserPanelProps {
  url: string
  workspaceId?: string
  onElementSelected?: (element: ElementContext) => void
  onConsoleLog?: (log: ConsoleMessage) => void
  sessionId: string | null
}
```

### 3. BrowserManager (Main Process)

**File**: `octave/electron/browserManager.ts`

**Responsibilities**:
- Create and destroy BrowserView instances
- Calculate and update view bounds on resize
- Initialize CDP sessions
- Manage inspect mode state
- Forward CDP events to renderer

**Key Methods**:
```typescript
class BrowserManager {
  // Lifecycle
  createBrowserView(options: BrowserViewOptions): Promise<BrowserViewResult>
  destroyBrowserView(viewId: string): Promise<void>

  // Navigation
  navigate(viewId: string, url: string): Promise<void>
  reload(viewId: string): Promise<void>
  goBack(viewId: string): Promise<void>
  goForward(viewId: string): Promise<void>

  // Inspection
  setInspectMode(viewId: string, enabled: boolean): Promise<void>

  // CDP Integration
  private initializeCDP(view: BrowserView): Promise<CDP.Client>
  private extractElementData(nodeId: number): Promise<ElementContext>

  // Bounds Management
  updateViewBounds(viewId: string, bounds: Rectangle): void
}
```

### 4. ElementInspector Service

**File**: `octave/electron/services/elementInspector.ts`

**Responsibilities**:
- Interact with CDP Overlay domain
- Extract comprehensive element data
- Generate optimal CSS selectors
- Capture element screenshots

**Key Methods**:
```typescript
class ElementInspector {
  constructor(cdpClient: CDP.Client)

  // Enable highlighting on hover
  enableInspectMode(config: HighlightConfig): Promise<void>

  // Disable inspect mode
  disableInspectMode(): Promise<void>

  // Extract full element context
  extractElementData(nodeId: number): Promise<ElementContext>

  // Generate optimal selector
  generateSelector(node: CDP.DOM.Node): Promise<string>

  // Capture element screenshot
  captureElementScreenshot(boxModel: BoxModel): Promise<string>
}
```

### 5. ContextInspectorPanel Component

**File**: `octave/src/components/browser/ContextInspectorPanel.tsx`

**Responsibilities**:
- Display selected element information
- Show element screenshot preview
- Render HTML/CSS with syntax highlighting
- Visualize box model
- Provide "Add to Chat" action

**Sections**:
1. **Preview**: Element screenshot
2. **Selector**: CSS selector with copy button
3. **HTML**: Syntax-highlighted source
4. **Styles**: Key computed styles
5. **Box Model**: Interactive diagram
6. **Actions**: Add to chat, copy, open file

### 6. ChatPanel Integration

**File**: `octave/src/components/workspace/ChatPanel.tsx` (modified)

**Changes**:
- Accept `elementContext` prop
- Display context pills above input
- Include element data in AI messages
- Render element screenshots inline

**Context Pills**:
```tsx
<div className="flex gap-2 p-2 border-b">
  {contexts.map(ctx => (
    <ContextPill
      type="element"
      label={ctx.selector}
      preview={<img src={ctx.screenshot} />}
      onRemove={() => removeContext(ctx)}
    />
  ))}
</div>
```

---

## Implementation Roadmap

### Phase 1: UI Restructure (2-3 days)

**Goal**: Move chat to right sidebar, prepare for browser integration

**Tasks**:
1. Modify `App.tsx` layout
   - Move `ChatPanel` from tab content to right `Sidebar`
   - Create vertical `ResizablePanelGroup` for Chat + Inspector
   - Update state management for persistent chat

2. Test existing functionality
   - Ensure file editing still works
   - Verify workspace switching
   - Confirm keyboard shortcuts

**Files to modify**:
- `octave/src/App.tsx`
- `octave/src/components/editor/EditorGroupPanel.tsx`

**Validation**:
- [ ] Chat accessible from all tabs
- [ ] File editing unaffected
- [ ] Settings panel works
- [ ] No layout glitches

---

### Phase 2: Browser Tab Type (3-4 days)

**Goal**: Add browser tab type with basic navigation

**Tasks**:
1. Extend type system
   - Add `BrowserTab` to `editor.ts`
   - Create factory function
   - Add type guard

2. Create `BrowserPanel` component
   - Basic UI with toolbar
   - IPC communication setup
   - Container for BrowserView

3. Implement `BrowserManager` in main process
   - BrowserView lifecycle
   - Bounds calculation
   - Navigation handlers

4. Update `EditorGroupPanel`
   - Add `renderBrowser` prop
   - Handle browser tab rendering

**Files to create**:
- `octave/src/types/editor.ts` (modify)
- `octave/src/components/browser/BrowserPanel.tsx`
- `octave/src/components/browser/BrowserToolbar.tsx`
- `octave/electron/browserManager.ts`
- `octave/electron/handlers/browserHandlers.ts`

**Files to modify**:
- `octave/src/components/editor/EditorGroupPanel.tsx`
- `octave/src/App.tsx`
- `octave/electron/main.cjs`

**Validation**:
- [ ] Can create browser tab
- [ ] BrowserView renders correctly
- [ ] Can navigate to URLs
- [ ] Can switch between file/browser tabs
- [ ] Bounds update on window resize

---

### Phase 3: Dev Server Auto-Detection (2 days)

**Goal**: Automatically detect and open dev server

**Tasks**:
1. Create `DevServerDetector` service
   - Parse `package.json` scripts
   - Scan localhost ports
   - Detect common frameworks

2. Auto-create browser tab on workspace load
   - Check for running dev server
   - Parse framework config files
   - Open browser tab with detected URL

3. Monitor dev server lifecycle
   - Detect server start/stop
   - Show connection status
   - Auto-reload on server restart

**Files to create**:
- `octave/electron/services/devServerDetector.ts`

**Files to modify**:
- `octave/src/App.tsx` (workspace selection handler)
- `octave/electron/browserManager.ts`

**Validation**:
- [ ] Detects Vite dev server
- [ ] Detects Next.js dev server
- [ ] Detects Create React App
- [ ] Auto-opens browser tab on workspace load
- [ ] Shows status when server not running

---

### Phase 4: CDP Integration & Inspection (4-5 days)

**Goal**: Implement element hover inspection

**Tasks**:
1. Initialize CDP in `BrowserManager`
   - Connect to BrowserView debugger
   - Enable Overlay, DOM, CSS domains
   - Handle reconnection

2. Implement inspect mode
   - Toggle via toolbar button
   - Set CDP inspect mode with highlight config
   - Visual feedback in UI

3. Element data extraction
   - Listen to `inspectNodeRequested`
   - Extract HTML, styles, box model
   - Generate CSS selector
   - Capture screenshot

4. Create `ElementInspector` service
   - Encapsulate CDP operations
   - Provide clean API
   - Handle errors gracefully

**Files to create**:
- `octave/electron/services/elementInspector.ts`

**Files to modify**:
- `octave/electron/browserManager.ts`
- `octave/src/components/browser/BrowserPanel.tsx`
- `octave/src/components/browser/BrowserToolbar.tsx`

**Dependencies**:
```bash
npm install chrome-remote-interface
npm install --save-dev @types/chrome-remote-interface
```

**Validation**:
- [ ] Inspect mode highlights elements on hover
- [ ] Box model overlay shows correctly
- [ ] Click selects element
- [ ] Element data extracted completely
- [ ] Screenshot captured successfully

---

### Phase 5: Context Inspector UI (2-3 days)

**Goal**: Display element info, enable chat integration

**Tasks**:
1. Create `ContextInspectorPanel` component
   - Element preview section
   - Collapsible HTML/CSS display
   - Syntax highlighting
   - Copy buttons

2. Implement box model visualizer
   - Interactive diagram
   - Show dimensions
   - Highlight sections on hover

3. Add "Add to Chat" functionality
   - Create context pill UI
   - Attach to chat input
   - Format for AI consumption

**Files to create**:
- `octave/src/components/browser/ContextInspectorPanel.tsx`
- `octave/src/components/browser/BoxModelVisualizer.tsx`
- `octave/src/components/browser/ContextPill.tsx`

**Files to modify**:
- `octave/src/App.tsx` (add inspector to right sidebar)

**Validation**:
- [ ] Element info displays correctly
- [ ] HTML/CSS syntax highlighted
- [ ] Box model visualization accurate
- [ ] Can copy selector/HTML
- [ ] Add to chat creates context pill

---

### Phase 6: Chat Integration (3-4 days)

**Goal**: AI understands element context, generates targeted code

**Tasks**:
1. Extend message format
   - Include element context in prompt
   - Format HTML/CSS for model
   - Attach screenshot as base64

2. Implement smart prompting
   - Template for element-based queries
   - Include visual context
   - Reference correct selectors

3. Create workflow shortcuts
   - Quick actions (Fix, Explain, Optimize)
   - Auto-open related files
   - Apply AI suggestions

**Files to modify**:
- `octave/src/components/workspace/ChatPanel.tsx`
- `octave/electron/handlers/conversationHandlers.ts`

**Validation**:
- [ ] AI receives element context
- [ ] Generated code uses correct selectors
- [ ] File edits target right location
- [ ] Can iterate on changes
- [ ] Screenshot visible in conversation

---

### Phase 7: Resilience & Polish (2-3 days)

**Goal**: Handle edge cases, ensure stability

**Tasks**:
1. BrowserView crash recovery
   - Detect renderer crash
   - Auto-restart with last URL
   - Preserve inspect mode state

2. Dev server lifecycle handling
   - Connection status indicator
   - Graceful degradation
   - Reconnection logic

3. Performance optimization
   - Lazy-load BrowserView
   - Debounce hover events
   - Limit context history
   - Screenshot compression

4. Error handling
   - Invalid URLs
   - Network failures
   - CDP disconnections
   - Missing dev server

**Validation**:
- [ ] Survives BrowserView crash
- [ ] Handles dev server restart
- [ ] No memory leaks
- [ ] Smooth performance
- [ ] Clear error messages

---

## Technical Decisions

### 1. BrowserView vs WebView vs iframe

**Decision**: Use Electron `BrowserView`

**Rationale**:
- ✅ Full Chrome DevTools Protocol access
- ✅ Process isolation for security
- ✅ Native browser performance
- ✅ Direct control over Chromium instance
- ✅ No CORS limitations

**Trade-offs**:
- ⚠️ Main process management complexity
- ⚠️ Manual bounds calculation required
- ⚠️ More IPC overhead

**Alternatives considered**:
- `<webview>` tag: Deprecated, limited control
- `iframe`: Same-origin policy, no CDP access

---

### 2. Chat Location

**Decision**: Right sidebar (persistent across tabs)

**Rationale**:
- ✅ Chat is ongoing context, not a document
- ✅ Always accessible regardless of active tab
- ✅ Natural for element → chat workflow
- ✅ Matches user mental model

**Trade-offs**:
- ⚠️ Less horizontal space for content
- ⚠️ Requires resizable panels

---

### 3. Element Context Format

**Decision**: Structured JSON + screenshot

**Rationale**:
- ✅ AI parses structured data better than images alone
- ✅ Screenshot provides visual context
- ✅ Selector enables precise code generation
- ✅ Styles allow targeted modifications

**Format**:
```typescript
{
  type: 'browser-element',
  selector: 'button.submit:nth-child(2)',
  html: '<button class="submit">Click</button>',
  styles: { display: 'flex', ... },
  screenshot: 'data:image/png;base64,...',
  url: 'http://localhost:5173/dashboard'
}
```

---

### 4. CDP Session Management

**Decision**: One CDP session per BrowserView, lazy init

**Rationale**:
- ✅ Avoids overhead for non-inspect usage
- ✅ Clean separation between views
- ✅ Can reconnect on disconnect

**Lifecycle**:
- Initialize CDP when inspect mode first enabled
- Reuse session for multiple inspections
- Close session on BrowserView destroy

---

### 5. Selector Generation Strategy

**Decision**: Priority-based with fallbacks

**Algorithm**:
1. Use ID if unique: `#submit-button`
2. Use data-testid if present: `[data-testid="submit"]`
3. Use unique class combo: `.btn.btn-primary.submit`
4. Use nth-child path: `div:nth-child(2) > button:nth-child(3)`

**Rationale**:
- ✅ Prefers stable, semantic selectors
- ✅ Falls back to guaranteed unique paths
- ✅ Avoids overly complex selectors

---

## API Reference

### IPC Handlers (Main Process)

#### `browser:create`

Create new BrowserView instance.

**Request**:
```typescript
{
  url: string
  workspaceId?: string
  devTools?: boolean
  partition?: string
}
```

**Response**:
```typescript
{
  success: boolean
  viewId?: string
  error?: string
}
```

---

#### `browser:destroy`

Destroy BrowserView instance.

**Request**:
```typescript
viewId: string
```

**Response**:
```typescript
{
  success: boolean
}
```

---

#### `browser:set-inspect-mode`

Enable/disable element inspection.

**Request**:
```typescript
{
  viewId: string
  enabled: boolean
}
```

**Response**:
```typescript
{
  success: boolean
  error?: string
}
```

---

#### `browser:navigate`

Navigate to URL.

**Request**:
```typescript
{
  viewId: string
  url: string
}
```

**Response**:
```typescript
{
  success: boolean
}
```

---

#### `browser:update-bounds`

Update BrowserView bounds.

**Request**:
```typescript
{
  viewId: string
  bounds: {
    x: number
    y: number
    width: number
    height: number
  }
}
```

**Response**: None (one-way)

---

### IPC Events (Main → Renderer)

#### `browser:element-selected`

Emitted when user selects element in inspect mode.

**Payload**:
```typescript
{
  viewId: string
  selector: string
  tagName: string
  html: string
  computedStyles: Record<string, string>
  boxModel: BoxModel
  screenshot: string
  url: string
  timestamp: number
}
```

---

#### `browser:console-log`

Emitted when browser console logs message.

**Payload**:
```typescript
{
  viewId: string
  level: 'log' | 'warn' | 'error' | 'info'
  message: string
  timestamp: number
}
```

---

#### `browser:navigation`

Emitted when navigation occurs.

**Payload**:
```typescript
{
  viewId: string
  url: string
  title: string
  canGoBack: boolean
  canGoForward: boolean
}
```

---

## Development Workflow Example

### Typical User Flow

1. **Open workspace** → Dev server auto-detected → Browser tab opens
2. **Enable inspect mode** → Click inspect button in toolbar
3. **Hover over button** → Box model overlay appears
4. **Click button** → Element data captured
5. **Review in inspector** → See HTML, CSS, screenshot
6. **Click "Add to Chat"** → Context pill appears in chat
7. **Type request** → "Make this button bigger and blue"
8. **AI responds** → Generates CSS with correct selector
9. **Apply changes** → File opens in editor, code inserted
10. **See result** → Browser hot-reloads, button updated

### Dev Server Detection Example

```typescript
// Workspace has package.json with:
{
  "scripts": {
    "dev": "vite --port 3000"
  }
}

// DevServerDetector finds:
// 1. Script "dev" with "vite"
// 2. Port 3000 specified
// 3. Checks localhost:3000 → server running

// Result: Browser tab opens to http://localhost:3000
```

### Element Extraction Example

```typescript
// User clicks on:
<button class="btn btn-primary submit" id="submit-btn">
  Submit Form
</button>

// Extracted context:
{
  selector: "#submit-btn",
  tagName: "BUTTON",
  html: '<button class="btn btn-primary submit" id="submit-btn">Submit Form</button>',
  computedStyles: {
    display: "inline-flex",
    backgroundColor: "rgb(37, 99, 235)",
    color: "rgb(255, 255, 255)",
    fontSize: "16px",
    padding: "12px 24px",
    ...
  },
  boxModel: {
    width: 120,
    height: 48,
    margin: [0, 0, 0, 0],
    padding: [12, 24, 12, 24],
    border: [0, 0, 0, 0]
  },
  screenshot: "iVBORw0KGgoAAAANSUhEUg...",
  url: "http://localhost:3000/dashboard"
}
```

---

## Testing Strategy

### Unit Tests

- `BrowserManager.createBrowserView()`
- `ElementInspector.generateSelector()`
- `DevServerDetector.detect()`
- Tab type guards and factories

### Integration Tests

- Browser tab lifecycle (create, navigate, destroy)
- Inspect mode toggle
- Element selection workflow
- Chat context integration

### E2E Tests

- Open workspace → Browser tab appears
- Enable inspect → Hover → Select element
- Add to chat → AI generates code
- Apply code → See changes in browser

### Performance Tests

- BrowserView creation time < 500ms
- Element hover highlight < 50ms
- Screenshot capture < 300ms
- No memory leaks after 1hr usage

---

## Future Enhancements

### Multi-Device Preview
- Split view with multiple viewport sizes
- Responsive design testing
- Device emulation

### Network Inspector
- Monitor API calls
- Intercept and mock responses
- Performance metrics

### Console Integration
- Stream browser console to chat
- Error tracking and stack traces
- Live expression evaluation

### Visual Regression Testing
- Screenshot diffing
- Auto-detect visual changes
- Component library detection

### Component Detection
- Identify UI library (MUI, Shadcn, etc.)
- Suggest component alternatives
- Extract component props

---

## References

- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)
- [Electron BrowserView](https://www.electronjs.org/docs/latest/api/browser-view)
- [chrome-remote-interface](https://github.com/cyrus-and/chrome-remote-interface)
- [Overlay Domain](https://chromedevtools.github.io/devtools-protocol/tot/Overlay/)
- [DOM Domain](https://chromedevtools.github.io/devtools-protocol/tot/DOM/)

---

## Glossary

- **BrowserView**: Electron API for embedding browser content
- **CDP**: Chrome DevTools Protocol - API for browser automation
- **Element Context**: Structured data about a DOM element
- **Inspect Mode**: UI state where hovering highlights elements
- **Box Model**: CSS layout model (content, padding, border, margin)
- **Selector**: CSS selector string uniquely identifying an element
- **Dev Server**: Local development server (Vite, Next.js, etc.)
- **IPC**: Inter-Process Communication (Electron renderer ↔ main)
