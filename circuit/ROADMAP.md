# Circuit UX Roadmap - Frictionless Developer Experience

> **Mission**: Make test monitoring **always visible but never intrusive**

## Design Principles

1. **Zero Context Switching** - Never leave your editor
2. **Ambient Presence** - Always there, never in the way
3. **Keyboard First** - Minimize mouse dependency
4. **Native Feel** - Follow macOS HIG patterns
5. **Smart Notifications** - Only when action needed

---

## Phase 7: Circuit Peek - Non-Activating Floating Panel 🎯 NEXT

### Overview
A small, always-on-top floating panel that displays test status without stealing keyboard focus from your editor.

### Visual Design
```
Normal State (80px height):
┌──────────────┐
│ Circuit      │
├──────────────┤
│ 🟢 15 passed │
│ ⏱  0.34s     │
│ Auto-run: ☑️ │
└──────────────┘

Failure State (300px height):
┌──────────────────┐
│ Circuit          │
├──────────────────┤
│ 🔴 2 failed      │
│                  │
│ test.js:10       │
│ String concat... │
│                  │
│ [💡 Get AI Fix]  │
│ [🔄 Re-run]      │
└──────────────────┘

AI Processing (200px):
┌──────────────────┐
│ 🤖 Analyzing...  │
├──────────────────┤
│ Reading test.js  │
│ ▓▓▓▓▓░░░░ 55%   │
└──────────────────┘
```

### Technical Implementation

#### Window Configuration
```javascript
// electron/main.cjs
const peekPanel = new BrowserWindow({
  width: 220,
  height: 80,  // Auto-expand to 300 on failure
  type: 'panel',  // NSPanel
  alwaysOnTop: true,
  skipTaskbar: true,
  frame: false,
  transparent: true,
  hasShadow: true,
  roundedCorners: true,
  acceptsFirstMouse: false,  // ← KEY: Doesn't steal focus!
  resizable: false,
  minimizable: false,
  maximizable: false,
  closable: false,
  visibleOnAllWorkspaces: true,
  backgroundColor: '#00000000'  // Transparent
})
```

#### Smart Positioning
```javascript
// Position near active editor
function positionPeekPanel() {
  const activeEditor = detectActiveEditor()  // VS Code/Cursor
  const screen = electron.screen.getDisplayNearestPoint(
    activeEditor?.position || { x: 0, y: 0 }
  )

  // Right side, 100px from top
  peekPanel.setPosition(
    screen.bounds.x + screen.bounds.width - 240,
    screen.bounds.y + 100
  )
}

// Reposition when editor moves
app.on('browser-window-focus', positionPeekPanel)
```

#### Mouse Interaction Control
```javascript
// Let mouse events pass through until hover
peekPanel.setIgnoreMouseEvents(true, { forward: true })

ipcMain.on('peek:mouse-enter', () => {
  peekPanel.setIgnoreMouseEvents(false)
})

ipcMain.on('peek:mouse-leave', () => {
  peekPanel.setIgnoreMouseEvents(true, { forward: true })
})
```

#### UI Component
```tsx
// src/components/PeekPanel.tsx
export function PeekPanel() {
  const [testResult, setTestResult] = useState(null)
  const [isHovered, setIsHovered] = useState(false)

  useEffect(() => {
    ipcRenderer.on('test:result', (_, result) => {
      setTestResult(result)

      // Auto-expand on failure
      if (!result.success) {
        ipcRenderer.send('peek:expand', 300)
      } else {
        ipcRenderer.send('peek:collapse', 80)
      }
    })
  }, [])

  return (
    <div
      className="peek-panel"
      onMouseEnter={() => {
        setIsHovered(true)
        ipcRenderer.send('peek:mouse-enter')
      }}
      onMouseLeave={() => {
        setIsHovered(false)
        ipcRenderer.send('peek:mouse-leave')
      }}
      style={{
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(20px)',
        borderRadius: '12px',
        padding: '16px',
        color: 'white'
      }}
    >
      {testResult?.success ? (
        <SuccessView result={testResult} />
      ) : (
        <FailureView result={testResult} />
      )}
    </div>
  )
}
```

### Features
- ✅ Always visible in top-right corner
- ✅ Doesn't steal keyboard focus
- ✅ Auto-expands on test failure
- ✅ One-click "Get AI Fix"
- ✅ Mouse-through when not hovered
- ✅ Follows active editor across monitors

### Timeline
- **Day 1**: Basic NSPanel setup + positioning
- **Day 2**: Mouse interaction + auto-expand
- **Day 3**: UI polish + integration testing

---

## Phase 8: Circuit Notch - Dynamic Island Integration

### Overview
Transform MacBook's Notch into a live test status indicator using Dynamic Island-style animations.

### Visual States

#### Idle
```
     ╔═══╗
     ║ C ║  ← Small Circuit logo
     ╚═══╝
```

#### Running Tests
```
     ╔════════════╗
     ║ ▓▓▓▓░░ 7/15 ║  ← Progress bar + count
     ╚════════════╝
```

#### Test Failed (Auto-expand)
```
     ╔═══════════════════╗
     ║ 🔴 2 failed       ║
     ║ [💡 Get AI Fix]   ║  ← Clickable
     ╚═══════════════════╝
```

#### AI Processing
```
     ╔═══════════════════════════╗
     ║ 🤖 Analyzing test.js...   ║
     ║ ▓▓▓▓▓░░░░ 55%            ║
     ╚═══════════════════════════╝
```

#### Success (Shows 3s, then collapses)
```
     ╔════════╗
     ║ ✓ 15/15 ║
     ╚════════╝
```

### Technical Implementation

#### Using DynamicNotchKit
```swift
// We'll need a Swift helper app or use DynamicNotchKit library
import DynamicNotchKit

let notch = DynamicNotch.shared

// Show compact state
notch.showContent(.compact) {
  VStack {
    Text("C")
      .font(.system(size: 14, weight: .semibold))
  }
}

// Expand on failure
notch.expand(.extended) {
  VStack(spacing: 8) {
    HStack {
      Image(systemName: "xmark.circle.fill")
        .foregroundColor(.red)
      Text("2 failed")
    }

    Button(action: {
      // Trigger IPC to main process
      NotificationCenter.default.post(
        name: .init("circuit:get-ai-fix"),
        object: nil
      )
    }) {
      HStack {
        Image(systemName: "sparkles")
        Text("Get AI Fix")
      }
    }
  }
  .padding()
}
```

#### Bridge to Electron
```javascript
// electron/main.cjs
const { exec } = require('child_process')

// Launch helper app
const notchHelper = path.join(__dirname, 'NotchHelper.app')
exec(`open ${notchHelper}`)

// Communicate via IPC or custom protocol
function updateNotch(state) {
  // Send message to NotchHelper
  const message = JSON.stringify({
    type: state.success ? 'success' : 'failure',
    passed: state.passed,
    failed: state.failed,
    total: state.total
  })

  // Via custom URL scheme
  exec(`open circuit-notch://update?data=${encodeURIComponent(message)}`)
}
```

### Alternative: Pure Electron (No Swift)
```javascript
// Create transparent window at notch position
const notchWindow = new BrowserWindow({
  width: 200,
  height: 30,
  type: 'panel',
  transparent: true,
  frame: false,
  alwaysOnTop: true,
  level: 'screen-saver',  // Above everything
  hasShadow: false
})

// Position at notch
const primaryDisplay = screen.getPrimaryDisplay()
const { width } = primaryDisplay.bounds
notchWindow.setPosition(
  width / 2 - 100,  // Center
  0  // Top
)
```

### Features
- ✅ Ultra-visible - always in eyeline
- ✅ Live progress during test runs
- ✅ Color-coded states
- ✅ Click to trigger AI Fix
- ✅ Auto-collapse after success

### Limitations
- ⚠️ Requires MacBook Pro 2021+ with Notch
- ⚠️ May need Swift helper app for best results
- ⚠️ Complex implementation

### Timeline
- **Day 1-2**: Research DynamicNotchKit integration
- **Day 3-4**: Build Swift helper app
- **Day 5-6**: Electron ↔ Swift IPC bridge
- **Day 7**: Testing + polish

---

## Phase 9: Circuit Cmd+Tab Enhancement

### Overview
Show Circuit test status directly in macOS App Switcher (Cmd+Tab) with quick actions.

### Visual Design
```
Cmd+Tab pressed:
┌────────────────────────────────────────────┐
│ [VS Code]  [Safari]  [Circuit●]  [Slack]  │
└────────────────────────────────────────────┘
                       ↓
              Tab to Circuit icon
                       ↓
┌──────────────────────────────────────────────┐
│              [Circuit●]                       │
│  ┌──────────────────────────────────┐        │
│  │ 🔴 2 tests failed                │        │
│  │                                  │        │
│  │ test.js:10 - String concat       │        │
│  │                                  │        │
│  │ ⌨️  Quick Actions:                │        │
│  │ Enter - Get AI Fix               │        │
│  │ R     - Re-run tests             │        │
│  │ G     - Go to failing test       │        │
│  └──────────────────────────────────┘        │
└──────────────────────────────────────────────┘
```

### Technical Implementation

#### Custom App Preview
```javascript
// electron/main.cjs
const { app } = require('electron')

// Set app icon with badge
function updateDockBadge(testResult) {
  if (testResult.success) {
    app.dock.setBadge('')
  } else {
    app.dock.setBadge(String(testResult.failed))
  }
}

// Set thumbnail for Cmd+Tab preview
app.on('browser-window-created', (event, window) => {
  // Render custom preview
  window.setThumbnailClip({ x: 0, y: 0, width: 400, height: 300 })
  window.setThumbnailToolTip(
    testResult.success
      ? `Circuit: All ${testResult.total} tests passed`
      : `Circuit: ${testResult.failed} tests failed`
  )
})
```

#### Quick Actions via Global Shortcuts
```javascript
// Listen for keys while Cmd+Tab is active
const { globalShortcut } = require('electron')

app.on('browser-window-focus', (event, window) => {
  // Register temporary shortcuts
  globalShortcut.register('CommandOrControl+Tab+Return', () => {
    // Trigger AI Fix
    handleGetAiFix()
  })

  globalShortcut.register('CommandOrControl+Tab+R', () => {
    // Re-run tests
    handleRunTest()
  })
})

app.on('browser-window-blur', () => {
  // Unregister when focus lost
  globalShortcut.unregisterAll()
})
```

#### Enhanced Preview Window
```javascript
// Create offscreen window for preview rendering
const previewWindow = new BrowserWindow({
  show: false,
  width: 400,
  height: 300,
  webPreferences: {
    offscreen: true
  }
})

previewWindow.webContents.on('paint', (event, dirty, image) => {
  // Use this image for Cmd+Tab preview
  mainWindow.setThumbnailImage(image)
})
```

### Features
- ✅ Zero learning curve (Cmd+Tab muscle memory)
- ✅ Glance at status without opening app
- ✅ Keyboard shortcuts for instant actions
- ✅ Works with existing workflow

### Limitations
- ⚠️ macOS API limitations for custom previews
- ⚠️ May need to use Accessibility APIs

### Timeline
- **Day 1**: Dock badge + basic preview
- **Day 2**: Custom preview rendering
- **Day 3**: Global shortcut integration

---

## Research & Inspiration

### Products Studied
1. **DynamicLake/NotchNook** - Dynamic Island for Mac
2. **FlowDeck** - iOS preview in Cursor (no alt-tab)
3. **Cursor/Copilot** - Inline diff suggestions
4. **Macscope** - Enhanced Cmd+Tab
5. **GroupTab** - Grouped app switching
6. **Things 3** - Quick Entry window (Ctrl+Space)
7. **Arc Browser** - Auto-hide sidebar
8. **Bartender** - Smart menu bar reveals

### Key Learnings
- **Non-activating windows** (`acceptsFirstMouse: false`) prevent focus stealing
- **NSPanel** type for utility windows that float
- **Mouse-through** for ambient displays
- **Smart reveals** on state change (Bartender pattern)
- **Progress in Notch** is most visible location
- **Cmd+Tab enhancement** leverages existing muscle memory

---

## Future Ideas (Beyond Phase 9)

### Circuit Widget (macOS Sonoma)
Desktop widget showing test status
- Requires WidgetKit (Swift)
- Always visible on desktop
- Click to open Circuit

### VS Code Extension
Inline integration with editor
- Status bar item
- Quick Fix provider
- Inline error decorations

### Notification Center Widget
Test history + statistics
- Last 10 test runs
- Success rate graph
- Click to re-run

### Shortcuts App Integration
Trigger tests via Shortcuts.app
- "Run Circuit Tests"
- "Get AI Fix for Last Failure"
- Automation support

---

## Success Metrics

### Phase 7-9 Goals
- **Context switches**: Reduce by 80%
- **Time to fix**: Under 30 seconds (from failure to applied fix)
- **User actions**: Max 2 clicks for entire flow
- **Visibility**: 100% awareness of test status
- **Intrusiveness**: 0 unwanted interruptions

### User Testing Questions
1. Did you notice test failures immediately?
2. How many times did you switch apps?
3. Was the UI distracting while coding?
4. Would you use this daily?
5. What's your #1 feature request?

---

**Last Updated**: 2025-01-22
**Next Review**: After Phase 7 completion
