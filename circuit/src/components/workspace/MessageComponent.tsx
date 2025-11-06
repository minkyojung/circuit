import React from 'react';
import type { Message } from '@/types/conversation';
import type { ThinkingStep } from '@/types/thinking';
import { Paperclip, Play, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BlockList } from '@/components/blocks';
import { InlineTodoProgress } from '@/components/blocks/InlineTodoProgress';
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
  onRetryMessage: (messageId: string, mode: 'normal' | 'extended') => void;
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
  onRetryMessage,
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

  // Get agent state for this task (using todoId)
  const agentState = isTask && todoId && agentStates ? agentStates.get(todoId) : null;
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
            ? 'bg-[#E8EEEB] dark:bg-[#1A2621] px-3 py-2 rounded-xl border border-border'
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

        {/* TodoWrite inline display (for Normal/Think modes) */}
        {msg.metadata?.todoWriteResult && (
          <InlineTodoProgress
            todos={msg.metadata.todoWriteResult.todos.map((todo: any) => ({
              content: todo.title || todo.content,
              activeForm: todo.activeForm || `${todo.title || todo.content}...`,
              status: todo.status,
              complexity: todo.complexity,
              priority: todo.priority,
              estimatedDuration: todo.estimatedTime,
              description: todo.description,
            }))}
            defaultExpanded={true}
            showProgressBar={true}
            autoCollapseOnComplete={true}
            onToggle={(expanded) => {
              console.log('[InlineTodo] Toggled:', expanded);
            }}
          />
        )}

        {/* Block-based rendering with fallback */}
        {msg.blocks && msg.blocks.length > 0 ? (
          <BlockList
            blocks={msg.filteredBlocks || msg.blocks}
            onCopy={(content) => navigator.clipboard.writeText(content)}
            onExecute={onExecuteCommand}
            onFileReferenceClick={onFileReferenceClick}
          />
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
            />
          </div>
        );
      })()}

      {/* Message Actions - Show for assistant messages (Copy, Retry) */}
      {msg.role === 'assistant' && !isSending && (
        <div className="w-full">
          <MessageActions
            messageId={msg.id}
            content={msg.content}
            onCopy={onCopyMessage}
            onRetry={onRetryMessage}
            copiedMessageId={copiedMessageId}
          />
        </div>
      )}
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
