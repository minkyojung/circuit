import React, { useState, useEffect } from 'react';
import type { Workspace } from '@/types/workspace';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

// Configure Monaco Editor to use local files instead of CDN
loader.config({ monaco });

// @ts-ignore - Electron IPC
const { ipcRenderer } = window.require('electron');

interface WorkspaceChatEditorProps {
  workspace: Workspace;
  prefillMessage?: string | null;
  onPrefillCleared?: () => void;
}

export const WorkspaceChatEditor: React.FC<WorkspaceChatEditorProps> = ({
  workspace,
  prefillMessage = null,
  onPrefillCleared
}) => {
  const [chatWidth, setChatWidth] = useState(40); // Percentage
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [openFiles, setOpenFiles] = useState<string[]>([]);

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

  return (
    <div className="h-full flex">
      {/* Left: Chat Panel */}
      <div
        style={{ width: `${chatWidth}%` }}
        className="border-r border-[#333] flex flex-col bg-[#0a0a0a]"
      >
        <ChatPanel
          workspace={workspace}
          sessionId={sessionId}
          onFileEdit={handleFileEdit}
          prefillMessage={prefillMessage}
          onPrefillCleared={onPrefillCleared}
        />
      </div>

      {/* Resizer */}
      <div
        className="w-1 bg-[#333] hover:bg-[#4CAF50] cursor-col-resize transition-colors"
        onMouseDown={(e) => {
          e.preventDefault();
          const startX = e.clientX;
          const startWidth = chatWidth;

          const handleMouseMove = (moveE: MouseEvent) => {
            const deltaX = moveE.clientX - startX;
            const newWidth = startWidth + (deltaX / window.innerWidth) * 100;
            setChatWidth(Math.max(20, Math.min(80, newWidth)));
          };

          const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
          };

          document.addEventListener('mousemove', handleMouseMove);
          document.addEventListener('mouseup', handleMouseUp);
        }}
      />

      {/* Right: Editor Panel */}
      <div className="flex-1 flex flex-col bg-[#1a1a1a]">
        <EditorPanel workspace={workspace} openFiles={openFiles} />
      </div>
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

  // Set prefilled message when provided
  useEffect(() => {
    if (prefillMessage) {
      setInput(prefillMessage);
      onPrefillCleared?.();
    }
  }, [prefillMessage, onPrefillCleared]);

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
    <>
      {/* Chat Header */}
      <div className="h-[50px] border-b border-[#333] flex items-center justify-between px-4">
        <span className="text-sm font-medium">Chat</span>
        {sessionId && (
          <span className="text-xs text-[#666]">
            {workspace.branch}
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-[#666] pt-8">
            <p>Start a conversation with Claude</p>
            <p className="text-xs mt-2">Ask about code, request changes, or get help</p>
            <p className="text-xs text-[#888] mt-4">
              Working directory: {workspace.path.split('/').pop()}
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`p-3 rounded ${
                msg.role === 'user'
                  ? 'bg-[#1a1a1a] ml-8'
                  : 'bg-[#0a0a0a] mr-8 border border-[#333]'
              }`}
            >
              <div className="text-xs text-[#888] mb-1">
                {msg.role === 'user' ? 'You' : 'Claude'}
              </div>
              <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
            </div>
          ))
        )}
        {isSending && (
          <div className="p-3 rounded bg-[#0a0a0a] mr-8 border border-[#333]">
            <div className="text-xs text-[#888] mb-1">Claude</div>
            <div className="text-sm text-[#666]">Thinking...</div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-[#333]">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={sessionId ? "Ask Claude..." : "Starting session..."}
            disabled={isSending || !sessionId}
            className="flex-1 bg-[#1a1a1a] border border-[#333] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#4CAF50] disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isSending || !sessionId}
            className="bg-[#4CAF50] hover:bg-[#45a049] disabled:bg-[#333] disabled:cursor-not-allowed px-4 py-2 rounded text-sm font-medium transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </>
  );
};

// ============================================================================
// Editor Panel Component
// ============================================================================

interface EditorPanelProps {
  workspace: Workspace;
  openFiles: string[];
}

const EditorPanel: React.FC<EditorPanelProps> = ({ workspace, openFiles }) => {
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [isLoadingFile, setIsLoadingFile] = useState(false);

  // Auto-select first file when files are opened
  useEffect(() => {
    if (openFiles.length > 0 && !activeFile) {
      setActiveFile(openFiles[0]);
    }
  }, [openFiles, activeFile]);

  // Load file contents when active file changes
  useEffect(() => {
    if (!activeFile) {
      setFileContent('');
      return;
    }

    const loadFileContent = async () => {
      setIsLoadingFile(true);
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

  return (
    <>
      {/* Editor Header */}
      <div className="h-[50px] border-b border-[#333] flex items-center px-4">
        <span className="text-sm font-medium">Editor</span>
        {openFiles.length > 0 && (
          <span className="text-xs text-[#666] ml-2">
            {openFiles.length} file(s) open
          </span>
        )}
      </div>

      {/* File Tabs */}
      {openFiles.length > 0 && (
        <div className="flex gap-1 px-2 py-2 border-b border-[#333] bg-[#0f0f0f] overflow-x-auto">
          {openFiles.map((file) => (
            <div
              key={file}
              onClick={() => setActiveFile(file)}
              className={`px-3 py-1 rounded text-xs cursor-pointer whitespace-nowrap ${
                activeFile === file
                  ? 'bg-[#1a1a1a] text-white'
                  : 'text-[#888] hover:text-white'
              }`}
            >
              {file.split('/').pop()}
            </div>
          ))}
        </div>
      )}

      {/* Editor Content */}
      <div className="flex-1 flex items-center justify-center text-[#666]">
        {openFiles.length === 0 ? (
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
                theme="vs-dark"
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                }}
              />
            )}
          </div>
        )}
      </div>
    </>
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
