import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { ThinkingStep } from '@/types/thinking';
import type { Block } from '@/types/conversation';
import { ReasoningAccordion } from './ReasoningAccordion';
import { FileChangeSummary } from './FileChangeSummary';
import { FileSummaryBlock } from '@/components/blocks/FileSummaryBlock';
import { extractFileChanges } from '@/lib/reasoningUtils';
import { summarizeToolUsage } from '@/lib/thinkingUtils';
import { cn } from '@/lib/utils';

interface UnifiedReasoningPanelProps {
  steps: ThinkingStep[];
  duration: number;
  isLive?: boolean;
  fileSummaryBlock?: Block;
  className?: string;
  onFileClick?: (filePath: string) => void;
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
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Extract file changes for collapsed view fallback
  const fileChanges = extractFileChanges(steps);

  // Calculate total diff statistics
  const totalAdditions = fileSummaryBlock?.metadata?.totalAdditions ||
    fileChanges.reduce((sum, f) => sum + f.additions, 0);
  const totalDeletions = fileSummaryBlock?.metadata?.totalDeletions ||
    fileChanges.reduce((sum, f) => sum + f.deletions, 0);

  // Generate summary text
  const stepCount = steps.length;
  const toolSummary = summarizeToolUsage(steps);

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={setIsExpanded}
      className={cn(
        "border border-border/60 rounded-lg overflow-hidden",
        "bg-secondary/60",
        "backdrop-blur-sm shadow-sm",
        className
      )}
    >
        {/* Header with summary */}
        <CollapsibleTrigger className="w-full group">
          <div className="flex items-center justify-between px-4 py-3 hover:bg-secondary/20 transition-all duration-200">
            <div className="flex items-center gap-4">
              {/* Chevron icon */}
              <ChevronDown
                className={cn(
                  "w-4 h-4 opacity-60 transition-all duration-300 ease-out group-hover:opacity-80",
                  isExpanded ? "rotate-180" : "rotate-0"
                )}
                strokeWidth={1.5}
              />

              {/* Summary text */}
              <span className="text-sm font-light opacity-70 group-hover:opacity-90 transition-opacity">
                {stepCount} {stepCount === 1 ? 'step' : 'steps'}
                {toolSummary && (
                  <>
                    <span className="mx-1.5 opacity-50">·</span>
                    <span>{toolSummary}</span>
                  </>
                )}
              </span>
            </div>

            {/* Duration and Diff Stats */}
            <div className="flex items-center gap-3">
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
              <span className="text-sm font-light opacity-60 group-hover:opacity-80 transition-opacity">
                {duration}s
              </span>
            </div>
          </div>
        </CollapsibleTrigger>

        {/* Default view (always visible when collapsed): File changes summary */}
        {!isExpanded && (
          <div className="border-t border-border/50">
            {fileSummaryBlock ? (
              // Use FileSummaryBlock in compact mode (no header, no border)
              <FileSummaryBlock
                block={fileSummaryBlock}
                onFileClick={onFileClick}
                compact={true}
              />
            ) : (
              // Fallback to extracted file changes from thinking steps
              <FileChangeSummary
                fileChanges={fileChanges}
                onFileClick={onFileClick}
              />
            )}
          </div>
        )}

        {/* Expanded view: Full reasoning timeline */}
        <CollapsibleContent>
          <div className="border-t border-border/50">
            <div className="px-4 py-3">
              <ReasoningAccordion
                steps={steps}
                isLive={isLive}
                duration={duration}
              />
            </div>
          </div>
        </CollapsibleContent>
    </Collapsible>
  );
};

UnifiedReasoningPanel.displayName = 'UnifiedReasoningPanel';
