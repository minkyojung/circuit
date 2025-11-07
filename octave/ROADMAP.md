# Octave UX Roadmap - Frictionless Developer Experience

> **Mission**: Make workspace management **always visible but never intrusive**

## Design Principles

1. **Zero Context Switching** - Never leave your editor
2. **Ambient Presence** - Always there, never in the way
3. **Keyboard First** - Minimize mouse dependency
4. **Native Feel** - Follow macOS HIG patterns
5. **Smart Notifications** - Only when action needed

---

## Phase 7: Octave Peek - Corner-Anchored Mini Panel 🎯 NEXT

### Overview
A Monologue-style corner-anchored panel that stays minimal as a dot, expands on hover/events, and provides ambient test status without stealing focus.

### Design Philosophy
- **Ambient by default**: Small dot (40x40px) in corner
- **Smart expansion**: Auto-expands based on state (hover, test running, test failed)
- **Hook-based triggers**: Event-driven architecture for maximum flexibility
- **Non-intrusive**: Never steals keyboard focus, mouse-through when idle

### Visual States
```
State 1: Dot (40x40px) - Idle/Normal
   ┌──┐
   │● │  Color-coded: Green/Red/Yellow/Gray
   └──┘

State 2: Compact (180x60px) - Hover or Running
   ┌────────────────┐
   │ ● Running...   │
   │ ▓▓▓▓░░░░ 7/15 │
   └────────────────┘

State 3: Compact Success (180x60px) - Auto-dismiss 3s
   ┌────────────────┐
   │ ✓ All passed!  │
   │ 15/15 in 1.2s  │
   └────────────────┘

State 4: Expanded (280x140px) - Test Failed
   ┌─────────────────────────┐
   │ ● 2/15 failed          │
   │                         │
   │ test.ts:42             │
   │ "Cannot read prop..."  │
   │                         │
   │ [💡 Get AI Fix]  [🔄]  │
   └─────────────────────────┘
```

### Technical Implementation

#### 1. Hook-Based Trigger System
```typescript
// src/hooks/usePeekPanel.ts
export type PanelState = 'hidden' | 'dot' | 'compact' | 'expanded'

interface PanelConfig {
  state: PanelState
  width: number
  height: number
  autoDismiss?: number // ms
}

const PANEL_CONFIGS: Record<PanelState, PanelConfig> = {
  hidden: { state: 'hidden', width: 0, height: 0 },
  dot: { state: 'dot', width: 40, height: 40 },
  compact: { state: 'compact', width: 180, height: 60, autoDismiss: 3000 },
  expanded: { state: 'expanded', width: 280, height: 140 }
}

export function usePeekPanel() {
  const [state, setState] = useState<PanelState>('dot')
  const [data, setData] = useState<any>(null)

  const show = useCallback((newState: PanelState, newData?: any) => {
    setState(newState)
    if (newData) setData(newData)

    const config = PANEL_CONFIGS[newState]
    window.electron.ipcRenderer.send('peek:resize', {
      width: config.width,
      height: config.height
    })

    // Auto-dismiss for success states
    if (config.autoDismiss) {
      setTimeout(() => {
        setState('dot')
        window.electron.ipcRenderer.send('peek:resize', { width: 40, height: 40 })
      }, config.autoDismiss)
    }
  }, [])

  // Event listeners - auto-triggered by test events
  useEffect(() => {
    const handleTestStarted = () => show('compact', { status: 'running' })
    const handleTestCompleted = (_, result) => {
      if (result.success) {
        show('compact', { status: 'success', ...result })
      } else {
        show('expanded', { status: 'failed', ...result })
      }
    }

    window.electron.ipcRenderer.on('test:started', handleTestStarted)
    window.electron.ipcRenderer.on('test:completed', handleTestCompleted)

    return () => {
      window.electron.ipcRenderer.off('test:started', handleTestStarted)
      window.electron.ipcRenderer.off('test:completed', handleTestCompleted)
    }
  }, [show])

  return { state, data, show, showDot: () => show('dot'),
           showCompact: (d) => show('compact', d),
           showExpanded: (d) => show('expanded', d) }
}
```

#### 2. Window Configuration (Electron Main)
```javascript
// electron/main.cjs
function createPeekWindow() {
  const { screen } = require('electron')
  const display = screen.getPrimaryDisplay()

  const peekWindow = new BrowserWindow({
    width: 40,  // Start as dot
    height: 40,
    x: display.bounds.width - 60,  // Top-right corner
    y: 100,
    type: 'panel',
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: true,
    acceptsFirstMouse: false,  // KEY: No focus steal!
    resizable: false,
    visibleOnAllWorkspaces: true,
    backgroundColor: '#00000000'
  })

  // Start with mouse-through (until hover)
  peekWindow.setIgnoreMouseEvents(true, { forward: true })

  return peekWindow
}

// IPC Handlers
ipcMain.on('peek:resize', (_, { width, height }) => {
  peekWindow.setSize(width, height)

  // Enable/disable mouse events based on size
  if (width === 40 && height === 40) {
    peekWindow.setIgnoreMouseEvents(true, { forward: true })
  } else {
    peekWindow.setIgnoreMouseEvents(false)
  }
})

ipcMain.on('peek:mouse-enter', () => {
  peekWindow.setIgnoreMouseEvents(false)
})

ipcMain.on('peek:mouse-leave', () => {
  // Only make mouse-through if in dot state
  const bounds = peekWindow.getBounds()
  if (bounds.width === 40) {
    peekWindow.setIgnoreMouseEvents(true, { forward: true })
  }
})
```

#### 3. UI Component with Hook Integration
```tsx
// src/components/PeekPanel.tsx
import { usePeekPanel } from '../hooks/usePeekPanel'

export function PeekPanel() {
  const panel = usePeekPanel()

  // Manual triggers (keyboard shortcuts)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === 't') {
        // Cmd+T: Toggle expanded view
        panel.state === 'dot' ? panel.showExpanded() : panel.showDot()
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [panel])

  if (panel.state === 'hidden') return null

  return (
    <div
      className="peek-panel"
      onMouseEnter={() => {
        window.electron.ipcRenderer.send('peek:mouse-enter')
        if (panel.state === 'dot') {
          panel.showCompact({ hover: true })
        }
      }}
      onMouseLeave={() => {
        window.electron.ipcRenderer.send('peek:mouse-leave')
        if (panel.data?.hover && panel.state === 'compact') {
          panel.showDot()
        }
      }}
      style={{
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(20px)',
        borderRadius: '12px',
        padding: panel.state === 'dot' ? '8px' : '16px',
        color: 'white'
      }}
    >
      {panel.state === 'dot' && <DotView status={panel.data?.status} />}
      {panel.state === 'compact' && <CompactView data={panel.data} />}
      {panel.state === 'expanded' && <ExpandedView data={panel.data} />}
    </div>
  )
}
```

### Trigger Modes

#### 1. Automatic (Event-Driven)
```typescript
// Test events automatically trigger panel
ipcRenderer.send('test:started')     // → Compact "Running..."
ipcRenderer.send('test:completed', result)
  // → Compact "Success" (3s) OR Expanded "Failed"
```

#### 2. Manual (Programmatic)
```typescript
// From any component
const panel = usePeekPanel()
panel.showExpanded({ customData: '...' })  // Direct control
```

#### 3. User-Triggered (Keyboard/Mouse)
```typescript
// Keyboard shortcut
Cmd+T → Toggle expanded view

// Mouse hover
Hover dot → Show compact view
Leave → Collapse to dot (if not important state)
```

#### 4. Custom Hooks (Extensible)
```typescript
// Register custom triggers
panel.registerTrigger('custom:event', (data) => {
  panel.showExpanded(data)
})
```

### Features
- ✅ **Minimal by default**: 40x40px dot in corner
- ✅ **Smart expansion**: Auto-expands based on importance
- ✅ **Hook-based triggers**: Event-driven + manual control
- ✅ **No focus steal**: `acceptsFirstMouse: false`
- ✅ **Mouse-through**: Transparent to clicks when idle
- ✅ **Auto-dismiss**: Success states collapse after 3s
- ✅ **Keyboard control**: Cmd+T toggle
- ✅ **Color-coded**: Green/Red/Yellow/Gray status

### Timeline
- **Day 1**: Hook system + basic window setup
- **Day 2**: State transitions + auto-expand logic
- **Day 3**: UI polish + keyboard shortcuts
- **Day 4**: Integration with existing test runner

---

## Phase 8: Octave Cmd+Tab Enhancement

### Overview
Show Octave test status directly in macOS App Switcher (Cmd+Tab) with quick actions.

### Visual Design
```
Cmd+Tab pressed:
┌────────────────────────────────────────────┐
│ [VS Code]  [Safari]  [Octave●]  [Slack]  │
└────────────────────────────────────────────┘
                       ↓
              Tab to Octave icon
                       ↓
┌──────────────────────────────────────────────┐
│              [Octave●]                       │
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
      ? `Octave: All ${testResult.total} tests passed`
      : `Octave: ${testResult.failed} tests failed`
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
1. **Monologue** - Corner-anchored voice dictation panel (Every.to)
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
- **Corner-anchored panels** provide ambient awareness without intrusion
- **Cmd+Tab enhancement** leverages existing muscle memory

---

## Future Ideas (Beyond Phase 8)

### Octave Widget (macOS Sonoma)
Desktop widget showing test status
- Requires WidgetKit (Swift)
- Always visible on desktop
- Click to open Octave

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
- "Run Octave Tests"
- "Get AI Fix for Last Failure"
- Automation support

---

## Success Metrics

### Phase 7-8 Goals
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
