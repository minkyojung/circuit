import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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

  // Generate summary text
  const stepCount = steps.length;
  const toolSummary = summarizeToolUsage(steps);

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={setIsExpanded}
      className={cn(
        "border border-border rounded-lg bg-card/30 backdrop-blur-sm overflow-hidden",
        className
      )}
    >
      {/* Header with summary */}
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors">
          <div className="flex items-center gap-2.5">
            {/* Chevron icon */}
            <ChevronDown
              className={cn(
                "w-4 h-4 opacity-60 transition-transform",
                isExpanded ? "rotate-180" : "rotate-0"
              )}
              strokeWidth={1.5}
            />

            {/* Summary text */}
            <span className="text-sm font-light opacity-70">
              {stepCount} {stepCount === 1 ? 'step' : 'steps'}
              {toolSummary && (
                <>
                  <span className="mx-1.5 opacity-50">·</span>
                  <span>{toolSummary}</span>
                </>
              )}
            </span>
          </div>

          {/* Duration */}
          <span className="text-sm font-light opacity-60">
            {duration}s
          </span>
        </div>
      </CollapsibleTrigger>

      {/* Default view (always visible when collapsed): File changes summary */}
      {!isExpanded && (
        <div className="border-t border-border">
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
        <div className="border-t border-border">
          <div className="px-2 py-2">
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
