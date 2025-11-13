import React from 'react';
import type { Message } from '@/types/conversation';
import type { ThinkingStep } from '@/types/thinking';
import { Paperclip, Play, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BlockList } from '@/components/blocks';
import { TodoQueue } from '@/components/blocks/TodoQueue';
import { UnifiedReasoningPanel } from '@/components/reasoning/UnifiedReasoningPanel';
import { MessageActions } from './MessageActions';
import { cn } from '@/lib/utils';

export interface MessageComponentProps {
  msg: Message & { filteredBlocks?: any[] };
  isSending: boolean;
  pendingAssistantMessageId: string | null;
  messageThinkingSteps: Record<string, { steps: ThinkingStep[]; duration: number }>;
  copiedMessageId: string | null;
  currentDuration: number;
  onCopyMessage: (messageId: string, content: string) => void;
  onExplainMessage: (messageId: string, content: string) => void;
  onExecuteCommand: (command: string) => Promise<void>;
  onFileReferenceClick?: (filePath: string, lineStart?: number, lineEnd?: number) => void;
  onRunAgent?: (messageId: string) => void;
  agentStates?: Map<string, { state: 'running' | 'completed' | 'failed' | 'cancelled'; progress: number; error?: string }>;
}

const MessageComponentInner: React.FC<MessageComponentProps> = ({
  msg,
  isSending,
  pendingAssistantMessageId,
  messageThinkingSteps,
  copiedMessageId,
  currentDuration,
  onCopyMessage,
  onExplainMessage,
  onExecuteCommand,
  onFileReferenceClick,
  onRunAgent,
  agentStates,
}) => {
  // Parse metadata safely
  const metadata = React.useMemo(() => {
    try {
      return typeof msg.metadata === 'string' ? JSON.parse(msg.metadata || '{}') : msg.metadata || {};
    } catch (error) {
      console.error('[MessageComponent] Failed to parse metadata:', error);
      return {};
    }
  }, [msg.metadata]);

  const isTask = metadata.isTask === true;
  const todoId = metadata.todoId;
  const isCancelled = metadata.cancelled === true;

  // Get agent state for this task (using todoId)
  const agentState = isTask && todoId && agentStates ? agentStates.get(todoId) : null;

  // If message is cancelled, show minimal cancelled state
  if (isCancelled) {
    return (
      <div
        data-message-id={msg.id}
        className={`flex flex-col ${
          msg.role === 'user' ? 'items-end' : 'items-start'
        } ${msg.role === 'assistant' ? 'mb-2' : ''} w-full opacity-40`}
      >
        <div
          className={`max-w-[75%] ${
            msg.role === 'user'
              ? 'bg-muted/30 px-3 py-2 rounded-xl border border-border/50'
              : ''
          }`}
        >
          <div className="text-base font-normal text-muted-foreground italic line-through leading-relaxed">
            {msg.content || 'Message cancelled'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-message-id={msg.id}
      className={`flex flex-col ${
        msg.role === 'user' ? 'items-end' : 'items-start'
      } ${msg.role === 'assistant' ? 'mb-2' : ''} w-full`}
    >
      <div
        className={`max-w-[75%] ${
          msg.role === 'user'
            ? 'bg-muted/30 px-3 py-2 rounded-xl border border-border/50'
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

        {/* Plan Review moved to right sidebar TodoPanel */}

        {/* TodoWrite is now displayed in Reasoning Panel when TodoWrite tool is used */}

        {/* Block-based rendering with fallback */}
        {msg.blocks && msg.blocks.length > 0 ? (
          <>
            <BlockList
              blocks={msg.filteredBlocks || msg.blocks}
              onCopy={(content) => navigator.clipboard.writeText(content)}
              onExecute={onExecuteCommand}
              onFileReferenceClick={onFileReferenceClick}
            />

            {/* Test blocks for styling */}
            {msg.role === 'assistant' && (
              <div className="mt-4 space-y-4">
                {/* Text block */}
                <BlockList
                  blocks={[{
                    id: 'test-text-1',
                    messageId: msg.id,
                    type: 'text',
                    content: 'This is a **test text block** with some markdown formatting. It includes `inline code` and [a link](https://example.com).',
                    metadata: {},
                    order: 100,
                    createdAt: new Date().toISOString(),
                  }]}
                  onCopy={(content) => navigator.clipboard.writeText(content)}
                  onExecute={onExecuteCommand}
                  onFileReferenceClick={onFileReferenceClick}
                />

                {/* Code block */}
                <BlockList
                  blocks={[{
                    id: 'test-code-1',
                    messageId: msg.id,
                    type: 'code',
                    content: `function greet(name: string): string {\n  return \`Hello, \${name}!\`;\n}\n\nconst message = greet('World');\nconsole.log(message);`,
                    metadata: { language: 'typescript', isExecutable: false },
                    order: 101,
                    createdAt: new Date().toISOString(),
                  }]}
                  onCopy={(content) => navigator.clipboard.writeText(content)}
                  onExecute={onExecuteCommand}
                  onFileReferenceClick={onFileReferenceClick}
                />

                {/* Command block */}
                <BlockList
                  blocks={[{
                    id: 'test-command-1',
                    messageId: msg.id,
                    type: 'command',
                    content: 'npm install react-markdown remark-gfm',
                    metadata: { language: 'bash', isExecutable: true },
                    order: 102,
                    createdAt: new Date().toISOString(),
                  }]}
                  onCopy={(content) => navigator.clipboard.writeText(content)}
                  onExecute={onExecuteCommand}
                  onFileReferenceClick={onFileReferenceClick}
                />

                {/* Diff block */}
                <BlockList
                  blocks={[{
                    id: 'test-diff-1',
                    messageId: msg.id,
                    type: 'diff',
                    content: `--- a/src/components/Button.tsx\n+++ b/src/components/Button.tsx\n@@ -1,5 +1,7 @@\n import React from 'react';\n \n-export const Button = () => {\n-  return <button>Click me</button>;\n+export const Button = ({ onClick }: { onClick: () => void }) => {\n+  return (\n+    <button onClick={onClick}>Click me</button>\n+  );\n };`,
                    metadata: { additions: 4, deletions: 2 },
                    order: 103,
                    createdAt: new Date().toISOString(),
                  }]}
                  onCopy={(content) => navigator.clipboard.writeText(content)}
                  onExecute={onExecuteCommand}
                  onFileReferenceClick={onFileReferenceClick}
                />

                {/* Error block */}
                <BlockList
                  blocks={[{
                    id: 'test-error-1',
                    messageId: msg.id,
                    type: 'error',
                    content: 'TypeError: Cannot read property \'map\' of undefined',
                    metadata: {
                      errorType: 'TypeError',
                      errorCode: 'ERR_UNDEFINED',
                      stack: 'at Component.render (App.tsx:42:15)\nat processQueue (scheduler.js:34:12)',
                      suggestedFix: 'Check if the array exists before calling map(). Use optional chaining: data?.map(...)',
                    },
                    order: 104,
                    createdAt: new Date().toISOString(),
                  }]}
                  onCopy={(content) => navigator.clipboard.writeText(content)}
                  onExecute={onExecuteCommand}
                  onFileReferenceClick={onFileReferenceClick}
                />

                {/* Tool block */}
                <BlockList
                  blocks={[{
                    id: 'test-tool-1',
                    messageId: msg.id,
                    type: 'tool',
                    content: '✓ Read • 125ms',
                    metadata: {
                      toolName: 'Read',
                      toolCallId: 'test-call-123',
                      type: 'tool-call',
                      state: 'output-available',
                      args: { file_path: '/src/App.tsx' },
                      result: 'File contents...',
                      duration: 125,
                      status: 'success',
                    },
                    order: 105,
                    createdAt: new Date().toISOString(),
                  }]}
                  onCopy={(content) => navigator.clipboard.writeText(content)}
                  onExecute={onExecuteCommand}
                  onFileReferenceClick={onFileReferenceClick}
                />
              </div>
            )}
          </>
        ) : (
          <>
            <div className="text-base font-normal text-foreground whitespace-pre-wrap leading-relaxed">
              {msg.content}
            </div>

            {/* Task controls - Show for user messages marked as task */}
            {isTask && msg.role === 'user' && onRunAgent && (
              <div className="mt-3 flex items-center gap-2">
                {!agentState || agentState.state === 'cancelled' ? (
                  <button
                    onClick={() => onRunAgent(msg.id)}
                    className={cn(
                      'inline-flex items-center gap-2 px-3 py-1.5 rounded-md',
                      'text-sm font-medium',
                      'bg-primary text-primary-foreground',
                      'hover:bg-primary/90 transition-colors'
                    )}
                  >
                    <Play className="w-3.5 h-3.5" />
                    Run Agent
                  </button>
                ) : agentState.state === 'running' ? (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-info/10 text-info">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span className="text-sm font-medium">Running... {agentState.progress}%</span>
                  </div>
                ) : agentState.state === 'completed' ? (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-success/10 text-success">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span className="text-sm font-medium">Completed</span>
                  </div>
                ) : agentState.state === 'failed' ? (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-destructive/10 text-destructive">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span className="text-sm font-medium" title={agentState.error}>Failed</span>
                  </div>
                ) : null}
              </div>
            )}
          </>
        )}

      </div>

      {/* Unified Reasoning Panel - Show at bottom for assistant messages with reasoning steps */}
      {msg.role === 'assistant' && messageThinkingSteps[msg.id] !== undefined && (() => {
        // Find file-summary block for collapsed view
        const fileSummaryBlock = msg.blocks?.find(b => b.type === 'file-summary');

        return (
          <div className="mt-4 w-full">
            <UnifiedReasoningPanel
              steps={messageThinkingSteps[msg.id]?.steps || []}
              duration={
                isSending && msg.id === pendingAssistantMessageId
                  ? currentDuration
                  : messageThinkingSteps[msg.id]?.duration || 0
              }
              isLive={isSending && msg.id === pendingAssistantMessageId}
              fileSummaryBlock={fileSummaryBlock}
              onFileClick={onFileReferenceClick}
              messageId={!isSending ? msg.id : undefined}
              messageContent={!isSending ? msg.content : undefined}
              onCopyMessage={onCopyMessage}
              onExplainMessage={onExplainMessage}
              copiedMessageId={copiedMessageId}
              todoWriteResult={msg.metadata?.todoWriteResult}
            />
          </div>
        );
      })()}
    </div>
  );
};

// Memoized MessageComponent to prevent unnecessary re-renders
// Only re-render when message content, blocks, or relevant state changes
export const MessageComponent = React.memo(
  MessageComponentInner,
  (prevProps, nextProps) => {
    // Custom comparison - only rerender if these specific props changed
    return (
      prevProps.msg.id === nextProps.msg.id &&
      prevProps.msg.content === nextProps.msg.content &&
      prevProps.msg.blocks === nextProps.msg.blocks &&
      prevProps.msg.filteredBlocks === nextProps.msg.filteredBlocks &&
      prevProps.msg.metadata?.cancelled === nextProps.msg.metadata?.cancelled &&
      prevProps.isSending === nextProps.isSending &&
      prevProps.pendingAssistantMessageId === nextProps.pendingAssistantMessageId &&
      prevProps.copiedMessageId === nextProps.copiedMessageId &&
      prevProps.currentDuration === nextProps.currentDuration &&
      // Compare messageThinkingSteps for this specific message only
      prevProps.messageThinkingSteps[prevProps.msg.id] === nextProps.messageThinkingSteps[nextProps.msg.id]
    );
  }
);

MessageComponent.displayName = 'MessageComponent';
