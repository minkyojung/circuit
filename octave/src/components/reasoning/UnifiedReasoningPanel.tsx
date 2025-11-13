import React, { useState, useEffect } from 'react';
import { ChevronDown, Copy, Check, MessageCircleQuestion } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import type { ThinkingStep } from '@/types/thinking';
import type { Block } from '@/types/conversation';
import { ReasoningAccordion } from './ReasoningAccordion';
import { FileChangeSummary } from './FileChangeSummary';
import { extractFileChanges, convertFileSummaryBlockToFileChanges } from '@/lib/reasoningUtils';
import { summarizeToolUsage } from '@/lib/thinkingUtils';
import { cn } from '@/lib/utils';

interface UnifiedReasoningPanelProps {
  steps: ThinkingStep[];
  duration: number;
  isLive?: boolean;
  fileSummaryBlock?: Block;
  className?: string;
  onFileClick?: (filePath: string) => void;
  // Message actions
  messageId?: string;
  messageContent?: string;
  onCopyMessage?: (messageId: string, content: string) => void;
  onExplainMessage?: (messageId: string, content: string) => void;
  copiedMessageId?: string | null;
  // TodoWrite result
  todoWriteResult?: any;
}

/**
 * UnifiedReasoningPanel - A collapsible panel that shows reasoning steps
 *
 * Collapsed: Shows file changes summary (FileSummaryBlock or FileChangeSummary)
 * Expanded: Shows full reasoning timeline with all steps
 */
export const UnifiedReasoningPanel: React.FC<UnifiedReasoningPanelProps> = ({
  steps,
  duration,
  isLive = false,
  fileSummaryBlock,
  className,
  onFileClick,
  messageId,
  messageContent,
  onCopyMessage,
  onExplainMessage,
  copiedMessageId,
  todoWriteResult,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Auto-expand when live (working)
  useEffect(() => {
    if (isLive) {
      setIsExpanded(true);
    }
  }, [isLive]);

  // Unified file changes: prefer FileSummaryBlock data, fallback to extracted from steps
  const fileChanges = fileSummaryBlock
    ? convertFileSummaryBlockToFileChanges(fileSummaryBlock)
    : extractFileChanges(steps);

  // Calculate total diff statistics
  const totalAdditions = fileChanges.reduce((sum, f) => sum + f.additions, 0);
  const totalDeletions = fileChanges.reduce((sum, f) => sum + f.deletions, 0);

  // Generate summary text
  const stepCount = steps.length;
  const toolSummary = summarizeToolUsage(steps);

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={setIsExpanded}
      className={cn("not-prose mb-4", className)}
    >
        {/* Header with summary */}
        <CollapsibleTrigger className="w-full group">
          <div className="flex items-center justify-between py-2 transition-colors">
            <div className="flex items-center gap-4">
              {/* Chevron icon */}
              <ChevronDown
                className={cn(
                  "w-3 h-3 opacity-60 transition-all duration-300 ease-out group-hover:opacity-90",
                  isExpanded ? "rotate-180" : "rotate-0"
                )}
                strokeWidth={1.5}
              />

              {/* Summary text */}
              <span className="text-base font-light opacity-70 group-hover:opacity-90 transition-opacity">
                {stepCount} {stepCount === 1 ? 'step' : 'steps'}
                {toolSummary && (
                  <>
                    <span className="mx-2.5 opacity-50">·</span>
                    <span>{toolSummary}</span>
                  </>
                )}
                <span className="mx-2.5 opacity-50">·</span>
                <span>{duration}s</span>
              </span>
            </div>

            {/* Diff Stats */}
            {(totalAdditions > 0 || totalDeletions > 0) && (
              <div className="flex items-center gap-2 text-xs font-mono">
                {totalAdditions > 0 && (
                  <span className="text-green-500 font-medium">+{totalAdditions}</span>
                )}
                {totalDeletions > 0 && (
                  <span className="text-red-500 font-medium">-{totalDeletions}</span>
                )}
              </div>
            )}
          </div>
        </CollapsibleTrigger>

        {/* Default view (always visible when collapsed): File changes summary */}
        {!isExpanded && fileChanges.length > 0 && (
          <div className="mt-2">
            <FileChangeSummary
              fileChanges={fileChanges}
              onFileClick={onFileClick}
            />
          </div>
        )}

        {/* Expanded view: Full reasoning timeline */}
        <CollapsibleContent
          className={cn(
            "mt-2 text-base font-light opacity-75 dark:opacity-65",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2",
            "data-[state=open]:animate-in data-[state=open]:slide-in-from-top-2 data-[state=open]:fade-in-0",
            "outline-none"
          )}
        >
          <ReasoningAccordion
            steps={steps}
            isLive={isLive}
            duration={duration}
            onFileClick={onFileClick}
            todoWriteResult={todoWriteResult}
          />
        </CollapsibleContent>

        {/* Message Actions - Copy, Explain */}
        {messageId && messageContent && (
          <div className="mt-3 flex items-center gap-2">
            {/* Copy Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onCopyMessage?.(messageId, messageContent)}
              className={cn(
                'h-[32px] w-[32px] hover:bg-secondary',
                'text-muted-foreground hover:text-foreground',
                copiedMessageId === messageId && 'text-green-500'
              )}
              title="Copy message"
            >
              {copiedMessageId === messageId ? (
                <Check className="w-4 h-4" strokeWidth={2} />
              ) : (
                <Copy className="w-4 h-4" strokeWidth={1.5} />
              )}
            </Button>

            {/* Explain Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onExplainMessage?.(messageId, messageContent)}
              className={cn(
                'h-[32px] w-[32px] hover:bg-secondary',
                'text-muted-foreground hover:text-foreground'
              )}
              title="Explain this response"
            >
              <MessageCircleQuestion className="w-4 h-4" strokeWidth={1.5} />
            </Button>
          </div>
        )}
    </Collapsible>
  );
};

UnifiedReasoningPanel.displayName = 'UnifiedReasoningPanel';
