# IPC Event Handlers Analysis
**Phase 1, Step 1: Current Implementation Analysis**

## Overview
WorkspaceChatEditor.tsx contains 7 IPC event handlers spanning lines 706-1500 (~800 lines).
This document analyzes each handler's structure, dependencies, and patterns for safe extraction.

---

## State Dependencies

### useState Variables (17 total)
1. `conversationId: string | null` (line 322)
2. `messages: Message[]` (line 323)
3. `input: string` (line 324)
4. `isSending: boolean` (line 325)
5. `isCancelling: boolean` (line 326)
6. `isLoadingConversation: boolean` (line 327)
7. `thinkingSteps: ThinkingStep[]` (line 328)
8. `messageThinkingSteps: Record<string, { steps, duration }>` (line 329)
9. `todoResult: TodoGenerationResult | null` (line 342)
10. `showTodoDialog: boolean` (line 343)
11. `pendingPrompt: { text, attachments, thinkingMode } | null` (line 344)
12. `pendingAssistantMessageId: string | null` (line 358)
13. `isAtBottom: boolean` (line 370)
14. `copiedMessageId: string | null` (line 379)
15. `openReasoningId: string | null` (line 382)
16. `currentDuration: number` (line 385)
17. `codeAttachment: { code, filePath, lineStart, lineEnd } | null` (line 388)

### useRef Variables (14 total)
1. `thinkingTimerRef: NodeJS.Timeout | null` (line 351)
2. `thinkingStartTimeRef: number` (line 352)
3. `currentStepMessageRef: string` (line 353)
4. `pendingUserMessageRef: Message | null` (line 354)
5. `currentThinkingModeRef: ThinkingMode` (line 355)
6. `sessionIdRef: string | null` (line 361)
7. `pendingAssistantMessageIdRef: string | null` (line 362)
8. `conversationIdRef: string | null` (line 363)
9. `messagesRef: Message[]` (line 364)
10. `thinkingStepsRef: ThinkingStep[]` (line 365)
11. `messageThinkingStepsRef: Record<...>` (line 366)
12. `scrollContainerRef: HTMLDivElement | null` (line 369)
13. `isMountedRef: boolean` (line 373)
14. `workspacePathRef: string` (line 376)

---

## Handler Analysis

### 1. handleThinkingStart (lines 706-781, 75 lines)

**Purpose**: Initialize thinking phase, create empty assistant message, start duration timer

**State Modified**:
- Sets: `thinkingSteps`, `currentDuration`, `messages`, `pendingAssistantMessageId`, `openReasoningId`, `messageThinkingSteps`
- Refs: `thinkingStartTimeRef`, `currentStepMessageRef`, `thinkingTimerRef`

**State Read**:
- Refs: `isMountedRef`, `sessionIdRef`, `pendingUserMessageRef`, `conversationIdRef`

**Session Filtering Pattern** (lines 715-721):
```typescript
const currentSessionId = sessionIdRef.current;
if (!currentSessionId || eventSessionId !== currentSessionId) {
  console.log('[WorkspaceChat] ⏭️  Ignoring thinking-start for different session');
  return;
}
```

**Mount Check Pattern** (lines 709-712):
```typescript
if (!isMountedRef.current) {
  console.log('[WorkspaceChat] ⚠️  Component unmounted, ignoring event');
  return;
}
```

**Key Operations**:
1. Create empty assistant message immediately
2. Auto-open reasoning dropdown
3. Start 1-second interval timer for duration display

**Complexity**: Medium (creates message, manages timer)

---

### 2. handleMilestone (lines 783-840, 57 lines) **[DEBOUNCED]**

**Purpose**: Record thinking milestones in real-time (debounced 300ms)

**State Modified**:
- Sets: `thinkingSteps`, `messageThinkingSteps`
- Refs: `currentStepMessageRef`

**State Read**:
- Refs: `isMountedRef`, `sessionIdRef`, `pendingAssistantMessageIdRef`, `thinkingStartTimeRef`

**Session Filtering Pattern** (lines 788-791):
```typescript
const currentSessionId = sessionIdRef.current;
if (!currentSessionId || eventSessionId !== currentSessionId) {
  return; // Silently ignore events for other sessions
}
```

**Mount Check Pattern** (line 785):
```typescript
if (!isMountedRef.current) return;
```

**Key Operations**:
1. Add milestone to thinking steps array
2. Update messageThinkingSteps in real-time
3. Calculate current duration

**Debounce Configuration**: 300ms, leading: true, trailing: true

**Complexity**: Low (simple state updates)

---

### 3. handleThinkingComplete (lines 842-862, 20 lines)

**Purpose**: Stop thinking timer when thinking phase completes

**State Modified**:
- Sets: `currentDuration` (reset to 0)
- Refs: `thinkingTimerRef` (cleared)

**State Read**:
- Refs: `isMountedRef`, `sessionIdRef`, `thinkingTimerRef`

**Session Filtering Pattern** (lines 846-849):
```typescript
const currentSessionId = sessionIdRef.current;
if (!currentSessionId || eventSessionId !== currentSessionId) {
  return; // Silently ignore events for other sessions
}
```

**Mount Check Pattern** (line 843):
```typescript
if (!isMountedRef.current) return;
```

**Key Operations**:
1. Clear thinking timer
2. Reset duration display

**Complexity**: Trivial (cleanup only)

---

### 4. handleResponseComplete (lines 864-1301, **437 lines**) ⚠️ **MONSTER HANDLER**

**Purpose**: Handle completed Claude response with message saving, Plan Mode, TodoWrite, file detection

**State Modified**:
- Sets: `messages` (multiple times), `messageThinkingSteps`, `isSending`, `pendingAssistantMessageId`, `openReasoningId`, `thinkingSteps`
- Refs: None directly modified

**State Read**:
- Refs: `isMountedRef`, `sessionIdRef`, `pendingUserMessageRef`, `thinkingStartTimeRef`, `pendingAssistantMessageId`, `thinkingStepsRef`, `currentThinkingModeRef`, `workspacePathRef`, `conversationIdRef`

**Session Filtering Pattern** (lines 867-872):
```typescript
const currentSessionId = sessionIdRef.current;
if (!currentSessionId || result.sessionId !== currentSessionId) {
  console.log('[WorkspaceChat] ⏭️  Ignoring response-complete for different session');
  return;
}
```

**Mount Check Pattern** (line 865):
```typescript
if (!isMountedRef.current) return;
```

**Major Sections**:

#### Section 1: Message Creation/Update (lines 883-920)
- Calculate thinking duration
- Update existing assistant message with content
- Prepare message for database save

#### Section 2: Database Save & Plan Mode Logic (lines 932-1232) **[COMPLEX]**
- Save message to database
- Extract TodoWrite/Plan from blocks or text (lines 940-950)
- **Plan Mode Validation** (lines 956-1037):
  - If no plan found, retry once with explicit JSON format request
  - If retry fails, show error to user
- **TodoWrite Handling** (lines 1038-1175):
  - Plan Mode: Display in right sidebar (`planResult`)
  - Normal Mode: Display inline in chat (`todoWriteResult`)
  - Sync todo status to database and `.circuit/todos.json` file
- **TodoWrite Status Sync** (lines 1176-1231):
  - Read `.circuit/todos.json`
  - Update todo status in database
  - Write back to file

#### Section 3: Fallback Message Creation (lines 1235-1274)
- Create new message if no pending assistant message ID (shouldn't happen)

#### Section 4: UI Updates (lines 1276-1300)
- Auto-open reasoning accordion
- Parse file changes from response
- Auto-open edited files
- Reset pending state
- Clear isSending flag

**Key Dependencies**:
- `extractTodoWriteFromBlocks()` - Parse blocks for TodoWrite
- `extractPlanFromText()` - Fallback text parsing
- `convertClaudeTodosToDrafts()` - Convert to Circuit format
- `parseFileChanges()` - Detect file edits
- `onFileEdit()` - Trigger file opening

**Complexity**: **VERY HIGH** - Needs to be broken into multiple services:
- MessageProcessor (update/create messages)
- PlanModeHandler (plan validation/retry)
- TodoWriteProcessor (extraction, conversion, sync)
- FileChangeDetector (parse and auto-open)

---

### 5. handleResponseError (lines 1303-1335, 32 lines)

**Purpose**: Handle Claude API errors and display error message

**State Modified**:
- Sets: `messages`, `isSending`
- Refs: None directly modified

**State Read**:
- Refs: `isMountedRef`, `sessionIdRef`, `pendingUserMessageRef`

**Session Filtering Pattern** (lines 1307-1310):
```typescript
const currentSessionId = sessionIdRef.current;
if (error.sessionId && currentSessionId && error.sessionId !== currentSessionId) {
  return; // Silently ignore errors for other sessions
}
```

**Mount Check Pattern** (line 1304):
```typescript
if (!isMountedRef.current) return;
```

**Key Operations**:
1. Create error message
2. Add to messages array
3. Save error message to database
4. Reset pending state

**Complexity**: Low (simple error handling)

---

### 6. handleMessageCancelled (lines 1337-1375, 38 lines)

**Purpose**: Handle user cancellation of in-progress message

**State Modified**:
- Sets: `isSending`, `isCancelling`, `thinkingSteps`, `messages`
- Refs: `pendingUserMessageRef`, `pendingAssistantMessageIdRef`, `thinkingStepsRef`, `thinkingTimerRef` (cleared)

**State Read**:
- Refs: `isMountedRef`, `sessionIdRef`, `conversationId`, `thinkingTimerRef`

**Session Filtering Pattern** (lines 1341-1344):
```typescript
const currentSessionId = sessionIdRef.current;
if (!currentSessionId || cancelledSessionId !== currentSessionId) {
  return; // Silently ignore cancellations for other sessions
}
```

**Mount Check Pattern** (line 1338):
```typescript
if (!isMountedRef.current) return;
```

**Key Operations**:
1. Reset all sending/thinking state
2. Clear timer if running
3. Add cancellation message to chat

**Complexity**: Low (cleanup and reset)

---

### 7. handleExecuteTasks (lines 1377-1500, 123 lines)

**Purpose**: Execute task plan from TodoPanel (auto or manual mode)

**State Modified**:
- Sets: `messages`, `isSending`
- Refs: `pendingUserMessageRef`

**State Read**:
- Refs: `workspacePathRef`, `sessionId`, `conversationId`

**⚠️ NO SESSION FILTERING** (triggered by TodoPanel, not Claude)
**⚠️ NO MOUNT CHECK**

**Key Operations**:
1. Write todos to `.circuit/todos.json` file
2. Save todos to database for progress tracking
3. Create mode-specific prompt (auto vs manual)
4. Create and send user message
5. Trigger Claude execution

**Complexity**: Medium-High (file I/O, database save, message creation)

**Note**: This handler is special - it's triggered by user action in TodoPanel, not by Claude responses

---

## Common Patterns

### Pattern 1: Mount Check (All handlers except handleExecuteTasks)
```typescript
if (!isMountedRef.current) return;
```
**Purpose**: Prevent setState on unmounted component

### Pattern 2: Session Filtering (All handlers except handleExecuteTasks)
```typescript
const currentSessionId = sessionIdRef.current;
if (!currentSessionId || eventSessionId !== currentSessionId) {
  return; // Ignore events for other sessions
}
```
**Purpose**: Prevent cross-session contamination in multi-workspace scenarios

### Pattern 3: Ref Synchronization
All handlers use refs (e.g., `sessionIdRef.current`) instead of state variables to avoid stale closures in IPC callbacks

### Pattern 4: Early Returns
All handlers use early returns for invalid states instead of nested conditionals

---

## Extraction Strategy Recommendations

### Priority 1: Extract handleResponseComplete (CRITICAL)
**Reason**: 437 lines doing too many things

**Proposed Services**:
1. `MessageProcessor` - Create/update messages (lines 883-920, 1235-1274)
2. `PlanModeHandler` - Validation, retry logic (lines 956-1037)
3. `TodoWriteProcessor` - Extract, convert, sync todos (lines 1038-1231)
4. `FileChangeDetector` - Parse and trigger file opens (lines 1289-1296)

### Priority 2: Extract to IPCEventBridge Service
Create `services/IPCEventBridge.ts` with:
- All 7 handlers as methods
- Common mount/session filtering logic
- State update callbacks (inject via constructor)

### Priority 3: Extract to useIPCEvents Hook
Create `hooks/useIPCEvents.ts` that:
- Consumes IPCEventBridge service
- Manages IPC listener registration/cleanup
- Provides callbacks to update component state

---

## Dependencies Between Handlers

```
handleThinkingStart
  ↓ Creates empty message
handleMilestone (multiple)
  ↓ Updates thinking steps
handleThinkingComplete
  ↓ Stops timer
handleResponseComplete
  ↓ Saves message, handles TodoWrite
  [may trigger]
handleExecuteTasks (user action)
  ↓ Sends new prompt
  [loop back to handleThinkingStart]

[error path]
handleResponseError

[cancel path]
handleMessageCancelled
```

---

## Risk Assessment

### High Risk
- **handleResponseComplete** - 437 lines with complex TodoWrite/PlanMode logic
- Database sync in multiple handlers (race conditions possible)
- Timer management across 3 handlers (cleanup coordination)

### Medium Risk
- Session filtering logic (must be preserved correctly)
- Mount check logic (must prevent setState on unmount)
- Ref synchronization (stale closure bugs)

### Low Risk
- handleThinkingComplete (trivial cleanup)
- handleMilestone (simple state updates)

---

## Next Steps (Step 2)

Based on this analysis, Step 2 will design the IPCEventBridge interface:
1. Service class structure
2. Method signatures for each handler
3. Callback interface for state updates
4. Common utilities (mount check, session filter)
5. Integration with existing Zustand stores (chatStore, thinkingStore)

**Goal**: Create a clean abstraction that makes ChatPanel a thin orchestration layer.
