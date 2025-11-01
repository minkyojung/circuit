import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Workspace } from '@/types/workspace';
import type { Message } from '@/types/conversation';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { Columns2, Maximize2, Save, ChevronDown, Copy, Check, Paperclip } from 'lucide-react';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { BlockList } from '@/components/blocks';
import { ChatInput, type AttachedFile } from './ChatInput';
import { ChatMessageSkeleton } from '@/components/ui/skeleton';
import { Shimmer } from '@/components/ai-elements/shimmer';
import { ReasoningAccordion } from '@/components/reasoning/ReasoningAccordion';
import type { ThinkingStep } from '@/types/thinking';
import { summarizeToolUsage } from '@/lib/thinkingUtils';
import { motion, AnimatePresence } from 'motion/react';
import { TodoProvider } from '@/contexts/TodoContext';
import { TodoConfirmationDialog } from '@/components/todo';
import {
  extractTodoWriteFromBlocks,
  extractPlanFromText,
  convertClaudeTodosToDrafts,
  calculateOverallComplexity,
  calculateTotalTime
} from '@/lib/planModeUtils';
import type { TodoGenerationResult, TodoDraft, ExecutionMode } from '@/types/todo';

// Configure Monaco Editor to use local files instead of CDN
loader.config({ monaco });

// @ts-ignore - Electron IPC
const { ipcRenderer } = window.require('electron');

interface WorkspaceChatEditorProps {
  workspace: Workspace;
  selectedFile: string | null;
  prefillMessage?: string | null;
  onPrefillCleared?: () => void;
  onConversationChange?: (conversationId: string | null) => void;
  onPlanAdded?: () => void;
}

type ViewMode = 'chat' | 'editor' | 'split';

export const WorkspaceChatEditor: React.FC<WorkspaceChatEditorProps> = ({
  workspace,
  selectedFile,
  prefillMessage = null,
  onPrefillCleared,
  onConversationChange,
  onPlanAdded
}) => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('chat');

  // Auto-switch to editor mode when file is selected
  useEffect(() => {
    if (selectedFile && viewMode === 'chat') {
      setViewMode('editor');
    } else if (!selectedFile && viewMode !== 'chat') {
      setViewMode('chat');
    }
  }, [selectedFile]);

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

    // Cleanup on unmount
    return () => {
      if (sessionId) {
        console.log('[WorkspaceChatEditor] Stopping Claude session:', sessionId);
        ipcRenderer.invoke('claude:stop-session', sessionId);
      }
    };
  }, [workspace.path]);

  const handleFileEdit = (filePath: string) => {
    console.log('[WorkspaceChatEditor] File edited:', filePath);
    if (!openFiles.includes(filePath)) {
      setOpenFiles([...openFiles, filePath]);
    }
  };

  // Add selected file to open files when it changes
  useEffect(() => {
    if (selectedFile && !openFiles.includes(selectedFile)) {
      setOpenFiles([...openFiles, selectedFile]);
    }
  }, [selectedFile]);

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
            onPrefillCleared={onPrefillCleared}
            onConversationChange={onConversationChange}
            onPlanAdded={onPlanAdded}
          />
        </div>
      )}

      {viewMode === 'editor' && (
        /* Editor Only Mode */
        <div className="h-full">
          <EditorPanel
            workspace={workspace}
            openFiles={openFiles}
            selectedFile={selectedFile}
            onToggleSplit={() => setViewMode('split')}
            isSplitMode={false}
          />
        </div>
      )}

      {viewMode === 'split' && (
        /* Split View - Chat and Editor side by side */
        <ResizablePanelGroup direction="horizontal" className="h-full">
          <ResizablePanel defaultSize={50} minSize={30}>
            <ChatPanel
              workspace={workspace}
              sessionId={sessionId}
              onFileEdit={handleFileEdit}
              prefillMessage={prefillMessage}
              onPrefillCleared={onPrefillCleared}
              onConversationChange={onConversationChange}
              onPlanAdded={onPlanAdded}
            />
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize={50} minSize={30}>
            <EditorPanel
              workspace={workspace}
              openFiles={openFiles}
              selectedFile={selectedFile}
              onToggleSplit={() => setViewMode('editor')}
              isSplitMode={true}
            />
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
  onPrefillCleared?: () => void;
  onConversationChange?: (conversationId: string | null) => void;
  onPlanAdded?: () => void;
}

// ChatInput component now handles all input styling and controls

const ChatPanelInner: React.FC<ChatPanelProps> = ({
  workspace,
  sessionId,
  onFileEdit,
  prefillMessage,
  onPrefillCleared,
  onConversationChange,
  onPlanAdded
}) => {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(true);
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [messageThinkingSteps, setMessageThinkingSteps] = useState<Record<string, { steps: ThinkingStep[], duration: number }>>({});

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
  const pendingAssistantMessageIdRef = useRef<string | null>(null);

  // Refs to hold latest state values (to avoid stale closures in IPC handlers)
  const conversationIdRef = useRef<string | null>(conversationId);
  const messagesRef = useRef<Message[]>(messages);
  const thinkingStepsRef = useRef<ThinkingStep[]>(thinkingSteps);
  const messageThinkingStepsRef = useRef<Record<string, { steps: ThinkingStep[], duration: number }>>(messageThinkingSteps);

  // Scroll state
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Copy state
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  // Reasoning toggle state
  const [openReasoningId, setOpenReasoningId] = useState<string | null>(null);

  // Real-time duration for in-progress message
  const [currentDuration, setCurrentDuration] = useState<number>(0);

  // Load conversation when workspace changes
  useEffect(() => {
    const loadConversation = async () => {
      setIsLoadingConversation(true);

      try {
        console.log('[ChatPanel] Loading conversation for workspace:', workspace.id);

        // 1. Get active conversation for this workspace
        const activeResult = await ipcRenderer.invoke('conversation:get-active', workspace.id);

        let conversation = activeResult.conversation;

        // 2. If no active conversation, create a new one
        if (!conversation) {
          console.log('[ChatPanel] No active conversation found, creating new one');
          const createResult = await ipcRenderer.invoke('conversation:create', workspace.id);
          conversation = createResult.conversation;
        }

        console.log('[ChatPanel] Loaded conversation:', conversation.id);
        setConversationId(conversation.id);

        // 3. Load messages for this conversation
        const messagesResult = await ipcRenderer.invoke('message:load', conversation.id);
        const loadedMessages = messagesResult.messages || [];

        console.log('[ChatPanel] Loaded', loadedMessages.length, 'messages');
        setMessages(loadedMessages);

        // 4. Restore thinking steps from message metadata
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
  }, [workspace.id]);

  // Sync refs with latest state (to avoid stale closures)
  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    thinkingStepsRef.current = thinkingSteps;
  }, [thinkingSteps]);

  useEffect(() => {
    messageThinkingStepsRef.current = messageThinkingSteps;
  }, [messageThinkingSteps]);

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

  // Check initial scroll position when messages load
  useEffect(() => {
    if (messages.length > 0 && scrollContainerRef.current) {
      // Check scroll position on load
      handleScroll();
    }
  }, [messages.length, handleScroll]);

  // Auto-scroll to bottom when new messages arrive (only if already at bottom)
  useEffect(() => {
    if (isAtBottom && messages.length > 0) {
      // Small delay to ensure DOM has updated
      setTimeout(() => scrollToBottom(), 100);
    }
  }, [messages.length, isAtBottom, scrollToBottom]);

  // IPC Event Handlers (using useCallback to avoid stale closures)
  const handleThinkingStart = useCallback((_event: any, sessionId: string, _timestamp: number) => {
      console.log('[WorkspaceChat] 🧠 Thinking started:', sessionId);

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
        setMessages((prev) => [...prev, emptyAssistantMessage]);
        pendingAssistantMessageIdRef.current = assistantMessageId;

        // Auto-open reasoning dropdown for real-time visibility
        setOpenReasoningId(assistantMessageId);

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

  const handleMilestone = useCallback((_event: any, _sessionId: string, milestone: any) => {
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
        if (pendingAssistantMessageIdRef.current) {
          const duration = thinkingStartTimeRef.current > 0
            ? Math.round((Date.now() - thinkingStartTimeRef.current) / 1000)
            : 0;

          setMessageThinkingSteps((prevSteps) => ({
            ...prevSteps,
            [pendingAssistantMessageIdRef.current!]: {
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
  }, []);

  const handleThinkingComplete = useCallback((_event: any, _sessionId: string, stats: any) => {
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
      let assistantMessageId = pendingAssistantMessageIdRef.current;
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

          if (todoWriteData && todoWriteData.todos.length > 0) {
            console.log('[WorkspaceChat] 📋 Plan mode: Plan detected, adding to message metadata');

            // Convert Claude's todos to Circuit format
            const todoDrafts = convertClaudeTodosToDrafts(todoWriteData.todos);

            // Create TodoGenerationResult
            const todoResult: TodoGenerationResult = {
              todos: todoDrafts,
              complexity: calculateOverallComplexity(todoDrafts),
              estimatedTotalTime: calculateTotalTime(todoDrafts),
              confidence: 0.95, // High confidence - Claude analyzed the codebase
              reasoning: 'Claude analyzed codebase and created detailed plan in Plan Mode'
            };

            // Add plan to assistant message metadata
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

            // Update database with plan metadata
            const updatedMessage = {
              ...assistantMessage,
              metadata: {
                ...assistantMessage.metadata,
                planResult: todoResult,
                hasPendingPlan: true
              }
            };

            console.log('[WorkspaceChat] 💾 Saving updated message with planResult');
            console.log('[WorkspaceChat] 💾 Message ID:', updatedMessage.id);
            console.log('[WorkspaceChat] 💾 Metadata keys:', Object.keys(updatedMessage.metadata || {}));
            console.log('[WorkspaceChat] 💾 Has planResult:', !!updatedMessage.metadata?.planResult);
            console.log('[WorkspaceChat] 💾 planResult todos count:', updatedMessage.metadata?.planResult?.todos?.length || 0);

            const saveResult2 = await ipcRenderer.invoke('message:save', updatedMessage);
            console.log('[WorkspaceChat] 💾 Save result:', saveResult2);

            // Notify parent that a plan was added (to refresh TodoPanel)
            onPlanAdded?.();

            // Don't show modal - plan will be displayed inline in the message
          } else if (todoWriteData && todoWriteData.todos.length > 0) {
            // TodoWrite detected but not a new plan - this is a status update
            console.log('[WorkspaceChat] 🔄 TodoWrite detected: Syncing status updates to database');

            try {
              // Read current todos.json file
              const todosFileResult = await ipcRenderer.invoke('workspace:read-file',
                workspace.path,
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
                  workspace.path,
                  '.circuit/todos.json',
                  JSON.stringify(todosData, null, 2)
                );

                console.log('[WorkspaceChat] ✅ Todo status sync complete');

                // Notify parent to refresh TodoPanel
                onPlanAdded?.();
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

      editedFiles.forEach((file) => {
        onFileEdit(file);
      });

      pendingUserMessageRef.current = null;
      pendingAssistantMessageIdRef.current = null; // Clear ref
      setIsSending(false);
  }, [parseFileChanges, onFileEdit]);

  const handleResponseError = useCallback(async (_event: any, error: any) => {
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

  // Handler for task execution trigger from TodoPanel
  const handleExecuteTasks = useCallback(async (_event: any, data: {
    conversationId: string
    messageId: string
    mode: ExecutionMode
    todos: TodoDraft[]
  }) => {
    console.log('[WorkspaceChat] Execute tasks triggered:', data.mode, data.todos.length, 'tasks')

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
        workspace.path,
        '.circuit/todos.json',
        JSON.stringify(todosData, null, 2)
      )

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

      // Use handleSend to properly handle UI updates
      // This ensures user message is added to UI and DB,
      // and response is properly handled
      await handleSend(executionPrompt, [], 'normal')

      console.log('[WorkspaceChat] Task execution started')
    } catch (error) {
      console.error('[WorkspaceChat] Error executing tasks:', error)
    }
  }, [workspace])

  // Listen for thinking steps from Electron (separate useEffect to avoid re-registering listeners)
  useEffect(() => {
    ipcRenderer.on('claude:thinking-start', handleThinkingStart);
    ipcRenderer.on('claude:milestone', handleMilestone);
    ipcRenderer.on('claude:thinking-complete', handleThinkingComplete);
    ipcRenderer.on('claude:response-complete', handleResponseComplete);
    ipcRenderer.on('claude:response-error', handleResponseError);
    ipcRenderer.on('todos:execute-tasks', handleExecuteTasks);

    return () => {
      // Cleanup timer if component unmounts during thinking
      if (thinkingTimerRef.current) {
        clearInterval(thinkingTimerRef.current);
        thinkingTimerRef.current = null;
        console.log('[WorkspaceChat] 🧹 Timer cleaned up on unmount');
      }

      ipcRenderer.removeListener('claude:thinking-start', handleThinkingStart);
      ipcRenderer.removeListener('claude:milestone', handleMilestone);
      ipcRenderer.removeListener('claude:thinking-complete', handleThinkingComplete);
      ipcRenderer.removeListener('claude:response-complete', handleResponseComplete);
      ipcRenderer.removeListener('claude:response-error', handleResponseError);
      ipcRenderer.removeListener('todos:execute-tasks', handleExecuteTasks);
    };
  }, [handleThinkingStart, handleMilestone, handleThinkingComplete, handleResponseComplete, handleResponseError, handleExecuteTasks]);

  const handleSend = async (inputText: string, attachments: AttachedFile[], thinkingMode: import('./ChatInput').ThinkingMode) => {
    if (!inputText.trim() && attachments.length === 0) return;
    if (isSending || !sessionId) return;

    // Plan mode: Let Claude generate detailed todos
    if (thinkingMode === 'plan') {
      console.log('[ChatPanel] Plan mode: Claude will generate todos');
      await executePrompt(inputText, attachments, thinkingMode);
      return;
    }

    // Normal/Think modes: Execute directly without todo analysis
    // Todo analysis is ONLY for plan mode now
    await executePrompt(inputText, attachments, thinkingMode);
  };

  const executePrompt = async (inputText: string, attachments: AttachedFile[], thinkingMode: import('./ChatInput').ThinkingMode) => {
    if (isSending || !sessionId) return;

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
    setMessages([...messages, userMessage]);
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
    ipcRenderer.send('claude:send-message', sessionId, currentInput, attachments, thinkingMode);
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

  return (
    <div className="h-full bg-card relative">
      {/* Messages Area - with space for floating input */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="h-full overflow-auto p-6 pb-[400px]"
      >
        {isLoadingConversation ? (
          <div className="space-y-5 max-w-4xl mx-auto">
            <ChatMessageSkeleton />
            <ChatMessageSkeleton />
          </div>
        ) : messages.length > 0 ? (
          <div className="space-y-5 max-w-4xl mx-auto">
            {messages
              .filter((msg) => {
                // Hide empty assistant messages UNLESS it's the pending message (in progress)
                if (msg.role === 'assistant' && !msg.content && (!msg.blocks || msg.blocks.length === 0)) {
                  // Keep if it's the pending message currently being streamed
                  if (isSending && msg.id === pendingAssistantMessageIdRef.current) {
                    return true;  // Show in-progress message
                  }
                  return false;  // Hide other empty messages
                }
                return true;
              })
              .map((msg) => (
              <div
                key={msg.id}
                data-message-id={msg.id}
                className={`flex ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                } ${msg.role === 'assistant' ? 'mb-2' : ''}`}
              >
                <div
                  className={`max-w-[75%] ${
                    msg.role === 'user'
                      ? 'bg-secondary p-4 rounded-xl border border-border'
                      : ''
                  }`}
                >
                  {/* Attachment pills - Only for user messages with attachments */}
                  {msg.role === 'user' && msg.metadata?.attachments && msg.metadata.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {msg.metadata.attachments.map((file: any) => {
                        // Extract file extension
                        const extension = file.name.split('.').pop()?.toUpperCase() || 'FILE';
                        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');

                        return (
                          <div
                            key={file.id}
                            className="group flex items-center gap-2 pl-2 pr-3 py-2 rounded-xl bg-card transition-all"
                          >
                            {/* Icon/Thumbnail - Vertical rectangle */}
                            <div className="flex-shrink-0">
                              {file.type.startsWith('image/') ? (
                                <div className="w-6 h-[30px] rounded-md bg-black flex items-center justify-center">
                                  <Paperclip className="w-3 h-3 text-muted-foreground" />
                                </div>
                              ) : (
                                <div className="w-6 h-[30px] rounded-md bg-black flex items-center justify-center">
                                  <Paperclip className="w-3 h-3 text-muted-foreground" />
                                </div>
                              )}
                            </div>

                            {/* File info - Vertical layout with spacing */}
                            <div className="flex flex-col justify-center min-w-0 gap-1">
                              <span className="text-sm font-light text-foreground max-w-[160px] truncate leading-tight">
                                {nameWithoutExt}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-medium leading-tight">
                                {extension}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Action bar (Copy + Reasoning) - Always show for assistant */}
                  {msg.role === 'assistant' && (
                    <div className="mb-3 flex items-center justify-between gap-2">
                      {/* Reasoning button (left) - Show for in-progress or completed messages */}
                      {(messageThinkingSteps[msg.id]?.steps?.length > 0 || (isSending && msg.id === pendingAssistantMessageIdRef.current)) && (
                        <button
                          onClick={() => setOpenReasoningId(openReasoningId === msg.id ? null : msg.id)}
                          className="flex items-center gap-1 text-base text-muted-foreground/60 hover:text-foreground transition-all"
                        >
                          <span className="opacity-80 hover:opacity-100">
                            {isSending && msg.id === pendingAssistantMessageIdRef.current
                              ? `${currentDuration}s • ${summarizeToolUsage(messageThinkingSteps[msg.id]?.steps || [])}`
                              : `${messageThinkingSteps[msg.id].duration}s • ${summarizeToolUsage(messageThinkingSteps[msg.id].steps)}`
                            }
                          </span>
                          <ChevronDown className={`w-4 h-4 opacity-80 transition-transform ${openReasoningId === msg.id ? 'rotate-180' : ''}`} strokeWidth={1.5} />
                        </button>
                      )}

                      {/* Spacer */}
                      <div className="flex-1" />

                      {/* Copy button (right) */}
                      <button
                        onClick={() => handleCopyMessage(msg.id, msg.content)}
                        className="p-1 text-muted-foreground/60 hover:text-foreground rounded-md hover:bg-secondary/50 transition-all"
                        title="Copy message"
                      >
                        {copiedMessageId === msg.id ? (
                          <Check className="w-3 h-3 text-green-500" strokeWidth={1.5} />
                        ) : (
                          <Copy className="w-3 h-3 opacity-60 hover:opacity-100 transition-opacity" strokeWidth={1.5} />
                        )}
                      </button>
                    </div>
                  )}

                  {/* Reasoning content (collapsible) - Above message content */}
                  {(() => {
                    const shouldShowReasoning = msg.role === 'assistant' && 
                      openReasoningId === msg.id && 
                      (messageThinkingSteps[msg.id]?.steps?.length ?? 0) > 0;
                    
                    if (!shouldShowReasoning) return null;
                    
                    return (
                      <AnimatePresence>
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2, ease: 'easeInOut' }}
                          className="overflow-hidden"
                        >
                          <div className="mb-3 pl-1">
                            <ReasoningAccordion
                              steps={messageThinkingSteps[msg.id].steps}
                            />
                          </div>
                        </motion.div>
                      </AnimatePresence>
                    );
                  })()}

                  {/* Plan Review moved to right sidebar TodoPanel */}

                  {/* Block-based rendering with fallback */}
                  {msg.blocks && msg.blocks.length > 0 ? (
                    <BlockList
                      blocks={
                        // Filter out plan JSON blocks if this message has a planResult
                        msg.metadata?.planResult
                          ? msg.blocks.filter(block => {
                              // Remove JSON code blocks that contain "todos" (plan blocks)
                              if (block.type === 'code' && block.metadata?.language === 'json') {
                                try {
                                  const parsed = JSON.parse(block.content)
                                  if (parsed.todos && Array.isArray(parsed.todos)) {
                                    return false // Filter out plan JSON
                                  }
                                } catch (e) {
                                  // Not valid JSON, keep it
                                }
                              }
                              return true
                            })
                          : msg.blocks
                      }
                      onCopy={(content) => navigator.clipboard.writeText(content)}
                      onExecute={async (command) => {
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
                      }}
                    />
                  ) : (
                    <div className="text-base font-normal text-foreground whitespace-pre-wrap leading-relaxed">
                      {msg.content}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isSending && thinkingSteps.length === 0 && (
              <div className="flex justify-start my-3">
                <div className="max-w-[75%] w-full">
                  {/* Initial loading state with Shimmer */}
                  <div className="space-y-2 pl-1">
                    <Shimmer duration={2} className="text-sm text-muted-foreground">
                      Analyzing your request...
                    </Shimmer>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-sm text-muted-foreground">No messages yet. Start a conversation!</div>
          </div>
        )}
      </div>

      {/* Gradient Fade to hide content behind floating input */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-card via-card to-transparent pointer-events-none" />

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
      <div className="absolute bottom-0 left-0 right-0 p-4 pointer-events-none">
        <div className="pointer-events-auto">
          <ChatInput
            value={input}
            onChange={setInput}
            onSubmit={handleSend}
            disabled={isSending || !sessionId || isLoadingConversation}
            placeholder="Ask, search, or make anything..."
            showControls={true}
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
  openFiles: string[];
  selectedFile: string | null;
  onToggleSplit?: () => void;
  isSplitMode?: boolean;
}

const EditorPanel: React.FC<EditorPanelProps> = ({
  workspace,
  openFiles: _openFiles,
  selectedFile,
  onToggleSplit,
  isSplitMode = false,
}) => {
  const [fileContent, setFileContent] = useState<string>('');
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const activeFile = selectedFile;

  // Load file contents when active file changes
  useEffect(() => {
    if (!activeFile) {
      setFileContent('');
      setHasUnsavedChanges(false);
      return;
    }

    const loadFileContent = async () => {
      setIsLoadingFile(true);
      setHasUnsavedChanges(false);
      try {
        console.log('[EditorPanel] Loading file:', activeFile);
        const result = await ipcRenderer.invoke('workspace:read-file', workspace.path, activeFile);

        if (result.success) {
          setFileContent(result.content);
        } else {
          console.error('[EditorPanel] Failed to load file:', result.error);
          setFileContent(`// Error loading file: ${result.error}`);
        }
      } catch (error) {
        console.error('[EditorPanel] Error loading file:', error);
        setFileContent(`// Error: ${error}`);
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
      const result = await ipcRenderer.invoke('workspace:write-file', workspace.path, activeFile, fileContent);

      if (result.success) {
        console.log('[EditorPanel] File saved successfully');
        setHasUnsavedChanges(false);
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

  return (
    <div className="h-full flex flex-col">
      {/* Editor Header */}
      <div className="h-[50px] border-b border-border flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Editor</span>
          {activeFile && (
            <>
              <span className="text-xs text-muted-foreground">
                {activeFile}
              </span>
              {hasUnsavedChanges && (
                <span className="text-xs text-warning">• (unsaved)</span>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Save Button */}
          {hasUnsavedChanges && (
            <button
              onClick={handleSaveFile}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-success hover:bg-success/90 disabled:bg-secondary disabled:cursor-not-allowed text-white rounded transition-colors"
              title="Save file (Cmd+S)"
            >
              <Save size={14} />
              <span>{isSaving ? 'Saving...' : 'Save'}</span>
            </button>
          )}

          {/* Split View Toggle Button */}
          {onToggleSplit && (
            <button
              onClick={onToggleSplit}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-colors"
              title={isSplitMode ? "Hide chat" : "Show chat"}
            >
              {isSplitMode ? (
                <>
                  <Maximize2 size={14} />
                  <span>Editor Only</span>
                </>
              ) : (
                <>
                  <Columns2 size={14} />
                  <span>Show Chat</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        {!activeFile ? (
          <div className="text-center">
            <p>No files open</p>
            <p className="text-xs mt-2">Files will appear here when Claude edits them</p>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col">
            {isLoadingFile ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-sm text-muted-foreground">Loading {activeFile}...</div>
              </div>
            ) : (
              <Editor
                height="100%"
                defaultLanguage={getLanguageFromFilePath(activeFile || '')}
                language={getLanguageFromFilePath(activeFile || '')}
                value={fileContent}
                onChange={(value) => {
                  if (value !== undefined && value !== fileContent) {
                    setFileContent(value);
                    setHasUnsavedChanges(true);
                  }
                }}
                theme="vs-dark"
                options={{
                  readOnly: false,
                  minimap: { enabled: false },
                  fontSize: 13,
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
    </div>
  );
};

// ============================================================================
// Helper Functions
// ============================================================================

function getLanguageFromFilePath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();

  const languageMap: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'py': 'python',
    'json': 'json',
    'md': 'markdown',
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'yaml': 'yaml',
    'yml': 'yaml',
    'sh': 'shell',
    'bash': 'shell',
    'go': 'go',
    'rs': 'rust',
    'java': 'java',
    'c': 'c',
    'cpp': 'cpp',
    'h': 'c',
    'hpp': 'cpp',
  };

  return languageMap[ext || ''] || 'plaintext';
}
