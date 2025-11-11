# Smart Commit UI Implementation - Quick Reference

## What You Need to Know

### Current State
The right sidebar contains:
1. **Header** (36px fixed)
   - Settings, Theme, Feedback, Smart Git Actions buttons
   
2. **Content Area** (flex-1)
   - Terminal only (ClassicTerminal with xterm.js)
   - Full height, no resizing

### What You're Adding
A Smart Commit UI component **above** the terminal in the right sidebar with a draggable divider between them.

---

## File Paths (Absolute)

### Main Files to Modify
- `/Users/williamjung/conductor/circuit/.conductor/stuttgart/octave/src/components/TodoPanel.tsx`

### Reference Patterns
- `/Users/williamjung/conductor/circuit/.conductor/stuttgart/octave/src/components/git/CommitInterface.tsx` (196 lines)
  - Copy styling and layout patterns from here
  
- `/Users/williamjung/conductor/circuit/.conductor/stuttgart/octave/src/components/ui/resizable.tsx` (50 lines)
  - ResizablePanel components already implemented

- `/Users/williamjung/conductor/circuit/.conductor/stuttgart/octave/src/components/Terminal.tsx` (12 lines)
- `/Users/williamjung/conductor/circuit/.conductor/stuttgart/octave/src/components/terminal/ClassicTerminal.tsx` (216 lines)

### Supporting Components
- `/Users/williamjung/conductor/circuit/.conductor/stuttgart/octave/src/components/ui/button.tsx`
- `/Users/williamjung/conductor/circuit/.conductor/stuttgart/octave/src/components/ui/badge.tsx`
- `/Users/williamjung/conductor/circuit/.conductor/stuttgart/octave/src/design-tokens.css`

---

## Implementation Steps (Copy-Paste Ready)

### Step 1: Add Imports to TodoPanel.tsx

Add these imports at the top of the file (around line 10-20):

```typescript
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import { Sparkles, Loader2 } from 'lucide-react' // Add to existing lucide import
```

### Step 2: Create SmartCommitUI Component

Create new file: `/octave/src/components/git/SmartCommitUI.tsx`

```typescript
import { useState } from 'react'
import { Sparkles, Loader2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Workspace } from '@/types/workspace'

interface SmartCommitUIProps {
  workspace: Workspace
  onCommit?: () => void
}

export function SmartCommitUI({ workspace, onCommit }: SmartCommitUIProps) {
  const [message, setMessage] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isCommitting, setIsCommitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  const handleGenerateMessage = async () => {
    setIsGenerating(true)
    try {
      const ipcRenderer = window.electron.ipcRenderer
      const result = await ipcRenderer.invoke('git:generate-commit-message', workspace.path)
      
      if (result.success && result.suggestions?.length > 0) {
        setMessage(result.suggestions[0])
      }
    } catch (error) {
      console.error('Failed to generate commit message:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCommit = async () => {
    if (!message.trim()) return
    
    setIsCommitting(true)
    try {
      const ipcRenderer = window.electron.ipcRenderer
      const result = await ipcRenderer.invoke('git:commit', workspace.path, message)
      
      if (result.success) {
        setMessage('')
        setShowSuccess(true)
        setTimeout(() => setShowSuccess(false), 2000)
        onCommit?.()
      }
    } catch (error) {
      console.error('Failed to commit:', error)
    } finally {
      setIsCommitting(false)
    }
  }

  return (
    <div className="p-3 border-b border-border space-y-2 flex flex-col h-full">
      <div className="text-xs font-semibold text-foreground">Quick Commit</div>

      {showSuccess && (
        <div className="flex items-center gap-2 p-2 bg-green-500/10 border border-green-500/20 rounded text-green-600 text-xs">
          <Check size={14} />
          <span>Committed!</span>
        </div>
      )}

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Commit message..."
        className="flex-1 px-2 py-1.5 text-xs bg-sidebar-accent border border-border rounded resize-none focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
        disabled={isCommitting}
      />

      <div className="flex gap-2">
        <button
          onClick={handleGenerateMessage}
          disabled={isGenerating || isCommitting}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-sidebar-accent hover:bg-sidebar-hover rounded transition-colors disabled:opacity-50"
        >
          {isGenerating ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
          AI
        </button>
        <button
          onClick={handleCommit}
          disabled={!message.trim() || isCommitting}
          className="flex-1 px-2 py-1 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded transition-colors disabled:opacity-50"
        >
          {isCommitting ? 'Committing...' : 'Commit'}
        </button>
      </div>
    </div>
  )
}
```

### Step 3: Modify TodoPanel.tsx SidebarContent

Find this section (around line 179-202):

```typescript
// OLD CODE
<SidebarContent className="flex flex-col overflow-hidden p-0">
  {workspace ? (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Terminal Header */}
      <div className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-foreground border-b border-border">
        <TerminalIcon size={14} />
        <span>Terminal</span>
        <span className="text-[10px] text-muted-foreground">
          {workspace.displayName}
        </span>
      </div>

      {/* Terminal Content */}
      <div className="flex-1 overflow-hidden bg-transparent">
        <Terminal key={workspace.id} workspace={workspace} />
      </div>
    </div>
  ) : (
    <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-4">
      Select a workspace
    </div>
  )}
</SidebarContent>
```

Replace with:

```typescript
// NEW CODE
<SidebarContent className="flex flex-col overflow-hidden p-0">
  {workspace ? (
    <ResizablePanelGroup direction="vertical" className="h-full">
      {/* Smart Commit Panel */}
      <ResizablePanel defaultSize={25} minSize={15} maxSize={40} className="overflow-hidden">
        <SmartCommitUI workspace={workspace} onCommit={() => {}} />
      </ResizablePanel>

      {/* Divider */}
      <ResizableHandle />

      {/* Terminal Panel */}
      <ResizablePanel defaultSize={75} minSize={50} className="overflow-hidden flex flex-col">
        {/* Terminal Header */}
        <div className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-foreground border-b border-border shrink-0">
          <TerminalIcon size={14} />
          <span>Terminal</span>
          <span className="text-[10px] text-muted-foreground">
            {workspace.displayName}
          </span>
        </div>

        {/* Terminal Content */}
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

### Step 4: Add SmartCommitUI Import to TodoPanel.tsx

Add this import near the top (with other component imports, around line 15):

```typescript
import { SmartCommitUI } from '@/components/git/SmartCommitUI'
```

---

## Testing Checklist

- [ ] Component renders without errors
- [ ] Commit UI appears above terminal (25% of space)
- [ ] ResizableHandle is visible and draggable
- [ ] Terminal resizes properly when dragging divider
- [ ] Textarea accepts input
- [ ] AI Generate button triggers IPC call
- [ ] Commit button works
- [ ] Success message shows and hides after 2s
- [ ] Works with workspace switching
- [ ] No console errors

---

## CSS Classes Used (Safe Patterns)

All CSS classes used are already defined in the codebase:

```
Layout:
- flex, flex-col, flex-1, h-full, overflow-hidden, p-3, px-2, py-1.5

Text:
- text-xs, text-sm, font-semibold, font-medium

Colors:
- bg-primary, hover:bg-primary/90, text-primary-foreground
- bg-sidebar-accent, hover:bg-sidebar-hover
- bg-green-500/10, border-green-500/20, text-green-600
- text-foreground, text-muted-foreground
- border-border

Interactive:
- rounded, rounded-lg
- transition-colors
- disabled:opacity-50, disabled:cursor-not-allowed
- focus:outline-none, focus:ring-1, focus:ring-primary

Borders:
- border, border-b, border-border
```

---

## Important Notes

1. **ResizablePanel Props**
   - `defaultSize={25}` - Initial 25% height
   - `minSize={15}` - Can't shrink below 15%
   - `maxSize={40}` - Can't grow above 40%
   - `className="overflow-hidden"` - Required for proper scrolling

2. **Terminal Positioning**
   - Add `shrink-0` to terminal header to prevent shrinking
   - Terminal panel is `defaultSize={75}` to complement commit UI (25% + 75% = 100%)

3. **Responsive Behavior**
   - ResizableHandle automatically updates PTY size via ResizeObserver in ClassicTerminal
   - Terminal will re-fit when resized

4. **Git State**
   - SmartCommitUI can access `workspace.path` to call git commands
   - Reuse the `gitState` from TodoPanel if needed for context

---

## Troubleshooting

**Issue: Terminal doesn't resize**
- Check: Terminal ResizeObserver in ClassicTerminal.tsx is active
- Solution: Ensure terminal fits after resize (already implemented)

**Issue: SmartCommitUI doesn't appear**
- Check: Import statement is correct
- Check: ResizablePanel wrapping is correct
- Solution: Check browser console for errors

**Issue: Dragging feels laggy**
- Solution: This is normal - ResizeObserver throttles at 150ms
- The debounce is in ClassicTerminal.tsx line 167

**Issue: Text in commit UI is cut off**
- Solution: Remove maxSize prop or increase it
- Check: Ensure flex-1 and h-full are present

---

## Design Decision Notes

- **25% default for commit UI**: Provides quick access without consuming too much space
- **Vertical ResizableGroup**: Matches split view pattern already used in App.tsx
- **No scroll in commit UI**: Compact design, no need for scrolling
- **Textarea with flex-1**: Grows to fill available space in the panel
- **Colors match CommitInterface**: For consistency across the app

---

## Files Modified Summary

1. **TodoPanel.tsx**
   - Add imports: ResizablePanel, SmartCommitUI, Sparkles, Loader2
   - Replace SidebarContent JSX with ResizablePanelGroup version

2. **SmartCommitUI.tsx** (NEW)
   - Simple, compact commit interface
   - ~80 lines of code

Total changes: Minimal, non-breaking, reuses existing patterns.
