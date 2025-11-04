# Phase 1 Implementation Plan
## File Reference Pills & Code Selection Context Menu

---

## 📊 Current Architecture Analysis

### 1. Message Rendering Flow
```
WorkspaceChatEditor (Main)
  ├─ ChatPanel
  │   └─ MessageComponent (for each message)
  │       └─ BlockList
  │           └─ BlockRenderer
  │               └─ TextBlock (ReactMarkdown)
  │                   └─ Raw markdown → HTML
  └─ EditorPanel (Monaco)
```

### 2. File Management System
```typescript
// App.tsx (Parent)
- handleFileSelect(filePath: string)
  → setSelectedFile(filePath)
  → setActiveFilePath(filePath)
  → adds to openFiles[] array

// WorkspaceChatEditor (Child)
- receives: selectedFile, openFiles as props
- EditorPanel renders Monaco with activeFile
```

### 3. Monaco Editor Integration
```typescript
// Located in: WorkspaceChatEditor.tsx → EditorPanel
- Uses @monaco-editor/react
- Monaco instance available via Editor component
- Already has:
  ✅ file loading/saving
  ✅ syntax highlighting
  ✅ keyboard shortcuts (Cmd+S)
```

---

## 🎯 Feature 1: File Reference Pills

### A. Requirements
**Input**: Claude message containing file references
- Pattern 1: `src/App.tsx:42` (file with line number)
- Pattern 2: `src/App.tsx:42-50` (line range)
- Pattern 3: `src/components/Button.tsx` (file only)

**Output**: Clickable pills that:
1. Open the file in EditorPanel
2. Jump to specified line number
3. Highlight the line range (if provided)

### B. Implementation Steps

#### Step 1: Create FileReferencePill Component
**File**: `circuit/src/components/workspace/FileReferencePill.tsx`

```typescript
interface FileReferencePillProps {
  filePath: string
  lineStart?: number
  lineEnd?: number
  onClick: (filePath: string, lineStart?: number, lineEnd?: number) => void
}

export function FileReferencePill({ filePath, lineStart, lineEnd, onClick }: FileReferencePillProps) {
  const fileName = filePath.split('/').pop()
  const directory = filePath.split('/').slice(0, -1).join('/')

  return (
    <button
      onClick={() => onClick(filePath, lineStart, lineEnd)}
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md
                 bg-blue-500/10 hover:bg-blue-500/20
                 border border-blue-500/30 hover:border-blue-500/50
                 transition-colors cursor-pointer"
    >
      {/* File icon */}
      <FileIcon className="w-3 h-3 text-blue-500" />

      {/* File path */}
      <span className="text-xs font-mono text-blue-400">
        {directory && <span className="opacity-60">{directory}/</span>}
        <span className="font-medium">{fileName}</span>
        {lineStart && <span className="opacity-60">:{lineStart}</span>}
      </span>
    </button>
  )
}
```

#### Step 2: Parse File References in TextBlock
**File**: `circuit/src/components/blocks/TextBlock.tsx`

**Current**:
```typescript
<ReactMarkdown remarkPlugins={[remarkGfm]}>
  {block.content}
</ReactMarkdown>
```

**New**:
```typescript
// Add custom remark plugin to detect file references
import { visit } from 'unist-util-visit'

const remarkFileReferences = (onFileReference) => {
  return (tree) => {
    visit(tree, 'text', (node, index, parent) => {
      const regex = /([a-zA-Z0-9_\-\/\.]+\.(tsx?|jsx?|py|rs|go|java|css|html|md)):?(\d+)?(?:-(\d+))?/g
      const matches = [...node.value.matchAll(regex)]

      if (matches.length > 0) {
        const children = []
        let lastIndex = 0

        matches.forEach(match => {
          // Text before match
          if (match.index > lastIndex) {
            children.push({
              type: 'text',
              value: node.value.slice(lastIndex, match.index)
            })
          }

          // File reference pill
          children.push({
            type: 'filereference',
            data: {
              filePath: match[1],
              lineStart: match[3] ? parseInt(match[3]) : undefined,
              lineEnd: match[4] ? parseInt(match[4]) : undefined
            }
          })

          lastIndex = match.index + match[0].length
        })

        // Text after last match
        if (lastIndex < node.value.length) {
          children.push({
            type: 'text',
            value: node.value.slice(lastIndex)
          })
        }

        parent.children.splice(index, 1, ...children)
      }
    })
  }
}

// Custom component renderer
const components = {
  filereference: ({ node }) => (
    <FileReferencePill
      filePath={node.data.filePath}
      lineStart={node.data.lineStart}
      lineEnd={node.data.lineEnd}
      onClick={onFileClick}
    />
  )
}

<ReactMarkdown
  remarkPlugins={[remarkGfm, remarkFileReferences]}
  components={components}
>
  {block.content}
</ReactMarkdown>
```

#### Step 3: Wire Up File Click Handler
**File**: `circuit/src/components/workspace/WorkspaceChatEditor.tsx`

Add new prop to pass down:
```typescript
interface WorkspaceChatEditorProps {
  // ... existing props
  onFileReferenceClick?: (filePath: string, lineStart?: number, lineEnd?: number) => void
}

// In WorkspaceChatEditor component
const handleFileReferenceClick = useCallback((filePath: string, lineStart?: number, lineEnd?: number) => {
  console.log('[WorkspaceChatEditor] File reference clicked:', { filePath, lineStart, lineEnd })

  // This will bubble up to App.tsx
  if (onFileReferenceClick) {
    onFileReferenceClick(filePath, lineStart, lineEnd)
  }
}, [onFileReferenceClick])

// Pass to MessageComponent
<MessageComponent
  // ... existing props
  onFileReferenceClick={handleFileReferenceClick}
/>
```

**File**: `circuit/src/App.tsx`

```typescript
// Extend handleFileSelect to support line numbers
const handleFileSelect = (filePath: string, lineNumber?: number, lineEnd?: number) => {
  console.log('[App] File selected:', filePath, lineNumber, lineEnd)

  setSelectedFile(filePath)
  setActiveFilePath(filePath)

  // Add to openFiles if not already there
  if (!openFiles.includes(filePath)) {
    setOpenFiles([...openFiles, filePath])
  }

  // Store line selection for Monaco to use
  if (lineNumber) {
    setFileCursorPosition({
      filePath,
      lineStart: lineNumber,
      lineEnd: lineEnd || lineNumber
    })
  }
}

// New state for cursor position
const [fileCursorPosition, setFileCursorPosition] = useState<{
  filePath: string
  lineStart: number
  lineEnd: number
} | null>(null)

// Pass to WorkspaceChatEditor
<WorkspaceChatEditor
  // ... existing props
  onFileReferenceClick={handleFileSelect}
  fileCursorPosition={fileCursorPosition}
/>
```

#### Step 4: Jump to Line in Monaco Editor
**File**: `circuit/src/components/workspace/WorkspaceChatEditor.tsx` → EditorPanel

```typescript
// Add ref to Monaco editor instance
const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)

// Handle editor mount
const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor) => {
  editorRef.current = editor
}

// Watch for cursor position changes from props
useEffect(() => {
  if (!editorRef.current || !fileCursorPosition) return
  if (fileCursorPosition.filePath !== activeFile) return

  const editor = editorRef.current
  const { lineStart, lineEnd } = fileCursorPosition

  // Jump to line
  editor.revealLineInCenter(lineStart)

  // Set cursor position
  editor.setPosition({ lineNumber: lineStart, column: 1 })

  // Highlight line range
  const decorations = editor.deltaDecorations([], [
    {
      range: new monaco.Range(lineStart, 1, lineEnd, 1),
      options: {
        isWholeLine: true,
        className: 'highlighted-line-reference',
        glyphMarginClassName: 'highlighted-line-glyph'
      }
    }
  ])

  // Clear highlight after 2 seconds
  setTimeout(() => {
    editor.deltaDecorations(decorations, [])
  }, 2000)

  // Focus editor
  editor.focus()
}, [fileCursorPosition, activeFile])

// Update Editor component
<Editor
  // ... existing props
  onMount={handleEditorDidMount}
/>
```

#### Step 5: Add CSS for Line Highlighting
**File**: `circuit/src/index.css`

```css
/* File reference line highlighting */
.highlighted-line-reference {
  background-color: rgba(59, 130, 246, 0.1);
  animation: highlight-fade 2s ease-out;
}

.highlighted-line-glyph {
  background-color: rgba(59, 130, 246, 0.3);
}

@keyframes highlight-fade {
  0% {
    background-color: rgba(59, 130, 246, 0.3);
  }
  100% {
    background-color: rgba(59, 130, 246, 0.05);
  }
}
```

---

## 🎯 Feature 2: Code Selection Context Menu

### A. Requirements
**Input**: User selects code in Monaco Editor
**Output**: Context menu with options:
- "Ask Claude about this"
- "Explain this code"
- "Optimize this"
- "Add tests for this"

### B. Implementation Steps

#### Step 1: Add Monaco Context Menu Action
**File**: `circuit/src/components/workspace/WorkspaceChatEditor.tsx` → EditorPanel

```typescript
// Add context menu after editor mounts
const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor) => {
  editorRef.current = editor

  // Add context menu actions
  editor.addAction({
    id: 'ask-claude-about-selection',
    label: '💬 Ask Claude about this',
    contextMenuGroupId: 'claude',
    contextMenuOrder: 1,
    run: (ed) => {
      const selection = ed.getSelection()
      const selectedText = ed.getModel()?.getValueInRange(selection)

      if (selectedText) {
        handleAskAboutCode(selectedText, selection)
      }
    }
  })

  editor.addAction({
    id: 'explain-code',
    label: '📖 Explain this code',
    contextMenuGroupId: 'claude',
    contextMenuOrder: 2,
    run: (ed) => {
      const selection = ed.getSelection()
      const selectedText = ed.getModel()?.getValueInRange(selection)

      if (selectedText) {
        handleExplainCode(selectedText, activeFile, selection)
      }
    }
  })

  editor.addAction({
    id: 'optimize-code',
    label: '⚡ Optimize this',
    contextMenuGroupId: 'claude',
    contextMenuOrder: 3,
    run: (ed) => {
      const selection = ed.getSelection()
      const selectedText = ed.getModel()?.getValueInRange(selection)

      if (selectedText) {
        handleOptimizeCode(selectedText, activeFile)
      }
    }
  })

  editor.addAction({
    id: 'add-tests',
    label: '🧪 Add tests for this',
    contextMenuGroupId: 'claude',
    contextMenuOrder: 4,
    run: (ed) => {
      const selection = ed.getSelection()
      const selectedText = ed.getModel()?.getValueInRange(selection)

      if (selectedText) {
        handleAddTests(selectedText, activeFile)
      }
    }
  })
}
```

#### Step 2: Implement Handler Functions
**File**: `circuit/src/components/workspace/WorkspaceChatEditor.tsx`

```typescript
// Handler: Ask about code
const handleAskAboutCode = useCallback((code: string, selection: monaco.Selection) => {
  // Attach code to chat input
  const codeContext = {
    type: 'code_selection',
    file: activeFile,
    lineStart: selection.startLineNumber,
    lineEnd: selection.endLineNumber,
    code: code
  }

  // Set chat input with code attached
  setChatInputAttachment(codeContext)

  // Focus chat input
  chatInputRef.current?.focus()
}, [activeFile])

// Handler: Explain code
const handleExplainCode = useCallback((code: string, filePath: string, selection: monaco.Selection) => {
  const prompt = `Explain this code from ${filePath}:${selection.startLineNumber}-${selection.endLineNumber}:

\`\`\`${getLanguageFromFilePath(filePath)}
${code}
\`\`\`

What does this code do? Explain it clearly and concisely.`

  // Auto-send to Claude
  executePrompt(prompt, [])
}, [executePrompt])

// Handler: Optimize code
const handleOptimizeCode = useCallback((code: string, filePath: string) => {
  const prompt = `Optimize this code from ${filePath}:

\`\`\`${getLanguageFromFilePath(filePath)}
${code}
\`\`\`

Suggest optimizations for:
- Performance
- Readability
- Best practices
- Type safety (if applicable)

Show the improved version.`

  executePrompt(prompt, [])
}, [executePrompt])

// Handler: Add tests
const handleAddTests = useCallback((code: string, filePath: string) => {
  const prompt = `Generate unit tests for this code from ${filePath}:

\`\`\`${getLanguageFromFilePath(filePath)}
${code}
\`\`\`

Create comprehensive tests covering:
- Happy path
- Edge cases
- Error handling
- Expected behavior

Use the appropriate testing framework for this project.`

  executePrompt(prompt, [])
}, [executePrompt])
```

#### Step 3: Add Code Attachment UI
**File**: `circuit/src/components/workspace/ChatInput.tsx`

```typescript
// Add state for code attachment
const [codeAttachment, setCodeAttachment] = useState<{
  file: string
  lineStart: number
  lineEnd: number
  code: string
} | null>(null)

// Render code attachment pill
{codeAttachment && (
  <div className="mb-2 p-2 bg-secondary/50 rounded-md border border-border">
    <div className="flex items-center justify-between mb-1">
      <span className="text-xs text-muted-foreground">
        Code from {codeAttachment.file}:{codeAttachment.lineStart}-{codeAttachment.lineEnd}
      </span>
      <button
        onClick={() => setCodeAttachment(null)}
        className="text-muted-foreground hover:text-foreground"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
    <pre className="text-xs font-mono bg-black/20 p-2 rounded overflow-x-auto max-h-32">
      {codeAttachment.code}
    </pre>
  </div>
)}
```

---

## 📦 Summary of Files to Create/Modify

### New Files (2)
1. `circuit/src/components/workspace/FileReferencePill.tsx` - Pill component
2. `PHASE1_IMPLEMENTATION_PLAN.md` - This document

### Modified Files (5)
1. `circuit/src/components/blocks/TextBlock.tsx` - Add file reference parsing
2. `circuit/src/components/workspace/WorkspaceChatEditor.tsx` - Add handlers, Monaco context menu
3. `circuit/src/components/workspace/MessageComponent.tsx` - Pass file click handler
4. `circuit/src/App.tsx` - Extend handleFileSelect with line numbers
5. `circuit/src/index.css` - Add highlight animations

---

## 🧪 Testing Checklist

### Feature 1: File Reference Pills
- [ ] Regex correctly matches `file.tsx:42`
- [ ] Regex correctly matches `file.tsx:42-50`
- [ ] Regex correctly matches `path/to/file.tsx`
- [ ] Clicking pill opens file in editor
- [ ] Jumping to line number works
- [ ] Line highlighting appears
- [ ] Line highlighting fades out after 2s
- [ ] Multiple pills in one message work
- [ ] Doesn't break existing markdown rendering

### Feature 2: Code Selection Context Menu
- [ ] Context menu appears on right-click
- [ ] "Ask Claude about this" focuses chat input
- [ ] "Explain this code" sends prompt
- [ ] "Optimize this" sends prompt
- [ ] "Add tests" sends prompt
- [ ] Selected code is included in prompt
- [ ] File path and line numbers are included
- [ ] Works with multi-line selections
- [ ] Works with partial line selections

---

## ⚡ Performance Considerations

1. **File Reference Parsing**: Use memoization to avoid re-parsing on every render
2. **Monaco Decorations**: Clean up decorations to avoid memory leaks
3. **Context Menu**: Only register actions once on mount
4. **Regex Performance**: File reference regex should be efficient (tested on large files)

---

## 🚀 Estimated Implementation Time

- **Feature 1 (File Reference Pills)**: 3-4 hours
  - FileReferencePill component: 30 min
  - Remark plugin: 1 hour
  - Wiring props: 30 min
  - Monaco jump/highlight: 1 hour
  - Testing: 1 hour

- **Feature 2 (Code Selection Menu)**: 2-3 hours
  - Monaco context menu: 1 hour
  - Handler functions: 1 hour
  - Code attachment UI: 30 min
  - Testing: 30 min

**Total: 5-7 hours for both features**

---

## 📝 Next Steps After Phase 1

Once Phase 1 is complete, we can move to Phase 2:
- Change annotations in editor gutter
- Live diff view for Claude's proposed changes
- Accept/Reject buttons for changes

These will build on the foundation of Phase 1's file navigation and selection systems.
