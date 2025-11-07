# IPCEventBridge Design Document
**Phase 1, Step 2: Service Architecture**

## Overview

The `IPCEventBridge` service extracts IPC event handling logic from WorkspaceChatEditor.tsx, creating a clean separation between event handling and UI state management.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ChatPanel Component                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              useIPCEvents Hook                        │  │
│  │  - Creates IPCEventBridge instance                    │  │
│  │  - Provides callbacks for state updates               │  │
│  │  - Manages listener registration/cleanup              │  │
│  └───────────────────────────────────────────────────────┘  │
│                           │                                  │
│                           ▼                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │           IPCEventBridge Service                      │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  Common Utilities                               │  │  │
│  │  │  - checkMounted()                               │  │  │
│  │  │  - validateSession()                            │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  IPC Handlers (7 total)                        │  │  │
│  │  │  1. handleThinkingStart      ✅ Implemented    │  │  │
│  │  │  2. handleMilestone          ✅ Implemented    │  │  │
│  │  │  3. handleThinkingComplete   ✅ Implemented    │  │  │
│  │  │  4. handleResponseComplete   🔨 Needs Processors│  │  │
│  │  │  5. handleResponseError      ✅ Implemented    │  │  │
│  │  │  6. handleMessageCancelled   ✅ Implemented    │  │  │
│  │  │  7. handleExecuteTasks       🔨 Needs Impl     │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  Lifecycle Methods                              │  │  │
│  │  │  - registerListeners()                          │  │  │
│  │  │  - unregisterListeners()                        │  │  │
│  │  │  - updateDependencies()                         │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
│                           │                                  │
│                           ▼                                  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         Electron IPC (Main Process)                   │  │
│  │  - thinking-start                                     │  │
│  │  - milestone                                          │  │
│  │  - thinking-complete                                  │  │
│  │  - response-complete                                  │  │
│  │  - response-error                                     │  │
│  │  - message-cancelled                                  │  │
│  │  - execute-tasks                                      │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Interfaces

### IPCEventCallbacks

State update callbacks provided by the consuming component/hook:

```typescript
export interface IPCEventCallbacks {
  // Message state
  onMessagesUpdate: (updater: (prev: Message[]) => Message[]) => void;
  onMessageAdd: (message: Message) => void;
  onMessageUpdate: (id: string, updates: Partial<Message>) => void;

  // Thinking state
  onThinkingStepsUpdate: (steps: ThinkingStep[]) => void;
  onThinkingStepAdd: (step: ThinkingStep) => void;
  onMessageThinkingStepsUpdate: (messageId: string, data: { steps, duration }) => void;
  onCurrentDurationUpdate: (duration: number) => void;
  onOpenReasoningIdUpdate: (id: string | null) => void;

  // Sending state
  onIsSendingUpdate: (sending: boolean) => void;
  onIsCancellingUpdate: (cancelling: boolean) => void;
  onPendingAssistantMessageIdUpdate: (id: string | null) => void;

  // File operations
  onFileEdit: (filePath: string) => void;
}
```

### IPCEventDependencies

Dependencies required by IPC handlers (refs, state values):

```typescript
export interface IPCEventDependencies {
  // Session tracking
  sessionId: string | null;
  conversationId: string | null;
  workspacePath: string;
  workspaceId: string;

  // State refs (to avoid stale closures)
  isMountedRef: React.MutableRefObject<boolean>;
  sessionIdRef: React.MutableRefObject<string | null>;
  conversationIdRef: React.MutableRefObject<string | null>;
  workspacePathRef: React.MutableRefObject<string>;

  // Message tracking
  pendingUserMessageRef: React.MutableRefObject<Message | null>;
  pendingAssistantMessageIdRef: React.MutableRefObject<string | null>;

  // Thinking tracking
  thinkingStartTimeRef: React.MutableRefObject<number>;
  currentStepMessageRef: React.MutableRefObject<string>;
  thinkingStepsRef: React.MutableRefObject<ThinkingStep[]>;
  thinkingTimerRef: React.MutableRefObject<NodeJS.Timeout | null>;
  currentThinkingModeRef: React.MutableRefObject<ThinkingMode>;

  // Message thinking steps tracking
  messageThinkingStepsRef: React.MutableRefObject<Record<string, ...>>;

  // Current state values
  pendingAssistantMessageId: string | null;
  thinkingSteps: ThinkingStep[];
}
```

---

## Common Utilities

### checkMounted()

```typescript
private checkMounted(): boolean {
  if (!this.deps.isMountedRef.current) {
    console.log('[IPCEventBridge] Component unmounted, ignoring event');
    return false;
  }
  return true;
}
```

**Purpose**: Prevent setState on unmounted component
**Used by**: All handlers except handleExecuteTasks

### validateSession()

```typescript
private validateSession(eventSessionId: string): boolean {
  const currentSessionId = this.deps.sessionIdRef.current;
  if (!currentSessionId || eventSessionId !== currentSessionId) {
    console.log('[IPCEventBridge] Session mismatch, ignoring event');
    return false;
  }
  return true;
}
```

**Purpose**: Prevent cross-session contamination in multi-workspace scenarios
**Used by**: All handlers except handleExecuteTasks

---

## Handler Implementation Status

### ✅ Fully Implemented (5/7)

1. **handleThinkingStart** (75 lines)
   - Creates empty assistant message
   - Initializes thinking state
   - Starts 1-second duration timer
   - Auto-opens reasoning dropdown

2. **handleMilestone** (57 lines)
   - Adds milestone to thinking steps
   - Updates messageThinkingSteps in real-time
   - Calculates current duration
   - Note: Will be wrapped with `useDebouncedCallback` in the hook

3. **handleThinkingComplete** (20 lines)
   - Stops thinking timer
   - Resets duration display

4. **handleResponseError** (32 lines)
   - Creates error message
   - Saves to database
   - Resets pending state

5. **handleMessageCancelled** (38 lines)
   - Resets all sending/thinking state
   - Clears timer
   - Adds cancellation message

### 🔨 Needs Work (2/7)

6. **handleResponseComplete** (437 lines) - **PLACEHOLDER**
   - Currently just calls `onIsSendingUpdate(false)`
   - **Step 9**: Will delegate to:
     - MessageProcessor (create/update messages)
     - PlanModeHandler (validation, retry logic)
     - TodoWriteProcessor (extract, convert, sync)
     - FileChangeDetector (parse and auto-open)

7. **handleExecuteTasks** (123 lines) - **PLACEHOLDER**
   - Currently just logs a warning
   - **Step 12**: Will implement:
     - Write todos to `.circuit/todos.json`
     - Save todos to database
     - Create mode-specific prompt
     - Send message to Claude

---

## Lifecycle Management

### registerListeners()

Registers all 7 IPC event listeners. Call this when:
- Component mounts
- sessionId changes (after unregistering old listeners)

```typescript
bridge.registerListeners();
```

### unregisterListeners()

Unregisters all 7 IPC event listeners. Call this when:
- Component unmounts
- Before re-registering listeners (e.g., sessionId change)

```typescript
bridge.unregisterListeners();
```

### updateDependencies()

Updates dependencies when props change:

```typescript
bridge.updateDependencies({
  sessionId: newSessionId,
  conversationId: newConversationId,
  // ... other changed dependencies
});
```

---

## Usage Pattern (Preview)

```typescript
// In ChatPanel component or useIPCEvents hook

// 1. Create callbacks
const callbacks: IPCEventCallbacks = {
  onMessageAdd: (msg) => setMessages(prev => [...prev, msg]),
  onMessageUpdate: (id, updates) => setMessages(prev =>
    prev.map(m => m.id === id ? {...m, ...updates} : m)
  ),
  // ... other callbacks
};

// 2. Create dependencies
const dependencies: IPCEventDependencies = {
  sessionId,
  conversationId,
  workspacePath: workspace.path,
  workspaceId: workspace.id,
  isMountedRef,
  sessionIdRef,
  // ... other refs and state
};

// 3. Create bridge instance
const bridge = new IPCEventBridge(callbacks, dependencies);

// 4. Register listeners on mount
useEffect(() => {
  bridge.registerListeners();
  return () => bridge.unregisterListeners();
}, []);

// 5. Update dependencies when they change
useEffect(() => {
  bridge.updateDependencies({ sessionId, conversationId });
}, [sessionId, conversationId]);
```

---

## Integration with Zustand Stores

The IPCEventBridge is **store-agnostic**. It uses callbacks for state updates, allowing:

1. **Direct setState** (current approach)
   ```typescript
   onMessageAdd: (msg) => setMessages(prev => [...prev, msg])
   ```

2. **Zustand store** (future approach)
   ```typescript
   const { addMessage } = useChatStore();
   onMessageAdd: (msg) => addMessage(msg)
   ```

3. **Hybrid** (transition approach)
   - Some callbacks use setState
   - Some callbacks use Zustand stores
   - Gradually migrate from setState to stores

This design allows **incremental migration** to Zustand stores without breaking existing functionality.

---

## Benefits

### 1. **Separation of Concerns**
- IPC logic separated from UI component
- Testable in isolation
- Reusable across components

### 2. **DRY Principle**
- Common patterns (mount check, session validation) extracted
- No duplicate IPC handler code

### 3. **Type Safety**
- Strongly typed interfaces for callbacks and dependencies
- Compile-time errors if contracts are violated

### 4. **Incremental Refactoring**
- Placeholder handlers allow progressive implementation
- Existing functionality not broken during transition

### 5. **Future-Proof**
- Easy to add new handlers
- Easy to swap state management (useState → Zustand)

---

## Next Steps

### Step 6-8: ✅ Already Complete
Handlers 1, 2, 3, 5, 6 are fully implemented

### Step 9: Implement handleResponseComplete Delegation
Create specialized processors:
1. `MessageProcessor.ts` - Message creation/update logic
2. `PlanModeHandler.ts` - Plan validation and retry
3. `TodoWriteProcessor.ts` - TodoWrite extraction and sync
4. `FileChangeDetector.ts` - File change parsing

### Step 12: Implement handleExecuteTasks
Full task execution logic for TodoPanel integration

### Step 13: Create useIPCEvents Hook
Consume IPCEventBridge service and provide clean API to ChatPanel

### Step 14: Integration Testing
Ensure no regressions in existing WorkspaceChatEditor functionality

---

## Files Created

1. `/circuit/src/services/IPCEventBridge.ts` (463 lines)
2. `/REFACTORING_ANALYSIS.md` (Analysis document)
3. `/IPCBRIDGE_DESIGN.md` (This document)

---

## Estimated Complexity

| Task | Complexity | Estimated Time |
|------|-----------|----------------|
| Steps 6-8 (Handlers 1,2,3,5,6) | ✅ Complete | - |
| Step 9 (handleResponseComplete) | Very High | 4-6 hours |
| Step 12 (handleExecuteTasks) | Medium | 1-2 hours |
| Step 13 (useIPCEvents hook) | Medium | 1-2 hours |
| Step 14 (Testing) | High | 2-3 hours |
| **Total Remaining** | | **8-13 hours** |

---

## Risk Mitigation

### High Risk: handleResponseComplete
- **Risk**: 437 lines with complex TodoWrite/PlanMode logic
- **Mitigation**: Break into 4 independent processors, test each separately

### Medium Risk: State Callback Mapping
- **Risk**: Wrong callback wiring could break functionality
- **Mitigation**: TypeScript interfaces enforce correct signatures

### Low Risk: Lifecycle Management
- **Risk**: Memory leaks from improper cleanup
- **Mitigation**: Clear patterns for register/unregister, tested in useEffect

---

## Success Criteria

1. ✅ All 7 handlers extracted from WorkspaceChatEditor
2. ✅ Common patterns (mount check, session filter) extracted to utilities
3. ✅ Clean callback interface for state updates
4. ✅ Type-safe dependencies injection
5. 🔨 handleResponseComplete delegated to processors (Step 9)
6. 🔨 handleExecuteTasks fully implemented (Step 12)
7. 🔨 useIPCEvents hook created (Step 13)
8. 🔨 Integration tests pass (Step 14)
