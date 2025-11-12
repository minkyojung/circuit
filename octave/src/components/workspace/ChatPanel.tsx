/**
 * ChatPanel Component
 *
 * Handles the chat interface with AI, including:
 * - Message streaming and display
 * - Conversation management
 * - File attachments and code selections
 * - Todo generation from AI responses
 * - Virtual scrolling for performance
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Workspace } from '@/types/workspace';
import type { Message } from '@/types/conversation';
import { ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
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
import { useAutoScroll } from '@/hooks/useAutoScroll';
import { useRefSync } from '@/hooks/useRefSync';
import { usePrefillMessage } from '@/hooks/usePrefillMessage';
import { useCopyMessage } from '@/hooks/useCopyMessage';
import { useCodeSelection } from '@/hooks/useCodeSelection';
import { useContextMetrics } from '@/hooks/useContextMetrics';
import { useFilteredMessages } from '@/hooks/useFilteredMessages';
import { useVirtualScrolling } from '@/hooks/useVirtualScrolling';
import { MessageComponent } from './MessageComponent';
import { ChatEmptyState } from './ChatEmptyState';
import { MarkdownPreview } from './MarkdownPreview';
import { FloatingCodeActions } from './FloatingCodeActions';
import type { TodoGenerationResult, TodoDraft, ExecutionMode } from '@/types/todo';
import { FEATURES } from '@/config/features';
import { cn } from '@/lib/utils';
import { getAIRulesContext } from '@/services/projectConfigLocal';
import type { ChatPanelProps } from './WorkspaceChatEditor.types';

const ipcRenderer = window.electron.ipcRenderer;

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

  // Context metrics (calculated from messages using useContextMetrics hook)
  const contextMetrics = useContextMetrics(messages);

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
  // Using useRefSync hook to automatically sync refs with state
  const sessionIdRef = useRefSync(sessionId);
  const pendingAssistantMessageIdRef = useRefSync(pendingAssistantMessageId);
  const conversationIdRef = useRefSync(conversationId);
  const messagesRef = useRefSync(messages);
  const thinkingStepsRef = useRefSync(thinkingSteps);
  const messageThinkingStepsRef = useRefSync(messageThinkingSteps);
  const workspacePathRef = useRefSync(workspace.path);

  // Auto-scroll hook (manages scroll state, workspace persistence, and auto-scroll behavior)
  const {
    scrollContainerRef,
    isAtBottom,
    scrollToBottom,
    handleScroll,
    resetScrollIntent,
  } = useAutoScroll({
    messages,
    workspaceId: workspace.id,
    isLoading: isLoadingConversation,
    enabled: true,
  });

  // Track if component is mounted to prevent setState on unmounted component
  const isMountedRef = useRef(true);

  // Copy message hook (handles clipboard copying with visual feedback)
  const { copiedMessageId, handleCopyMessage } = useCopyMessage();


  // Real-time duration for in-progress message
  const [currentDuration, setCurrentDuration] = useState<number>(0);

  // Code attachment state for "Ask Claude" action
  const [codeAttachment, setCodeAttachment] = useState<{
    code: string
    filePath: string
    lineStart: number
    lineEnd: number
  } | null>(null);

  // Message attachment state for "Explain" action
  const [messageAttachment, setMessageAttachment] = useState<{
    messageId: string
    content: string
  } | null>(null);

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

  // Handle input prefilling from external sources
  usePrefillMessage({
    prefillMessage,
    setInput,
    onPrefillCleared,
  });

  // Notify parent when conversationId changes
  // Note: onConversationChange is intentionally NOT in deps to avoid infinite loop
  // (it's an inline function in App.tsx that gets recreated on every render)
  useEffect(() => {
    onConversationChange?.(conversationId);
  }, [conversationId]);

  // parseFileChanges removed - now handled by FileChangeDetector service
  // handleCopyMessage is now provided by useCopyMessage hook

  // Explain message handler
  const handleExplainMessage = useCallback((messageId: string, content: string) => {
    // Set short prompt in the input
    const explainPrompt = `Please explain your previous response in a more structured and easy-to-understand way.

Break down:
1. What you did (specific actions taken)
2. Why you did it that way (design decisions and rationale)
3. The structure and flow (overall architecture)
4. Key points to understand (core concepts)`;

    setInput(explainPrompt);

    // Attach the message as a reference
    setMessageAttachment({
      messageId,
      content,
    });

    // Focus on the textarea
    setTimeout(() => {
      const textarea = document.querySelector('textarea');
      if (textarea) {
        textarea.focus();
        textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);

    toast.success('Message attached for explanation');
  }, []);

  // Retry message handler
  const handleRetryMessage = useCallback(async (messageId: string, mode: 'normal' | 'extended') => {
    if (!conversationId) {
      console.error('[ChatPanel] Cannot retry: No conversation ID');
      return;
    }

    console.log('[ChatPanel] Retrying message:', messageId, 'with mode:', mode);

    // Find the assistant message and the user message before it
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1 || messageIndex === 0) {
      console.error('[ChatPanel] Cannot find message or no previous message');
      return;
    }

    // Find the previous user message
    let userMessageIndex = messageIndex - 1;
    while (userMessageIndex >= 0 && messages[userMessageIndex].role !== 'user') {
      userMessageIndex--;
    }

    if (userMessageIndex < 0) {
      console.error('[ChatPanel] Cannot find previous user message');
      return;
    }

    const userMessage = messages[userMessageIndex];

    // Extract attachments from metadata
    const attachments: AttachedFile[] = [];
    if (userMessage.metadata?.attachments) {
      try {
        const metadataAttachments = typeof userMessage.metadata.attachments === 'string'
          ? JSON.parse(userMessage.metadata.attachments)
          : userMessage.metadata.attachments;

        attachments.push(...metadataAttachments);
      } catch (error) {
        console.error('[ChatPanel] Failed to parse attachments:', error);
      }
    }

    // Delete all messages after the user message
    const messagesToKeep = messages.slice(0, userMessageIndex + 1);

    try {
      // Update database to remove messages after the user message
      await ipcRenderer.invoke('db:messages:delete-after', conversationId, userMessage.id);

      // Update local state
      setMessages(messagesToKeep);

      // Set thinking mode based on retry mode
      const newThinkingMode = mode === 'extended' ? 'extended' : 'normal';

      // Resend the message
      console.log('[ChatPanel] Resending message with mode:', newThinkingMode);
      ipcRenderer.send(
        'claude:send-message',
        sessionId,
        userMessage.content,
        attachments,
        newThinkingMode,
        false, // architectMode - use default
        undefined // aiRulesSystemPrompt - use default
      );

      toast.success(mode === 'extended' ? 'Retrying with extended thinking...' : 'Retrying message...');
    } catch (error) {
      console.error('[ChatPanel] Failed to retry message:', error);
      toast.error('Failed to retry message');
    }
  }, [conversationId, messages, sessionId]);

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


  // ============================================================================
  // IPC Event Handlers - Managed by useIPCEvents hook
  // ============================================================================

  // Create callbacks for IPCEventBridge
  // Note: useMemo with empty deps because all setters are stable
  const ipcCallbacks: IPCEventCallbacks = useMemo(() => ({
    // Message state
    onMessagesUpdate: setMessages,
    onMessageAdd: (msg) => setMessages((prev) => {
      // Prevent duplicate messages (defensive programming against IPC event duplication)
      if (prev.some((m) => m.id === msg.id)) {
        console.warn('[ChatPanel] Prevented duplicate message:', msg.id);
        return prev;
      }
      return [...prev, msg];
    }),
    onMessageUpdate: (id, updates) =>
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m))),

    // Thinking state
    onThinkingStepsUpdate: setThinkingSteps,
    onThinkingStepAdd: (step) => setThinkingSteps((prev) => [...prev, step]),
    onMessageThinkingStepsUpdate: (msgId, data) =>
      setMessageThinkingSteps((prev) => ({ ...prev, [msgId]: data })),
    onCurrentDurationUpdate: setCurrentDuration,

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

      // Ensure activeConversationId is not null
      if (!activeConversationId) {
        throw new Error('Failed to get or create conversation');
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
  // Context metrics are now calculated by useContextMetrics hook
  useEffect(() => {
    // Use calculated context metrics if available, fallback to useClaudeMetrics
    const effectiveMetrics = contextMetrics || metrics;
    const shouldAutoCompact = effectiveMetrics?.context?.shouldCompact;

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
  }, [contextMetrics, metrics?.context?.shouldCompact, conversationId, messages.length, lastAutoCompactTime, handleSessionCompact]);

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

    // Append message reference attachments
    const messageAttachments = attachments.filter(a => a.type === 'message/reference' && a.message);

    if (messageAttachments.length > 0) {
      const messageBlocks = messageAttachments.map(a => {
        if (!a.message) return '';
        return `\n\nPrevious response:\n${a.message.content}`;
      }).join('\n\n');

      finalInput = `${finalInput}${messageBlocks}`;

      // Clear message attachment state
      setMessageAttachment(null);
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

    // Reset scroll intent when user sends message (enable auto-scroll)
    resetScrollIntent();

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

  // Handle code selection actions from editor (using useCodeSelection hook)
  // NOTE: Must be called after executePrompt is defined to avoid hoisting errors
  useCodeSelection({
    codeSelectionAction,
    onCodeSelectionHandled,
    executePrompt,
    setCodeAttachment,
  });

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
    await executePrompt(executionPrompt, pendingPrompt.attachments, 'normal', false);

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

  // Filter messages for display (using useFilteredMessages hook)
  const filteredMessages = useFilteredMessages(messages, isSending, pendingAssistantMessageId);

  // Virtual scrolling setup (using useVirtualScrolling hook)
  const virtualizer = useVirtualScrolling({
    filteredMessages,
    messageThinkingSteps,
    scrollContainerRef,
  });

  // Auto-scroll is disabled - users can manually scroll using the "Scroll to Bottom" button

  return (
    <div className="h-full bg-card relative">
      {/* Messages Area - with space for floating input */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="absolute inset-0 bottom-[160px] overflow-auto p-3"
      >
        {isLoadingConversation ? (
          <div className="space-y-5 mx-auto px-4">
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
                  <div className="mx-auto px-4 pb-5">
                    <MessageComponent
                      msg={msg}
                      isSending={isSending}
                      pendingAssistantMessageId={pendingAssistantMessageId}
                      messageThinkingSteps={messageThinkingSteps}
                      copiedMessageId={copiedMessageId}
                      currentDuration={currentDuration}
                      onCopyMessage={handleCopyMessage}
                      onExplainMessage={handleExplainMessage}
                      onExecuteCommand={handleExecuteCommand}
                      onFileReferenceClick={onFileReferenceClick}
                      onRunAgent={handleRunAgentForMessage}
                      agentStates={messageAgentStates}
                    />
                  </div>
                </div>
              );
            })}
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
      <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-0 pointer-events-none z-50">
        <div className="pointer-events-auto mx-auto">
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
            contextMetrics={contextMetrics}
            codeAttachment={codeAttachment}
            onCodeAttachmentRemove={() => setCodeAttachment(null)}
            messageAttachment={messageAttachment}
            onMessageAttachmentRemove={() => setMessageAttachment(null)}
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

export { ChatPanel };
