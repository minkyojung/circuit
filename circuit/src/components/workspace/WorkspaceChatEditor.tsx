import React, { useState, useEffect } from 'react';
import type { Workspace } from '@/types/workspace';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { Columns2, Maximize2, Save, ArrowUp, Grid3x3, MessageSquare } from 'lucide-react';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';

// Configure Monaco Editor to use local files instead of CDN
loader.config({ monaco });

// @ts-ignore - Electron IPC
const { ipcRenderer } = window.require('electron');

interface WorkspaceChatEditorProps {
  workspace: Workspace;
  selectedFile: string | null;
  prefillMessage?: string | null;
  onPrefillCleared?: () => void;
}

type ViewMode = 'chat' | 'editor' | 'split';

export const WorkspaceChatEditor: React.FC<WorkspaceChatEditorProps> = ({
  workspace,
  selectedFile,
  prefillMessage = null,
  onPrefillCleared
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

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ChatPanelProps {
  workspace: Workspace;
  sessionId: string | null;
  onFileEdit: (filePath: string) => void;
  prefillMessage?: string | null;
  onPrefillCleared?: () => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({
  workspace,
  sessionId,
  onFileEdit,
  prefillMessage,
  onPrefillCleared
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedModel, setSelectedModel] = useState<'sonnet' | 'think' | 'agent'>('sonnet');

  // Context area state
  const [showContext, setShowContext] = useState(false);
  const [contextMessage, setContextMessage] = useState('');

  // Set prefilled message when provided
  useEffect(() => {
    if (prefillMessage) {
      setInput(prefillMessage);
      onPrefillCleared?.();
    }
  }, [prefillMessage, onPrefillCleared]);

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

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };

    setMessages([...messages, userMessage]);
    const currentInput = input;
    setInput('');
    setIsSending(true);

    try {
      console.log('[ChatPanel] Sending message to Claude...');
      const result = await ipcRenderer.invoke('claude:send-message', sessionId, currentInput);

      if (result.success) {
        console.log('[ChatPanel] Received response from Claude');

        const assistantMessage: Message = {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: result.message,
          timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, assistantMessage]);

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
          role: 'assistant',
          content: `Error: ${result.error}`,
          timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('[ChatPanel] Failed to send message:', error);

      const errorMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${error}`,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      className="h-full bg-background flex flex-col"
      style={{ backgroundColor: 'var(--background)', opacity: 1 }}
    >
      {/* Messages Area */}
      <div className="flex-1 overflow-auto p-6">
        {messages.length > 0 && (
          <div className="space-y-3 max-w-3xl mx-auto">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`p-3 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-sidebar ml-12'
                    : 'bg-sidebar mr-12 border border-border'
                }`}
              >
                <div className="text-xs text-muted-foreground mb-1.5 font-medium">
                  {msg.role === 'user' ? 'You' : 'Claude'}
                </div>
                <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{msg.content}</div>
              </div>
            ))}
            {isSending && (
              <div className="p-3 rounded-lg bg-sidebar mr-12 border border-border">
                <div className="text-xs text-muted-foreground mb-1.5 font-medium">Claude</div>
                <div className="text-sm text-muted-foreground">Thinking...</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input Section - Bottom */}
      <div className="p-4">
        <div className="max-w-2xl mx-auto">
          {/* Outer Card (Large Rectangle) - Design token based */}
          <div
            className="relative border"
            style={{
              backgroundColor: 'var(--chat-input-outer)',
              borderColor: 'var(--chat-input-border)',
              borderRadius: '25px',
              boxShadow: '0px 4px 25px 0px rgba(160, 160, 160, 0.05)'
            }}
          >
            {/* Top Section - Context Area (dynamic: 50px when shown, 0px when hidden) */}
            {showContext && (
              <div className="h-[50px] px-3 flex items-center">
                <div className="flex items-center gap-2">
                  <div className="grid grid-cols-3 gap-0.5 w-4">
                    {[...Array(9)].map((_, i) => (
                      <div key={i} className="w-1 h-1 rounded-full bg-pink-500 animate-pulse" />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {contextMessage}
                  </span>
                </div>
              </div>
            )}

            {/* Inner Card (Small Rectangle) - Design token based */}
            <div
              className={`p-3 ${showContext ? 'mx-3 mb-3' : 'm-3'}`}
              style={{
                backgroundColor: 'var(--chat-input-inner)',
                borderRadius: '22px'
              }}
            >
              {/* Textarea */}
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    handleSend();
                  }
                }}
                placeholder="Make something wonderful..."
                disabled={isSending || !sessionId}
                className="w-full text-base text-foreground placeholder-muted-foreground bg-transparent border-none outline-none resize-none mb-3 leading-relaxed min-h-[60px]"
                rows={2}
              />

              {/* Control Bar */}
              <div className="flex items-center justify-between">
                {/* Left: Mode Toggles */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedModel('sonnet')}
                    className={`px-4 py-2 rounded-lg text-base font-medium transition-colors border ${
                      selectedModel === 'sonnet'
                        ? 'text-foreground'
                        : 'text-muted-foreground'
                    }`}
                    style={{
                      backgroundColor: selectedModel === 'sonnet' ? 'var(--chat-button-selected)' : 'var(--chat-button-default)',
                      borderColor: 'var(--chat-button-selected)'
                    }}
                  >
                    Sonnet
                  </button>
                  <button
                    onClick={() => setSelectedModel('think')}
                    className={`px-4 py-2 rounded-lg text-base font-medium transition-colors flex items-center gap-1.5 border ${
                      selectedModel === 'think'
                        ? 'text-foreground'
                        : 'text-muted-foreground'
                    }`}
                    style={{
                      backgroundColor: selectedModel === 'think' ? 'var(--chat-button-selected)' : 'var(--chat-button-default)',
                      borderColor: 'var(--chat-button-selected)'
                    }}
                  >
                    <Grid3x3 size={14} />
                    Think
                  </button>
                  <button
                    onClick={() => setSelectedModel('agent')}
                    className={`px-4 py-2 rounded-lg text-base font-medium transition-colors flex items-center gap-1.5 border ${
                      selectedModel === 'agent'
                        ? 'text-foreground'
                        : 'text-muted-foreground'
                    }`}
                    style={{
                      backgroundColor: selectedModel === 'agent' ? 'var(--chat-button-selected)' : 'var(--chat-button-default)',
                      borderColor: 'var(--chat-button-selected)'
                    }}
                  >
                    <MessageSquare size={14} />
                    Agent
                  </button>
                </div>

                {/* Right: Send Button */}
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isSending || !sessionId}
                  className="px-4 py-2 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-muted disabled:to-muted disabled:cursor-not-allowed flex items-center justify-center transition-all shadow-sm"
                >
                  <ArrowUp size={16} className="text-white" strokeWidth={2.5} />
                </button>
              </div>
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
  openFiles,
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
