import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Workspace } from '@/types/workspace';
import type { Message } from '@/types/conversation';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { BlockList } from '@/components/blocks';
import { InlineTodoProgress } from '@/components/blocks/InlineTodoProgress';
import { ChatInput, type AttachedFile } from './ChatInput';
import { ChatMessageSkeleton } from '@/components/ui/skeleton';
import { Shimmer } from '@/components/ai-elements/shimmer';
import { ReasoningAccordion } from '@/components/reasoning/ReasoningAccordion';
import type { ThinkingStep } from '@/types/thinking';
import { summarizeToolUsage } from '@/lib/thinkingUtils';
import { motion, AnimatePresence } from 'motion/react';
import { TodoProvider, useTodos } from '@/contexts/TodoContext';
import { useAgent } from '@/contexts/AgentContext';
import { useSettingsContext } from '@/contexts/SettingsContext';
import { useIPCEvents } from '@/hooks/useIPCEvents';
import type { IPCEventCallbacks } from '@/services/IPCEventBridge';
import { TodoConfirmationDialog } from '@/components/todo';
import { useLanguageService } from '@/hooks/useLanguageService';
import { useClaudeMetrics } from '@/hooks/useClaudeMetrics';
import { MessageComponent } from './MessageComponent';
import { ChatEmptyState } from './ChatEmptyState';
import { MarkdownPreview } from './MarkdownPreview';
import { FloatingCodeActions } from './FloatingCodeActions';
import { ConversationTabsOnly } from './ConversationTabsOnly';
import { FileTabsOnly } from './FileTabsOnly';
import type { TodoGenerationResult, TodoDraft, ExecutionMode } from '@/types/todo';
import { FEATURES } from '@/config/features';
import { getLanguageFromFilePath } from '@/lib/fileUtils';
import { cn } from '@/lib/utils';
import { getAIRulesContext } from '@/services/projectConfigLocal';

// Configure Monaco Editor to use local files instead of CDN
// The vite-plugin-monaco-editor plugin handles web worker configuration automatically
loader.config({ monaco });

// @ts-ignore - Electron IPC
const { ipcRenderer } = window.require('electron');

interface WorkspaceChatEditorProps {
  workspace: Workspace;
  selectedFile: string | null;
  prefillMessage?: string | null;
  conversationId?: string | null;
  onPrefillCleared?: () => void;
  onConversationChange?: (conversationId: string | null) => void;

  // View mode props (lifted to App.tsx)
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;

  // Open files props (lifted to App.tsx)
  openFiles?: string[];

  // Unsaved changes callback
  onUnsavedChange?: (filePath: string, hasChanges: boolean) => void;

  // File reference click callback
  onFileReferenceClick?: (filePath: string, lineStart?: number, lineEnd?: number) => void;

  // File cursor position for jumping to line
  fileCursorPosition?: {
    filePath: string
    lineStart: number
    lineEnd: number
  } | null;

  // Active file path for editor tabs
  activeFilePath?: string | null;
  onFileChange?: (filePath: string) => void;
  onCloseFile?: (filePath: string) => void;

  // Unsaved files state
  unsavedFiles?: Set<string>;
}

type ViewMode = 'chat' | 'editor' | 'split';

export const WorkspaceChatEditor: React.FC<WorkspaceChatEditorProps> = ({
  workspace,
  selectedFile,
  prefillMessage = null,
  conversationId: externalConversationId = null,
  onPrefillCleared,
  onConversationChange,
  viewMode: externalViewMode,
  onViewModeChange,
  openFiles: externalOpenFiles = [],
  onUnsavedChange,
  onFileReferenceClick,
  fileCursorPosition,
  activeFilePath,
  onFileChange,
  onCloseFile,
  unsavedFiles = new Set()
}) => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const { settings } = useSettingsContext();

  // Use external viewMode if provided, otherwise use local state
  const viewMode = externalViewMode || 'chat';
  const openFiles = externalOpenFiles;

  // Code selection state for editor → chat communication
  const [codeSelectionAction, setCodeSelectionAction] = useState<{
    type: 'ask' | 'explain' | 'optimize' | 'add-tests'
    code: string
    filePath: string
    lineStart: number
    lineEnd: number
  } | null>(null);

  // File edit handler
  const handleFileEdit = (filePath: string) => {
    // This will be handled by parent (App.tsx) through file selection
    console.log('[WorkspaceChatEditor] File edited:', filePath);
  };

  // File close handler - delegate to parent
  const handleCloseFile = (filePath: string) => {
    // Will be handled by parent via UnifiedTabs
    console.log('[WorkspaceChatEditor] File closed:', filePath);
  };

  // Code selection handler - from EditorPanel
  const handleCodeSelectionAction = useCallback((action: {
    type: 'ask' | 'explain' | 'optimize' | 'add-tests'
    code: string
    filePath: string
    lineStart: number
    lineEnd: number
  }) => {
    console.log('[WorkspaceChatEditor] Code selection action:', action.type);

    // Auto-convert to split view if currently in editor-only mode
    if (viewMode === 'editor' && onViewModeChange) {
      console.log('[WorkspaceChatEditor] Auto-converting from editor to split view');
      onViewModeChange('split');
    }

    // Store action for ChatPanel to handle
    setCodeSelectionAction(action);
  }, [viewMode, onViewModeChange]);

  // Start Claude session when workspace changes
  useEffect(() => {
    const startSession = async () => {
      console.log('[WorkspaceChatEditor] Starting Claude session for:', workspace.path);
      const result = await ipcRenderer.invoke('claude:start-session', workspace.path);

      if (result.success) {
        console.log('[WorkspaceChatEditor] Claude session started:', result.sessionId);
        setSessionId(result.sessionId);
      } else {
        console.error('[WorkspaceChatEditor] Failed to start Claude session:', result.error);
        alert(`Failed to start Claude session: ${result.error}`);
      }
    };

    startSession();
  }, [workspace.path]);

  // Cleanup session when component unmounts or sessionId changes
  useEffect(() => {
    return () => {
      if (sessionId) {
        console.log('[WorkspaceChatEditor] Stopping Claude session:', sessionId);
        ipcRenderer.invoke('claude:stop-session', sessionId);
      }
    };
  }, [sessionId]);


  return (
    <div className="h-full">
      {viewMode === 'chat' && (
        /* Chat Only Mode */
        <div className="h-full">
          <ChatPanel
            workspace={workspace}
            sessionId={sessionId}
            onFileEdit={handleFileEdit}
            prefillMessage={prefillMessage}
            externalConversationId={externalConversationId}
            onPrefillCleared={onPrefillCleared}
            onConversationChange={onConversationChange}
            onFileReferenceClick={onFileReferenceClick}
            codeSelectionAction={codeSelectionAction}
            onCodeSelectionHandled={() => setCodeSelectionAction(null)}
          />
        </div>
      )}

      {viewMode === 'editor' && (
        /* Editor Only Mode */
        <div className="h-full">
          <EditorPanel
            workspace={workspace}
            sessionId={sessionId}
            openFiles={openFiles}
            selectedFile={selectedFile}
            onCloseFile={handleCloseFile}
            onUnsavedChange={onUnsavedChange}
            fileCursorPosition={fileCursorPosition}
            onCodeSelectionAction={handleCodeSelectionAction}
          />
        </div>
      )}

      {viewMode === 'split' && (
        /* Split View - Chat and Editor side by side with independent tabs */
        <ResizablePanelGroup direction="horizontal" className="h-full">
          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="h-full flex flex-col">
              {/* Conversation Tabs for ChatPanel */}
              <ConversationTabsOnly
                workspaceId={workspace.id}
                workspaceName={workspace.name}
                activeConversationId={externalConversationId}
                onConversationChange={onConversationChange || (() => {})}
              />
              {/* Chat Content */}
              <div className="flex-1 min-h-0">
                <ChatPanel
                  workspace={workspace}
                  sessionId={sessionId}
                  onFileEdit={handleFileEdit}
                  prefillMessage={prefillMessage}
                  externalConversationId={externalConversationId}
                  onPrefillCleared={onPrefillCleared}
                  onConversationChange={onConversationChange}
                  onFileReferenceClick={onFileReferenceClick}
                  codeSelectionAction={codeSelectionAction}
                  onCodeSelectionHandled={() => setCodeSelectionAction(null)}
                />
              </div>
            </div>
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="h-full flex flex-col">
              {/* File Tabs for EditorPanel */}
              <FileTabsOnly
                openFiles={openFiles.map(path => ({
                  path,
                  unsavedChanges: unsavedFiles.has(path)
                }))}
                activeFilePath={activeFilePath || selectedFile}
                onFileChange={onFileChange || (() => {})}
                onCloseFile={onCloseFile || handleCloseFile}
              />
              {/* Editor Content */}
              <div className="flex-1 min-h-0">
                <EditorPanel
                  workspace={workspace}
                  sessionId={sessionId}
                  openFiles={openFiles}
                  selectedFile={activeFilePath || selectedFile}
                  onCloseFile={onCloseFile || handleCloseFile}
                  onUnsavedChange={onUnsavedChange}
                  fileCursorPosition={fileCursorPosition}
                  onCodeSelectionAction={handleCodeSelectionAction}
                />
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
    </div>
  );
};

// ============================================================================
// Chat Panel Component
// ============================================================================

interface ChatPanelProps {
  workspace: Workspace;
  sessionId: string | null;
  onFileEdit: (filePath: string) => void;
  prefillMessage?: string | null;
  externalConversationId?: string | null;
  onPrefillCleared?: () => void;
  onConversationChange?: (conversationId: string | null) => void;
  onFileReferenceClick?: (filePath: string, lineStart?: number, lineEnd?: number) => void;
  codeSelectionAction?: {
    type: 'ask' | 'explain' | 'optimize' | 'add-tests'
    code: string
    filePath: string
    lineStart: number
    lineEnd: number
  } | null;
  onCodeSelectionHandled?: () => void;
}

// ChatInput component now handles all input styling and controls

const ChatPanelInner: React.FC<ChatPanelProps> = ({
  workspace,
  sessionId,
  onFileEdit,
  prefillMessage,
  externalConversationId,
  onPrefillCleared,
  onConversationChange,
  onFileReferenceClick,
  codeSelectionAction,
  onCodeSelectionHandled
}) => {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(true);
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [messageThinkingSteps, setMessageThinkingSteps] = useState<Record<string, { steps: ThinkingStep[], duration: number }>>({});

  // Todo context
  const { createTodosFromDrafts, todos } = useTodos();

  // Agent context
  const { startAgent, agents: agentStatesByTodoId } = useAgent();

  // Metrics for auto-compact
  const { metrics } = useClaudeMetrics();
  const [lastAutoCompactTime, setLastAutoCompactTime] = useState<number>(0);

  // Simply pass through agentStatesByTodoId as it's already todoId-based
  // MessageComponent will use todoId from metadata to look up the state
  const messageAgentStates = agentStatesByTodoId;

  // Todo-related state
  const [todoResult, setTodoResult] = useState<TodoGenerationResult | null>(null);
  const [showTodoDialog, setShowTodoDialog] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<{
    text: string;
    attachments: AttachedFile[];
    thinkingMode: import('./ChatInput').ThinkingMode;
  } | null>(null);

  // Use refs for timer to avoid closure issues
  const thinkingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const thinkingStartTimeRef = useRef<number>(0);
  const currentStepMessageRef = useRef<string>('Starting analysis');
  const pendingUserMessageRef = useRef<Message | null>(null);
  const currentThinkingModeRef = useRef<import('./ChatInput').ThinkingMode>('normal');

  // Track pending assistant message ID in state instead of ref to trigger re-renders
  const [pendingAssistantMessageId, setPendingAssistantMessageId] = useState<string | null>(null);

  // Refs to hold latest state values (to avoid stale closures in IPC handlers)
  const sessionIdRef = useRef<string | null>(sessionId);
  const pendingAssistantMessageIdRef = useRef<string | null>(null);
  const conversationIdRef = useRef<string | null>(conversationId);
  const messagesRef = useRef<Message[]>(messages);
  const thinkingStepsRef = useRef<ThinkingStep[]>(thinkingSteps);
  const messageThinkingStepsRef = useRef<Record<string, { steps: ThinkingStep[], duration: number }>>(messageThinkingSteps);

  // Scroll state
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Track if component is mounted to prevent setState on unmounted component
  const isMountedRef = useRef(true);

  // Track workspace path to avoid stale closures in IPC handlers
  const workspacePathRef = useRef(workspace.path);

  // Copy state
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  // Reasoning toggle state
  const [openReasoningId, setOpenReasoningId] = useState<string | null>(null);

  // Real-time duration for in-progress message
  const [currentDuration, setCurrentDuration] = useState<number>(0);

  // Code attachment state for "Ask Claude" action
  const [codeAttachment, setCodeAttachment] = useState<{
    code: string
    filePath: string
    lineStart: number
    lineEnd: number
  } | null>(null);

  // Handle code selection actions from editor
  useEffect(() => {
    if (!codeSelectionAction) return;

    const { type, code, filePath, lineStart, lineEnd } = codeSelectionAction;

    if (type === 'ask') {
      // For "Ask" action: Attach code to chat input for manual sending
      setCodeAttachment({ code, filePath, lineStart, lineEnd });
    } else {
      // For other actions: Auto-generate and send prompt
      const lineInfo = lineEnd !== lineStart ? `${lineStart}-${lineEnd}` : `${lineStart}`;
      let prompt = '';

      if (type === 'explain') {
        prompt = `Explain this code from ${filePath}:${lineInfo}:\n\n\`\`\`\n${code}\n\`\`\``;
      } else if (type === 'optimize') {
        prompt = `Optimize this code from ${filePath}:${lineInfo}:\n\n\`\`\`\n${code}\n\`\`\`\n\nProvide specific improvements for performance, readability, and maintainability.`;
      } else if (type === 'add-tests') {
        prompt = `Generate comprehensive tests for this code from ${filePath}:${lineInfo}:\n\n\`\`\`\n${code}\n\`\`\`\n\nInclude unit tests, edge cases, and integration tests where appropriate.`;
      }

      if (prompt) {
        executePrompt(prompt, [], 'normal');
      }
    }

    // Clear the action after handling
    onCodeSelectionHandled?.();
  }, [codeSelectionAction, onCodeSelectionHandled]);

  // Load conversation when workspace or externalConversationId changes
  useEffect(() => {
    const loadConversation = async () => {
      // Early return: Skip if we're already on the correct conversation
      // Use ref to avoid circular dependency in useEffect
      if (externalConversationId && conversationIdRef.current === externalConversationId) {
        console.log('[ChatPanel] Already loaded conversation:', externalConversationId, '- skipping reload');
        return;
      }

      setIsLoadingConversation(true);

      try {
        console.log('[ChatPanel] Loading conversation for workspace:', workspace.id);
        console.log('[ChatPanel] External conversation ID:', externalConversationId);

        let conversation;

        // 1. If externalConversationId is provided, use it directly
        if (externalConversationId) {
          console.log('[ChatPanel] Using external conversation ID:', externalConversationId);
          conversation = { id: externalConversationId };
        } else {
          // 2. Otherwise, get active conversation for this workspace
          const activeResult = await ipcRenderer.invoke('conversation:get-active', workspace.id);
          conversation = activeResult.conversation;

          // 3. If no active conversation, create a new one
          if (!conversation) {
            console.log('[ChatPanel] No active conversation found, creating new one');
            const createResult = await ipcRenderer.invoke('conversation:create', workspace.id);
            conversation = createResult.conversation;
          }
        }

        console.log('[ChatPanel] Loaded conversation:', conversation.id);
        setConversationId(conversation.id);

        // Notify parent about conversation change ONLY if we created/found a new one
        // (i.e., when externalConversationId was not provided)
        if (onConversationChange && !externalConversationId) {
          onConversationChange(conversation.id);
        }

        // 4. Load messages for this conversation
        const messagesResult = await ipcRenderer.invoke('message:load', conversation.id);
        const loadedMessages = messagesResult.messages || [];

        console.log('[ChatPanel] Loaded', loadedMessages.length, 'messages');
        setMessages(loadedMessages);

        // 5. Restore thinking steps from message metadata
        const restoredSteps: Record<string, { steps: ThinkingStep[], duration: number }> = {};
        loadedMessages.forEach((msg: Message) => {
          if (msg.role === 'assistant' && msg.metadata) {
            // Parse metadata if it's a string
            const metadata = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata;

            if (metadata.thinkingSteps && metadata.thinkingDuration) {
              restoredSteps[msg.id] = {
                steps: metadata.thinkingSteps,
                duration: metadata.thinkingDuration
              };
              console.log('[ChatPanel] Restored thinking steps for message:', msg.id, metadata.duration, 's');
            }
          }
        });
        setMessageThinkingSteps(restoredSteps);
        console.log('[ChatPanel] Restored', Object.keys(restoredSteps).length, 'thinking step sets');
      } catch (error) {
        console.error('[ChatPanel] Failed to load conversation:', error);
        // On error, start fresh
        setConversationId(null);
        setMessages([]);
      } finally {
        setIsLoadingConversation(false);
      }
    };

    loadConversation();
  }, [workspace.id, externalConversationId]);  // conversationId removed to prevent circular dependency

  // Sync refs with latest state (to avoid stale closures)
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    workspacePathRef.current = workspace.path;
  }, [workspace.path]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    thinkingStepsRef.current = thinkingSteps;
  }, [thinkingSteps]);

  useEffect(() => {
    messageThinkingStepsRef.current = messageThinkingSteps;
  }, [messageThinkingSteps]);

  useEffect(() => {
    pendingAssistantMessageIdRef.current = pendingAssistantMessageId;
  }, [pendingAssistantMessageId]);

  // Set prefilled message when provided
  useEffect(() => {
    if (prefillMessage) {
      setInput(prefillMessage);
      onPrefillCleared?.();
    }
  }, [prefillMessage, onPrefillCleared]);

  // Notify parent when conversationId changes
  // Note: onConversationChange is intentionally NOT in deps to avoid infinite loop
  // (it's an inline function in App.tsx that gets recreated on every render)
  useEffect(() => {
    onConversationChange?.(conversationId);
  }, [conversationId]);

  // parseFileChanges removed - now handled by FileChangeDetector service

  // Scroll handlers
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    // Consider "at bottom" if within 150px of bottom
    setIsAtBottom(distanceFromBottom < 150);
  }, []);

  const scrollToBottom = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth'
    });
  }, []);

  // Copy message handler
  const handleCopyMessage = useCallback((messageId: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedMessageId(messageId);
    setTimeout(() => setCopiedMessageId(null), 2000);
  }, []);

  // Toggle reasoning accordion handler
  const handleToggleReasoning = useCallback((messageId: string) => {
    setOpenReasoningId((prev) => (prev === messageId ? null : messageId));
  }, []);

  // Execute command handler
  const handleExecuteCommand = useCallback(async (command: string) => {
    try {
      const result = await ipcRenderer.invoke('command:execute', {
        command,
        workingDirectory: workspace.path,
        blockId: undefined
      });

      if (result.success) {
        console.log('[CommandBlock] Execution success:', result.output);

        // Add result as a new assistant message with output
        const resultMessage: Message = {
          id: `msg-${Date.now()}`,
          conversationId: conversationId!,
          role: 'assistant',
          content: `Command executed successfully (${result.duration}ms)\n\n\`\`\`\n${result.output}\n\`\`\`\n\nExit code: ${result.exitCode}`,
          timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, resultMessage]);

        // Save to database with block parsing
        const saveResult = await ipcRenderer.invoke('message:save', resultMessage);
        if (saveResult.success && saveResult.blocks) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === resultMessage.id ? { ...msg, blocks: saveResult.blocks } : msg
            )
          );
        }
      } else {
        console.error('[CommandBlock] Execution failed:', result.error);

        // Add error as a new assistant message
        const errorMessage: Message = {
          id: `msg-${Date.now()}`,
          conversationId: conversationId!,
          role: 'assistant',
          content: `Command execution failed\n\n\`\`\`\n${result.error}\n${result.output || ''}\n\`\`\``,
          timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, errorMessage]);

        const saveResult = await ipcRenderer.invoke('message:save', errorMessage);
        if (saveResult.success && saveResult.blocks) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === errorMessage.id ? { ...msg, blocks: saveResult.blocks } : msg
            )
          );
        }
      }
    } catch (error) {
      console.error('[CommandBlock] Execute error:', error);

      const errorMessage: Message = {
        id: `msg-${Date.now()}`,
        conversationId: conversationId!,
        role: 'assistant',
        content: `Failed to execute command: ${error}`,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, errorMessage]);
      await ipcRenderer.invoke('message:save', errorMessage);
    }
  }, [workspace.path, conversationId]);

  // Check initial scroll position when messages load
  useEffect(() => {
    if (messages.length > 0 && scrollContainerRef.current) {
      // Check scroll position on load
      handleScroll();
    }
  }, [messages.length, handleScroll]);


  // ============================================================================
  // IPC Event Handlers - Managed by useIPCEvents hook
  // ============================================================================

  // Create callbacks for IPCEventBridge
  // Note: useMemo with empty deps because all setters are stable
  const ipcCallbacks: IPCEventCallbacks = useMemo(() => ({
    // Message state
    onMessagesUpdate: setMessages,
    onMessageAdd: (msg) => setMessages((prev) => [...prev, msg]),
    onMessageUpdate: (id, updates) =>
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m))),

    // Thinking state
    onThinkingStepsUpdate: setThinkingSteps,
    onThinkingStepAdd: (step) => setThinkingSteps((prev) => [...prev, step]),
    onMessageThinkingStepsUpdate: (msgId, data) =>
      setMessageThinkingSteps((prev) => ({ ...prev, [msgId]: data })),
    onCurrentDurationUpdate: setCurrentDuration,
    onOpenReasoningIdUpdate: setOpenReasoningId,

    // Sending state
    onIsSendingUpdate: setIsSending,
    onIsCancellingUpdate: setIsCancelling,
    onPendingAssistantMessageIdUpdate: setPendingAssistantMessageId,

    // File operations
    onFileEdit: onFileEdit,
  }), []);

  // Register IPC event listeners
  useIPCEvents({
    sessionId,
    conversationId,
    workspacePath: workspace.path,
    workspaceId: workspace.id,
    pendingAssistantMessageId,
    thinkingSteps,

    // Refs
    isMountedRef,
    sessionIdRef,
    conversationIdRef,
    workspacePathRef,
    pendingUserMessageRef,
    pendingAssistantMessageIdRef,
    thinkingStartTimeRef,
    currentStepMessageRef,
    thinkingStepsRef,
    thinkingTimerRef,
    currentThinkingModeRef,
    messageThinkingStepsRef,

    // Callbacks
    callbacks: ipcCallbacks,
  });

  // ============================================================================
  // End of IPC Event Handlers
  // ============================================================================

  // Cancel current message
  const handleCancel = () => {
    if (!isSending || !sessionId) return;

    console.log('[ChatPanel] Cancelling message');
    setIsCancelling(true);

    // Send cancel request to backend
    // @ts-ignore
    ipcRenderer.send('claude:cancel-message', sessionId);
  };

  // Handle running agent for a task message
  const handleRunAgentForMessage = useCallback(async (messageId: string) => {
    // Find the message to get todoId from metadata
    const message = messages.find(m => m.id === messageId);
    if (!message) {
      console.warn('[ChatPanel] No message found:', messageId);
      return;
    }

    // Parse metadata to get todoId
    let todoId: string | undefined;
    try {
      const metadata = typeof message.metadata === 'string'
        ? JSON.parse(message.metadata)
        : message.metadata;
      todoId = metadata?.todoId;
    } catch (error) {
      console.error('[ChatPanel] Failed to parse metadata:', error);
    }

    if (!todoId) {
      console.warn('[ChatPanel] No todoId found in message metadata:', messageId);
      return;
    }

    try {
      console.log('[ChatPanel] Starting agent for todo:', todoId, 'workspace:', workspace.id);
      await startAgent(todoId, workspace.id);
    } catch (error) {
      console.error('[ChatPanel] Failed to start agent:', error);
    }
  }, [messages, startAgent, workspace.id]);

  // Handle adding text as todo - creates a user message with todo
  const handleAddTodo = useCallback(async (content: string) => {
    if (!content.trim()) {
      throw new Error('Task content cannot be empty');
    }

    try {
      // Ensure we have a conversationId (create if needed)
      let activeConversationId = conversationId;

      if (!activeConversationId) {
        console.log('[ChatPanel] No conversation ID, creating new conversation for task');
        try {
          const createResult = await ipcRenderer.invoke('conversation:create', workspace.id);
          if (createResult.success && createResult.conversation) {
            activeConversationId = createResult.conversation.id;
            setConversationId(activeConversationId);
            if (onConversationChange) {
              onConversationChange(activeConversationId);
            }
          } else {
            throw new Error('Failed to create conversation');
          }
        } catch (error) {
          console.error('[ChatPanel] Error creating conversation:', error);
          throw new Error('Failed to create conversation. Please try again.');
        }
      }

      const timestamp = Date.now();
      const messageId = `msg-${timestamp}`;
      const todoId = `todo-${messageId}-0`;  // Pre-generate todoId

      // Create user message (UI only - not saved to DB)
      const userMessage: Message = {
        id: messageId,
        conversationId: activeConversationId,
        role: 'user',
        content: content.trim(),
        timestamp,
        metadata: {
          isTask: true,
          todoId: todoId  // Store todoId in metadata
        },
      };

      // Add message to UI immediately
      setMessages(prev => [...prev, userMessage]);

      // Create todo linked to this message
      console.log('[ChatPanel] Creating todo with ID:', todoId);
      await createTodosFromDrafts(
        activeConversationId,
        messageId,
        [
          {
            content: content.trim(),
            activeForm: content.trim(),
            order: todos.length,
            depth: 0,
          }
        ]
      );
      console.log('[ChatPanel] Todo created successfully:', todoId);
      console.log('[ChatPanel] Task added as message:', messageId, 'todoId:', todoId);
    } catch (error) {
      console.error('[ChatPanel] Failed to add todo:', error);
      throw error; // Re-throw to show error toast in ChatInput
    }
  }, [conversationId, createTodosFromDrafts, todos.length, workspace.id, onConversationChange]);

  // Handle session compact - summarize old messages to reduce token usage (Enhanced)
  const handleSessionCompact = useCallback(async (silent: boolean = false) => {
    if (!conversationId) {
      console.warn('[ChatPanel] No conversation to compact');
      if (!silent) toast.error('No active conversation to compact');
      return;
    }

    if (messages.length < 20) {
      console.warn('[ChatPanel] Not enough messages to compact (need at least 20)');
      if (!silent) toast.info('Not enough messages to compact (minimum 20 messages needed)');
      return;
    }

    try {
      console.log(`[ChatPanel] 🗜️  Starting ${silent ? 'auto' : 'manual'} session compact...`);
      console.log('[ChatPanel] Messages:', messages.length, '| Strategy: Keep initial 3 + important + recent 10');

      // Show loading toast only for manual compact
      const loadingToast = silent ? null : toast.loading('Analyzing and compacting session...');

      // Call enhanced IPC handler with smart preservation
      const result = await ipcRenderer.invoke('session:compact', {
        sessionId: sessionId,
        messages: messages,
        keepRecentCount: 10,
        keepInitialCount: 3,  // ✅ NEW: Keep first 3 messages (project context)
      });

      if (!result.success) {
        if (loadingToast) toast.dismiss(loadingToast);
        if (!silent) toast.error(`Failed to compact: ${result.error}`);
        console.error('[ChatPanel] Compact failed:', result.error);
        return;
      }

      // ✅ Enhanced logging
      console.log('[ChatPanel] 📊 Compact result:', {
        originalCount: result.originalMessageCount,
        summarizedCount: result.summarizedMessageCount,
        keptCount: result.keptMessageCount,
        preservedImportant: result.preservedMessages?.length || 0,
        tokensBefore: result.tokensBeforeEstimate,
        tokensAfter: result.tokensAfterEstimate,
        savings: Math.round((1 - result.tokensAfterEstimate / result.tokensBeforeEstimate) * 100) + '%',
      });

      // ✅ Enhanced summary message with more context
      const timestamp = Date.now();
      const summaryMessage: Message = {
        id: `summary-${timestamp}`,
        conversationId: conversationId,
        role: 'assistant',
        content: `## 📝 Session Summary\n\n${result.summary}\n\n---\n\n*This summary consolidates **${result.summarizedMessageCount}** messages (out of ${result.originalMessageCount} total). ${result.preservedMessages?.length || 0} important messages preserved separately.*${silent ? ' 🤖 (Auto-compacted)' : ''}`,
        timestamp,
        metadata: {
          isCompactSummary: true,
          originalMessageCount: result.originalMessageCount,
          summarizedMessageCount: result.summarizedMessageCount,
          tokensBeforeEstimate: result.tokensBeforeEstimate,
          tokensAfterEstimate: result.tokensAfterEstimate,
        },
      };

      // ✅ Build messages array from current state
      // Backend already selected: initial + important + recent
      // We need to reconstruct this from message IDs

      // Simple approach: Find messages that were kept
      // Backend returns: keptMessageCount (initial + important + recent count)
      // We'll reconstruct by taking first 3, last 10, and any in between that match IDs

      const preservedIds = new Set(result.preservedMessages?.map((m: Message) => m.id) || []);
      const recentMessages = messages.slice(-10);  // Last 10
      const initialMessages = messages.slice(0, 3);  // First 3

      // Find preserved important messages (not in initial or recent)
      const preservedImportant = messages.filter(msg =>
        preservedIds.has(msg.id) &&
        !initialMessages.some(m => m.id === msg.id) &&
        !recentMessages.some(m => m.id === msg.id)
      );

      // Build final message array: [initial] + [summary] + [preserved important] + [recent]
      const newMessages = [
        ...initialMessages,
        summaryMessage,
        ...preservedImportant,
        ...recentMessages,
      ];

      setMessages(newMessages);

      // Save summary message to database
      await ipcRenderer.invoke('message:create', summaryMessage);

      // Delete summarized messages from database
      // Backend told us which were kept, so delete everything except those + summary
      const keptIds = new Set([
        ...initialMessages.map(m => m.id),
        summaryMessage.id,
        ...preservedImportant.map(m => m.id),
        ...recentMessages.map(m => m.id),
      ]);

      const messagesToDelete = messages.filter(msg => !keptIds.has(msg.id));

      console.log(`[ChatPanel] 🗑️  Deleting ${messagesToDelete.length} summarized messages from DB...`);

      for (const msg of messagesToDelete) {
        await ipcRenderer.invoke('message:delete', msg.id);
      }

      if (loadingToast) toast.dismiss(loadingToast);

      // ✅ Enhanced success toast with more detail
      const savedPercentage = Math.round((1 - result.tokensAfterEstimate / result.tokensBeforeEstimate) * 100);
      const keptTotal = initialMessages.length + 1 + preservedImportant.length + recentMessages.length;

      if (!silent) {
        toast.success(
          `✅ Session compacted: ${result.originalMessageCount} → ${keptTotal} messages (${savedPercentage}% tokens saved)\n${result.summarizedMessageCount} messages summarized, ${preservedImportant.length} important kept`,
          { duration: 6000 }
        );
      } else {
        toast.info(
          `🤖 Auto-compact: ${savedPercentage}% tokens saved`,
          { duration: 3000 }
        );
      }

      // Update last auto-compact time if this was an auto-compact
      if (silent) {
        setLastAutoCompactTime(Date.now());
      }

      console.log(`[ChatPanel] ✅ Session compact completed successfully (${silent ? 'auto' : 'manual'})`);
    } catch (error) {
      console.error('[ChatPanel] ❌ Session compact failed:', error);
      if (!silent) toast.error('Failed to compact session. Please try again.');
    }
  }, [conversationId, sessionId, messages]);

  // Auto-compact when Context Gauge reaches 80% (shouldCompact = true)
  useEffect(() => {
    const shouldAutoCompact = metrics?.context?.shouldCompact;

    if (!shouldAutoCompact || !conversationId || messages.length < 20) {
      return;
    }

    // Prevent compact if we did it recently (within 5 minutes)
    const MIN_COMPACT_INTERVAL = 5 * 60 * 1000; // 5 minutes
    const timeSinceLastCompact = Date.now() - lastAutoCompactTime;

    if (lastAutoCompactTime > 0 && timeSinceLastCompact < MIN_COMPACT_INTERVAL) {
      console.log('[ChatPanel] Skipping auto-compact (too soon since last compact)');
      return;
    }

    // Trigger silent auto-compact
    console.log('[ChatPanel] Auto-compact triggered (Context Gauge at 80%+)');
    handleSessionCompact(true);
  }, [metrics?.context?.shouldCompact, conversationId, messages.length, lastAutoCompactTime, handleSessionCompact]);

  const handleSend = async (inputText: string, attachments: AttachedFile[], thinkingMode: import('./ChatInput').ThinkingMode, architectMode: boolean) => {
    if (!inputText.trim() && attachments.length === 0) return;
    if (!sessionId) return;

    // Build final input with code attachments prepended
    let finalInput = inputText;
    const codeAttachments = attachments.filter(a => a.type === 'code/selection' && a.code);

    if (codeAttachments.length > 0) {
      const codeBlocks = codeAttachments.map(a => {
        if (!a.code) return '';
        const lineInfo = a.code.lineEnd !== a.code.lineStart
          ? `${a.code.lineStart}-${a.code.lineEnd}`
          : `${a.code.lineStart}`;
        return `Code from ${a.code.filePath}:${lineInfo}:\n\`\`\`\n${a.code.content}\n\`\`\``;
      }).join('\n\n');

      finalInput = `${codeBlocks}\n\n${inputText}`;

      // Clear code attachment state
      setCodeAttachment(null);
    }

    // Clear input immediately (improved UX)
    setInput('');

    // Execute prompt directly
    await executePrompt(finalInput, attachments, thinkingMode, architectMode);
  };

  const executePrompt = async (inputText: string, attachments: AttachedFile[], thinkingMode: import('./ChatInput').ThinkingMode, architectMode: boolean) => {
    if (isSending || !sessionId) return;

    // Track current thinking mode for plan detection
    currentThinkingModeRef.current = thinkingMode;

    // Ensure we have a conversationId
    let activeConversationId = conversationId;

    if (!activeConversationId) {
      console.warn('[ChatPanel] No conversation ID, creating new conversation');
      try {
        const createResult = await ipcRenderer.invoke('conversation:create', workspace.id);
        if (createResult.success && createResult.conversation) {
          activeConversationId = createResult.conversation.id;
          setConversationId(activeConversationId);
        } else {
          console.error('[ChatPanel] Failed to create conversation:', createResult.error);
          alert('Failed to create conversation. Please try again.');
          return;
        }
      } catch (error) {
        console.error('[ChatPanel] Error creating conversation:', error);
        alert('Failed to create conversation. Please check console for details.');
        return;
      }
    }

    // NO LONGER prepending AI rules to user message - they will be sent as system prompt instead
    // Build content with just the user input
    const content = inputText;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      conversationId: activeConversationId!,
      role: 'user',
      content,
      timestamp: Date.now(),
      metadata: {
        attachments: attachments.map(f => ({
          id: f.id,
          name: f.name,
          type: f.type,
          size: f.size,
        })),
      },
    };

    // Optimistic UI update
    setMessages((prev) => {
      console.log('[ChatPanel] 📤 Adding user message:', {
        messageId: userMessage.id,
        prevLength: prev.length,
        newLength: prev.length + 1,
        timestamp: Date.now()
      });
      return [...prev, userMessage];
    });
    setInput('');
    setIsSending(true);

    // Save user message to database and update with blocks
    ipcRenderer.invoke('message:save', userMessage).then((result: any) => {
      if (result.success && result.blocks) {
        // Update the message with parsed blocks
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === userMessage.id ? { ...msg, blocks: result.blocks } : msg
          )
        );
      }
    }).catch((err: any) => {
      console.error('[ChatPanel] Failed to save user message:', err);
    });

    // Store pending user message for response handlers
    pendingUserMessageRef.current = userMessage;

    // Load AI rules context if architect mode is enabled
    let aiRulesSystemPrompt: string | undefined = undefined;
    if (architectMode) {
      try {
        aiRulesSystemPrompt = await getAIRulesContext(workspace.path);
        if (aiRulesSystemPrompt) {
          console.log('[ChatPanel] 🏗️ Architect Mode enabled - AI rules will be sent as system prompt');
        }
      } catch (error) {
        console.warn('[ChatPanel] Failed to load AI rules for Architect Mode:', error);
      }
    }

    // Send message (non-blocking) - response will arrive via event listeners
    console.log('[ChatPanel] 📨 Sending message to Claude:', {
      sessionId,
      messageLength: inputText.length,
      attachmentsCount: attachments.length,
      thinkingMode,
      architectMode,
      hasAIRules: !!aiRulesSystemPrompt,
      currentSessionIdRef: sessionIdRef.current
    });
    ipcRenderer.send('claude:send-message', sessionId, inputText, attachments, thinkingMode, architectMode, aiRulesSystemPrompt);
    console.log('[ChatPanel] 📨 Message sent, waiting for IPC events...');
  };

  // Todo confirmation handlers
  const handleTodoConfirm = async (todos: TodoDraft[], mode: ExecutionMode) => {
    console.log('[ChatPanel] Todos confirmed:', todos, 'Mode:', mode);
    setShowTodoDialog(false);

    if (!conversationId || !pendingPrompt) {
      console.error('[ChatPanel] Missing conversation ID or pending prompt');
      return;
    }

    // Create user message for todo tracking
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      conversationId,
      role: 'user',
      content: pendingPrompt.text,
      timestamp: Date.now(),
      metadata: {
        attachments: pendingPrompt.attachments.map(f => ({
          id: f.id,
          name: f.name,
          type: f.type,
          size: f.size,
        })),
      },
    };

    // Save todos to database
    try {
      const result = await ipcRenderer.invoke('todos:save-multiple',
        todos.map((draft, index) => ({
          id: `todo-${userMessage.id}-${index}`,
          conversationId,
          messageId: userMessage.id,
          parentId: draft.parentId,
          order: draft.order,
          depth: draft.depth,
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
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }))
      );

      if (result.success) {
        console.log('[ChatPanel] Todos saved successfully');
      } else {
        console.error('[ChatPanel] Failed to save todos:', result.error);
      }
    } catch (error) {
      console.error('[ChatPanel] Error saving todos:', error);
    }

    // Write todos to .circuit/todos.json file for Claude to read
    try {
      const todosData = {
        conversationId,
        messageId: userMessage.id,
        mode,
        todos: todos.map((draft, index) => ({
          id: `todo-${userMessage.id}-${index}`,
          content: draft.content,
          description: draft.description,
          activeForm: draft.activeForm,
          status: 'pending',
          priority: draft.priority,
          complexity: draft.complexity,
          estimatedDuration: draft.estimatedDuration,
          order: draft.order,
          depth: draft.depth,
        })),
      };

      await ipcRenderer.invoke('workspace:write-file',
        workspace.path,
        '.circuit/todos.json',
        JSON.stringify(todosData, null, 2)
      );

      console.log('[ChatPanel] Wrote todos to .circuit/todos.json');
    } catch (error) {
      console.error('[ChatPanel] Error writing todos.json:', error);
    }

    // Prepare mode-specific prompt for Claude
    const modePrompts = {
      auto: `I've created a task plan in .circuit/todos.json with ${todos.length} task${todos.length === 1 ? '' : 's'}.

Please execute ALL tasks in order automatically. Use the TodoWrite tool to update task status as you progress. Show progress for each task.`,

      manual: `I've created a task plan in .circuit/todos.json with ${todos.length} task${todos.length === 1 ? '' : 's'}.

I'll control execution manually. Respond to commands like:
- "next" or "continue" - Execute next pending task
- "run all" - Execute all remaining tasks
- "execute task N" - Execute specific task by number
- "skip task N" - Skip a task

The plan is ready. What would you like to do?`,
    };

    const executionPrompt = modePrompts[mode];

    // Execute with mode-specific prompt instead of original prompt
    await executePrompt(executionPrompt, pendingPrompt.attachments, 'normal');

    // Clear pending state
    setPendingPrompt(null);
    setTodoResult(null);
  };

  const handleTodoCancel = () => {
    console.log('[ChatPanel] Todos cancelled');
    setShowTodoDialog(false);
    setPendingPrompt(null);
    setTodoResult(null);
  };

  // Memoize filtered blocks for each message to avoid expensive JSON parsing on every render
  const messagesWithFilteredBlocks = useMemo(() => {
    return messages.map(msg => {
      // Skip if no blocks or no metadata requiring filtering
      if (!msg.blocks || msg.blocks.length === 0 || (!msg.metadata?.planResult && !msg.metadata?.todoWriteResult)) {
        return { ...msg, filteredBlocks: msg.blocks };
      }

      // Filter out plan/todoWrite JSON blocks
      const filteredBlocks = msg.blocks.filter(block => {
        if (block.type === 'code' && block.metadata?.language === 'json') {
          try {
            const parsed = JSON.parse(block.content);
            // Remove blocks containing todos array (plan/todoWrite JSON)
            if (parsed.todos && Array.isArray(parsed.todos)) {
              return false;
            }
          } catch (e) {
            // Not valid JSON, keep it
          }
        }
        return true;
      });

      return { ...msg, filteredBlocks };
    });
  }, [messages]);

  // Filter out empty assistant messages for display
  const filteredMessages = useMemo(() => {
    return messagesWithFilteredBlocks.filter((msg) => {
      // Hide empty assistant messages UNLESS it's the pending message (in progress)
      if (msg.role === 'assistant' && !msg.content && (!msg.blocks || msg.blocks.length === 0)) {
        // Keep if it's the pending message currently being streamed
        if (isSending && msg.id === pendingAssistantMessageId) {
          return true;
        }
        return false;
      }
      return true;
    });
  }, [messagesWithFilteredBlocks, isSending, pendingAssistantMessageId]);

  // Virtual scrolling setup
  // Memoize getScrollElement to prevent virtualizer recreation
  const getScrollElement = useCallback(() => scrollContainerRef.current, []);

  // Memoize estimateSize with dynamic height prediction
  const estimateSize = useCallback((index: number) => {
    const msg = filteredMessages[index];
    if (!msg) return 200;

    // Check if reasoning is open for this message
    const isReasoningOpen = openReasoningId === msg.id;
    const hasReasoning = messageThinkingSteps[msg.id]?.steps?.length > 0;

    // If reasoning accordion is open, estimate based on number of steps
    if (isReasoningOpen && hasReasoning) {
      const stepCount = messageThinkingSteps[msg.id].steps.length;
      // Each step is ~40px, plus base message height of 150px, plus accordion header ~50px
      return 150 + 50 + (stepCount * 40);
    }

    // Estimate based on number of blocks (code blocks, etc.)
    const blockCount = msg.blocks?.length || 0;
    if (blockCount > 0) {
      // Code blocks are typically 200-300px each
      return 150 + (blockCount * 250);
    }

    // Estimate based on content length
    const contentLength = msg.content?.length || 0;
    if (contentLength > 1000) {
      return 400;
    } else if (contentLength > 500) {
      return 300;
    } else if (contentLength > 200) {
      return 200;
    }

    // Default minimum height
    return 150;
  }, [filteredMessages, messageThinkingSteps, openReasoningId]);

  const virtualizer = useVirtualizer({
    count: filteredMessages.length,
    getScrollElement,
    estimateSize,
    overscan: 5, // Render 5 extra items outside viewport for smooth scrolling
  });

  // Auto-scroll is disabled - users can manually scroll using the "Scroll to Bottom" button

  // When reasoning accordion is toggled, the estimateSize function recalculates
  // because openReasoningId is in its dependencies. This triggers virtualizer
  // to remeasure all items automatically. No manual measure() call needed.

  return (
    <div className="h-full bg-card relative">
      {/* Messages Area - with space for floating input */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="absolute inset-0 bottom-[240px] overflow-auto p-3"
      >
        {isLoadingConversation ? (
          <div className="space-y-5 max-w-4xl mx-auto">
            <ChatMessageSkeleton />
            <ChatMessageSkeleton />
          </div>
        ) : filteredMessages.length > 0 ? (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
            data-virtualizer-total-size={virtualizer.getTotalSize()}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const msg = filteredMessages[virtualItem.index];

              return (
                <div
                  key={msg.id}
                  data-index={virtualItem.index}
                  data-message-id={msg.id}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <div className="max-w-4xl mx-auto px-0 mb-5">
                    <MessageComponent
                      msg={msg}
                      isSending={isSending}
                      pendingAssistantMessageId={pendingAssistantMessageId}
                      messageThinkingSteps={messageThinkingSteps}
                      openReasoningId={openReasoningId}
                      copiedMessageId={copiedMessageId}
                      currentDuration={currentDuration}
                      onCopyMessage={handleCopyMessage}
                      onToggleReasoning={handleToggleReasoning}
                      onExecuteCommand={handleExecuteCommand}
                      onFileReferenceClick={onFileReferenceClick}
                      onRunAgent={handleRunAgentForMessage}
                      agentStates={messageAgentStates}
                    />
                  </div>
                </div>
              );
            })}
            {isSending && thinkingSteps.length === 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualizer.getTotalSize()}px)`,
                }}
              >
                <div className="max-w-4xl mx-auto px-0 mb-5">
                  <div className="flex justify-start">
                    <div className="max-w-[75%]">
                      <div className="space-y-2 pl-1">
                        <Shimmer duration={2} className="text-sm text-muted-foreground">
                          Analyzing your request...
                        </Shimmer>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {/* Bottom spacer for better visibility when sending messages */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualizer.getTotalSize()}px)`,
                height: '600px',
              }}
            />
          </div>
        ) : (
          <ChatEmptyState />
        )}
      </div>

      {/* Gradient Fade to hide content behind floating input */}
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-card from-20% via-card via-60% to-transparent pointer-events-none" />

      {/* Scroll to Bottom Button */}
      {!isAtBottom && messages.length > 0 && (
        <div className="absolute bottom-[260px] left-1/2 -translate-x-1/2 pointer-events-none z-50">
          <button
            onClick={scrollToBottom}
            className="pointer-events-auto flex items-center justify-center w-6 h-6 rounded-full bg-muted text-foreground border-2 border-border shadow-lg hover:bg-muted/80 transition-all duration-200"
            aria-label="Scroll to bottom"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Enhanced Chat Input - Floating */}
      <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-0 bg-card pointer-events-none">
        <div className="pointer-events-auto max-w-4xl mx-auto">
          <ChatInput
            value={input}
            onChange={setInput}
            onSubmit={handleSend}
            disabled={!sessionId || isLoadingConversation}
            placeholder="Ask, search, or make anything..."
            showControls={true}
            isSending={isSending}
            isCancelling={isCancelling}
            onCancel={handleCancel}
            workspacePath={workspace.path}
            projectPath={workspace.path.split('/.conductor/workspaces/')[0]}
            onAddTodo={handleAddTodo}
            onCompact={handleSessionCompact}
            codeAttachment={codeAttachment}
            onCodeAttachmentRemove={() => setCodeAttachment(null)}
          />
        </div>
      </div>

      {/* Todo Confirmation Dialog */}
      <TodoConfirmationDialog
        isOpen={showTodoDialog}
        result={todoResult}
        onConfirm={handleTodoConfirm}
        onCancel={handleTodoCancel}
      />
    </div>
  );
};

// Wrapper component with TodoProvider
const ChatPanel: React.FC<ChatPanelProps> = (props) => {
  return (
    <TodoProvider conversationId={undefined}>
      <ChatPanelInner {...props} />
    </TodoProvider>
  );
};

// ============================================================================
// Editor Panel Component
// ============================================================================

interface EditorPanelProps {
  workspace: Workspace;
  sessionId: string | null;  // Claude session ID for AI features
  openFiles: string[];
  selectedFile: string | null;
  onCloseFile?: (filePath: string) => void;
  onUnsavedChange?: (filePath: string, hasChanges: boolean) => void;
  fileCursorPosition?: {
    filePath: string
    lineStart: number
    lineEnd: number
  } | null;
  onCodeSelectionAction?: (action: {
    type: 'ask' | 'explain' | 'optimize' | 'add-tests'
    code: string
    filePath: string
    lineStart: number
    lineEnd: number
  }) => void;
}

const EditorPanel: React.FC<EditorPanelProps> = ({
  workspace,
  sessionId,
  openFiles,
  selectedFile,
  onCloseFile,
  onUnsavedChange,
  fileCursorPosition,
  onCodeSelectionAction,
}) => {
  const { settings } = useSettingsContext();
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [fileContents, setFileContents] = useState<Map<string, string>>(new Map());
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState<Map<string, boolean>>(new Map());
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');

  // Monaco editor instance ref
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  // Get project root path (workspace.path is a worktree, we need the actual project root)
  // Example: /path/to/project/.conductor/workspaces/duck -> /path/to/project
  const projectRoot = useMemo(() => {
    const parts = workspace.path.split('/.conductor/workspaces/');
    return parts[0]; // Return the project root without worktree path
  }, [workspace.path]);

  // ✅ Normalize active file path to workspace-relative path
  // This ensures consistent tab IDs and file loading regardless of path format
  const normalizedActiveFile = useMemo(() => {
    if (!activeFile) return null;

    let normalized = activeFile;

    // Convert absolute path to relative path
    if (normalized.startsWith('/') || normalized.match(/^[A-Z]:\\/)) {
      if (normalized.startsWith(projectRoot)) {
        normalized = normalized.slice(projectRoot.length);
        if (normalized.startsWith('/') || normalized.startsWith('\\')) {
          normalized = normalized.slice(1);
        }
      }
    }

    // Remove "./" prefix
    normalized = normalized.replace(/^\.\//, '');
    normalized = normalized.replace(/^\.\\/, '');

    // Normalize path separators
    normalized = normalized.replace(/\\/g, '/');

    return normalized;
  }, [activeFile, projectRoot]);

  // Language service for TypeScript/diagnostics (using LSP for full project analysis)
  const { languageService, isInitialized: isLanguageServiceInitialized, mode: languageServiceMode } = useLanguageService({
    workspacePath: projectRoot, // Use project root, not worktree path
    mode: 'lsp', // Use LSP for project-wide diagnostics
  });

  // Floating action bar state
  const [floatingActionsVisible, setFloatingActionsVisible] = useState(false);
  const [floatingActionsPosition, setFloatingActionsPosition] = useState({ top: 0, left: 0 });
  const [currentSelection, setCurrentSelection] = useState<{
    code: string
    selection: monaco.Selection
  } | null>(null);

  // Handler: Ask about code
  const handleAskAboutCode = useCallback((code: string, filePath: string, selection: monaco.Selection) => {
    if (onCodeSelectionAction) {
      onCodeSelectionAction({
        type: 'ask',
        code,
        filePath,
        lineStart: selection.startLineNumber,
        lineEnd: selection.endLineNumber
      });
    }
  }, [onCodeSelectionAction]);

  // Handler: Explain code
  const handleExplainCode = useCallback((code: string, filePath: string, selection: monaco.Selection) => {
    if (onCodeSelectionAction) {
      onCodeSelectionAction({
        type: 'explain',
        code,
        filePath,
        lineStart: selection.startLineNumber,
        lineEnd: selection.endLineNumber
      });
    }
  }, [onCodeSelectionAction]);

  // Handler: Optimize code
  const handleOptimizeCode = useCallback((code: string, filePath: string, selection: monaco.Selection) => {
    if (onCodeSelectionAction) {
      onCodeSelectionAction({
        type: 'optimize',
        code,
        filePath,
        lineStart: selection.startLineNumber,
        lineEnd: selection.endLineNumber
      });
    }
  }, [onCodeSelectionAction]);

  // Handler: Add tests
  const handleAddTests = useCallback((code: string, filePath: string, selection: monaco.Selection) => {
    if (onCodeSelectionAction) {
      onCodeSelectionAction({
        type: 'add-tests',
        code,
        filePath,
        lineStart: selection.startLineNumber,
        lineEnd: selection.endLineNumber
      });
    }
  }, [onCodeSelectionAction]);

  // Floating action bar button handlers
  const handleFloatingAsk = useCallback(() => {
    if (currentSelection && activeFile) {
      handleAskAboutCode(currentSelection.code, activeFile, currentSelection.selection);
      setFloatingActionsVisible(false);
    }
  }, [currentSelection, activeFile, handleAskAboutCode]);

  const handleFloatingExplain = useCallback(() => {
    if (currentSelection && activeFile) {
      handleExplainCode(currentSelection.code, activeFile, currentSelection.selection);
      setFloatingActionsVisible(false);
    }
  }, [currentSelection, activeFile, handleExplainCode]);

  const handleFloatingOptimize = useCallback(() => {
    if (currentSelection && activeFile) {
      handleOptimizeCode(currentSelection.code, activeFile, currentSelection.selection);
      setFloatingActionsVisible(false);
    }
  }, [currentSelection, activeFile, handleOptimizeCode]);

  const handleFloatingAddTests = useCallback(() => {
    if (currentSelection && activeFile) {
      handleAddTests(currentSelection.code, activeFile, currentSelection.selection);
      setFloatingActionsVisible(false);
    }
  }, [currentSelection, activeFile, handleAddTests]);

  // Note: TypeScript configuration and type definitions are now loaded
  // automatically by the useLanguageService hook (MonacoLanguageService)

  // Set active file when selectedFile changes (from sidebar)
  useEffect(() => {
    if (selectedFile && selectedFile !== activeFile) {
      setActiveFile(selectedFile);
      setViewMode('edit'); // Reset to edit mode when switching files
    }
  }, [selectedFile]);

  // Set initial active file when openFiles changes
  useEffect(() => {
    if (!activeFile && openFiles.length > 0) {
      setActiveFile(openFiles[0]);
    }
  }, [openFiles.length]);

  // ✅ Use normalized path for file content lookup
  const fileContent = normalizedActiveFile ? fileContents.get(normalizedActiveFile) || '' : '';
  const hasUnsavedChanges = normalizedActiveFile ? unsavedChanges.get(normalizedActiveFile) || false : false;
  const isMarkdown = normalizedActiveFile?.toLowerCase().endsWith('.md') || normalizedActiveFile?.toLowerCase().endsWith('.markdown');

  // Track opened files in LSP
  const openedLSPFiles = useRef<Set<string>>(new Set());

  // Cleanup: Close all LSP documents on unmount
  useEffect(() => {
    return () => {
      if (languageService && languageServiceMode === 'lsp') {
        openedLSPFiles.current.forEach(async (file) => {
          try {
            const fileUri = `file:///${file}`;
            await (languageService as any).closeDocument(fileUri);
            console.log('[EditorPanel] ✅ LSP: Document closed on unmount:', file);
          } catch (error) {
            console.error('[EditorPanel] LSP cleanup error:', error);
          }
        });
        openedLSPFiles.current.clear();
      }
    };
  }, [languageService, languageServiceMode]);

  // Load file contents when active file changes
  useEffect(() => {
    if (!normalizedActiveFile) {
      return;
    }

    // ✅ Use normalized path for cache check
    if (fileContents.has(normalizedActiveFile)) {
      console.log('[EditorPanel] File content already loaded (cache hit):', normalizedActiveFile);
      return;
    }

    const loadFileContent = async () => {
      setIsLoadingFile(true);
      try {
        console.log('[EditorPanel] Loading file (normalized):', normalizedActiveFile);
        // ✅ Use normalized path for IPC call
        const result = await ipcRenderer.invoke('workspace:read-file', workspace.path, normalizedActiveFile);

        if (result.success) {
          // ✅ Store with normalized path as key
          setFileContents(prev => new Map(prev).set(normalizedActiveFile, result.content));

          // Notify LSP that document was opened
          if (languageService && isLanguageServiceInitialized && languageServiceMode === 'lsp') {
            // ✅ Use normalized path for LSP URI
            const fileUri = `file:///${normalizedActiveFile}`;
            const languageId = getLanguageFromFilePath(normalizedActiveFile);

            // Map Monaco language IDs to LSP language IDs
            const lspLanguageId = languageId === 'typescriptreact' ? 'typescriptreact' :
                                   languageId === 'typescript' ? 'typescript' :
                                   languageId === 'javascriptreact' ? 'javascriptreact' :
                                   languageId === 'javascript' ? 'javascript' : 'typescript';

            await (languageService as any).openDocument(fileUri, lspLanguageId, result.content);
            // ✅ Track with normalized path
            openedLSPFiles.current.add(normalizedActiveFile);
            console.log('[EditorPanel] ✅ LSP: Document opened:', normalizedActiveFile);
          }
        } else {
          console.error('[EditorPanel] Failed to load file:', result.error);
          // ✅ Store error with normalized path
          setFileContents(prev => new Map(prev).set(normalizedActiveFile, `// Error loading file: ${result.error}`));
        }
      } catch (error) {
        console.error('[EditorPanel] Error loading file:', error);
        // ✅ Store error with normalized path
        setFileContents(prev => new Map(prev).set(normalizedActiveFile, `// Error: ${error}`));
      } finally {
        setIsLoadingFile(false);
      }
    };

    loadFileContent();
  }, [normalizedActiveFile, workspace.path, languageService, isLanguageServiceInitialized, languageServiceMode]);

  // Close documents when files are removed from openFiles
  useEffect(() => {
    if (!languageService || !isLanguageServiceInitialized || languageServiceMode !== 'lsp') {
      return;
    }

    // Find files that were opened in LSP but are no longer in openFiles
    const currentOpenFiles = new Set(openFiles);
    const filesToClose: string[] = [];

    openedLSPFiles.current.forEach(file => {
      if (!currentOpenFiles.has(file)) {
        filesToClose.push(file);
      }
    });

    // Close documents in LSP
    filesToClose.forEach(async (file) => {
      try {
        const fileUri = `file:///${file}`;
        await (languageService as any).closeDocument(fileUri);
        openedLSPFiles.current.delete(file);
        console.log('[EditorPanel] ✅ LSP: Document closed:', file);
      } catch (error) {
        console.error('[EditorPanel] LSP close error:', error);
      }
    });
  }, [openFiles, languageService, isLanguageServiceInitialized, languageServiceMode]);

  // Save file
  const handleSaveFile = async () => {
    if (!normalizedActiveFile || !hasUnsavedChanges) return;

    setIsSaving(true);
    try {
      console.log('[EditorPanel] Saving file (normalized):', normalizedActiveFile);
      // ✅ Use normalized path for file content lookup
      const content = fileContents.get(normalizedActiveFile) || '';
      // ✅ Use normalized path for IPC call
      const result = await ipcRenderer.invoke('workspace:write-file', workspace.path, normalizedActiveFile, content);

      if (result.success) {
        console.log('[EditorPanel] File saved successfully');
        // ✅ Update unsaved changes with normalized path
        setUnsavedChanges(prev => new Map(prev).set(normalizedActiveFile, false));

        // Notify parent that file is saved (no unsaved changes)
        onUnsavedChange?.(normalizedActiveFile, false);
      } else {
        console.error('[EditorPanel] Failed to save file:', result.error);
        alert(`Failed to save file: ${result.error}`);
      }
    } catch (error) {
      console.error('[EditorPanel] Error saving file:', error);
      alert(`Error saving file: ${error}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle content change
  // Debounced LSP update
  const updateLSPDebounced = useRef<NodeJS.Timeout | null>(null);

  const handleContentChange = (value: string | undefined) => {
    if (!normalizedActiveFile || value === undefined) return;

    // ✅ Use normalized path for file content lookup
    const currentContent = fileContents.get(normalizedActiveFile) || '';
    if (value !== currentContent) {
      // ✅ Store with normalized path
      setFileContents(prev => new Map(prev).set(normalizedActiveFile, value));
      setUnsavedChanges(prev => new Map(prev).set(normalizedActiveFile, true));

      // Notify parent about unsaved changes
      onUnsavedChange?.(normalizedActiveFile, true);

      // Notify LSP about document changes (debounced to avoid too many updates)
      if (languageService && isLanguageServiceInitialized && languageServiceMode === 'lsp') {
        // Clear previous timeout
        if (updateLSPDebounced.current) {
          clearTimeout(updateLSPDebounced.current);
        }

        // Set new timeout (500ms delay)
        updateLSPDebounced.current = setTimeout(async () => {
          try {
            // ✅ Use normalized path for LSP URI
            const fileUri = `file:///${normalizedActiveFile}`;
            await (languageService as any).updateDocument(fileUri, value);
            console.log('[EditorPanel] ✅ LSP: Document updated:', normalizedActiveFile);
          } catch (error) {
            console.error('[EditorPanel] LSP update error:', error);
          }
        }, 500);
      }
    }
  };

  // Handle Cmd+S / Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSaveFile();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFile, hasUnsavedChanges, fileContent]);

  // Handle Monaco editor mount
  const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;

    // Log model info for debugging
    const model = editor.getModel();
    if (model && activeFile) {
      console.log(`[EditorPanel] Model mounted:`, {
        file: activeFile,
        language: model.getLanguageId(),
        uri: model.uri.toString()
      });

      // Refresh diagnostics using language service
      if (languageService && isLanguageServiceInitialized) {
        setTimeout(async () => {
          try {
            await languageService.refreshDiagnostics(model.uri.toString());
            const diagnostics = await languageService.getDiagnostics(model.uri.toString());
            console.log(`[EditorPanel] Current diagnostics for ${activeFile}: ${diagnostics.length} issues`);
            console.log('[EditorPanel] ✅ Diagnostics refreshed via language service');
          } catch (error) {
            console.error('[EditorPanel] Failed to refresh diagnostics:', error);
          }
        }, 100); // Small delay to ensure TypeScript worker is ready
      } else {
        console.log('[EditorPanel] Language service not yet initialized');
      }
    }

    // Listen for selection changes to show/hide floating actions
    editor.onDidChangeCursorSelection((e) => {
      const selection = e.selection;
      const model = editor.getModel();

      if (!model || selection.isEmpty()) {
        // No selection or empty selection - hide floating actions
        setFloatingActionsVisible(false);
        setCurrentSelection(null);
        return;
      }

      // Get selected text
      const selectedText = model.getValueInRange(selection);

      if (!selectedText.trim()) {
        // Only whitespace selected - hide floating actions
        setFloatingActionsVisible(false);
        setCurrentSelection(null);
        return;
      }

      // Store current selection
      setCurrentSelection({
        code: selectedText,
        selection
      });

      // Calculate position for floating action bar
      // Position it above the selection start
      const position = editor.getScrolledVisiblePosition(selection.getStartPosition());

      if (position) {
        const editorDom = editor.getDomNode();
        if (!editorDom) return;

        const editorRect = editorDom.getBoundingClientRect();

        // Position above the selection with some offset
        const top = editorRect.top + position.top - 45; // 45px above selection
        const left = editorRect.left + position.left;

        setFloatingActionsPosition({ top, left });
        setFloatingActionsVisible(true);
      }
    });

    // Add context menu actions for Claude AI assistance
    editor.addAction({
      id: 'ask-claude-about-selection',
      label: '💬 Ask Claude about this',
      contextMenuGroupId: 'claude',
      contextMenuOrder: 1,
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK
      ],
      run: (ed) => {
        const selection = ed.getSelection();
        const selectedText = ed.getModel()?.getValueInRange(selection);

        if (selectedText && activeFile) {
          handleAskAboutCode(selectedText, activeFile, selection);
        }
      }
    });

    editor.addAction({
      id: 'explain-code',
      label: '📖 Explain this code',
      contextMenuGroupId: 'claude',
      contextMenuOrder: 2,
      run: (ed) => {
        const selection = ed.getSelection();
        const selectedText = ed.getModel()?.getValueInRange(selection);

        if (selectedText && activeFile) {
          handleExplainCode(selectedText, activeFile, selection);
        }
      }
    });

    editor.addAction({
      id: 'optimize-code',
      label: '⚡ Optimize this',
      contextMenuGroupId: 'claude',
      contextMenuOrder: 3,
      run: (ed) => {
        const selection = ed.getSelection();
        const selectedText = ed.getModel()?.getValueInRange(selection);

        if (selectedText && activeFile) {
          handleOptimizeCode(selectedText, activeFile, selection);
        }
      }
    });

    editor.addAction({
      id: 'add-tests',
      label: '🧪 Add tests for this',
      contextMenuGroupId: 'claude',
      contextMenuOrder: 4,
      run: (ed) => {
        const selection = ed.getSelection();
        const selectedText = ed.getModel()?.getValueInRange(selection);

        if (selectedText && activeFile) {
          handleAddTests(selectedText, activeFile, selection);
        }
      }
    });
  };

  // Register Monaco Hover Provider for AI explanations
  useEffect(() => {
    if (!settings.monaco.enableHover || !sessionId) return;

    const disposable = monaco.languages.registerHoverProvider(['typescript', 'javascript', 'python', 'java', 'go', 'rust'], {
      provideHover: async (model, position) => {
        const word = model.getWordAtPosition(position);
        if (!word) return null;

        // Get surrounding context (3 lines before and after)
        const startLine = Math.max(1, position.lineNumber - 3);
        const endLine = Math.min(model.getLineCount(), position.lineNumber + 3);
        const context = model.getValueInRange({
          startLineNumber: startLine,
          startColumn: 1,
          endLineNumber: endLine,
          endColumn: model.getLineMaxColumn(endLine)
        });

        const language = model.getLanguageId();

        try {
          // Call IPC handler for quick explanation
          const result = await ipcRenderer.invoke('claude:quick-explain', {
            word: word.word,
            context,
            language,
            aiMode: settings.monaco.aiMode
          });

          if (!result.success) return null;

          return {
            range: new monaco.Range(
              position.lineNumber,
              word.startColumn,
              position.lineNumber,
              word.endColumn
            ),
            contents: [
              { value: `**${word.word}**` },
              { value: result.explanation },
              {
                value: '[더 자세히 알아보기 →](command:circuit.explainInChat)',
                isTrusted: true
              }
            ]
          };
        } catch (error) {
          console.error('[Monaco Hover] Error:', error);
          return null;
        }
      }
    });

    return () => disposable.dispose();
  }, [settings.monaco.enableHover, settings.monaco.aiMode, sessionId]);

  // Register AI Completion Provider
  useEffect(() => {
    if (!settings.monaco.enableAutocompletion || !sessionId) return;

    // Simple cache for completions (cleared every 5 minutes)
    const completionCache = new Map<string, { completion: string, timestamp: number }>();
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    const disposable = monaco.languages.registerCompletionItemProvider(
      ['typescript', 'javascript', 'python', 'java', 'go', 'rust'],
      {
        triggerCharacters: ['.', '(', '<', '{', ' '],
        provideCompletionItems: async (model, position) => {
          try {
            // Get code context
            const currentLine = model.getLineContent(position.lineNumber);
            const prefix = model.getValueInRange({
              startLineNumber: Math.max(1, position.lineNumber - 10),
              startColumn: 1,
              endLineNumber: position.lineNumber,
              endColumn: position.column
            });

            const suffix = model.getValueInRange({
              startLineNumber: position.lineNumber,
              startColumn: position.column,
              endLineNumber: Math.min(model.getLineCount(), position.lineNumber + 5),
              endColumn: model.getLineMaxColumn(Math.min(model.getLineCount(), position.lineNumber + 5))
            });

            // Build context (20 lines around cursor)
            const startLine = Math.max(1, position.lineNumber - 10);
            const endLine = Math.min(model.getLineCount(), position.lineNumber + 10);
            const context = model.getValueInRange({
              startLineNumber: startLine,
              startColumn: 1,
              endLineNumber: endLine,
              endColumn: model.getLineMaxColumn(endLine)
            });

            const language = model.getLanguageId();

            // Check cache if enabled
            const cacheKey = `${prefix}|${suffix}|${language}`;
            if (settings.monaco.cacheCompletions) {
              const cached = completionCache.get(cacheKey);
              if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
                return {
                  suggestions: [{
                    label: '⚡ AI Suggestion',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: cached.completion,
                    detail: 'Claude AI (cached)',
                    documentation: 'AI-powered code completion',
                    range: new monaco.Range(
                      position.lineNumber,
                      position.column,
                      position.lineNumber,
                      position.column
                    )
                  }]
                };
              }
            }

            // Debounce: Wait for completion delay
            await new Promise(resolve => setTimeout(resolve, settings.monaco.completionDelay || 300));

            // Request AI completion
            const result = await ipcRenderer.invoke('claude:ai-completion', {
              prefix,
              suffix,
              context,
              language,
              aiMode: settings.monaco.aiMode,
              maxTokens: settings.monaco.maxTokens || 150
            });

            if (!result.success || !result.completion) {
              return { suggestions: [] };
            }

            // Cache the result
            if (settings.monaco.cacheCompletions) {
              completionCache.set(cacheKey, {
                completion: result.completion,
                timestamp: Date.now()
              });
            }

            // Return completion suggestion
            return {
              suggestions: [{
                label: '⚡ AI Suggestion',
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: result.completion,
                detail: `Claude AI (${settings.monaco.aiMode})`,
                documentation: 'AI-powered code completion',
                range: new monaco.Range(
                  position.lineNumber,
                  position.column,
                  position.lineNumber,
                  position.column
                ),
                sortText: '0' // Prioritize AI suggestions
              }]
            };
          } catch (error) {
            console.error('[Monaco Completion] Error:', error);
            return { suggestions: [] };
          }
        }
      }
    );

    return () => disposable.dispose();
  }, [
    settings.monaco.enableAutocompletion,
    settings.monaco.aiMode,
    settings.monaco.completionDelay,
    settings.monaco.maxTokens,
    settings.monaco.cacheCompletions,
    sessionId
  ]);

  // Jump to line when fileCursorPosition changes
  useEffect(() => {
    if (!editorRef.current || !fileCursorPosition) return;
    if (fileCursorPosition.filePath !== activeFile) return;

    const editor = editorRef.current;
    const { lineStart, lineEnd } = fileCursorPosition;

    // Reveal line in center of editor
    editor.revealLineInCenter(lineStart);

    // Set cursor position
    editor.setPosition({ lineNumber: lineStart, column: 1 });

    // Highlight line range with animation
    const decorations = editor.deltaDecorations([], [
      {
        range: new monaco.Range(lineStart, 1, lineEnd, 1),
        options: {
          isWholeLine: true,
          className: 'highlighted-line-reference',
          glyphMarginClassName: 'highlighted-line-glyph'
        }
      }
    ]);

    // Clear highlight after 2 seconds
    const timeout = setTimeout(() => {
      editor.deltaDecorations(decorations, []);
    }, 2000);

    // Focus editor
    editor.focus();

    return () => clearTimeout(timeout);
  }, [fileCursorPosition, activeFile]);

  return (
    <div className="h-full flex flex-col">
      {/* Editor Content */}
      {!activeFile ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <p>No files open</p>
            <p className="text-xs mt-2">Files will appear here when Claude edits them</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 relative min-h-0">
          {/* Floating Code Actions (appears on selection) */}
          <FloatingCodeActions
            visible={floatingActionsVisible}
            position={floatingActionsPosition}
            onAsk={handleFloatingAsk}
            onExplain={handleFloatingExplain}
            onOptimize={handleFloatingOptimize}
            onAddTests={handleFloatingAddTests}
          />

          {/* Floating Edit/Preview Toggle (only for markdown) */}
          {isMarkdown && (
            <div className="absolute top-3 right-3 z-10">
              <div className="flex items-center gap-1 bg-secondary/95 backdrop-blur-sm rounded-md p-1 shadow-lg border border-border">
                <button
                  onClick={() => setViewMode('edit')}
                  className={cn(
                    'px-3 py-1 text-xs font-medium rounded transition-colors',
                    viewMode === 'edit'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Edit
                </button>
                <button
                  onClick={() => setViewMode('preview')}
                  className={cn(
                    'px-3 py-1 text-xs font-medium rounded transition-colors',
                    viewMode === 'preview'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Preview
                </button>
              </div>
            </div>
          )}

          {isLoadingFile ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-sm text-muted-foreground">Loading {activeFile}...</div>
            </div>
          ) : isMarkdown && viewMode === 'preview' ? (
            <MarkdownPreview content={fileContent} />
          ) : (
            <Editor
              height="100%"
              path={normalizedActiveFile || undefined} // ✅ Use normalized path for Monaco model URI
              language={getLanguageFromFilePath(normalizedActiveFile || '')}
              value={fileContent}
              onChange={handleContentChange}
              onMount={handleEditorDidMount}
              theme="vs-dark"
              options={{
                readOnly: false,
                minimap: { enabled: false },
                fontSize: 12,
                fontFamily: 'ui-monospace, "SF Mono", Menlo, Monaco, "Cascadia Code", "Courier New", monospace',
                fontWeight: '400',
                fontLigatures: true,
                lineHeight: 1.5,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                insertSpaces: true,
                // Find/Replace 기능 명시적 활성화
                find: {
                  seedSearchStringFromSelection: 'selection',
                  autoFindInSelection: 'never',
                  addExtraSpaceOnTop: true,
                  loop: true,
                },
              }}
            />
          )}
        </div>
      )}
    </div>
  );
};



// Export ChatPanel and EditorPanel for direct use in unified editor system
export { ChatPanel, EditorPanel };
