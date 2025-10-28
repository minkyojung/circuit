import React, { useState, useEffect } from 'react';
import type { Workspace } from '@/types/workspace';
import type { Message } from '@/types/conversation';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { Columns2, Maximize2, Save, ArrowUp, Grid3x3, MessageSquare, Paperclip, Globe } from 'lucide-react';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { BlockList } from '@/components/blocks';

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

// Input Section Style Constants - Shadcn UI Style
const INPUT_STYLES = {
  container: {
    padding: 'p-4',
    maxWidth: 'max-w-3xl',
    borderRadius: 'rounded-xl'  // Moderate radius
  },
  card: {
    background: 'bg-card',
    border: 'border border-input',
    shadow: 'shadow-sm'
  },
  textarea: {
    minHeight: 'min-h-[60px]',   // 컴팩트한 높이
    fontSize: 'text-base',        // 14px
    padding: 'px-4 py-2'          // 적절한 padding
  },
  contextButton: {
    padding: 'px-4 py-2',
    fontSize: 'text-base',
    borderRadius: 'rounded-full',
    gap: 'gap-2'
  },
  controlButton: {
    padding: 'px-3 py-2',
    fontSize: 'text-sm',
    borderRadius: 'rounded-lg',
    gap: 'gap-2',
    iconSize: 18
  },
  sendButton: {
    size: 'w-10 h-10',           // 40px
    borderRadius: 'rounded-full',
    iconSize: 20
  },
  controlBar: {
    padding: 'px-4 pb-4',
    gap: 'gap-2'
  }
} as const;

// Model Mode Configuration
const MODEL_MODES = [
  { value: 'sonnet', icon: MessageSquare, label: 'Auto' },
  { value: 'think', icon: Grid3x3, label: 'Deep Think' },
  { value: 'agent', icon: MessageSquare, label: 'Agent' }
] as const;

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

  const parseFileChanges = (response: string): string[] => {
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
  };

  const handleSend = async () => {
    if (!input.trim() || isSending || !sessionId) return;

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

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      conversationId: activeConversationId!,
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };

    // Optimistic UI update
    setMessages([...messages, userMessage]);
    const currentInput = input;
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

    try {
      console.log('[ChatPanel] Sending message to Claude...');
      const result = await ipcRenderer.invoke('claude:send-message', sessionId, currentInput);

      if (result.success) {
        console.log('[ChatPanel] Received response from Claude');

        const assistantMessage: Message = {
          id: `msg-${Date.now()}`,
          conversationId: activeConversationId!,
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

        // Parse and detect file changes
        const editedFiles = parseFileChanges(result.message);
        console.log('[ChatPanel] Detected file changes:', editedFiles);

        editedFiles.forEach((file) => {
          onFileEdit(file);
        });
      } else {
        console.error('[ChatPanel] Claude error:', result.error);

        const errorMessage: Message = {
          id: `msg-${Date.now()}`,
          conversationId: activeConversationId!,
          role: 'assistant',
          content: `Error: ${result.error}`,
          timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, errorMessage]);

        // Save error message
        await ipcRenderer.invoke('message:save', errorMessage);
      }
    } catch (error) {
      console.error('[ChatPanel] Failed to send message:', error);

      const errorMessage: Message = {
        id: `msg-${Date.now()}`,
        conversationId: activeConversationId!,
        role: 'assistant',
        content: `Error: ${error}`,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, errorMessage]);

      // Save error message
      await ipcRenderer.invoke('message:save', errorMessage);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="h-full bg-card relative">
      {/* Messages Area - extends behind input */}
      <div className="h-full overflow-auto p-6 pb-32">
        {isLoadingConversation ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-sm text-muted-foreground">Loading conversation...</div>
          </div>
        ) : messages.length > 0 ? (
          <div className="space-y-5 max-w-4xl mx-auto">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[75%] ${
                    msg.role === 'user'
                      ? 'bg-muted p-4 rounded-xl'
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
                    <div className="text-[14px] font-extralight text-foreground whitespace-pre-wrap leading-relaxed">
                      {msg.content}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isSending && (
              <div className="flex justify-start">
                <div className="text-[14px] font-extralight text-muted-foreground">Thinking...</div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-sm text-muted-foreground">No messages yet. Start a conversation!</div>
          </div>
        )}
      </div>

      {/* Input Section - Sticky at bottom - Simple Style */}
      <div className={`sticky bottom-0 ${INPUT_STYLES.container.padding} pointer-events-none`}>
        <div className={`${INPUT_STYLES.container.maxWidth} mx-auto pointer-events-auto`}>
          {/* Input Card - Single border container */}
          <div className="relative w-full flex flex-col border border-input rounded-xl bg-card shadow-sm">
            {/* Top: Add Context Button */}
            <div className="px-4 pt-4 pb-2">
              <button
                className={`inline-flex items-center ${INPUT_STYLES.contextButton.gap} ${INPUT_STYLES.contextButton.padding} ${INPUT_STYLES.contextButton.borderRadius} ${INPUT_STYLES.contextButton.fontSize} bg-secondary/50 hover:bg-secondary text-secondary-foreground border border-border/50 transition-colors`}
              >
                <span className="text-base">@</span>
                <span>Add context</span>
              </button>
            </div>

            {/* Textarea */}
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleSend();
                }
              }}
              placeholder="Ask, search, or make anything..."
              disabled={isSending || !sessionId || isLoadingConversation}
              className={`w-full px-4 bg-transparent border-none outline-none resize-none leading-relaxed text-card-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-0 ${INPUT_STYLES.textarea.fontSize} ${INPUT_STYLES.textarea.minHeight}`}
              rows={1}
            />

            {/* Control Bar - Bottom */}
            <div className="flex items-center justify-between px-4 pb-4">
              {/* Left: Mode controls with icon + text */}
              <div className={`flex ${INPUT_STYLES.controlBar.gap} items-center`}>
                {/* Paperclip / Attachment */}
                <button
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-muted-foreground hover:text-card-foreground hover:bg-accent transition-colors"
                >
                  <Paperclip size={INPUT_STYLES.controlButton.iconSize} strokeWidth={1.5} />
                </button>

                {/* Model Mode Selector */}
                <button
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-card-foreground hover:bg-accent transition-colors"
                >
                  {MODEL_MODES.find(m => m.value === selectedModel)?.icon && (
                    React.createElement(MODEL_MODES.find(m => m.value === selectedModel)!.icon, {
                      size: INPUT_STYLES.controlButton.iconSize,
                      strokeWidth: 1.5
                    })
                  )}
                  <span>{MODEL_MODES.find(m => m.value === selectedModel)?.label}</span>
                </button>

                {/* All Sources / Context Selector */}
                <button
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-card-foreground hover:bg-accent transition-colors"
                >
                  <Globe size={INPUT_STYLES.controlButton.iconSize} strokeWidth={1.5} />
                  <span>All Sources</span>
                </button>
              </div>

              {/* Right: Send button with orange color */}
              <button
                onClick={handleSend}
                disabled={!input.trim() || isSending || !sessionId || isLoadingConversation}
                className={`${INPUT_STYLES.sendButton.size} ${INPUT_STYLES.sendButton.borderRadius} flex items-center justify-center transition-all shrink-0 ${
                  !input.trim() || isSending || !sessionId || isLoadingConversation
                    ? 'bg-muted/50 text-muted-foreground/40 cursor-not-allowed'
                    : 'bg-orange-500 text-white hover:bg-orange-600'
                }`}
              >
                <ArrowUp size={INPUT_STYLES.sendButton.iconSize} strokeWidth={2} />
              </button>
            </div>
          </div>
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
