import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Workspace } from '@/types/workspace';
import type { Message } from '@/types/conversation';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { Columns2, Maximize2, Save, ChevronDown } from 'lucide-react';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { BlockList } from '@/components/blocks';
import { ChatInput, type AttachedFile } from './ChatInput';
import { ChatMessageSkeleton } from '@/components/ui/skeleton';
import { Reasoning, ReasoningTrigger, ReasoningContent } from '@/components/ai-elements/reasoning';
import { ThinkingTimeline } from '@/components/reasoning/ThinkingTimeline';
import type { ThinkingStep } from '@/types/thinking';
import { groupThinkingSteps, summarizeToolUsage } from '@/lib/thinkingUtils';

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
}

type ViewMode = 'chat' | 'editor' | 'split';

export const WorkspaceChatEditor: React.FC<WorkspaceChatEditorProps> = ({
  workspace,
  selectedFile,
  prefillMessage = null,
  onPrefillCleared,
  onConversationChange
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
}

// ChatInput component now handles all input styling and controls

const ChatPanel: React.FC<ChatPanelProps> = ({
  workspace,
  sessionId,
  onFileEdit,
  prefillMessage,
  onPrefillCleared,
  onConversationChange
}) => {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedModel, setSelectedModel] = useState<'sonnet' | 'think' | 'agent'>('sonnet');
  const [isLoadingConversation, setIsLoadingConversation] = useState(true);
  const [thinkingStep, setThinkingStep] = useState<string>('');
  const [thinkingDuration, setThinkingDuration] = useState<number>(0);
  const [pendingUserMessage, setPendingUserMessage] = useState<Message | null>(null);
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [messageThinkingSteps, setMessageThinkingSteps] = useState<Record<string, { steps: ThinkingStep[], duration: number }>>({});

  // Use refs for timer to avoid closure issues
  const thinkingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const thinkingStartTimeRef = useRef<number>(0);
  const currentStepMessageRef = useRef<string>('Starting analysis');
  const pendingUserMessageRef = useRef<Message | null>(null);

  // Scroll state
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Context area state
  const [showContext, setShowContext] = useState(false);
  const [contextMessage, setContextMessage] = useState('');

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

  // Show/hide context when AI is thinking
  useEffect(() => {
    if (isSending) {
      setContextMessage('Analyzing request...');
      setShowContext(true);
    } else {
      setShowContext(false);
    }
  }, [isSending]);

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

  // Auto-scroll to bottom when new messages arrive (only if already at bottom)
  useEffect(() => {
    if (isAtBottom && messages.length > 0) {
      // Small delay to ensure DOM has updated
      setTimeout(() => scrollToBottom(), 100);
    }
  }, [messages.length, isAtBottom, scrollToBottom]);

  // Group thinking steps for organized display
  const groupedThinkingSteps = useMemo(() => {
    return groupThinkingSteps(thinkingSteps, thinkingStartTimeRef.current);
  }, [thinkingSteps]);

  // Calculate tool usage summary for completed reasoning
  const thinkingSummary = useMemo(() => {
    return summarizeToolUsage(thinkingSteps);
  }, [thinkingSteps]);

  // Listen for thinking steps from Electron
  useEffect(() => {
    const handleThinkingStart = (event: any, sessionId: string, timestamp: number) => {
      console.log('[WorkspaceChat] 🧠 Thinking started:', sessionId);

      // Initialize refs and clear history
      thinkingStartTimeRef.current = Date.now();
      currentStepMessageRef.current = 'Starting analysis';
      setThinkingDuration(0);
      setThinkingSteps([]); // Clear previous history

      // Set initial message immediately
      setThinkingStep('Starting analysis... (0s)');

      // Client-side timer: Update every 100ms for smooth UX
      thinkingTimerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - thinkingStartTimeRef.current) / 1000);
        const message = `${currentStepMessageRef.current}... (${elapsed}s)`;

        // DEBUG: Log timer ticks
        console.log(`[WorkspaceChat] ⏱️  Timer tick: ${elapsed}s - "${message}"`);

        setThinkingStep(message);
        setThinkingDuration(elapsed);
      }, 100);

      console.log('[WorkspaceChat] ✅ Timer started');
    };

    const handleMilestone = (event: any, sessionId: string, milestone: any) => {
      console.log('[WorkspaceChat] 📍 Milestone:', milestone);

      // Update ref for timer display
      currentStepMessageRef.current = milestone.message;

      // Add to history array
      setThinkingSteps(prev => [...prev, {
        type: milestone.type,
        message: milestone.message,
        timestamp: milestone.timestamp || Date.now(),
        tool: milestone.tool,
        filePath: milestone.filePath,
        command: milestone.command,
        pattern: milestone.pattern
      }]);
    };

    const handleThinkingComplete = (event: any, sessionId: string, stats: any) => {
      console.log('[WorkspaceChat] ✅ Thinking complete:', stats);

      // Stop timer
      if (thinkingTimerRef.current) {
        clearInterval(thinkingTimerRef.current);
        thinkingTimerRef.current = null;
        console.log('[WorkspaceChat] 🛑 Timer stopped');
      }

      setThinkingDuration(stats.duration);
      // Keep the last step visible briefly before clearing
      setTimeout(() => {
        setThinkingStep('');
        setThinkingDuration(0);
      }, 1000);
    };

    const handleResponseComplete = async (event: any, result: any) => {
      console.log('[WorkspaceChat] Response complete:', result);

      const pending = pendingUserMessageRef.current;
      if (!result.success || !pending) {
        setIsSending(false);
        return;
      }

      const assistantMessage: Message = {
        id: `msg-${Date.now()}`,
        conversationId: pending.conversationId,
        role: 'assistant',
        content: result.message,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Save assistant message to database and update with blocks
      const saveResult = await ipcRenderer.invoke('message:save', assistantMessage);
      if (saveResult.success && saveResult.blocks) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessage.id ? { ...msg, blocks: saveResult.blocks } : msg
          )
        );
      }

      // Save thinking steps with this message and calculate duration
      const duration = thinkingStartTimeRef.current > 0
        ? Math.round((Date.now() - thinkingStartTimeRef.current) / 1000)
        : 0;

      setMessageThinkingSteps((prev) => ({
        ...prev,
        [assistantMessage.id]: {
          steps: [...thinkingSteps],
          duration
        }
      }));

      // Clear thinking steps for next message
      setThinkingSteps([]);

      // Parse and detect file changes
      const editedFiles = parseFileChanges(result.message);
      console.log('[WorkspaceChat] Detected file changes:', editedFiles);

      editedFiles.forEach((file) => {
        onFileEdit(file);
      });

      pendingUserMessageRef.current = null;
      setPendingUserMessage(null);
      setIsSending(false);
    };

    const handleResponseError = async (event: any, error: any) => {
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
      setPendingUserMessage(null);
      setIsSending(false);
    };

    ipcRenderer.on('claude:thinking-start', handleThinkingStart);
    ipcRenderer.on('claude:milestone', handleMilestone);
    ipcRenderer.on('claude:thinking-complete', handleThinkingComplete);
    ipcRenderer.on('claude:response-complete', handleResponseComplete);
    ipcRenderer.on('claude:response-error', handleResponseError);

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
    };
  }, [parseFileChanges, onFileEdit]);

  const handleSend = async (inputText: string, attachments: AttachedFile[]) => {
    if (!inputText.trim() && attachments.length === 0) return;
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

    // Build content with attachments
    let content = inputText;
    if (attachments.length > 0) {
      content += '\n\nAttached files:\n';
      attachments.forEach(file => {
        content += `- ${file.name} (${(file.size / 1024).toFixed(1)}KB)\n`;
      });
    }

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      conversationId: activeConversationId!,
      role: 'user',
      content,
      timestamp: Date.now(),
      metadata: {
        files: attachments.map(f => f.name),
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
    setPendingUserMessage(userMessage);

    // Send message (non-blocking) - response will arrive via event listeners
    console.log('[ChatPanel] Sending message to Claude...');
    ipcRenderer.send('claude:send-message', sessionId, currentInput);
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
            {messages.map((msg) => (
              <div
                key={msg.id}
                data-message-id={msg.id}
                className={`flex ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[75%] ${
                    msg.role === 'user'
                      ? 'bg-secondary p-4 rounded-xl border border-border'
                      : ''
                  }`}
                >
                  {/* Block-based rendering with fallback */}
                  {msg.blocks && msg.blocks.length > 0 ? (
                    <BlockList
                      blocks={msg.blocks}
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

                  {/* Show reasoning dropdown for completed assistant messages */}
                  {msg.role === 'assistant' && messageThinkingSteps[msg.id] && messageThinkingSteps[msg.id]?.steps && messageThinkingSteps[msg.id].steps.length > 0 && (
                    <div className="mt-3">
                      <Reasoning isStreaming={false} defaultOpen={false}>
                        <ReasoningTrigger
                          summary={summarizeToolUsage(messageThinkingSteps[msg.id].steps)}
                          duration={messageThinkingSteps[msg.id].duration}
                        />
                        <ReasoningContent>
                          <ThinkingTimeline
                            groupedSteps={groupThinkingSteps(messageThinkingSteps[msg.id].steps, 0)}
                            startTime={0}
                            isStreaming={false}
                            className="pl-1"
                          />
                        </ReasoningContent>
                      </Reasoning>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isSending && (
              <div className="my-3">
                <ThinkingTimeline
                  groupedSteps={groupedThinkingSteps}
                  startTime={thinkingStartTimeRef.current}
                  isStreaming={true}
                  className="pl-1"
                />
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
        <div className="absolute bottom-44 left-1/2 -translate-x-1/2 pointer-events-none z-50">
          <button
            onClick={scrollToBottom}
            className="pointer-events-auto flex items-center justify-center w-8 h-8 rounded-full bg-secondary text-secondary-foreground shadow-md hover:bg-secondary/80 transition-all duration-200"
            aria-label="Scroll to bottom"
          >
            <ChevronDown className="w-4 h-4" />
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
    </div>
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
      <div className="h-[50px] border-b border-[#333] flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Editor</span>
          {activeFile && (
            <>
              <span className="text-xs text-[#666]">
                {activeFile}
              </span>
              {hasUnsavedChanges && (
                <span className="text-xs text-[#FFA500]">• (unsaved)</span>
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
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-[#4CAF50] hover:bg-[#45a049] disabled:bg-[#333] disabled:cursor-not-allowed text-white rounded transition-colors"
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
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-[#666] hover:text-white hover:bg-[#333] rounded transition-colors"
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
      <div className="flex-1 flex items-center justify-center text-[#666]">
        {!activeFile ? (
          <div className="text-center">
            <p>No files open</p>
            <p className="text-xs mt-2">Files will appear here when Claude edits them</p>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col">
            {isLoadingFile ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-sm text-[#666]">Loading {activeFile}...</div>
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
