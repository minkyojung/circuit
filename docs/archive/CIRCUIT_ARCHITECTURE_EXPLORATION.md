# Circuit Codebase Architecture Exploration

## Executive Summary

Circuit is a desktop Electron application that integrates Claude AI with workspace management, featuring real-time chat, code editing, git visualization, and MCP server integration. The architecture prioritizes state synchronization, event-driven IPC communication, and feature flag flexibility.

---

## 1. CHAT/INPUT ARCHITECTURE

### ChatInput Component (`circuit/src/components/workspace/ChatInput.tsx`)

**Key Responsibilities:**
- Text input with auto-resizing textarea
- File attachment handling (images, PDFs, text)
- Multiple thinking modes (Normal, Think, Megathink, Ultrathink, Plan)
- Model cycling (Sonnet 4.5, Opus 4, Haiku 4)
- Slash command system with dynamic menu
- Plan Mode toggle (feature-flagged)

**State Management:**
- `value`: Current text input
- `attachedFiles`: Array of AttachedFile objects with data URLs
- `thinkingMode`: Current thinking mode selection
- `isPlanMode`: Plan mode toggle state
- `availableCommands`: Slash commands loaded from IPC
- `showCommandMenu`: Command autocomplete visibility

**Key Features:**
```typescript
interface AttachedFile {
  id: string
  name: string
  type: string
  size: number
  url: string  // Data URL
}

type ThinkingMode = 'normal' | 'think' | 'megathink' | 'ultrathink' | 'plan'
```

**Input Flow:**
1. User types → `onChange` updates state
2. FileInput accepts images/*.pdf/.txt/.md (max 10MB)
3. Long text auto-converts to attachment (configurable threshold: 5000 chars)
4. Keyboard shortcuts: Cmd/Ctrl+Enter to send, Cmd/Ctrl+Shift+P for Plan Mode
5. Slash commands: `/` triggers menu → Arrow keys navigate → Enter selects

**IPC Communication:**
- `slash-commands:list` - Load available commands
- `slash-commands:get` - Load command content
- `open-claude-code` - Open Claude Code terminal

### WorkspaceChatEditor Component (`circuit/src/components/workspace/WorkspaceChatEditor.tsx`)

**Architecture:**
- Main chat interface wrapper
- Manages ChatPanel and EditorPanel
- Supports three view modes: `chat` | `editor` | `split`

**ChatPanel Inner Component (1830+ lines):**

**State Management (Extensive):**
```typescript
// Conversation & Messages
const [conversationId, setConversationId] = useState<string | null>(null)
const [messages, setMessages] = useState<Message[]>([])
const [input, setInput] = useState('')
const [isSending, setIsSending] = useState(false)
const [isCancelling, setIsCancelling] = useState(false)

// Thinking Steps & Analysis
const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([])
const [messageThinkingSteps, setMessageThinkingSteps] = useState<Record<string, { steps: ThinkingStep[], duration: number }>>({})

// Todo/Plan Mode
const [todoResult, setTodoResult] = useState<TodoGenerationResult | null>(null)
const [showTodoDialog, setShowTodoDialog] = useState(false)

// UI State
const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
const [openReasoningId, setOpenReasoningId] = useState<string | null>(null)
const [currentDuration, setCurrentDuration] = useState<number>(0)
const [isAtBottom, setIsAtBottom] = useState(true)
```

**Ref-Based State (for closure avoidance):**
```typescript
// Refs prevent stale closures in IPC handlers
const sessionIdRef = useRef<string | null>(sessionId)
const conversationIdRef = useRef<string | null>(conversationId)
const messagesRef = useRef<Message[]>(messages)
const thinkingStepsRef = useRef<ThinkingStep[]>(thinkingSteps)
const pendingUserMessageRef = useRef<Message | null>(null)
const thinkingStartTimeRef = useRef<number>(0)
const currentThinkingModeRef = useRef<ThinkingMode>('normal')
```

**Message Flow:**
1. User submits via `handleSend()`
2. Create user Message, add to state, save to DB
3. Send via IPC: `claude:send-message`
4. Electron backend processes and returns via events
5. Listen to IPC events:
   - `claude:thinking-start` - Begin analysis (empty assistant message created)
   - `claude:milestone` - Progress update (thinking steps accumulate)
   - `claude:thinking-complete` - Analysis done
   - `claude:response-complete` - Final response with content & blocks
   - `claude:response-error` - Error occurred
   - `claude:message-cancelled` - User cancelled

**Message Structure:**
```typescript
interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  metadata?: {
    thinkingSteps?: ThinkingStep[]
    thinkingDuration?: number
    attachments?: Array<{ id, name, type, size }>
    planResult?: TodoGenerationResult  // Sidebar display
    todoWriteResult?: TodoGenerationResult  // Inline display
    cancelled?: boolean
  }
  blocks?: Block[]  // Parsed code blocks, commands, etc.
}
```

**Block System:**
Messages support semantic blocks:
- `text`, `code`, `command`, `file`, `diff`, `error`, `result`, `diagram`, `link`, `quote`, `list`, `checklist`, `table`, `tool`

**Virtual Scrolling:**
- Uses `@tanstack/react-virtual` for performance
- Dynamic height estimation
- Auto-scroll to bottom when new messages arrive
- Remeasure on message changes

**Plan Mode Integration:**
- Feature-flagged: `VITE_FEATURE_PLAN_MODE`
- Detects JSON todo blocks in responses
- Shows TodoConfirmationDialog
- Syncs todo status to database via TodoWrite tool

---

## 2. ELECTRON MAIN PROCESS CAPABILITIES

### Architecture Overview (`circuit/electron/main.cjs`)

**Key Managers (Lazy-loaded ES Modules):**

1. **MCP Manager** - Model Context Protocol server management
   - Handles installation/uninstallation of MCP servers
   - Auto-starts configured servers
   - Manages server lifecycle

2. **Circuit API Server** - HTTP API for external integrations
   - Built on MCP capabilities
   - Provides REST interface

3. **Workspace Context Tracker** - Project-wide context analysis
   - Monitors file changes
   - Updates context windows
   - Emits `context-updated` and `context-waiting` events

4. **Terminal Manager** - Terminal execution
   - Spawns terminal processes
   - Manages output streams
   - Emits `terminal:data` and `terminal:exit` events

**Window Creation:**
```javascript
const mainWindow = new BrowserWindow({
  width: 1400,
  height: 900,
  transparent: true,
  vibrancy: 'under-window',  // macOS glassmorphism
  titleBarStyle: process.platform === 'darwin' ? 'hidden' : 'default',
})
```

**Webhook Server:**
- Listens on port 3456 (configurable via `WEBHOOK_PORT`)
- Handles Vercel deployment webhooks
- Handles GitHub events (push, pull request, check run, review)
- Routes: `/webhook/vercel`, `/webhook/github`

**IPC Handlers (Key ones for voice features):**
```javascript
ipcMain.handle('claude:send-message', ...) // Send chat message
ipcMain.handle('claude:start-session', ...) // Start conversation
ipcMain.handle('claude:stop-session', ...) // End conversation
ipcMain.handle('claude:cancel-message', ...) // Cancel in-flight request
ipcMain.handle('message:save', ...) // Persist message
ipcMain.handle('message:load', ...) // Load conversation
ipcMain.handle('conversation:create', ...) // New conversation
ipcMain.handle('conversation:get-active', ...) // Active conversation
ipcMain.handle('todos:save-multiple', ...) // Save plan todos
ipcMain.handle('todos:update-status', ...) // Update todo progress
ipcMain.handle('slash-commands:list', ...) // List available commands
ipcMain.handle('slash-commands:get', ...) // Load command content
ipcMain.handle('workspace:read-file', ...) // Read file
ipcMain.handle('workspace:write-file', ...) // Write file
```

**IPC Sending Patterns:**
- `ipcRenderer.send(channel, data)` - Fire and forget
- `ipcRenderer.invoke(channel, data)` - Request/response with async
- `ipcRenderer.on(channel, handler)` - Listen for events
- `mainWindow.webContents.send(channel, data)` - Broadcast from main

---

## 3. UI/UX PATTERNS

### Design System

**Color & Theme:**
- Multiple themes: light, dark, system, green-light/dark, warm-light/dark, straw-light, slate-dark
- Based on shadcn/ui components
- Tailwind CSS for styling

**Component Patterns:**

1. **Floating Input Design**
   - ChatInput floats at bottom of chat
   - Gradient fade background prevents overlap
   - Absolute positioning with pointer-events management

2. **Expandable Sections**
   - Reasoning accordion (thinking steps)
   - Auto-expands during streaming
   - Collapsible after completion

3. **Toast Notifications**
   - Sonner toast library
   - Success/error/info messages
   - Auto-dismiss or action buttons

4. **Modal Dialogs**
   - TodoConfirmationDialog - Plan validation
   - CommitDialog - Git workflow
   - CommandPalette - Global actions
   - ConflictResolverDialog - Git merge conflicts

5. **Sidebar Layout**
   - Left: File explorer + workspace
   - Right: Todo panel (conditional)
   - Resizable with localStorage persistence

6. **Tab System (UnifiedTabs)**
   - File tabs with unsaved indicators
   - Conversation tabs
   - Keyboard navigation

7. **Empty States**
   - ChatEmptyState with keyboard shortcuts
   - WorkspaceEmptyState when no workspace selected
   - Shimmer loading states

### Animation & Motion
- Framer Motion (`motion` package)
- AnimatePresence for mount/unmount
- Smooth transitions (200-300ms typical)
- useVirtualizer for efficient rendering

---

## 4. STATE MANAGEMENT APPROACH

### Pattern: Distributed State with Context Providers

**SettingsContext** (`circuit/src/contexts/SettingsContext.tsx`):
```typescript
export interface SettingsContextType {
  settings: CircuitSettings
  updateSettings: <K extends keyof CircuitSettings>(
    category: K,
    updates: Partial<CircuitSettings[K]>
  ) => void
  updateSetting: <K extends keyof CircuitSettings, P extends keyof CircuitSettings[K]>(
    category: K,
    property: P,
    value: CircuitSettings[K][P]
  ) => void
  resetSettings: () => void
  resetCategory: (category: keyof CircuitSettings) => void
  exportSettings: () => string
  importSettings: (json: string) => boolean
}
```

**CircuitSettings Structure:**
```typescript
export interface CircuitSettings {
  model: { default: ClaudeModel }
  theme: { mode: ThemeMode }
  notifications: { sessionComplete: boolean }
  sounds: { completionSound: CompletionSound; volume: number }
  input: { sendWith: SendKeyCombo }
  aiBehavior: { stripAbsoluteAgreement: boolean }
  attachments: { autoConvertLongText: boolean; threshold: number }
  context: AutoCompactSettings  // Advanced context management
}
```

**TodoContext** (`circuit/src/contexts/TodoContext.tsx`):
- Manages todo data for Plan Mode
- Integrates with chat message system

**TerminalContext** (`circuit/src/contexts/TerminalContext.tsx`):
- Manages terminal sessions
- Broadcasts terminal events

**Component State Hierarchy:**
```
App (global state)
  ├── projectPath
  ├── selectedWorkspace
  ├── selectedFile
  ├── openFiles
  ├── viewMode (chat/editor/split)
  ├── activeConversationId
  ├── rightSidebarOpen
  ├── rightSidebarWidth
  │
  └── WorkspaceChatEditor (workspace state)
      ├── sessionId
      ├── ChatPanel (conversation state)
      │   ├── conversationId
      │   ├── messages
      │   ├── input
      │   ├── isSending
      │   ├── thinkingSteps
      │   ├── messageThinkingSteps
      │   └── todoResult
      │
      └── EditorPanel (file editing)
          ├── activeFile
          ├── fileContents (Map)
          ├── unsavedChanges (Map)
```

**Storage:**
- localStorage: User preferences (sidebar state, width, theme)
- IPC-based Electron store: Conversation data, settings
- File system: Todo plans (.circuit/todos.json)
- SQLite/Database: Message history, todos

---

## 5. EXISTING AUDIO/MEDIA HANDLING

### Sound System

**Settings Configuration:**
```typescript
sounds: {
  completionSound: CompletionSound  // 'chime' | 'ding' | 'pop' | 'none'
  volume: number  // 0-100
}
```

**UI Controls:** (SettingsDialog.tsx)
- Dropdown to select completion sound
- Volume slider (0-100)
- Notification toggle

**Current Implementation Status:**
- ✓ Settings structure defined
- ✓ UI controls in SettingsDialog
- ? Audio playback logic not visible in explored files
- No voice recording/playback features currently

**No Existing Voice Features:**
- No microphone input
- No voice transcription
- No speech synthesis
- No audio streams

---

## 6. FEATURE FLAG SYSTEM

### Architecture (`circuit/src/config/features.ts`)

```typescript
export const FEATURES = {
  PLAN_MODE: import.meta.env.VITE_FEATURE_PLAN_MODE === 'true',
  GIT_GRAPH: import.meta.env.VITE_FEATURE_GIT_GRAPH === 'true',
} as const

export function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
  return FEATURES[feature]
}
```

**Implementation Pattern:**

In components:
```typescript
import { FEATURES } from '@/config/features'

// Conditional rendering
{FEATURES.PLAN_MODE && (
  <button onClick={togglePlanMode}>Plan Mode</button>
)}
```

**Environment Variables:** (`.env.example`)
```
VITE_FEATURE_PLAN_MODE=false
VITE_FEATURE_GIT_GRAPH=false
```

**Design Benefits:**
1. **Zero-Cost Abstraction**: Feature flags compile away
2. **No Runtime Overhead**: Simple boolean checks
3. **Easy Testing**: Toggle features without code changes
4. **Progressive Rollout**: Enable for specific builds

**Future Voice Features Would Use:**
```typescript
export const FEATURES = {
  PLAN_MODE: import.meta.env.VITE_FEATURE_PLAN_MODE === 'true',
  GIT_GRAPH: import.meta.env.VITE_FEATURE_GIT_GRAPH === 'true',
  VOICE_INPUT: import.meta.env.VITE_FEATURE_VOICE_INPUT === 'true',
  VOICE_OUTPUT: import.meta.env.VITE_FEATURE_VOICE_OUTPUT === 'true',
  AUDIO_STREAMING: import.meta.env.VITE_FEATURE_AUDIO_STREAMING === 'true',
} as const
```

---

## 7. USER INPUT FLOW (COMPREHENSIVE)

### Complete Message Journey

**Phase 1: Input Preparation**
```
User types in ChatInput textarea
    ↓
onChange event → updateState(input)
    ↓
Auto-resize textarea to fit content (max 200px)
    ↓
Slash command detection:
  - Starts with `/` → Show command menu
  - Arrow keys → Navigate menu
  - Enter → Select command (or dismiss with Esc)
    ↓
File attachments:
  - Drag/drop or file picker → Add AttachedFile[]
  - Validate: type, size (max 10MB)
  - Convert to data URL
  - Display as pills with remove buttons
    ↓
Model selection:
  - Click model button → Cycle to next model
  - Click thinking mode dropdown → Select mode
  - Plan mode toggle (if feature enabled)
```

**Phase 2: Message Submission**
```
User presses Cmd/Ctrl+Enter OR clicks send button
    ↓
[Validation]
  - If no text AND no attachments → Disable
    ↓
handleSend() invoked:
  1. Create Message object with:
     - id: `msg-${timestamp}`
     - conversationId
     - content: inputText
     - metadata.attachments
     - metadata.thinkingMode (for plan detection)
    ↓
  2. Optimistic UI update:
     - Add to messages state
     - Clear input field
     - Keep attachments (clear after response)
     - Set isSending = true
    ↓
  3. Save to database:
     - await ipcRenderer.invoke('message:save', userMessage)
     - Returns blocks (parsed commands, code, etc.)
    ↓
  4. Send to Claude:
     - ipcRenderer.send('claude:send-message', 
         sessionId, 
         content, 
         attachments, 
         thinkingMode)
```

**Phase 3: Response Streaming**
```
Electron backend receives message and calls Claude API
    ↓
[Thinking Start Event] claude:thinking-start
  - Create empty assistant Message
  - Add to messages array
  - Set pendingAssistantMessageId
  - Auto-open reasoning accordion
  - Start duration timer (updates every 1s)
    ↓
[Milestone Events] claude:milestone (repeated)
  - Analysis step completed
  - Add to thinkingSteps array
  - Update messageThinkingSteps for real-time display
  - Examples: "Analyzing codebase", "Tool use: read_file", "Planning tasks"
    ↓
[Thinking Complete Event] claude:thinking-complete
  - Stop timer
  - Stats available
    ↓
[Response Complete Event] claude:response-complete
  - Claude response received
  - Update assistant message with content
  - Parse blocks (code, commands, etc.)
  - Save message to database
  - Detect and handle Plan Mode:
    * Extract todos from JSON
    * Show TodoConfirmationDialog
    * Or add to sidebar
  - Parse file changes (heuristic detection)
  - Clear pendingAssistantMessageId
  - Set isSending = false
```

**Phase 4: Rendering**
```
Virtual scrolling with @tanstack/react-virtual:
  - Estimate item heights
  - Only render visible + 5 items overscan
  - Remeasure on content changes
    ↓
MessageComponent renders:
  1. User message → Bubble right, light background
  2. Assistant message → Bubble left, darker background
     - Text content rendered as markdown
     - Blocks rendered with syntax highlighting
     - Thinking steps in ReasoningAccordion (collapsible)
     - Todo progress inline (if Plan Mode)
     - Copy button, execute commands, etc.
    ↓
Auto-scroll to bottom when:
  - New messages arrive AND user at bottom (within 150px)
    ↓
Message actions available:
  - Copy to clipboard
  - Toggle reasoning
  - Execute commands
  - Bookmark blocks
```

**Phase 5: Error Handling**
```
If error during send:
  - Create error Message
  - Add to messages array
  - Save to database
  - Set isSending = false

If user cancels:
  - Set isCancelling = true
  - ipcRenderer.send('claude:cancel-message', sessionId)
  - Show cancel button with loading state
  - Clear timer, refs, and state on completion
```

---

## 8. ARCHITECTURE PATTERNS

### IPC Communication Pattern

**Request-Response (invoke):**
```typescript
const result = await ipcRenderer.invoke('operation', data)
// In main: ipcMain.handle('operation', (event, data) => { ... })
```

**Fire-and-Forget (send):**
```typescript
ipcRenderer.send('operation', data)
// In main: ipcMain.on('operation', (event, data) => { ... })
```

**Broadcast Events (from main to renderer):**
```typescript
// In main: mainWindow.webContents.send('event', data)
// In renderer: ipcRenderer.on('event', (event, data) => { ... })
```

**Common Operations:**
- Conversation CRUD: `conversation:*`
- Message persistence: `message:*`
- Workspace operations: `workspace:*`
- Todo operations: `todos:*`
- Claude session: `claude:*`
- Commands: `command:*`, `slash-commands:*`
- MCP: `mcp:*`
- File operations: `workspace:read-file`, `workspace:write-file`

### Error Handling

**Frontend Level:**
```typescript
try {
  await operation()
} catch (error) {
  console.error('[Component]', error)
  toast.error('User-friendly message')
}
```

**Backend Level:**
```javascript
try {
  // Operation
} catch (error) {
  console.error('[Handler]', error)
  return { success: false, error: error.message }
}
```

**Global Error Handlers:**
```javascript
process.on('uncaughtException', ...)
process.on('unhandledRejection', ...)
app.on('render-process-gone', ...)
```

---

## 9. KEY TAKEAWAYS FOR VOICE FEATURES

### Strengths to Leverage

1. **Robust Message System**
   - Block-based architecture can support audio blocks
   - Metadata system for storing transcriptions/audio metadata
   - Message history with full context

2. **IPC Communication Pattern**
   - Well-established invoke/send/listen patterns
   - Can easily add audio stream handlers
   - Event-driven architecture supports streaming

3. **Feature Flag System**
   - Perfect for gradual rollout of voice features
   - Zero-cost abstraction
   - Environment-driven configuration

4. **State Management**
   - Context providers for storing voice settings
   - Refs used to prevent stale closures (important for async streams)
   - Conversation state tracking

5. **Settings Infrastructure**
   - Sound/volume already configured
   - Can extend for voice-specific settings:
     * Voice input (transcription model, language)
     * Voice output (synthesis voice, speed, tone)
     * Audio processing (noise reduction, echo cancellation)

### Integration Points

1. **ChatInput Enhancement**
   - Add voice button next to text input
   - Real-time transcription display
   - Recording indicator

2. **Message System**
   - Store audio data in message.metadata
   - Track voice vs text origin
   - Support mixed media messages

3. **Settings Dialog**
   - Voice input provider selection
   - Voice output voice/speed selection
   - Microphone/speaker device selection
   - Privacy settings (local vs cloud processing)

4. **Electron Main**
   - Audio device enumeration
   - Stream audio to Claude API
   - Handle audio playback
   - Manage audio permissions

5. **IPC Handlers Needed**
   - `audio:start-recording`
   - `audio:stop-recording`
   - `audio:play`
   - `audio:list-devices`
   - `audio:get-settings`
   - `audio:set-settings`

---

## 10. EXISTING SIMILAR PATTERNS

### File Attachment Pattern (Model for Voice)

**ChatInput.tsx patterns:**
```typescript
// State
const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])

// Selection handler
const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = e.target.files
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    // Validate size, type
    // Read as data URL
    // Create AttachedFile object
    // Add to state
  }
}

// Removal handler
const handleRemoveFile = (fileId: string) => {
  setAttachedFiles(prev => prev.filter(f => f.id !== fileId))
}

// Rendering
{attachedFiles.length > 0 && (
  <motion.div>
    {attachedFiles.map(file => (
      <div key={file.id}>
        {/* Thumbnail/Icon */}
        {/* File info */}
        {/* Remove button */}
      </div>
    ))}
  </motion.div>
)}
```

**Could be adapted for voice:**
```typescript
// State
const [voiceMessage, setVoiceMessage] = useState<{
  id: string
  duration: number
  waveform?: Uint8Array
  transcription?: string
  audioUrl?: string
} | null>(null)

// Recording handler
const handleStartRecording = async () => { /* ... */ }
const handleStopRecording = async () => { /* ... */ }

// Rendering similar pattern
```

---

## Summary

Circuit presents a well-architected Electron app with:
- **Strong message infrastructure** for extending with audio
- **Clean IPC patterns** for main process communication
- **Feature flag system** for safe rollout
- **Settings management** ready for voice options
- **No existing voice features** providing clean slate for implementation

The codebase is production-ready with proper error handling, state management, and UI patterns that can serve as templates for voice feature integration.
