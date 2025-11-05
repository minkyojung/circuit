import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useDebouncedCallback } from 'use-debounce';
import type { Workspace } from '@/types/workspace';
import type { Message } from '@/types/conversation';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { ChevronDown } from 'lucide-react';
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
import { TodoConfirmationDialog } from '@/components/todo';
import { MessageComponent } from './MessageComponent';
import { ChatEmptyState } from './ChatEmptyState';
import { MarkdownPreview } from './MarkdownPreview';
import { FloatingCodeActions } from './FloatingCodeActions';
import { ConversationTabsOnly } from './ConversationTabsOnly';
import { FileTabsOnly } from './FileTabsOnly';
import {
  extractTodoWriteFromBlocks,
  extractPlanFromText,
  convertClaudeTodosToDrafts,
  calculateOverallComplexity,
  calculateTotalTime
} from '@/lib/planModeUtils';
import type { TodoGenerationResult, TodoDraft, ExecutionMode } from '@/types/todo';
import { FEATURES } from '@/config/features';
import { getLanguageFromFilePath } from '@/lib/fileUtils';
import { cn } from '@/lib/utils';

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
  useEffect(() => {
    onConversationChange?.(conversationId);
  }, [conversationId, onConversationChange]);

  const parseFileChanges = useCallback((response: string): string[] => {
    const files: string[] = [];

    // Pattern 1: <file_path>path/to/file.ts</file_path>
    const filePathMatches = response.matchAll(/<file_path>(.*?)<\/file_path>/g);
    for (const match of filePathMatches) {
      files.push(match[1]);
    }

    // Pattern 2: "I'll edit src/App.tsx" or "수정했습니다" with README.md
    const editMentions = response.matchAll(/(?:edit|modify|update|create|추가|수정|변경|생성)(?:했습니다)?[^.]*?([a-zA-Z0-9_\-/.]+\.[a-z]+)/gi);
    for (const match of editMentions) {
      const filePath = match[1];
      if (!files.includes(filePath)) {
        files.push(filePath);
      }
    }

    // Pattern 3: File paths mentioned anywhere (e.g., README.md, src/App.tsx)
    const filePathPattern = /\b([a-zA-Z0-9_\-]+(?:\/[a-zA-Z0-9_\-]+)*\.[a-z]+)\b/gi;
    const allFileMatches = response.matchAll(filePathPattern);
    for (const match of allFileMatches) {
      const filePath = match[1];
      // Only include if it looks like a real file (not just any word.extension)
      if (!files.includes(filePath) && (filePath.includes('/') || filePath.toUpperCase() === filePath || filePath.includes('README'))) {
        files.push(filePath);
      }
    }

    // Pattern 4: Code blocks with file paths
    const codeBlockMatches = response.matchAll(/```[a-z]*\s*(?:\/\/|#)?\s*([a-zA-Z0-9_\-/.]+\.[a-z]+)/gi);
    for (const match of codeBlockMatches) {
      const filePath = match[1];
      if (!files.includes(filePath)) {
        files.push(filePath);
      }
    }

    console.log('[parseFileChanges] Detected files:', files);
    return files;
  }, []);

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

  // IPC Event Handlers (using useCallback to avoid stale closures)
  const handleThinkingStart = useCallback((_event: any, eventSessionId: string, _timestamp: number) => {
      console.log('[WorkspaceChat] 🎬 handleThinkingStart called, isMounted:', isMountedRef.current, 'eventSessionId:', eventSessionId);

      if (!isMountedRef.current) {
        console.log('[WorkspaceChat] ⚠️  Component unmounted, ignoring event');
        return;
      }

      // Filter: only handle events for THIS component's session
      const currentSessionId = sessionIdRef.current;
      console.log('[WorkspaceChat] 🔍 Session check - current:', currentSessionId, 'event:', eventSessionId);

      if (!currentSessionId || eventSessionId !== currentSessionId) {
        console.log('[WorkspaceChat] ⏭️  Ignoring thinking-start for different session:', eventSessionId, '(current:', currentSessionId, ')');
        return;
      }

      console.log('[WorkspaceChat] 🧠 Thinking started:', eventSessionId);

      // Initialize refs and clear history
      thinkingStartTimeRef.current = Date.now();
      currentStepMessageRef.current = 'Starting analysis';
      setThinkingSteps([]); // Clear previous history
      setCurrentDuration(0); // Reset duration timer

      // Create empty assistant message immediately for real-time streaming
      const pending = pendingUserMessageRef.current;
      const currentConversationId = conversationIdRef.current;
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
        setMessages((prev) => {
          console.log('[ChatPanel] 🤖 Adding assistant message:', {
            messageId: assistantMessageId,
            prevLength: prev.length,
            newLength: prev.length + 1,
            timestamp: Date.now()
          });
          return [...prev, emptyAssistantMessage];
        });
        setPendingAssistantMessageId(assistantMessageId);

        // Auto-open reasoning dropdown for real-time visibility
        setOpenReasoningId(assistantMessageId);

        // Initialize messageThinkingSteps for this message so accordion displays immediately
        setMessageThinkingSteps((prevSteps) => ({
          ...prevSteps,
          [assistantMessageId]: {
            steps: [],
            duration: 0
          }
        }));

        console.log('[WorkspaceChat] ✅ Empty assistant message created:', assistantMessageId);
      }

      // Client-side timer: Update every 1s for duration display
      thinkingTimerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - thinkingStartTimeRef.current) / 1000);
        setCurrentDuration(elapsed);
        console.log(`[WorkspaceChat] ⏱️  Timer tick: ${elapsed}s`);
      }, 1000);

      console.log('[WorkspaceChat] ✅ Timer started');
  }, []);

  const handleMilestone = useDebouncedCallback(
    (_event: any, eventSessionId: string, milestone: any) => {
      if (!isMountedRef.current) return; // Prevent setState on unmounted component

      // Filter: only handle events for THIS component's session
      const currentSessionId = sessionIdRef.current;
      if (!currentSessionId || eventSessionId !== currentSessionId) {
        return; // Silently ignore events for other sessions
      }

      console.log('[WorkspaceChat] 📍 Milestone:', milestone);

      // Update ref for timer display
      currentStepMessageRef.current = milestone.message;

      // Add to history array
      const newStep = {
        type: milestone.type,
        message: milestone.message,
        timestamp: milestone.timestamp || Date.now(),
        tool: milestone.tool,
        filePath: milestone.filePath,
        command: milestone.command,
        pattern: milestone.pattern
      };

      setThinkingSteps(prev => {
        const updatedSteps = [...prev, newStep];

        // Update messageThinkingSteps in real-time for the pending assistant message
        const currentPendingId = pendingAssistantMessageIdRef.current;
        if (currentPendingId) {
          const duration = thinkingStartTimeRef.current > 0
            ? Math.round((Date.now() - thinkingStartTimeRef.current) / 1000)
            : 0;

          setMessageThinkingSteps((prevSteps) => ({
            ...prevSteps,
            [currentPendingId]: {
              steps: updatedSteps,
              duration
            }
          }));
        }

        return updatedSteps;
      });

      // Note: Tool blocks are NOT added to msg.blocks
      // They are only stored in messageThinkingSteps and displayed in ReasoningAccordion
      // This prevents duplicate rendering (ReasoningAccordion + BlockRenderer)
      if (milestone.type === 'tool-use' && milestone.tool) {
        console.log('[WorkspaceChat] 📝 Tool step recorded in ReasoningAccordion only:', milestone.tool);
      }
    },
    300, // 300ms debounce - reduces re-renders by ~70%
    { leading: true, trailing: true } // Execute immediately on first call, then debounce subsequent calls
  );

  const handleThinkingComplete = useCallback((_event: any, eventSessionId: string, stats: any) => {
      if (!isMountedRef.current) return; // Prevent setState on unmounted component

      // Filter: only handle events for THIS component's session
      const currentSessionId = sessionIdRef.current;
      if (!currentSessionId || eventSessionId !== currentSessionId) {
        return; // Silently ignore events for other sessions
      }
      console.log('[WorkspaceChat] ✅ Thinking complete:', stats);

      // Note: No need to update tool blocks since they're not in msg.blocks anymore
      // Tool execution status is shown in ReasoningAccordion via messageThinkingSteps

      // Stop timer and reset currentDuration
      if (thinkingTimerRef.current) {
        clearInterval(thinkingTimerRef.current);
        thinkingTimerRef.current = null;
        setCurrentDuration(0);
        console.log('[WorkspaceChat] 🛑 Timer stopped');
      }
  }, []);

  const handleResponseComplete = useCallback(async (_event: any, result: any) => {
      if (!isMountedRef.current) return; // Prevent setState on unmounted component

      // Filter: only handle events for THIS component's session
      const currentSessionId = sessionIdRef.current;
      if (!currentSessionId || result.sessionId !== currentSessionId) {
        console.log('[WorkspaceChat] ⏭️  Ignoring response-complete for different session:', result.sessionId, '(current:', currentSessionId, ')');
        return;
      }

      console.log('[WorkspaceChat] Response complete:', result);

      const pending = pendingUserMessageRef.current;
      if (!result.success || !pending) {
        setIsSending(false);
        return;
      }

      // Calculate thinking duration
      const duration = thinkingStartTimeRef.current > 0
        ? Math.round((Date.now() - thinkingStartTimeRef.current) / 1000)
        : 0;

      // Get existing assistant message ID (created in handleThinkingStart)
      let assistantMessageId = pendingAssistantMessageId;
      const currentThinkingSteps = thinkingStepsRef.current;

      if (assistantMessageId) {
        // Update existing assistant message with content
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: result.message,
                  metadata: {
                    thinkingSteps: currentThinkingSteps,
                    thinkingDuration: duration
                  }
                }
              : msg
          )
        );

        // Create complete message object for saving
        // Note: No tool blocks in message body - they're only in ReasoningAccordion
        const assistantMessage: Message = {
          id: assistantMessageId,
          conversationId: pending.conversationId,
          role: 'assistant',
          content: result.message,
          timestamp: Date.now(),
          metadata: {
            thinkingSteps: currentThinkingSteps,
            thinkingDuration: duration
          }
        };

        // Save thinking steps to memory
        setMessageThinkingSteps((prev) => ({
          ...prev,
          [assistantMessageId!]: {
            steps: [...currentThinkingSteps],
            duration
          }
        }));

        // Save assistant message to database (with thinking steps in metadata)
        const saveResult = await ipcRenderer.invoke('message:save', assistantMessage);
        if (saveResult.success && saveResult.blocks) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId ? { ...msg, blocks: saveResult.blocks } : msg
            )
          );

          // Plan Mode: Check if Claude output a plan in JSON format
          console.log('[WorkspaceChat] 📋 Checking for plan in blocks:', saveResult.blocks?.length || 0, 'blocks');
          let todoWriteData = extractTodoWriteFromBlocks(saveResult.blocks);
          console.log('[WorkspaceChat] 📋 Plan from blocks:', todoWriteData ? `Found ${todoWriteData.todos.length} todos` : 'Not found');

          // Fallback: Try parsing from message content if blocks parsing failed
          if (!todoWriteData && result.message) {
            console.log('[WorkspaceChat] 📋 Plan mode: Trying to extract plan from message content');
            console.log('[WorkspaceChat] 📋 Message content length:', result.message.length);
            todoWriteData = extractPlanFromText(result.message);
            console.log('[WorkspaceChat] 📋 Plan from text:', todoWriteData ? `Found ${todoWriteData.todos.length} todos` : 'Not found');
          }

          // Plan Mode validation: If in Plan Mode but no plan found, retry once
          // Only execute if PLAN_MODE feature is enabled
          const isPlanMode = currentThinkingModeRef.current === 'plan';
          if (FEATURES.PLAN_MODE && isPlanMode && (!todoWriteData || todoWriteData.todos.length === 0)) {
            console.warn('[WorkspaceChat] ⚠️ Plan Mode active but no plan found in response');

            // Check if this is already a retry (prevent infinite loop)
            const isRetry = assistantMessage.metadata?.planRetryAttempt || 0;

            if (isRetry === 0) {
              console.log('[WorkspaceChat] 🔄 Automatically requesting plan from Claude (retry 1/1)');

              // Update assistant message to show we're requesting a plan
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? {
                        ...msg,
                        metadata: {
                          ...msg.metadata,
                          planRetryAttempt: 1
                        }
                      }
                    : msg
                )
              );

              // Send automatic follow-up request for plan
              const retryPrompt = `You are in PLAN MODE. You must create a detailed plan in JSON format before proceeding.

Please create a plan with the following structure:
\`\`\`json
{
  "todos": [
    {
      "content": "Task description",
      "activeForm": "Doing task description",
      "status": "pending",
      "complexity": "trivial" | "simple" | "moderate" | "complex" | "very_complex",
      "priority": "low" | "medium" | "high" | "critical",
      "estimatedDuration": 30,
      "order": 0,
      "depth": 0
    }
  ]
}
\`\`\`

Wrap the JSON in triple backticks with 'json' language marker. This is REQUIRED.`;

              // Send retry message
              setTimeout(() => {
                ipcRenderer.send('claude:send-message', sessionId, retryPrompt, [], 'plan');
              }, 1000);

              return; // Exit early, wait for retry response
            } else {
              console.error('[WorkspaceChat] ❌ Plan Mode retry failed - Claude did not provide a plan after 2 attempts');

              // Show error to user
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? {
                        ...msg,
                        content: msg.content + '\n\n⚠️ **Plan Mode Error**: Claude did not provide a plan in the required JSON format. Please try again or switch to Normal mode.',
                        metadata: {
                          ...msg.metadata,
                          planGenerationFailed: true
                        }
                      }
                    : msg
                )
              );

              // Still save the message
              await ipcRenderer.invoke('message:save', {
                ...assistantMessage,
                content: result.message + '\n\n⚠️ **Plan Mode Error**: Claude did not provide a plan in the required JSON format.',
                metadata: {
                  ...assistantMessage.metadata,
                  planGenerationFailed: true
                }
              });
            }
          } else if (FEATURES.PLAN_MODE && todoWriteData && todoWriteData.todos.length > 0) {
            console.log('[WorkspaceChat] 📋 TodoWrite detected, checking thinking mode');
            console.log('[WorkspaceChat] 📋 Current thinking mode:', currentThinkingModeRef.current);

            // Convert Claude's todos to Circuit format
            const todoDrafts = convertClaudeTodosToDrafts(todoWriteData.todos);

            // Create TodoGenerationResult
            const todoResult: TodoGenerationResult = {
              todos: todoDrafts,
              complexity: calculateOverallComplexity(todoDrafts),
              estimatedTotalTime: calculateTotalTime(todoDrafts),
              confidence: 0.95,
              reasoning: currentThinkingModeRef.current === 'plan'
                ? 'Claude analyzed codebase and created detailed plan in Plan Mode'
                : 'Claude automatically created task breakdown while working'
            };

            // Determine where to display based on thinking mode
            const isPlanMode = currentThinkingModeRef.current === 'plan';

            if (isPlanMode) {
              // Plan Mode: Display in right sidebar (persistent)
              console.log('[WorkspaceChat] 📋 Plan Mode: Adding to sidebar');

              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? {
                        ...msg,
                        metadata: {
                          ...msg.metadata,
                          planResult: todoResult,
                          hasPendingPlan: true
                        }
                      }
                    : msg
                )
              );

              const updatedMessage = {
                ...assistantMessage,
                metadata: {
                  ...assistantMessage.metadata,
                  planResult: todoResult,
                  hasPendingPlan: true
                }
              };

              console.log('[WorkspaceChat] 💾 Saving plan to sidebar');
              await ipcRenderer.invoke('message:save', updatedMessage);

              // Sync TodoWrite status updates to database
              console.log('[WorkspaceChat] 🔄 Syncing TodoWrite status to database');
              try {
                // Read current todos.json file to compare status
                const todosFileResult = await ipcRenderer.invoke('workspace:read-file',
                  workspacePathRef.current,
                  '.circuit/todos.json'
                );

                if (todosFileResult.success && todosFileResult.content) {
                  const todosData = JSON.parse(todosFileResult.content);

                  // Update each todo in database based on TodoWrite data
                  for (let i = 0; i < todoWriteData.todos.length && i < todosData.todos.length; i++) {
                    const claudeTodo = todoWriteData.todos[i];
                    const dbTodo = todosData.todos[i];

                    // Update status if different
                    if (claudeTodo.status && claudeTodo.status !== dbTodo.status) {
                      console.log(`[WorkspaceChat] 🔄 Updating todo ${dbTodo.id}: ${dbTodo.status} → ${claudeTodo.status}`);

                      const updateData: any = {
                        todoId: dbTodo.id,
                        status: claudeTodo.status,
                      };

                      // Add timing data
                      if (claudeTodo.status === 'completed') {
                        updateData.completedAt = Date.now();
                      } else if (claudeTodo.status === 'in_progress' && !dbTodo.startedAt) {
                        updateData.startedAt = Date.now();
                      }

                      await ipcRenderer.invoke('todos:update-status', updateData);

                      // Update local todos.json file
                      todosData.todos[i].status = claudeTodo.status;
                      if (claudeTodo.status === 'completed' && !todosData.todos[i].completedAt) {
                        todosData.todos[i].completedAt = Date.now();
                      } else if (claudeTodo.status === 'in_progress' && !todosData.todos[i].startedAt) {
                        todosData.todos[i].startedAt = Date.now();
                      }
                    }
                  }

                  // Write updated todos back to file
                  await ipcRenderer.invoke('workspace:write-file',
                    workspacePathRef.current,
                    '.circuit/todos.json',
                    JSON.stringify(todosData, null, 2)
                  );

                  console.log('[WorkspaceChat] ✅ Todo status sync complete');
                }
              } catch (error) {
                console.error('[WorkspaceChat] ❌ Failed to sync todo status:', error);
              }
            } else {
              // Normal/Think Mode: Display inline in chat (temporary)
              console.log('[WorkspaceChat] 📋 TodoWrite Mode: Adding inline to chat');

              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? {
                        ...msg,
                        metadata: {
                          ...msg.metadata,
                          todoWriteResult: todoResult
                        }
                      }
                    : msg
                )
              );

              const updatedMessage = {
                ...assistantMessage,
                metadata: {
                  ...assistantMessage.metadata,
                  todoWriteResult: todoResult
                }
              };

              console.log('[WorkspaceChat] 💾 Saving TodoWrite inline');
              await ipcRenderer.invoke('message:save', updatedMessage);
            }
          } else if (todoWriteData && todoWriteData.todos.length > 0) {
            // TodoWrite detected but not a new plan - this is a status update
            console.log('[WorkspaceChat] 🔄 TodoWrite detected: Syncing status updates to database');

            try {
              // Read current todos.json file
              const todosFileResult = await ipcRenderer.invoke('workspace:read-file',
                workspacePathRef.current,
                '.circuit/todos.json'
              );

              if (todosFileResult.success && todosFileResult.content) {
                const todosData = JSON.parse(todosFileResult.content);

                // Update each todo in database based on TodoWrite data
                for (let i = 0; i < todoWriteData.todos.length && i < todosData.todos.length; i++) {
                  const claudeTodo = todoWriteData.todos[i];
                  const dbTodo = todosData.todos[i];

                  // Update status if changed
                  if (claudeTodo.status && claudeTodo.status !== dbTodo.status) {
                    console.log(`[WorkspaceChat] 🔄 Updating todo ${dbTodo.id}: ${dbTodo.status} → ${claudeTodo.status}`);

                    const updateData: any = {
                      todoId: dbTodo.id,
                      status: claudeTodo.status,
                    };

                    // Add timing data
                    if (claudeTodo.status === 'completed') {
                      updateData.completedAt = Date.now();
                    }

                    await ipcRenderer.invoke('todos:update-status', updateData);

                    // Update local todos.json file
                    todosData.todos[i].status = claudeTodo.status;
                  }
                }

                // Write updated todos back to file
                await ipcRenderer.invoke('workspace:write-file',
                  workspacePathRef.current,
                  '.circuit/todos.json',
                  JSON.stringify(todosData, null, 2)
                );

                console.log('[WorkspaceChat] ✅ Todo status sync complete');

                // Note: No need to call onPlanAdded here
                // TodoPanel auto-refresh will detect DB changes automatically
              }
            } catch (error) {
              console.error('[WorkspaceChat] ❌ Error syncing todo status:', error);
            }
          }
        }

        console.log('[WorkspaceChat] ✅ Assistant message updated with content and blocks');
      } else {
        // Fallback: Create new message (shouldn't happen in normal flow)
        console.warn('[WorkspaceChat] ⚠️ No pending assistant message ID, creating new message');

        const newAssistantMessage: Message = {
          id: `msg-${Date.now()}`,
          conversationId: pending.conversationId,
          role: 'assistant',
          content: result.message,
          timestamp: Date.now(),
          metadata: {
            thinkingSteps: currentThinkingSteps,
            thinkingDuration: duration
          }
        };

        // Set assistantMessageId for auto-open reasoning
        assistantMessageId = newAssistantMessage.id;

        setMessages((prev) => [...prev, newAssistantMessage]);

        // Save thinking steps to memory
        setMessageThinkingSteps((prev) => ({
          ...prev,
          [newAssistantMessage.id]: {
            steps: [...currentThinkingSteps],
            duration
          }
        }));

        // Save assistant message to database
        const saveResult = await ipcRenderer.invoke('message:save', newAssistantMessage);
        if (saveResult.success && saveResult.blocks) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === newAssistantMessage.id ? { ...msg, blocks: saveResult.blocks } : msg
            )
          );
        }
      }

      // Auto-open reasoning for completed message if it has thinking steps
      // Use setTimeout to ensure messageThinkingSteps has been updated in the next render
      const hasThinkingSteps = currentThinkingSteps.length > 0;
      if (assistantMessageId && hasThinkingSteps) {
        setTimeout(() => {
          setOpenReasoningId(assistantMessageId);
          console.log('[WorkspaceChat] ✅ Auto-opened reasoning for completed message');
        }, 100);
      }

      // Clear thinking steps for next message
      setThinkingSteps([]);

      // Parse and detect file changes
      const editedFiles = parseFileChanges(result.message);
      console.log('[WorkspaceChat] Detected file changes:', editedFiles);

      // Auto-open edited files
      editedFiles.forEach((file) => {
        onFileEdit(file);
      });

      pendingUserMessageRef.current = null;
      setPendingAssistantMessageId(null); // Clear pending message ID
      setIsSending(false);
  }, [parseFileChanges, onFileEdit]);

  const handleResponseError = useCallback(async (_event: any, error: any) => {
      if (!isMountedRef.current) return; // Prevent setState on unmounted component

      // Filter: only handle events for THIS component's session
      const currentSessionId = sessionIdRef.current;
      if (error.sessionId && currentSessionId && error.sessionId !== currentSessionId) {
        return; // Silently ignore errors for other sessions
      }

      console.error('[WorkspaceChat] Response error:', error);

      const pending = pendingUserMessageRef.current;
      if (!pending) {
        setIsSending(false);
        return;
      }

      const errorMessage: Message = {
        id: `msg-${Date.now()}`,
        conversationId: pending.conversationId,
        role: 'assistant',
        content: `Error: ${error.error || error.message || 'Unknown error'}`,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, errorMessage]);

      // Save error message
      await ipcRenderer.invoke('message:save', errorMessage);

      pendingUserMessageRef.current = null;
      setIsSending(false);
  }, []);

  const handleMessageCancelled = useCallback((_event: any, cancelledSessionId: string) => {
    if (!isMountedRef.current) return; // Prevent setState on unmounted component

    // Filter: only handle events for THIS component's session
    const currentSessionId = sessionIdRef.current;
    if (!currentSessionId || cancelledSessionId !== currentSessionId) {
      return; // Silently ignore cancellations for other sessions
    }

    console.log('[WorkspaceChat] Message cancelled:', cancelledSessionId);

    // Reset states
    setIsSending(false);
    setIsCancelling(false);
    setThinkingSteps([]);

    // Clear refs
    pendingUserMessageRef.current = null;
    setPendingAssistantMessageId(null);
    thinkingStepsRef.current = [];

    // Clear timer if running
    if (thinkingTimerRef.current) {
      clearInterval(thinkingTimerRef.current);
      thinkingTimerRef.current = null;
    }

    // Optional: Add a system message indicating cancellation
    const cancelMessage: Message = {
      id: `msg-${Date.now()}`,
      conversationId: conversationId!,
      role: 'assistant',
      content: '_Message cancelled by user_',
      timestamp: Date.now(),
      metadata: { cancelled: true }
    };

    setMessages((prev) => [...prev, cancelMessage]);
  }, [conversationId]);

  // Handler for task execution trigger from TodoPanel
  const handleExecuteTasks = useCallback(async (_event: any, data: {
    conversationId: string
    messageId: string
    mode: ExecutionMode
    todos: TodoDraft[]
  }) => {
    try {
      // Write todos to .circuit/todos.json file
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
      }

      await ipcRenderer.invoke('workspace:write-file',
        workspacePathRef.current,
        '.circuit/todos.json',
        JSON.stringify(todosData, null, 2)
      )

      // Save todos to database for real-time progress tracking
      const now = Date.now()
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
      }))

      const dbSaveResult = await ipcRenderer.invoke('todos:save-multiple', todosForDB)
      if (!dbSaveResult.success) {
        console.error('[handleExecuteTasks] Failed to save todos to DB:', dbSaveResult.error)
      } else {
        console.log('[handleExecuteTasks] Successfully saved', todosForDB.length, 'todos to DB')
      }

      // Prepare mode-specific prompt
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
      }

      const executionPrompt = modePrompts[data.mode]

      // Create and send user message manually
      // (Can't call handleSend due to function declaration order)
      if (!sessionId || !conversationId) {
        console.error('[WorkspaceChat] No session or conversation ID')
        return
      }

      // Create user message
      const userMessage: Message = {
        id: `msg-${Date.now()}`,
        conversationId: conversationId,
        role: 'user',
        content: executionPrompt,
        timestamp: Date.now(),
      }

      // Add to UI
      setMessages((prev) => [...prev, userMessage])

      // Save to DB
      const saveResult = await ipcRenderer.invoke('message:save', userMessage)
      if (saveResult.success && saveResult.blocks) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === userMessage.id ? { ...msg, blocks: saveResult.blocks } : msg
          )
        )
      }

      // Set pending ref for response handling
      pendingUserMessageRef.current = userMessage
      setIsSending(true)

      // Send to Claude
      ipcRenderer.send('claude:send-message', sessionId, executionPrompt, [], 'normal')
    } catch (error) {
      console.error('[WorkspaceChat] Error executing tasks:', error)
    }
  }, [workspace, sessionId, conversationId, setMessages, setIsSending])

  // Store handlers in refs to avoid re-registering IPC listeners
  const handlersRef = useRef({
    handleThinkingStart,
    handleMilestone,
    handleThinkingComplete,
    handleResponseComplete,
    handleResponseError,
    handleMessageCancelled,
    handleExecuteTasks
  });

  // Update refs when handlers change (but don't re-register listeners)
  handlersRef.current = {
    handleThinkingStart,
    handleMilestone,
    handleThinkingComplete,
    handleResponseComplete,
    handleResponseError,
    handleMessageCancelled,
    handleExecuteTasks
  };

  // Listen for thinking steps from Electron (register once, use refs for handlers)
  useEffect(() => {
    // CRITICAL: Reset mounted flag when listeners are registered
    isMountedRef.current = true;
    console.log('[WorkspaceChat] 🎧 Registering IPC listeners, sessionId:', sessionIdRef.current, 'isMounted:', isMountedRef.current);

    // Wrap handlers to use refs (always call latest version)
    const debugThinkingStart = (event: any, ...args: any[]) => {
      console.log('[WorkspaceChat] 🎤 RAW thinking-start event received:', args, 'isMounted:', isMountedRef.current);
      handlersRef.current.handleThinkingStart(event, ...args);
    };

    const wrappedMilestone = (event: any, ...args: any[]) => handlersRef.current.handleMilestone(event, ...args);
    const wrappedThinkingComplete = (event: any, ...args: any[]) => handlersRef.current.handleThinkingComplete(event, ...args);
    const wrappedResponseComplete = (event: any, ...args: any[]) => handlersRef.current.handleResponseComplete(event, ...args);
    const wrappedResponseError = (event: any, ...args: any[]) => handlersRef.current.handleResponseError(event, ...args);
    const wrappedMessageCancelled = (event: any, ...args: any[]) => handlersRef.current.handleMessageCancelled(event, ...args);
    const wrappedExecuteTasks = (event: any, ...args: any[]) => handlersRef.current.handleExecuteTasks(event, ...args);

    ipcRenderer.on('claude:thinking-start', debugThinkingStart);
    ipcRenderer.on('claude:milestone', wrappedMilestone);
    ipcRenderer.on('claude:thinking-complete', wrappedThinkingComplete);
    ipcRenderer.on('claude:response-complete', wrappedResponseComplete);
    ipcRenderer.on('claude:response-error', wrappedResponseError);
    ipcRenderer.on('claude:message-cancelled', wrappedMessageCancelled);
    ipcRenderer.on('todos:execute-tasks', wrappedExecuteTasks);

    return () => {
      console.log('[WorkspaceChat] 🧹 Cleanup: Removing IPC listeners');

      // Mark component as unmounted to prevent setState calls
      isMountedRef.current = false;

      // Cleanup timer if component unmounts during thinking
      if (thinkingTimerRef.current) {
        clearInterval(thinkingTimerRef.current);
        thinkingTimerRef.current = null;
        console.log('[WorkspaceChat] 🧹 Timer cleaned up on unmount');
      }

      ipcRenderer.removeListener('claude:thinking-start', debugThinkingStart);
      ipcRenderer.removeListener('claude:milestone', wrappedMilestone);
      ipcRenderer.removeListener('claude:thinking-complete', wrappedThinkingComplete);
      ipcRenderer.removeListener('claude:response-complete', wrappedResponseComplete);
      ipcRenderer.removeListener('claude:response-error', wrappedResponseError);
      ipcRenderer.removeListener('claude:message-cancelled', wrappedMessageCancelled);
      ipcRenderer.removeListener('todos:execute-tasks', wrappedExecuteTasks);
    };
  }, []); // Empty deps - register once, use refs for latest handlers

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
        metadata: JSON.stringify({
          isTask: true,
          todoId: todoId  // Store todoId in metadata
        }),
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

  const handleSend = async (inputText: string, attachments: AttachedFile[], thinkingMode: import('./ChatInput').ThinkingMode) => {
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
    await executePrompt(finalInput, attachments, thinkingMode);
  };

  const executePrompt = async (inputText: string, attachments: AttachedFile[], thinkingMode: import('./ChatInput').ThinkingMode) => {
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

    // Build content - no need to include file list in content anymore
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
    const currentInput = inputText;
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

    // Send message (non-blocking) - response will arrive via event listeners
    console.log('[ChatPanel] 📨 Sending message to Claude:', {
      sessionId,
      messageLength: currentInput.length,
      attachmentsCount: attachments.length,
      thinkingMode,
      currentSessionIdRef: sessionIdRef.current
    });
    ipcRenderer.send('claude:send-message', sessionId, currentInput, attachments, thinkingMode);
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
        className="h-full overflow-auto p-3 pb-[300px]"
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
        <div className="absolute bottom-[230px] left-1/2 -translate-x-1/2 pointer-events-none z-50">
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

  const fileContent = activeFile ? fileContents.get(activeFile) || '' : '';
  const hasUnsavedChanges = activeFile ? unsavedChanges.get(activeFile) || false : false;
  const isMarkdown = activeFile?.toLowerCase().endsWith('.md') || activeFile?.toLowerCase().endsWith('.markdown');

  // Load file contents when active file changes
  useEffect(() => {
    if (!activeFile) {
      return;
    }

    // If file content already loaded, skip
    if (fileContents.has(activeFile)) {
      return;
    }

    const loadFileContent = async () => {
      setIsLoadingFile(true);
      try {
        console.log('[EditorPanel] Loading file:', activeFile);
        const result = await ipcRenderer.invoke('workspace:read-file', workspace.path, activeFile);

        if (result.success) {
          setFileContents(prev => new Map(prev).set(activeFile, result.content));
        } else {
          console.error('[EditorPanel] Failed to load file:', result.error);
          setFileContents(prev => new Map(prev).set(activeFile, `// Error loading file: ${result.error}`));
        }
      } catch (error) {
        console.error('[EditorPanel] Error loading file:', error);
        setFileContents(prev => new Map(prev).set(activeFile, `// Error: ${error}`));
      } finally {
        setIsLoadingFile(false);
      }
    };

    loadFileContent();
  }, [activeFile, workspace.path]);

  // Save file
  const handleSaveFile = async () => {
    if (!activeFile || !hasUnsavedChanges) return;

    setIsSaving(true);
    try {
      console.log('[EditorPanel] Saving file:', activeFile);
      const content = fileContents.get(activeFile) || '';
      const result = await ipcRenderer.invoke('workspace:write-file', workspace.path, activeFile, content);

      if (result.success) {
        console.log('[EditorPanel] File saved successfully');
        setUnsavedChanges(prev => new Map(prev).set(activeFile, false));

        // Notify parent that file is saved (no unsaved changes)
        onUnsavedChange?.(activeFile, false);
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
  const handleContentChange = (value: string | undefined) => {
    if (!activeFile || value === undefined) return;

    const currentContent = fileContents.get(activeFile) || '';
    if (value !== currentContent) {
      setFileContents(prev => new Map(prev).set(activeFile, value));
      setUnsavedChanges(prev => new Map(prev).set(activeFile, true));

      // Notify parent about unsaved changes
      onUnsavedChange?.(activeFile, true);
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
              key={activeFile} // Force remount on file change
              defaultLanguage={getLanguageFromFilePath(activeFile || '')}
              language={getLanguageFromFilePath(activeFile || '')}
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
