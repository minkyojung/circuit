/**
 * IPC Event Bridge Service
 *
 * Extracts IPC event handling logic from WorkspaceChatEditor.tsx
 * Provides clean separation between IPC events and UI state management
 * Works with Zustand stores (chatStore, thinkingStore) for state updates
 */

import type { Message } from '@/types/conversation';
import type { ThinkingStep } from '@/types/thinking';
import type { AttachedFile } from '@/components/workspace/ChatInput';

// @ts-ignore
const { ipcRenderer } = window.require('electron');

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Callbacks for updating component state
 * These are injected by the consuming hook/component
 */
export interface IPCEventCallbacks {
  // Message state
  onMessagesUpdate: (updater: (prev: Message[]) => Message[]) => void;
  onMessageAdd: (message: Message) => void;
  onMessageUpdate: (id: string, updates: Partial<Message>) => void;

  // Thinking state
  onThinkingStepsUpdate: (steps: ThinkingStep[]) => void;
  onThinkingStepAdd: (step: ThinkingStep) => void;
  onMessageThinkingStepsUpdate: (messageId: string, data: { steps: ThinkingStep[], duration: number }) => void;
  onCurrentDurationUpdate: (duration: number) => void;
  onOpenReasoningIdUpdate: (id: string | null) => void;

  // Sending state
  onIsSendingUpdate: (sending: boolean) => void;
  onIsCancellingUpdate: (cancelling: boolean) => void;
  onPendingAssistantMessageIdUpdate: (id: string | null) => void;

  // File operations
  onFileEdit: (filePath: string) => void;
}

/**
 * Dependencies required by IPC handlers
 * These are provided by the consuming component
 */
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
  currentThinkingModeRef: React.MutableRefObject<import('@/components/workspace/ChatInput').ThinkingMode>;

  // Message thinking steps tracking
  messageThinkingStepsRef: React.MutableRefObject<Record<string, { steps: ThinkingStep[], duration: number }>>;

  // Current state values
  pendingAssistantMessageId: string | null;
  thinkingSteps: ThinkingStep[];
}

// ============================================================================
// IPC Event Bridge Service
// ============================================================================

export class IPCEventBridge {
  private callbacks: IPCEventCallbacks;
  private deps: IPCEventDependencies;

  constructor(callbacks: IPCEventCallbacks, dependencies: IPCEventDependencies) {
    this.callbacks = callbacks;
    this.deps = dependencies;
  }

  /**
   * Common utility: Check if component is mounted
   * Prevents setState on unmounted component
   */
  private checkMounted(): boolean {
    if (!this.deps.isMountedRef.current) {
      console.log('[IPCEventBridge] Component unmounted, ignoring event');
      return false;
    }
    return true;
  }

  /**
   * Common utility: Validate session ID matches current session
   * Prevents cross-session contamination
   */
  private validateSession(eventSessionId: string): boolean {
    const currentSessionId = this.deps.sessionIdRef.current;
    if (!currentSessionId || eventSessionId !== currentSessionId) {
      console.log('[IPCEventBridge] Session mismatch, ignoring event', {
        event: eventSessionId,
        current: currentSessionId
      });
      return false;
    }
    return true;
  }

  // ==========================================================================
  // Handler 1: Thinking Start
  // ==========================================================================

  handleThinkingStart = (_event: any, eventSessionId: string, _timestamp: number) => {
    console.log('[IPCEventBridge] handleThinkingStart called');

    // Common checks
    if (!this.checkMounted()) return;
    if (!this.validateSession(eventSessionId)) return;

    console.log('[IPCEventBridge] 🧠 Thinking started:', eventSessionId);

    // Initialize refs and clear history
    this.deps.thinkingStartTimeRef.current = Date.now();
    this.deps.currentStepMessageRef.current = 'Starting analysis';
    this.callbacks.onThinkingStepsUpdate([]); // Clear previous history
    this.callbacks.onCurrentDurationUpdate(0); // Reset duration timer

    // Create empty assistant message immediately for real-time streaming
    const pending = this.deps.pendingUserMessageRef.current;
    const currentConversationId = this.deps.conversationIdRef.current;

    if (pending && currentConversationId) {
      const assistantMessageId = `msg-${Date.now()}`;
      const emptyAssistantMessage: Message = {
        id: assistantMessageId,
        conversationId: currentConversationId,
        role: 'assistant',
        content: '', // Will be filled in by response-complete
        timestamp: Date.now(),
        blocks: [], // Will be populated with tool blocks in real-time
        metadata: {}
      };

      // Add to messages state immediately
      this.callbacks.onMessageAdd(emptyAssistantMessage);
      this.callbacks.onPendingAssistantMessageIdUpdate(assistantMessageId);

      // Auto-open reasoning dropdown for real-time visibility
      this.callbacks.onOpenReasoningIdUpdate(assistantMessageId);

      // Initialize messageThinkingSteps for this message
      this.callbacks.onMessageThinkingStepsUpdate(assistantMessageId, {
        steps: [],
        duration: 0
      });

      console.log('[IPCEventBridge] ✅ Empty assistant message created:', assistantMessageId);
    }

    // Client-side timer: Update every 1s for duration display
    this.deps.thinkingTimerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.deps.thinkingStartTimeRef.current) / 1000);
      this.callbacks.onCurrentDurationUpdate(elapsed);
      console.log(`[IPCEventBridge] ⏱️  Timer tick: ${elapsed}s`);
    }, 1000);

    console.log('[IPCEventBridge] ✅ Timer started');
  };

  // ==========================================================================
  // Handler 2: Milestone
  // ==========================================================================

  handleMilestone = (_event: any, eventSessionId: string, milestone: any) => {
    // Common checks
    if (!this.checkMounted()) return;
    if (!this.validateSession(eventSessionId)) return;

    console.log('[IPCEventBridge] 📍 Milestone:', milestone);

    // Update ref for timer display
    this.deps.currentStepMessageRef.current = milestone.message;

    // Create new step
    const newStep: ThinkingStep = {
      type: milestone.type,
      message: milestone.message,
      timestamp: milestone.timestamp || Date.now(),
      tool: milestone.tool,
      filePath: milestone.filePath,
      command: milestone.command,
      pattern: milestone.pattern
    };

    // Add to thinking steps (callback will handle state update)
    const updatedSteps = [...this.deps.thinkingStepsRef.current, newStep];
    this.callbacks.onThinkingStepAdd(newStep);

    // Update thinking steps ref
    this.deps.thinkingStepsRef.current = updatedSteps;

    // Update messageThinkingSteps in real-time for the pending assistant message
    const currentPendingId = this.deps.pendingAssistantMessageIdRef.current;
    if (currentPendingId) {
      const duration = this.deps.thinkingStartTimeRef.current > 0
        ? Math.round((Date.now() - this.deps.thinkingStartTimeRef.current) / 1000)
        : 0;

      this.callbacks.onMessageThinkingStepsUpdate(currentPendingId, {
        steps: updatedSteps,
        duration
      });
    }

    // Tool logging
    if (milestone.type === 'tool-use' && milestone.tool) {
      console.log('[IPCEventBridge] 📝 Tool step recorded:', milestone.tool);
    }
  };

  // ==========================================================================
  // Handler 3: Thinking Complete
  // ==========================================================================

  handleThinkingComplete = (_event: any, eventSessionId: string, stats: any) => {
    // Common checks
    if (!this.checkMounted()) return;
    if (!this.validateSession(eventSessionId)) return;

    console.log('[IPCEventBridge] ✅ Thinking complete:', stats);

    // Stop timer and reset currentDuration
    if (this.deps.thinkingTimerRef.current) {
      clearInterval(this.deps.thinkingTimerRef.current);
      this.deps.thinkingTimerRef.current = null;
      this.callbacks.onCurrentDurationUpdate(0);
      console.log('[IPCEventBridge] 🛑 Timer stopped');
    }
  };

  // ==========================================================================
  // Handler 4: Response Complete
  // ==========================================================================
  // Delegates to specialized processors:
  // - MessageProcessor: Create/update messages
  // - PlanModeHandler: Validate plan mode, retry if needed
  // - TodoWriteProcessor: Extract and sync TodoWrite data
  // - FileChangeDetector: Parse file changes and auto-open

  handleResponseComplete = async (_event: any, result: any) => {
    // Common checks
    if (!this.checkMounted()) return;
    if (!this.validateSession(result.sessionId)) return;

    console.log('[IPCEventBridge] Response complete:', result);

    const pending = this.deps.pendingUserMessageRef.current;
    if (!result.success || !pending) {
      this.callbacks.onIsSendingUpdate(false);
      return;
    }

    // Import processors dynamically to avoid circular dependencies
    const { MessageProcessor } = await import('./MessageProcessor');
    const { PlanModeHandler } = await import('./PlanModeHandler');
    const { TodoWriteProcessor } = await import('./TodoWriteProcessor');
    const { FileChangeDetector } = await import('./FileChangeDetector');

    // ========================================================================
    // Step 1: Calculate thinking duration
    // ========================================================================

    const duration = this.deps.thinkingStartTimeRef.current > 0
      ? Math.round((Date.now() - this.deps.thinkingStartTimeRef.current) / 1000)
      : 0;

    const currentThinkingSteps = this.deps.thinkingStepsRef.current;

    // ========================================================================
    // Step 2: Process message (create or update)
    // ========================================================================

    const messageResult = await MessageProcessor.processResponse({
      responseMessage: result.message,
      responseSessionId: result.sessionId,
      thinkingSteps: currentThinkingSteps,
      thinkingDuration: duration,
      pendingAssistantMessageId: this.deps.pendingAssistantMessageId,
      pendingUserMessage: pending,
      onMessageUpdate: this.callbacks.onMessageUpdate,
      onMessageAdd: this.callbacks.onMessageAdd,
      onOpenReasoningId: this.callbacks.onOpenReasoningIdUpdate,
      onMessageThinkingStepsUpdate: this.callbacks.onMessageThinkingStepsUpdate,
    });

    if (!messageResult) {
      console.error('[IPCEventBridge] Failed to process message');
      this.callbacks.onIsSendingUpdate(false);
      return;
    }

    const { assistantMessageId, message: assistantMessage, blocks } = messageResult;

    // ========================================================================
    // Step 3: Plan Mode validation (if in Plan Mode)
    // ========================================================================

    const planValidation = await PlanModeHandler.validatePlanMode({
      assistantMessage,
      assistantMessageId,
      blocks,
      responseMessage: result.message,
      currentThinkingMode: this.deps.currentThinkingModeRef.current,
      sessionId: this.deps.sessionId!,
      onMessageUpdate: this.callbacks.onMessageUpdate,
    });

    // If retry was triggered, exit early (wait for retry response)
    if (planValidation.retryTriggered) {
      return;
    }

    // ========================================================================
    // Step 4: TodoWrite processing (if TodoWrite detected)
    // ========================================================================

    await TodoWriteProcessor.processTodoWrite({
      assistantMessage,
      assistantMessageId,
      blocks,
      responseMessage: result.message,
      currentThinkingMode: this.deps.currentThinkingModeRef.current,
      workspacePath: this.deps.workspacePathRef.current,
      onMessageUpdate: this.callbacks.onMessageUpdate,
    });

    // ========================================================================
    // Step 5: Auto-open reasoning
    // ========================================================================

    const hasThinkingSteps = currentThinkingSteps.length > 0;
    MessageProcessor.autoOpenReasoning(
      assistantMessageId,
      hasThinkingSteps,
      this.callbacks.onOpenReasoningIdUpdate
    );

    // ========================================================================
    // Step 6: Parse file changes and auto-open
    // ========================================================================

    const editedFiles = FileChangeDetector.processFileChanges(
      result.message,
      this.callbacks.onFileEdit
    );

    console.log('[IPCEventBridge] Detected file changes:', editedFiles);

    // ========================================================================
    // Step 7: Clear thinking steps for next message
    // ========================================================================

    this.callbacks.onThinkingStepsUpdate([]);

    // ========================================================================
    // Step 8: Reset pending state
    // ========================================================================

    this.deps.pendingUserMessageRef.current = null;
    this.callbacks.onPendingAssistantMessageIdUpdate(null);
    this.callbacks.onIsSendingUpdate(false);

    console.log('[IPCEventBridge] ✅ Response processing complete');
  };

  // ==========================================================================
  // Handler 5: Response Error
  // ==========================================================================

  handleResponseError = async (_event: any, error: any) => {
    // Common checks
    if (!this.checkMounted()) return;

    // Session check (error.sessionId may be undefined)
    const currentSessionId = this.deps.sessionIdRef.current;
    if (error.sessionId && currentSessionId && error.sessionId !== currentSessionId) {
      console.log('[IPCEventBridge] Session mismatch in error, ignoring');
      return;
    }

    console.error('[IPCEventBridge] Response error:', error);

    const pending = this.deps.pendingUserMessageRef.current;
    if (!pending) {
      this.callbacks.onIsSendingUpdate(false);
      return;
    }

    // Create error message
    const errorMessage: Message = {
      id: `msg-${Date.now()}`,
      conversationId: pending.conversationId,
      role: 'assistant',
      content: `Error: ${error.error || error.message || 'Unknown error'}`,
      timestamp: Date.now(),
    };

    // Add to UI
    this.callbacks.onMessageAdd(errorMessage);

    // Save error message
    await ipcRenderer.invoke('message:save', errorMessage);

    // Clear pending state
    this.deps.pendingUserMessageRef.current = null;
    this.callbacks.onIsSendingUpdate(false);
  };

  // ==========================================================================
  // Handler 6: Message Cancelled
  // ==========================================================================

  handleMessageCancelled = (_event: any, cancelledSessionId: string) => {
    // Common checks
    if (!this.checkMounted()) return;
    if (!this.validateSession(cancelledSessionId)) return;

    console.log('[IPCEventBridge] Message cancelled:', cancelledSessionId);

    // Reset states
    this.callbacks.onIsSendingUpdate(false);
    this.callbacks.onIsCancellingUpdate(false);
    this.callbacks.onThinkingStepsUpdate([]);

    // Clear refs
    this.deps.pendingUserMessageRef.current = null;
    this.callbacks.onPendingAssistantMessageIdUpdate(null);
    this.deps.thinkingStepsRef.current = [];

    // Clear timer if running
    if (this.deps.thinkingTimerRef.current) {
      clearInterval(this.deps.thinkingTimerRef.current);
      this.deps.thinkingTimerRef.current = null;
    }

    // Add system message indicating cancellation
    const cancelMessage: Message = {
      id: `msg-${Date.now()}`,
      conversationId: this.deps.conversationId!,
      role: 'assistant',
      content: '_Message cancelled by user_',
      timestamp: Date.now(),
      metadata: { cancelled: true }
    };

    this.callbacks.onMessageAdd(cancelMessage);
  };

  // ==========================================================================
  // Handler 7: Execute Tasks
  // ==========================================================================
  // NOTE: No session filtering (triggered by TodoPanel, not Claude)

  handleExecuteTasks = async (_event: any, data: {
    conversationId: string;
    messageId: string;
    mode: import('@/types/todo').ExecutionMode;
    todos: import('@/types/todo').TodoDraft[];
  }) => {
    // No mount check or session filtering for this handler
    console.log('[IPCEventBridge] Execute tasks:', data);

    try {
      // ========================================================================
      // Step 1: Write todos to .circuit/todos.json file
      // ========================================================================

      const todosData = {
        conversationId: data.conversationId,
        messageId: data.messageId,
        mode: data.mode,
        todos: data.todos.map((draft: any, index: number) => ({
          id: `todo-${data.messageId}-${index}`,
          content: draft.content,
          description: draft.description,
          activeForm: draft.activeForm,
          status: 'pending',
          priority: draft.priority,
          complexity: draft.complexity,
          estimatedDuration: draft.estimatedDuration,
          order: draft.order || index,
          depth: draft.depth || 0,
        })),
      };

      await ipcRenderer.invoke(
        'workspace:write-file',
        this.deps.workspacePathRef.current,
        '.circuit/todos.json',
        JSON.stringify(todosData, null, 2)
      );

      console.log('[IPCEventBridge] ✅ Wrote todos to .circuit/todos.json');

      // ========================================================================
      // Step 2: Save todos to database for real-time progress tracking
      // ========================================================================

      const now = Date.now();
      const todosForDB = data.todos.map((draft: any, index: number) => ({
        id: `todo-${data.messageId}-${index}`,
        conversationId: data.conversationId,
        messageId: data.messageId,
        parentId: draft.parentId,
        order: draft.order ?? index,
        depth: draft.depth ?? 0,
        content: draft.content,
        description: draft.description,
        activeForm: draft.activeForm,
        status: 'pending' as const,
        progress: 0,
        priority: draft.priority,
        complexity: draft.complexity,
        thinkingStepIds: [],
        blockIds: [],
        estimatedDuration: draft.estimatedDuration,
        actualDuration: undefined,
        startedAt: undefined,
        completedAt: undefined,
        createdAt: now,
        updatedAt: now,
      }));

      const dbSaveResult = await ipcRenderer.invoke('todos:save-multiple', todosForDB);
      if (!dbSaveResult.success) {
        console.error('[IPCEventBridge] Failed to save todos to DB:', dbSaveResult.error);
      } else {
        console.log('[IPCEventBridge] ✅ Saved', todosForDB.length, 'todos to DB');
      }

      // ========================================================================
      // Step 3: Prepare mode-specific prompt
      // ========================================================================

      const modePrompts = {
        auto: `I've created a task plan in .circuit/todos.json with ${data.todos.length} task${data.todos.length === 1 ? '' : 's'}.

Please execute ALL tasks in order automatically. Use the TodoWrite tool to update task status as you progress. Show progress for each task.`,

        manual: `I've created a task plan in .circuit/todos.json with ${data.todos.length} task${data.todos.length === 1 ? '' : 's'}.

I'll control execution manually. Respond to commands like:
- "next" or "continue" - Execute next pending task
- "run all" - Execute all remaining tasks
- "execute task N" - Execute specific task by number
- "skip task N" - Skip a task

The plan is ready. What would you like to do?`,
      };

      const executionPrompt = modePrompts[data.mode];

      // ========================================================================
      // Step 4: Validate session and conversation
      // ========================================================================

      if (!this.deps.sessionId || !this.deps.conversationId) {
        console.error('[IPCEventBridge] No session or conversation ID');
        return;
      }

      // ========================================================================
      // Step 5: Create and save user message
      // ========================================================================

      const userMessage: import('@/types/conversation').Message = {
        id: `msg-${Date.now()}`,
        conversationId: this.deps.conversationId,
        role: 'user',
        content: executionPrompt,
        timestamp: Date.now(),
      };

      // Add to UI
      this.callbacks.onMessageAdd(userMessage);

      // Save to DB
      const saveResult = await ipcRenderer.invoke('message:save', userMessage);
      if (saveResult.success && saveResult.blocks) {
        this.callbacks.onMessageUpdate(userMessage.id, { blocks: saveResult.blocks });
      }

      console.log('[IPCEventBridge] ✅ Created and saved user message');

      // ========================================================================
      // Step 6: Set pending state and send to Claude
      // ========================================================================

      this.deps.pendingUserMessageRef.current = userMessage;
      this.callbacks.onIsSendingUpdate(true);

      // Send to Claude
      ipcRenderer.send('claude:send-message', this.deps.sessionId, executionPrompt, [], 'normal');

      console.log('[IPCEventBridge] ✅ Sent execution prompt to Claude');
    } catch (error) {
      console.error('[IPCEventBridge] Error executing tasks:', error);
    }
  };

  // ==========================================================================
  // Lifecycle Methods
  // ==========================================================================

  /**
   * Register all IPC event listeners
   * Call this when component mounts or sessionId changes
   */
  registerListeners() {
    console.log('[IPCEventBridge] Registering IPC listeners');

    ipcRenderer.on('thinking-start', this.handleThinkingStart);
    ipcRenderer.on('milestone', this.handleMilestone);
    ipcRenderer.on('thinking-complete', this.handleThinkingComplete);
    ipcRenderer.on('response-complete', this.handleResponseComplete);
    ipcRenderer.on('response-error', this.handleResponseError);
    ipcRenderer.on('message-cancelled', this.handleMessageCancelled);
    ipcRenderer.on('execute-tasks', this.handleExecuteTasks);

    console.log('[IPCEventBridge] ✅ All listeners registered');
  }

  /**
   * Unregister all IPC event listeners
   * Call this when component unmounts or before re-registering
   */
  unregisterListeners() {
    console.log('[IPCEventBridge] Unregistering IPC listeners');

    ipcRenderer.removeListener('thinking-start', this.handleThinkingStart);
    ipcRenderer.removeListener('milestone', this.handleMilestone);
    ipcRenderer.removeListener('thinking-complete', this.handleThinkingComplete);
    ipcRenderer.removeListener('response-complete', this.handleResponseComplete);
    ipcRenderer.removeListener('response-error', this.handleResponseError);
    ipcRenderer.removeListener('message-cancelled', this.handleMessageCancelled);
    ipcRenderer.removeListener('execute-tasks', this.handleExecuteTasks);

    console.log('[IPCEventBridge] ✅ All listeners unregistered');
  }

  /**
   * Update dependencies when props change
   * Call this in useEffect when dependencies change
   */
  updateDependencies(newDeps: Partial<IPCEventDependencies>) {
    this.deps = { ...this.deps, ...newDeps };
  }
}
