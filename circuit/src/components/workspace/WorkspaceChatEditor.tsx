import React, { useState } from 'react';
import type { Workspace } from '@/types/workspace';

interface WorkspaceChatEditorProps {
  workspace: Workspace;
}

export const WorkspaceChatEditor: React.FC<WorkspaceChatEditorProps> = ({ workspace }) => {
  const [chatWidth, setChatWidth] = useState(40); // Percentage

  return (
    <div className="h-full flex">
      {/* Left: Chat Panel */}
      <div
        style={{ width: `${chatWidth}%` }}
        className="border-r border-[#333] flex flex-col bg-[#0a0a0a]"
      >
        <ChatPanel workspace={workspace} />
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
        <EditorPanel workspace={workspace} />
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

const ChatPanel: React.FC<{ workspace: Workspace }> = ({ workspace }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || isSending) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };

    setMessages([...messages, userMessage]);
    setInput('');
    setIsSending(true);

    // TODO: Send to Claude CLI
    // For now, just echo back
    setTimeout(() => {
      const assistantMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: `Echo: ${input}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsSending(false);
    }, 1000);
  };

  return (
    <>
      {/* Chat Header */}
      <div className="h-[50px] border-b border-[#333] flex items-center px-4">
        <span className="text-sm font-medium">Chat</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-[#666] pt-8">
            <p>Start a conversation with Claude</p>
            <p className="text-xs mt-2">Ask about code, request changes, or get help</p>
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
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask Claude..."
            disabled={isSending}
            className="flex-1 bg-[#1a1a1a] border border-[#333] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#4CAF50]"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isSending}
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

const EditorPanel: React.FC<{ workspace: Workspace }> = ({ workspace }) => {
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);

  return (
    <>
      {/* Editor Header */}
      <div className="h-[50px] border-b border-[#333] flex items-center px-4">
        <span className="text-sm font-medium">Editor</span>
      </div>

      {/* File Tabs */}
      {openFiles.length > 0 && (
        <div className="flex gap-1 px-2 py-2 border-b border-[#333] bg-[#0f0f0f]">
          {openFiles.map((file) => (
            <div
              key={file}
              onClick={() => setActiveFile(file)}
              className={`px-3 py-1 rounded text-xs cursor-pointer ${
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
          <div className="w-full h-full p-4">
            <div className="text-xs text-[#888] mb-2">{activeFile}</div>
            <div className="text-sm">Monaco Editor will be integrated here</div>
          </div>
        )}
      </div>
    </>
  );
};
