import React from 'react';
import type { Message } from '@/types/conversation';
import type { ThinkingStep } from '@/types/thinking';
import { Paperclip, ChevronDown, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BlockList } from '@/components/blocks';
import { InlineTodoProgress } from '@/components/blocks/InlineTodoProgress';
import { ReasoningAccordion } from '@/components/reasoning/ReasoningAccordion';
import { summarizeToolUsage } from '@/lib/thinkingUtils';
import { cn } from '@/lib/utils';

export interface MessageComponentProps {
  msg: Message & { filteredBlocks?: any[] };
  isSending: boolean;
  pendingAssistantMessageId: string | null;
  messageThinkingSteps: Record<string, { steps: ThinkingStep[]; duration: number }>;
  openReasoningId: string | null;
  copiedMessageId: string | null;
  currentDuration: number;
  onCopyMessage: (messageId: string, content: string) => void;
  onToggleReasoning: (messageId: string) => void;
  onExecuteCommand: (command: string) => Promise<void>;
  onFileReferenceClick?: (filePath: string, lineStart?: number, lineEnd?: number) => void;
}

const MessageComponentInner: React.FC<MessageComponentProps> = ({
  msg,
  isSending,
  pendingAssistantMessageId,
  messageThinkingSteps,
  openReasoningId,
  copiedMessageId,
  currentDuration,
  onCopyMessage,
  onToggleReasoning,
  onExecuteCommand,
  onFileReferenceClick,
}) => {
  return (
    <div
      data-message-id={msg.id}
      className={`flex ${
        msg.role === 'user' ? 'justify-end' : 'justify-start'
      } ${msg.role === 'assistant' ? 'mb-2' : ''}`}
    >
      <div
        className={`max-w-[75%] ${
          msg.role === 'user'
            ? 'bg-secondary px-3 py-2 rounded-xl border border-border'
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

        {/* Reasoning button - Show for assistant messages with reasoning steps */}
        {msg.role === 'assistant' && (messageThinkingSteps[msg.id]?.steps?.length > 0 || (isSending && msg.id === pendingAssistantMessageId)) && (
          <div className="mb-3 flex items-center gap-2">
            <button
              onClick={() => onToggleReasoning(msg.id)}
              className="flex items-center gap-1 text-base text-muted-foreground/60 hover:text-foreground transition-all"
            >
              <span className="opacity-80 hover:opacity-100">
                {isSending && msg.id === pendingAssistantMessageId
                  ? `${currentDuration}s • ${summarizeToolUsage(messageThinkingSteps[msg.id]?.steps || [])}`
                  : `${messageThinkingSteps[msg.id].duration}s • ${summarizeToolUsage(messageThinkingSteps[msg.id].steps)}`
                }
              </span>
              <ChevronDown className={`w-4 h-4 opacity-80 transition-transform ${openReasoningId === msg.id ? 'rotate-180' : ''}`} strokeWidth={1.5} />
            </button>
          </div>
        )}

        {/* Reasoning content (collapsible) - Above message content */}
        {(() => {
          // Show reasoning if accordion is open AND messageThinkingSteps exists (even if steps is empty initially)
          const shouldShowReasoning = msg.role === 'assistant' &&
            openReasoningId === msg.id &&
            messageThinkingSteps[msg.id] !== undefined;

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
                    isLive={isSending && msg.id === pendingAssistantMessageId}
                    duration={isSending && msg.id === pendingAssistantMessageId ? currentDuration : messageThinkingSteps[msg.id].duration}
                  />
                </div>
              </motion.div>
            </AnimatePresence>
          );
        })()}

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
          <div className="text-base font-normal text-foreground whitespace-pre-wrap leading-relaxed">
            {msg.content}
          </div>
        )}

        {/* Copy button - Show below message content for assistant messages */}
        {msg.role === 'assistant' && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => onCopyMessage(msg.id, msg.content)}
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
      </div>
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
      prevProps.openReasoningId === nextProps.openReasoningId &&
      prevProps.copiedMessageId === nextProps.copiedMessageId &&
      prevProps.currentDuration === nextProps.currentDuration &&
      // Compare messageThinkingSteps for this specific message only
      prevProps.messageThinkingSteps[prevProps.msg.id] === nextProps.messageThinkingSteps[nextProps.msg.id]
    );
  }
);

MessageComponent.displayName = 'MessageComponent';
