# Right Sidebar Visual Structure & File Locations

## Sidebar Layout Hierarchy

```
┌─────────────────────────────────────────────┐
│ Sidebar (side="right" w-[400px])            │
├─────────────────────────────────────────────┤
│ SidebarHeader (h-[36px], p-0)              │
│ ┌───────────────────────────────────────┐  │
│ │ [Settings] [Theme] [Feedback]  [Git ▼]│ │
│ └───────────────────────────────────────┘  │
├─────────────────────────────────────────────┤
│ SidebarContent (flex-1, overflow-hidden)   │
│ ┌───────────────────────────────────────┐  │
│ │ [Smart Commit UI] ◄─ TO BE ADDED       │  │
│ ├───────────────────────────────────────┤  │ ← ResizableHandle
│ │ Terminal ✓                             │  │
│ │ ┌─────────────────────────────────┐  │  │
│ │ │ $ Terminal (workspace-name)     │  │  │
│ │ │                                   │  │  │
│ │ │ (xterm.js canvas renderer)      │  │  │
│ │ │                                   │  │  │
│ │ └─────────────────────────────────┘  │  │
│ └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

## File Structure

```
src/
├── App.tsx
│   └── Right sidebar mount point (lines 1302-1316)
│       ├── isRightSidebarOpen state
│       ├── Sidebar component (w-[400px])
│       └── TodoPanel component
│
├── components/
│   ├── TodoPanel.tsx (234 lines)
│   │   ├── SidebarHeader
│   │   │   ├── Settings button (h-7 w-7)
│   │   │   ├── Theme toggle (h-7 w-7)
│   │   │   ├── Feedback button (h-7 w-7)
│   │   │   └── Smart Git Actions dropdown
│   │   │
│   │   └── SidebarContent (NEEDS MODIFICATION)
│   │       ├── Terminal header (12px text)
│   │       └── Terminal component
│   │
│   ├── Terminal.tsx (12 lines)
│   │   └── ClassicTerminal wrapper
│   │
│   ├── terminal/
│   │   └── ClassicTerminal.tsx (216 lines)
│   │       ├── xterm.js terminal instance
│   │       ├── CanvasAddon (transparency)
│   │       ├── FitAddon (auto-sizing)
│   │       └── ResizeObserver (responsive)
│   │
│   ├── git/
│   │   ├── CommitInterface.tsx (196 lines) ◄─ REFERENCE PATTERN
│   │   └── [other git components]
│   │
│   └── ui/
│       ├── resizable.tsx (50 lines)
│       │   ├── ResizablePanelGroup
│       │   ├── ResizablePanel
│       │   └── ResizableHandle
│       ├── button.tsx
│       ├── badge.tsx
│       ├── dropdown-menu.tsx
│       └── [other shadcn components]
│
└── design-tokens.css (400+ lines)
    ├── Spacing scale (--space-*)
    ├── Color tokens (primary, secondary, destructive, success)
    ├── Border radius (--radius-lg, --radius-md)
    └── Transitions (--transition-base, --transition-fast)
```

## Component Dependency Chain

```
App.tsx
  └─ isRightSidebarOpen (state)
      └─ Sidebar (shadcn component)
          └─ TodoPanel.tsx
              ├─ SidebarHeader (shadcn)
              │   ├─ Button (icon variants)
              │   ├─ ThemeToggle
              │   └─ DropdownMenu
              │       └─ Smart Git Actions
              │
              ├─ SidebarContent (shadcn)
              │   └─ Terminal.tsx
              │       └─ ClassicTerminal.tsx
              │           ├─ xterm Terminal
              │           ├─ CanvasAddon
              │           ├─ FitAddon
              │           └─ ResizeObserver
              │
              ├─ MergeDialog (conditional)
              └─ Feedback dialog (conditional)
```

## Current Content Layout (SidebarContent)

```
┌─────────────────────────────────┐
│ Terminal Header                 │ ← height: auto (px-4 py-2)
│ ┌─────────────────────────────┐│
│ │ $ Terminal (workspace)      ││
│ │                             ││
│ │ [xterm canvas area]         ││ ← flex-1 (fills remaining space)
│ │                             ││
│ │                             ││
│ └─────────────────────────────┘│
└─────────────────────────────────┘
```

## Proposed New Layout (With Smart Commit UI)

```
┌─────────────────────────────────┐
│ Smart Commit UI                 │ ← ResizablePanel (25%, minSize 15%)
│ [Compact commit interface]      │
├─────────────────────────────────┤ ← ResizableHandle (draggable)
│ Terminal Header                 │
│ ┌─────────────────────────────┐│
│ │ $ Terminal (workspace)      ││ ← ResizablePanel (75%, minSize 50%)
│ │                             ││
│ │ [xterm canvas area]         ││
│ │                             ││
│ │                             ││
│ └─────────────────────────────┘│
└─────────────────────────────────┘
```

## Design Tokens Used in Right Sidebar

```css
/* Typography */
--font-xs: 0.6875rem      /* Text size for labels */
--font-sm: 0.75rem        /* Secondary text */
--font-base: 0.875rem     /* Body text */

/* Spacing */
--space-2: 0.5rem (8px)   /* Gap between items: gap-2 */
--space-3: 0.75rem (12px) /* Padding for panels: p-3 */
--space-4: 1rem (16px)    /* Header padding: px-4 */

/* Colors (Semantic) */
--label-primary: rgba(0,0,0,0.85)   /* Main text */
--label-secondary: rgba(0,0,0,0.50) /* Secondary text */
--foreground: var(--label-primary)  /* Text color */
--muted-foreground: secondary gray  /* Disabled/placeholder text */
--border: rgba(0,0,0,0.1)          /* Dividers */

/* Colors (Interactive) */
--primary: Primary color            /* Main buttons, highlights */
--secondary: Secondary color        /* Alternative buttons */
--destructive: Destructive color    /* Delete, error states */
--success: Success color            /* Commit success */

/* Borders & Radius */
--radius-lg: 0.65rem (10.4px)  /* Main radius: rounded-lg */
--radius-md: 0.5rem (8px)      /* Medium radius: rounded-md */
--border-width: 1px             /* All borders */

/* Transitions */
--transition-base: 200ms        /* Hover effects */
--transition-fast: 150ms        /* Quick transitions */
```

## Key CSS Classes Pattern

```typescript
// Header button pattern (h-7 w-7)
className="flex h-7 w-7 items-center justify-center rounded-md 
           transition-colors hover:bg-sidebar-hover 
           text-sidebar-foreground-muted hover:text-sidebar-foreground"

// Primary action button pattern
className="px-3 py-1.5 text-xs bg-primary hover:bg-primary/90 
           text-primary-foreground font-medium rounded 
           transition-colors disabled:opacity-50 disabled:cursor-not-allowed"

// Secondary action button pattern
className="flex items-center gap-1.5 px-3 py-1.5 text-xs 
           bg-sidebar-accent hover:bg-sidebar-hover rounded 
           transition-colors disabled:opacity-50"

// Container pattern
className="flex flex-col overflow-hidden p-0"  /* Full height container */
className="h-full overflow-hidden bg-transparent" /* Fill space */
```

## Icon Library (lucide-react)

Icons available and used:
- `Settings` (16px) - Settings button
- `TerminalIcon` (14px) - Terminal header
- `MessageSquare` (16px) - Feedback button
- `ChevronDown` (14px) - Dropdown trigger
- `Sparkles` (12px) - AI Generate button
- `Loader2` (12px) - Loading spinner
- `Check` (16px) - Success indicator
- `Plus`, `Minus`, `X` - Common actions
- `GitBranch`, `GitCommit` - Git actions

## Import Statements for Implementation

```typescript
// TodoPanel.tsx current imports
import { useState, useEffect } from 'react'
import { Settings, Terminal as TerminalIcon, MessageSquare, ChevronDown } from 'lucide-react'
import type { Workspace } from '@/types/workspace'
import type { GitWorkspaceState } from '../../electron/gitHandlers'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Terminal } from '@/components/Terminal'
import { MergeDialog } from '@/components/workspace/MergeDialog'
import {
  SidebarHeader,
  SidebarContent,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// ADDITIONS NEEDED FOR SMART COMMIT UI
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import { SmartCommitUI } from '@/components/git/SmartCommitUI' // NEW
import { Sparkles, Loader2 } from 'lucide-react' // ADD to imports
```

## Next Steps for Implementation

1. Modify `/src/components/TodoPanel.tsx`
   - Import ResizablePanel components
   - Wrap SidebarContent layout in ResizablePanelGroup (vertical)
   
2. Create `/src/components/git/SmartCommitUI.tsx`
   - Reference CommitInterface.tsx (196 lines)
   - Compact sidebar-optimized version
   - Reuse git state management
   
3. Update imports in TodoPanel.tsx
   - Add ResizablePanel imports
   - Add SmartCommitUI import
   - Add lucide-react icons (if not already present)

4. Test responsive behavior
   - Check ResizableHandle drag interactions
   - Verify terminal still resizes properly
   - Test on different screen sizes
