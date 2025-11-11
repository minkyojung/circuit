# Circuit/Octave Right Sidebar Structure Analysis

## Overview
The right sidebar in Circuit/Octave is a resizable panel containing a **TodoPanel** with Terminal integration. The sidebar is conditionally rendered in the main App.tsx and is toggleable via the header controls.

---

## 1. RIGHT SIDEBAR COMPONENT STRUCTURE

### Main Layout Flow (App.tsx, lines 1302-1316)

```typescript
{isRightSidebarOpen && (
  <Sidebar side="right" variant="inset" collapsible="none" className="w-[400px]">
    <TodoPanel
      conversationId={activeConversationId}
      workspace={selectedWorkspace}
      onCommit={() => setShowCommitDialog(true)}
      onFileSelect={handleFileSelect}
      onOpenSettings={handleOpenSettings}
      onRequestDirectEdit={(message) => {
        setChatPrefillMessage(message);
      }}
    />
  </Sidebar>
)}
```

**Key Properties:**
- `side="right"` - Positions sidebar on right edge
- `variant="inset"` - Uses sidebar styling system
- `collapsible="none"` - No collapse animation (fixed width)
- `className="w-[400px]"` - Fixed width of 400px
- Uses Shadcn `<Sidebar>` component wrapper

---

## 2. TODOPL PANEL STRUCTURE - Right Sidebar Content

### File Location
`/Users/williamjung/conductor/circuit/.conductor/stuttgart/octave/src/components/TodoPanel.tsx`

### Header Section (Lines 99-177)
```typescript
<SidebarHeader className="p-0 mt-[7px]" style={{ WebkitAppRegion: 'drag' } as any}>
  <div className="h-[36px] w-full flex flex-row items-center justify-between pl-2 pr-2">
    {/* Left icon group: Settings, Theme, Feedback */}
    <div className="flex items-center gap-2">
      {/* Settings Button - size: h-7 w-7 */}
      {/* Theme Toggle - size: h-7 w-7 */}
      {/* Feedback Button - size: h-7 w-7 */}
    </div>

    {/* Smart Git Actions button - Dropdown with primary action */}
    <DropdownMenu>
      {/* Primary button with ChevronDown trigger */}
    </DropdownMenu>
  </div>
</SidebarHeader>
```

### Content Section (Lines 179-202)
```typescript
<SidebarContent className="flex flex-col overflow-hidden p-0">
  <div className="h-full flex flex-col overflow-hidden">
    {/* Terminal Header */}
    <div className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-foreground border-b border-border">
      <TerminalIcon size={14} />
      <span>Terminal</span>
      <span className="text-[10px] text-muted-foreground">{workspace.displayName}</span>
    </div>

    {/* Terminal Content */}
    <div className="flex-1 overflow-hidden bg-transparent">
      <Terminal key={workspace.id} workspace={workspace} />
    </div>
  </div>
</SidebarContent>
```

---

## 3. TERMINAL INTEGRATION

### Terminal Component Stack
1. **Terminal.tsx** - Wrapper component (12 lines)
   - Always uses ClassicTerminal (stable xterm.js)

2. **ClassicTerminal.tsx** (216 lines)
   - Uses `@xterm/xterm/css/xterm.css`
   - Uses CanvasAddon for full transparency support
   - ResizeObserver for container size tracking
   - FitAddon for auto-sizing terminal
   - Terminal has 8px padding: `style={{ padding: '8px' }}`

### Key Terminal Styling
```typescript
<div
  ref={terminalRef}
  className="w-full h-full overflow-hidden bg-transparent"
  style={{
    padding: '8px',
    backgroundColor: 'transparent',
  }}
/>
```

---

## 4. SPLIT VIEW / RESIZABLE PANEL USAGE

### ResizablePanel Component
File: `/Users/williamjung/conductor/circuit/.conductor/stuttgart/octave/src/components/ui/resizable.tsx`

**Components:**
- `ResizablePanelGroup` - Container (uses `react-resizable-panels`)
- `ResizablePanel` - Individual panel
- `ResizableHandle` - Draggable separator with visual handle

**Current Usage in App.tsx (Split View Mode):**
```typescript
<ResizablePanelGroup direction="horizontal" className="h-full">
  <ResizablePanel defaultSize={50} minSize={30}>
    {/* Primary Editor Group - Left */}
  </ResizablePanel>
  <ResizableHandle />
  <ResizablePanel defaultSize={50} minSize={30}>
    {/* Secondary Editor Group - Right */}
  </ResizablePanel>
</ResizablePanelGroup>
```

**Future: Terminal Above Chat/Editor**
To add a Smart Commit UI above the terminal in the right sidebar, you would use vertical ResizablePanels:
```typescript
<ResizablePanelGroup direction="vertical" className="h-full">
  <ResizablePanel defaultSize={20} minSize={15}>
    {/* Smart Commit UI */}
  </ResizablePanel>
  <ResizableHandle />
  <ResizablePanel defaultSize={80} minSize={50}>
    {/* Terminal */}
  </ResizablePanel>
</ResizablePanelGroup>
```

---

## 5. DESIGN PATTERNS & STYLING

### Shadcn/UI Components Used
- **Sidebar** - Main container (left/right positioning)
- **SidebarHeader** - Fixed header area
- **SidebarContent** - Scrollable content area
- **Button** - Icon buttons with variants
- **DropdownMenu** - Smart Git Actions dropdown
- **Textarea** - Text input (see CommitInterface pattern)
- **Dialog** - Merge/Commit dialogs
- **Badge** - Status indicators

### Button Variants
From `src/components/ui/button.tsx`:
```typescript
const buttonVariants = cva(..., {
  variants: {
    variant: {
      default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
      destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
      success: "bg-success text-success-foreground shadow-sm hover:bg-success/90",
      warning: "bg-warning text-warning-foreground shadow-sm hover:bg-warning/90",
      secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
      ghost: "hover:bg-accent hover:text-accent-foreground",
      outline: "ring-1 ring-inset ring-input bg-background shadow-sm hover:bg-accent",
    },
    size: {
      icon: "h-9 w-9",
      sm: "h-8 rounded-md px-3 text-xs",
      default: "h-9 px-4 py-2",
      lg: "h-10 rounded-md px-8",
    }
  }
})
```

### Color System (Design Tokens)
From `design-tokens.css`:
```css
/* Semantic Colors */
--label-primary: rgba(0, 0, 0, 0.85);      /* Main text */
--label-secondary: rgba(0, 0, 0, 0.50);    /* Secondary text */
--separator-opaque: rgba(0, 0, 0, 0.1);    /* Dividers */

/* Interactive Colors */
--primary: [system primary]
--secondary: [system secondary]
--destructive: [system destructive]
--success: [system success]
--muted-foreground: [system muted text]

/* Spacing Scale */
--space-2: 0.5rem;   /* 8px - base unit */
--space-3: 0.75rem;  /* 12px */
--space-4: 1rem;     /* 16px */
```

### Spacing Conventions
- **Header Height**: 36px (h-[36px])
- **Icon Size**: 16px for header icons (size={16})
- **Padding**: px-2 pr-2 (8px horizontal)
- **Terminal Header**: px-4 py-2 (16px/8px)
- **Gaps Between Items**: gap-2 (8px)

### Border & Dividers
```typescript
border-border        /* 1px solid separator */
border-b             /* Bottom border */
rounded-lg           /* Rounded corners - 10.4px (--radius-lg) */
rounded-md           /* Medium radius - 8px */
```

### Icon Usage Pattern (Lucide-React)
```typescript
import { Settings, Terminal as TerminalIcon, MessageSquare, ChevronDown, Sparkles, Loader2, Check } from 'lucide-react'

// Icon sizes in Octave:
// - Header icons: size={16}
// - Small icons: size={12} or size={14}
// - Status icons: size={16}
```

---

## 6. SIMILAR PATTERNS TO REFERENCE

### CommitInterface.tsx Pattern (196 lines)
A good reference for the Smart Commit UI that could go above the terminal:

```typescript
<div className="p-3 border-t border-border space-y-3">
  <div className="text-xs font-semibold text-foreground">
    Commit ({stagedCount} file{stagedCount !== 1 ? 's' : ''})
  </div>

  {/* Success Message */}
  {showSuccess && (
    <div className="flex items-center gap-2 p-2 bg-green-500/10 border border-green-500/20 rounded-lg text-green-600 text-sm">
      <Check size={16} />
      <span>Committed successfully!</span>
    </div>
  )}

  {/* Error Message */}
  {error && (
    <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-600 text-sm">
      {error}
    </div>
  )}

  {/* Textarea Input */}
  <textarea
    value={message}
    onChange={(e) => setMessage(e.target.value)}
    placeholder="Commit message..."
    className="w-full px-3 py-2 text-sm bg-sidebar-accent border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
    rows={3}
  />

  {/* AI Suggestions */}
  {suggestions.length > 0 && (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">AI Suggestions:</div>
      {suggestions.map((suggestion, i) => (
        <button
          key={i}
          onClick={() => setMessage(suggestion)}
          className={cn(
            "w-full text-left px-2 py-1.5 text-xs rounded transition-colors",
            message === suggestion
              ? "bg-primary/20 text-primary border border-primary/30"
              : "bg-sidebar-accent hover:bg-sidebar-hover border border-transparent"
          )}
        >
          {suggestion}
        </button>
      ))}
    </div>
  )}

  {/* Action Buttons */}
  <div className="flex gap-2">
    <button
      onClick={handleGenerateMessage}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-sidebar-accent hover:bg-sidebar-hover rounded transition-colors disabled:opacity-50"
    >
      <Sparkles size={12} />
      {isGenerating ? 'Generating...' : 'AI Generate'}
    </button>
    <button className="px-3 py-1.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded">
      Commit
    </button>
  </div>
</div>
```

---

## 7. KEY STYLING CLASSES & PATTERNS

### Container Patterns
- `h-full overflow-hidden` - Fill height with no scroll (parent controls scroll)
- `flex flex-col` - Vertical layout
- `flex-1` - Take remaining space
- `w-[400px]` - Fixed width (applies to right sidebar)

### Text Patterns
- Headers: `text-xs font-semibold text-foreground`
- Secondary text: `text-xs text-muted-foreground`
- Body: `text-sm`

### Button/Interactive Patterns
```typescript
// Icon buttons in header
className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-sidebar-hover text-sidebar-foreground-muted hover:text-sidebar-foreground"

// Action buttons
className="px-3 py-1.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
```

### Status Messages
- Success: `bg-green-500/10 border border-green-500/20 rounded-lg text-green-600`
- Error: `bg-red-500/10 border border-red-500/20 rounded-lg text-red-600`

---

## 8. QUICK IMPLEMENTATION GUIDE FOR SMART COMMIT UI

### Step 1: Modify TodoPanel.tsx SidebarContent
Replace the current simple Terminal layout with a ResizablePanelGroup:

```typescript
<SidebarContent className="flex flex-col overflow-hidden p-0">
  {workspace ? (
    <ResizablePanelGroup direction="vertical" className="h-full">
      {/* Smart Commit UI Panel */}
      <ResizablePanel defaultSize={25} minSize={15} maxSize={40}>
        <SmartCommitUI 
          workspace={workspace}
          onCommit={onCommit}
        />
      </ResizablePanel>

      {/* Divider */}
      <ResizableHandle />

      {/* Terminal Panel */}
      <ResizablePanel defaultSize={75} minSize={50}>
        <div className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-foreground border-b border-border">
          <TerminalIcon size={14} />
          <span>Terminal</span>
        </div>
        <div className="flex-1 overflow-hidden bg-transparent">
          <Terminal key={workspace.id} workspace={workspace} />
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  ) : (
    <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-4">
      Select a workspace
    </div>
  )}
</SidebarContent>
```

### Step 2: Create SmartCommitUI Component
Use the CommitInterface pattern as reference:
- Small compact card layout
- AI Generate button with Sparkles icon
- Commit message preview or quick stats
- Status indicators for git state

### Step 3: Import ResizablePanel Components
```typescript
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
```

---

## 9. FILES TO MODIFY

1. **TodoPanel.tsx** - Main change location
   - Replace SidebarContent layout with ResizablePanelGroup
   - Import ResizablePanel, ResizableHandle
   - Create SmartCommitUI component or import it

2. **Create SmartCommitUI.tsx** (new file)
   - Reference: CommitInterface.tsx pattern
   - Compact design optimized for sidebar
   - Reuse git state from TodoPanel

3. **App.tsx** (likely no changes needed)
   - ResizablePanel already configured in split view mode
   - Just needs to work in right sidebar

---

## 10. CSS CLASSES TO USE

### Safe/Tested Patterns
- `p-3` - Padding (12px)
- `px-4 py-2` - Padding with border
- `text-xs font-semibold` - Headers
- `text-sm` - Body text
- `gap-2` - Spacing between items
- `border-t border-border` - Top divider
- `rounded-lg` - Rounded corners
- `transition-colors` - Smooth hover effects
- `bg-sidebar-accent` - Panel background
- `hover:bg-sidebar-hover` - Hover state
- `disabled:opacity-50` - Disabled state
- `flex items-center gap-2` - Horizontal layout
- `flex flex-col` - Vertical layout

---

## SUMMARY

The right sidebar is a **fixed-width (400px) Shadcn Sidebar component** containing a **TodoPanel** with:
1. **Header**: Settings, Theme, Feedback, Smart Git Actions (36px fixed)
2. **Content**: Terminal with xterm.js + Canvas renderer

To add Smart Commit UI above terminal:
- Use **ResizablePanelGroup (vertical)** in SidebarContent
- Split space between SmartCommitUI (25%) and Terminal (75%) with ResizableHandle
- Follow **CommitInterface.tsx** pattern for UI components
- Use consistent **spacing (8px base), colors (primary/secondary/success), and icons (lucide-react)**
