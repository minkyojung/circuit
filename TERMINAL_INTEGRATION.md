# Terminal Integration Manual

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Component Details](#component-details)
4. [Critical Problems Solved](#critical-problems-solved)
5. [Design Decisions](#design-decisions)
6. [Common Pitfalls](#common-pitfalls)
7. [Styling System](#styling-system)
8. [Future Improvements](#future-improvements)

---

## Overview

This document describes the integrated terminal system in Octave, which provides workspace-isolated terminal sessions within the TodoPanel. Each workspace gets its own persistent PTY (pseudo-terminal) session that survives workspace switching.

### Key Features
- **Workspace Isolation**: Each workspace has its own terminal session
- **Persistent Sessions**: Terminal state persists when switching between workspaces
- **Transparent Background**: Terminal integrates seamlessly with TodoPanel design
- **Resizable**: Terminal height adjustable via drag handle
- **Full Terminal Emulation**: Powered by xterm.js with Canvas rendering

### Technology Stack
- **Frontend Terminal**: xterm.js with Canvas addon
- **Backend PTY**: node-pty for spawning shell processes
- **IPC**: Electron IPC for renderer ↔ main process communication
- **Styling**: CSS variables with xterm.css override approach

---

## Architecture

### Three-Layer Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Terminal.tsx                         │
│  (React Component - DOM lifecycle & attachment)         │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ↓
┌─────────────────────────────────────────────────────────┐
│                 TerminalContext.tsx                     │
│  (State Management - xterm instances & workspace map)  │
└─────────────────────┬───────────────────────────────────┘
                      │ IPC
                      ↓
┌─────────────────────────────────────────────────────────┐
│              terminalManager.ts (Main)                  │
│  (PTY Sessions - shell process management)              │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

**Terminal Creation:**
```
1. Terminal.tsx calls getOrCreateTerminal(workspaceId, path)
2. TerminalContext creates xterm instance (NO PTY yet)
3. Terminal.tsx attaches xterm to DOM with terminal.open()
4. Terminal.tsx calls createPtySession(workspaceId, path)
5. TerminalContext requests PTY via IPC
6. terminalManager.ts spawns shell process
7. PTY output flows: shell → IPC → TerminalContext → xterm
```

**Key Insight**: PTY creation is delayed until after `terminal.open()` to prevent output buffering issues.

### Workspace Switching

```
User switches workspace
    ↓
TodoPanel key changes (key={workspace.id})
    ↓
Terminal.tsx unmounts and remounts
    ↓
getOrCreateTerminal() returns EXISTING terminal data
    ↓
Terminal element re-attached to new DOM container
    ↓
PTY session continues running (no interruption)
```

The terminal instance and PTY session persist - only the DOM attachment changes.

---

## Component Details

### 1. terminalManager.ts (Main Process)

**Location**: `circuit/electron/terminalManager.ts`

**Responsibilities**:
- Spawn PTY sessions using node-pty
- Manage shell process lifecycle
- Handle PTY output and forward to renderer
- Handle terminal resize events
- Clean up PTY on session destruction

**Key APIs**:
```typescript
// IPC Handlers
'terminal:create-session' → createTerminal(workspaceId, workspacePath)
'terminal:write'          → writeToTerminal(workspaceId, data)
'terminal:resize'         → resizeTerminal(workspaceId, cols, rows)
'terminal:destroy-session' → destroyTerminal(workspaceId)

// IPC Senders (to renderer)
'terminal:data' → Sends PTY output to renderer
```

**Session Storage**:
```typescript
const terminals = new Map<string, IPty>()
// Key: workspaceId
// Value: node-pty instance
```

**Shell Selection**:
- macOS/Linux: Uses `$SHELL` environment variable (typically zsh or bash)
- Windows: Uses PowerShell
- Working directory: Set to workspace path

### 2. TerminalContext.tsx (Renderer Process)

**Location**: `circuit/src/contexts/TerminalContext.tsx`

**Responsibilities**:
- Create and manage xterm.js instances
- Map workspaceId → TerminalData
- Handle IPC communication with main process
- Track PTY session creation state
- Provide terminal operations to components

**State Structure**:
```typescript
interface TerminalData {
  terminal: XTermTerminal        // xterm.js instance
  addons: {
    fitAddon: FitAddon          // Auto-fit terminal to container
    webLinksAddon: WebLinksAddon // Clickable URLs
  }
  isAttached: boolean            // Has terminal.open() been called?
  hasInitialized: boolean        // Has PTY session been created?
  onDataDisposable?: IDisposable // Event handler cleanup
}

// Storage
const terminalsRef = useRef<Map<string, TerminalData>>(new Map())
const createdSessions = useRef<Set<string>>(new Set())
```

**Critical Functions**:

**getOrCreateTerminal(workspaceId, workspacePath)**
- Returns existing terminal or creates new xterm instance
- Does NOT create PTY session (deferred to Terminal.tsx)
- Sets up theme, fonts, addons
- Stores in terminalsRef Map

**createPtySession(workspaceId, workspacePath)**
- Creates PTY session via IPC
- Only called AFTER terminal.open() in Terminal.tsx
- Tracks created sessions to prevent duplicates
- Returns success/failure boolean

**IPC Data Handler**:
```typescript
useEffect(() => {
  const handler = (_: any, workspaceId: string, data: string) => {
    const terminalData = terminalsRef.current.get(workspaceId)
    if (terminalData?.isAttached) {
      terminalData.terminal.write(data)  // Write PTY output to xterm
    }
  }
  ipcRenderer.on('terminal:data', handler)
  return () => ipcRenderer.off('terminal:data', handler)
}, [])
```

### 3. Terminal.tsx (React Component)

**Location**: `circuit/src/components/Terminal.tsx`

**Responsibilities**:
- Manage terminal DOM attachment lifecycle
- Load Canvas addon for transparency
- Set up event handlers (onData, resize)
- Coordinate terminal initialization sequence
- Handle workspace switching re-attachment

**Initialization Sequence** (for new terminal):
```typescript
1. Load fonts (fontfaceobserver) - Wait up to 2s
2. Load Canvas addon - BEFORE terminal.open()
3. terminal.open(domElement) - Attach to DOM
4. Set isAttached = true
5. Register onData handler - User input → IPC
6. Fit terminal to container
7. createPtySession() - NOW create PTY (after terminal ready)
8. Setup ResizeObserver - Auto-fit on container resize
```

**Re-attachment Sequence** (existing terminal):
```typescript
1. Clear container DOM (remove old terminal element)
2. Append existing terminal.element
3. Fit terminal to new container
4. Resize observer continues working
```

**Cleanup on Unmount**:
```typescript
return () => {
  isMounted = false
  if (initPromptTimer) clearTimeout(initPromptTimer)
  if (resizeObserver) resizeObserver.disconnect()
}
```

**Critical Dependencies**:
```typescript
useEffect(..., [
  workspace.id,        // Re-run on workspace change
  getOrCreateTerminal, // Stable (useCallback)
  createPtySession,    // Stable (useCallback)
  workspace.path       // Needed for PTY creation
])
```

⚠️ **Warning**: Including `workspace.path` is necessary but can cause re-runs if the workspace object reference changes. This is acceptable because the `isMounted` guard prevents duplicate operations.

---

## Critical Problems Solved

### Problem 1: Black Background Instead of Transparent

**Symptom**: Terminal showed black background instead of transparent, breaking TodoPanel design.

**Root Cause**:
- WebGL renderer (default in xterm.js) does not support transparency
- This is a known limitation: xterm.js Issue #4212
- WebGL forces opaque background for accessibility and performance
- CSS `background: transparent !important` has no effect on WebGL canvas

**Solution**:
```typescript
// Load Canvas addon BEFORE terminal.open()
const { CanvasAddon } = await import('@xterm/addon-canvas')
terminal.loadAddon(new CanvasAddon())
terminal.open(terminalRef.current)
```

Canvas renderer fully supports transparency when `allowTransparency: true` is set.

**Why Load Before open()**:
- xterm.js selects renderer on first render
- Loading Canvas after open() requires re-opening terminal
- Order matters: addon → open → render

### Problem 2: Duplicate Prompts (Most Complex Issue)

**Symptom**: Shell prompt appeared twice on terminal initialization:
```
williamjung@macbook victoria %
williamjung@macbook victoria %
```

**Evolution of Attempts**:

**Attempt 1: Remove '\r' trigger**
- Problem: Terminal blank until user presses Enter
- Why: PTY output buffered before terminal ready

**Attempt 2: Re-add '\r' trigger with delay**
- Problem: Duplicates return
- Why: PTY outputs prompt + '\r' triggers second prompt

**Attempt 3: terminal.clear() + '\r' trigger**
- Problem: Still duplicates
- Why: terminal.clear() only clears xterm display, not PTY output buffer

**Final Solution: Delay PTY Creation**

**Root Cause Analysis**:
```
Timeline (BROKEN):
T=0ms:   getOrCreateTerminal() creates xterm AND PTY
T=0ms:   PTY spawns, shell outputs prompt → buffered
T=100ms: terminal.open() called
T=100ms: Buffered prompt displays (Prompt #1)
T=300ms: '\r' trigger fires → shell outputs prompt (Prompt #2)
Result: 2 prompts
```

```
Timeline (FIXED):
T=0ms:   getOrCreateTerminal() creates xterm only (NO PTY)
T=100ms: terminal.open() called
T=100ms: Terminal ready, no buffered data
T=150ms: createPtySession() creates PTY
T=150ms: Shell outputs prompt → displays immediately (Prompt #1)
Result: 1 prompt
```

**Implementation**:
```typescript
// TerminalContext.tsx
const getOrCreateTerminal = async (workspaceId, workspacePath) => {
  // Create xterm instance only
  const terminalData = { terminal, addons, isAttached: false, hasInitialized: false }
  terminals.set(workspaceId, terminalData)

  // DO NOT create PTY here!
  return terminalData
}

const createPtySession = async (workspaceId, workspacePath) => {
  // Create PTY session (called from Terminal.tsx after open)
  const result = await ipcRenderer.invoke('terminal:create-session', workspaceId, workspacePath)
  return result.success
}

// Terminal.tsx
terminal.open(terminalRef.current)  // Attach to DOM
terminalData.isAttached = true

// NOW create PTY after terminal is ready
if (!terminalData.hasInitialized) {
  terminalData.hasInitialized = true
  await createPtySession(workspace.id, workspace.path)
}
```

**Key Insight**: The PTY must not exist until the terminal can display its output. Buffering is the enemy.

### Problem 3: Terminal Content Requires Enter to Display

**Symptom**: After certain changes, terminal showed blank screen until user pressed Enter.

**Root Cause**: Canvas addon loaded AFTER terminal.open()

**Why This Matters**:
```typescript
// WRONG ORDER
terminal.open(ref)           // Renders with WebGL
loadAddon(new CanvasAddon()) // Too late, already rendered
// Result: First render fails, needs user interaction to refresh

// CORRECT ORDER
loadAddon(new CanvasAddon()) // Canvas ready
terminal.open(ref)           // Renders with Canvas
// Result: First render succeeds
```

**Solution**: Always load Canvas addon before calling `terminal.open()`.

### Problem 4: Font Weight Not Applying

**Symptom**: Setting `fontWeight: '300'` in xterm config had no visible effect.

**Root Cause**: xterm.css has default font weights that override JavaScript config.

**Solution**: Dual approach:
```typescript
// 1. JavaScript config (xterm API)
const terminal = new XTermTerminal({
  fontWeight: '300',
  fontWeightBold: '600'
})

// 2. CSS override (visual rendering)
.xterm {
  font-weight: 300 !important;
}
```

Both are needed because:
- JavaScript config: Sets xterm's internal font metrics
- CSS override: Actually renders light weight visually

### Problem 5: React Strict Mode Double-Mounting

**Symptom**: In development, useEffect runs twice causing issues.

**Solution**: Cleanup guards:
```typescript
useEffect(() => {
  let isMounted = true  // Guard flag
  let initPromptTimer: NodeJS.Timeout | null = null
  let resizeObserver: ResizeObserver | null = null

  // All async operations check isMounted
  if (!isMounted) return

  // Proper cleanup
  return () => {
    isMounted = false
    if (initPromptTimer) clearTimeout(initPromptTimer)
    if (resizeObserver) resizeObserver.disconnect()
  }
}, [workspace.id])
```

This prevents duplicate timers, duplicate observers, and duplicate PTY sessions.

---

## Design Decisions

### 1. Why Map Instead of useState for Terminals?

```typescript
// CHOSEN APPROACH
const terminalsRef = useRef<Map<string, TerminalData>>(new Map())

// NOT CHOSEN
const [terminals, setTerminals] = useState<Map<...>>(new Map())
```

**Reasons**:
1. **No re-renders needed**: Terminal instances are mutable, changes don't need React re-render
2. **Direct mutation safe**: useRef allows direct `.set()` without violating React principles
3. **Performance**: Avoid re-rendering entire component tree when terminal data changes
4. **Lifecycle**: Terminal instances should survive re-renders

### 2. Why Delay PTY Creation Until After terminal.open()?

**Alternative considered**: Create PTY immediately, buffer output until terminal ready.

**Problems with buffering approach**:
- Complex state management (pending data queue)
- Race conditions (what if multiple chunks arrive?)
- Memory overhead (large outputs could accumulate)
- Timing issues (when to flush buffer?)

**Advantages of delayed creation**:
- Simple: PTY output → terminal display (direct pipe)
- No buffering needed
- No race conditions
- Clean separation: xterm instance creation ≠ PTY session creation

### 3. Why Canvas Addon Instead of WebGL?

| Feature | WebGL | Canvas | DOM |
|---------|-------|--------|-----|
| **Transparency** | ❌ No | ✅ Yes | ✅ Yes |
| **Performance** | ⚡ Best | 🚀 Good | 🐌 Slow |
| **Memory** | 💾 Low | 💾 Medium | 💾 High |
| **Browser Support** | Some | All | All |

**Decision**: Canvas addon for transparency support while maintaining good performance.

### 4. Why Keep xterm.css Instead of Removing It?

**Attempted**: Remove xterm.css, copy essential styles to index.css.

**Result**: White box, broken functionality.

**Analysis**: xterm.css contains 50+ essential styles:
- `.xterm-helper-textarea` - IME input handling
- `.xterm-viewport` - Scroll area positioning
- `.xterm-screen canvas` - Text rendering layers
- Accessibility styles
- Selection styles
- Cursor animations

**Decision**: Keep xterm.css, override with CSS variables.

```css
/* Import library defaults */
@import '@xterm/xterm/css/xterm.css';

/* Override with custom values */
:root {
  --xterm-background: transparent;
  --xterm-font-weight: 300;
}

.xterm {
  background: var(--xterm-background) !important;
  font-weight: var(--xterm-font-weight) !important;
}
```

This provides:
- ✅ All essential xterm functionality
- ✅ Customizable styling
- ✅ Centralized control via CSS variables
- ✅ Maintainable (survives xterm.js updates)

### 5. Why workspace.id as React Key?

```typescript
<Terminal key={workspace.id} workspace={workspace} />
```

**Effect**: Complete unmount/remount when workspace changes.

**Why Not Persist Single Component?**:
- Simpler lifecycle management
- Clean separation between workspaces
- React handles cleanup automatically
- Terminal instance persists in TerminalContext (ref-based)

**What Actually Happens**:
- Component unmounts → cleanup runs
- Component remounts → useEffect re-runs
- getOrCreateTerminal() returns existing terminal instance
- Terminal element re-attached to new DOM
- No visible interruption to user

---

## Common Pitfalls

### Pitfall 1: Modifying Terminal During Render

❌ **WRONG**:
```typescript
function Terminal({ workspace }) {
  const { terminal } = getOrCreateTerminal(workspace.id)
  terminal.write('Hello')  // Mutation during render!
  return <div ref={ref} />
}
```

✅ **CORRECT**:
```typescript
function Terminal({ workspace }) {
  useEffect(() => {
    const { terminal } = await getOrCreateTerminal(workspace.id)
    terminal.write('Hello')  // Mutation in effect
  }, [workspace.id])
  return <div ref={ref} />
}
```

### Pitfall 2: Using terminal.clear() to Fix Duplicates

❌ **DOESN'T WORK**:
```typescript
terminal.open(ref)
terminal.clear()  // Only clears xterm display
// PTY output still in IPC channel, will appear
```

`terminal.clear()` only clears the xterm.js display buffer, not the PTY output buffer or IPC message queue.

### Pitfall 3: Including Unstable Dependencies

❌ **CAUSES INFINITE LOOP**:
```typescript
useEffect(() => {
  // ...
}, [workspace])  // Whole object, reference changes every render
```

✅ **STABLE DEPENDENCIES**:
```typescript
useEffect(() => {
  // ...
}, [workspace.id])  // Primitive value, stable
```

Exception: `workspace.path` is included despite being potentially unstable, but `isMounted` guard prevents duplicate operations.

### Pitfall 4: Forgetting Canvas Addon Load Order

❌ **WRONG ORDER**:
```typescript
terminal.open(ref)           // Renders immediately with WebGL
loadAddon(new CanvasAddon()) // Too late
```

✅ **CORRECT ORDER**:
```typescript
loadAddon(new CanvasAddon()) // Prepare renderer
terminal.open(ref)           // Render with Canvas
```

### Pitfall 5: Direct Map Mutation Without useRef

❌ **WRONG**:
```typescript
const [terminals] = useState(new Map())
terminals.set(id, data)  // Direct mutation, no setState!
// React doesn't know about the change
```

✅ **CORRECT**:
```typescript
const terminalsRef = useRef(new Map())
terminalsRef.current.set(id, data)  // Mutation allowed with useRef
```

### Pitfall 6: Forgetting Cleanup

❌ **MEMORY LEAK**:
```typescript
useEffect(() => {
  const observer = new ResizeObserver(...)
  observer.observe(ref.current)
  // No cleanup!
}, [])
```

✅ **WITH CLEANUP**:
```typescript
useEffect(() => {
  const observer = new ResizeObserver(...)
  observer.observe(ref.current)
  return () => observer.disconnect()
}, [])
```

### Pitfall 7: Creating PTY Before Terminal Ready

❌ **CAUSES DUPLICATES**:
```typescript
const terminal = new XTermTerminal()
await createPtySession()  // PTY outputs prompt → buffered
terminal.open(ref)        // Shows buffered prompt
// Later: trigger causes second prompt
```

✅ **CORRECT TIMING**:
```typescript
const terminal = new XTermTerminal()
terminal.open(ref)             // Terminal ready
await createPtySession()       // NOW create PTY
// PTY output goes directly to visible terminal
```

---

## Styling System

### CSS Architecture

```
┌──────────────────────────────────────────┐
│  xterm.css (library defaults)           │
│  - Essential functionality styles        │
│  - IME, accessibility, scroll, etc.      │
└──────────────┬───────────────────────────┘
               │ imported by
               ↓
┌──────────────────────────────────────────┐
│  index.css (custom overrides)            │
│  - CSS variables for customization       │
│  - !important overrides for specificity  │
└──────────────────────────────────────────┘
```

### CSS Variables

Defined in `:root` for centralized control:

```css
:root {
  --xterm-background: transparent;
  --xterm-font-weight: 300;
  --xterm-font-weight-bold: 600;
  --xterm-padding: 0;
}
```

### Override Pattern

```css
/* Base xterm styles */
.xterm {
  font-weight: var(--xterm-font-weight) !important;
  background: var(--xterm-background) !important;
}

/* All internal layers must be transparent */
.xterm .xterm-viewport,
.xterm .xterm-screen,
.xterm canvas {
  background-color: var(--xterm-background) !important;
}
```

**Why !important?**
- xterm.css has inline styles and high specificity
- Library styles should not override our design tokens
- !important is justified when overriding third-party defaults

### Theme Integration

Terminal colors sync with Octave design tokens:

```typescript
const getCSSVar = (varName: string) => {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim()
  // Convert HSL values to hsl() function
  if (value && !value.startsWith('#') && !value.startsWith('rgb')) {
    return `hsl(${value})`
  }
  return value
}

const terminal = new XTermTerminal({
  theme: {
    foreground: getCSSVar('--sidebar-foreground'),
    cursor: getCSSVar('--primary'),
    selectionBackground: getCSSVar('--accent').replace(')', ' / 0.3)'),
    // ... ANSI colors
  }
})
```

---

## Future Improvements

### 1. PTY Output Buffering

**Problem**: If terminal is not yet attached when PTY outputs data, that data is lost.

**Current**: Data handler checks `isAttached`:
```typescript
ipcRenderer.on('terminal:data', (_, workspaceId, data) => {
  const terminalData = terminalsRef.current.get(workspaceId)
  if (terminalData?.isAttached) {
    terminalData.terminal.write(data)  // Only write if attached
  }
  // else: data is lost!
})
```

**Improvement**: Buffer pending data:
```typescript
const pendingDataRef = useRef<Map<string, string[]>>(new Map())

ipcRenderer.on('terminal:data', (_, workspaceId, data) => {
  const terminalData = terminalsRef.current.get(workspaceId)

  if (terminalData?.isAttached) {
    terminalData.terminal.write(data)
  } else {
    // Buffer for later
    if (!pendingDataRef.current.has(workspaceId)) {
      pendingDataRef.current.set(workspaceId, [])
    }
    pendingDataRef.current.get(workspaceId)!.push(data)
  }
})

// In Terminal.tsx after open():
const pending = pendingDataRef.current.get(workspaceId) || []
pending.forEach(data => terminal.write(data))
pendingDataRef.current.delete(workspaceId)
```

### 2. Terminal Tabs

**Vision**: Multiple terminals per workspace (like VS Code).

**Architecture**:
```typescript
// Change from:
Map<workspaceId, TerminalData>

// To:
Map<workspaceId, {
  terminals: Map<terminalId, TerminalData>
  activeTerminalId: string
}>
```

**UI**: Tab bar above terminal showing multiple terminal instances.

### 3. Terminal Persistence

**Problem**: Terminal history lost on app restart.

**Solution**:
- Use xterm.js serialization addon
- Save terminal buffer to localStorage/file on app close
- Restore on app start

**Trade-offs**:
- Storage size (limit buffer size)
- Security (don't save sensitive data)
- Performance (async save/load)

### 4. Smart Font Scaling

**Current**: Fixed 13px font size.

**Improvement**: Scale with zoom level or user preference:
```typescript
const fontSize = useMemo(() => {
  const zoomLevel = parseFloat(localStorage.getItem('zoomLevel') || '1')
  return Math.round(13 * zoomLevel)
}, [zoomLevel])
```

### 5. Link Preview

**Current**: WebLinksAddon makes URLs clickable.

**Improvement**: Hover preview for links:
- File paths → show file type, size
- URLs → show preview card
- Git commits → show commit info

### 6. Terminal Search

**Addon**: @xterm/addon-search

```typescript
import { SearchAddon } from '@xterm/addon-search'

const searchAddon = new SearchAddon()
terminal.loadAddon(searchAddon)

// UI: Cmd+F to search terminal output
searchAddon.findNext('error')
```

### 7. Performance Monitoring

**Metrics to track**:
- Terminal creation time
- PTY spawn time
- Render time (first paint)
- Memory usage per terminal

**Implementation**:
```typescript
const metrics = {
  createStart: performance.now(),
  createEnd: 0,
  renderStart: 0,
  renderEnd: 0
}

// Log and send to analytics
console.log('[Perf]', metrics)
```

---

## Debugging Checklist

When terminal doesn't work as expected:

### Black Background?
- [ ] Canvas addon loaded?
- [ ] Canvas addon loaded BEFORE terminal.open()?
- [ ] allowTransparency: true set?
- [ ] CSS background: transparent set?

### Duplicate Prompts?
- [ ] PTY created AFTER terminal.open()?
- [ ] No manual '\r' triggers?
- [ ] hasInitialized flag working?
- [ ] React Strict Mode causing double mount?

### Blank Terminal?
- [ ] Canvas addon loaded before open()?
- [ ] Fonts loaded?
- [ ] PTY session created?
- [ ] Check console for IPC errors
- [ ] terminal.isAttached = true?

### Terminal Not Showing?
- [ ] terminalRef.current exists?
- [ ] terminal.open() called?
- [ ] DOM element visible (not display: none)?
- [ ] Check parent container height

### Input Not Working?
- [ ] onData handler registered?
- [ ] IPC 'terminal:write' working?
- [ ] PTY session exists in main process?

### Workspace Switching Broken?
- [ ] Terminal.tsx has key={workspace.id}?
- [ ] terminalsRef persists across renders?
- [ ] terminal.element exists?
- [ ] Re-attachment logic working?

---

## File Reference

### Core Files
- `circuit/electron/terminalManager.ts` - PTY session management (main process)
- `circuit/src/contexts/TerminalContext.tsx` - xterm instance management (renderer)
- `circuit/src/components/Terminal.tsx` - DOM lifecycle & attachment
- `circuit/src/components/TodoPanel.tsx` - Parent container
- `circuit/src/index.css` - Terminal styling

### Key Functions

**terminalManager.ts**:
- `createTerminal(workspaceId, workspacePath)` - Spawn PTY
- `writeToTerminal(workspaceId, data)` - Send input to PTY
- `resizeTerminal(workspaceId, cols, rows)` - Resize PTY
- `destroyTerminal(workspaceId)` - Kill PTY

**TerminalContext.tsx**:
- `getOrCreateTerminal(workspaceId, path)` - Create xterm instance
- `createPtySession(workspaceId, path)` - Create PTY session (NEW)
- `destroyTerminal(workspaceId)` - Cleanup terminal

**Terminal.tsx**:
- `initTerminal()` - Full initialization sequence
- useEffect cleanup - Prevent memory leaks

---

## Conclusion

The terminal integration is a complex system requiring careful coordination between:
- React component lifecycle
- xterm.js rendering lifecycle
- PTY process lifecycle
- IPC communication timing

The key to success is **respecting the order of operations**:

1. Create xterm instance (TerminalContext)
2. Load Canvas addon (Terminal.tsx)
3. Attach to DOM with terminal.open() (Terminal.tsx)
4. Create PTY session (Terminal.tsx → TerminalContext → Main)
5. PTY output flows naturally to visible terminal

When debugging, always check the **timing** first. Most issues stem from operations happening in the wrong order.

This architecture has proven stable and performant across workspace switching, rapid toggling, and long-running sessions. The delayed PTY creation pattern is the critical innovation that eliminated duplicate prompts and buffering issues.
