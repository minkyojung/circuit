import React from 'react';
import { Brain, FileText, Search, Terminal, Wrench } from 'lucide-react';
import type { ThinkingStep } from '@/types/thinking';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from '@/lib/utils';

interface ReasoningAccordionProps {
  steps: ThinkingStep[];
  className?: string;
  isLive?: boolean;  // Whether thinking is currently in progress
  duration?: number;  // Duration in seconds
}

// Get icon for individual step
function getIconForStep(step: ThinkingStep): React.ElementType {
  if (step.type === 'thinking') return Brain;

  switch (step.tool) {
    case 'Read':
    case 'Write':
    case 'Edit':
      return FileText;
    case 'Glob':
    case 'Grep':
      return Search;
    case 'Bash':
      return Terminal;
    default:
      return Wrench;
  }
}

// Get label for individual step
function getLabelForStep(step: ThinkingStep): string {
  if (step.type === 'thinking') return 'Thinking';

  switch (step.tool) {
    case 'Read': return 'Read';
    case 'Write': return 'Write';
    case 'Edit': return 'Edit';
    case 'Glob': return 'Glob';
    case 'Grep': return 'Grep';
    case 'Bash': return 'Run';
    default: return step.tool || 'Unknown';
  }
}

// Get one-line summary for step
function getStepSummary(step: ThinkingStep): string {
  if (step.type === 'thinking') {
    const message = step.message || '';
    return message.length > 50 ? message.slice(0, 50) + '...' : message;
  }

  switch (step.tool) {
    case 'Glob':
    case 'Grep':
      return step.pattern || 'pattern';
    case 'Read':
    case 'Write':
    case 'Edit':
      return step.filePath?.split('/').pop() || 'file';
    case 'Bash':
      const cmd = step.command || '';
      return cmd.length > 40 ? cmd.slice(0, 40) + '...' : cmd;
    default:
      return '';
  }
}

// Render detail content for expanded step
function renderStepDetail(step: ThinkingStep) {
  if (step.type === 'thinking') {
    return (
      <div className="text-sm leading-relaxed font-light opacity-70 dark:opacity-60 hover:opacity-100 transition-opacity">
        {step.message}
      </div>
    );
  }

  switch (step.tool) {
    case 'Glob':
    case 'Grep':
      return (
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-secondary text-sm font-light opacity-70 dark:opacity-60 hover:opacity-100 transition-opacity">
          <span>{step.pattern || 'pattern'}</span>
        </div>
      );

    case 'Read':
    case 'Write':
    case 'Edit':
      return (
        <div
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-secondary text-sm hover:bg-secondary/80 transition-colors cursor-default font-light opacity-70 dark:opacity-60 hover:opacity-100 transition-opacity"
          title={step.filePath}
        >
          <span>{step.filePath}</span>
        </div>
      );

    case 'Bash':
      return (
        <div className="text-sm leading-relaxed font-light opacity-70 dark:opacity-60 hover:opacity-100 transition-opacity">
          {step.command}
        </div>
      );

    default:
      return (
        <div className="text-sm font-light opacity-70 dark:opacity-60 hover:opacity-100 transition-opacity">
          No details available
        </div>
      );
  }
}

export const ReasoningAccordion: React.FC<ReasoningAccordionProps> = ({
  steps,
  className,
  isLive = false,
  duration = 0,
}) => {
  if (steps.length === 0) {
    return (
      <div className="text-sm py-2 font-light opacity-70 dark:opacity-60 hover:opacity-100 transition-opacity">
        {isLive ? (
          <div className="flex items-center gap-2">
            <Brain className="w-3 h-3 animate-pulse" />
            <span>Thinking{duration > 0 ? ` (${duration}s)` : '...'}</span>
          </div>
        ) : (
          'No reasoning steps recorded.'
        )}
      </div>
    );
  }

  return (
    <div className={cn("max-h-[280px] overflow-y-auto", className)}>
      <Accordion type="multiple" className="space-y-1.5">
        {steps.map((step, idx) => {
          const Icon = getIconForStep(step);
          const label = getLabelForStep(step);
          const summary = getStepSummary(step);

          return (
            <AccordionItem
              value={`step-${idx}`}
              key={idx}
              className="border-b-0"
            >
              <AccordionTrigger className="py-2 hover:no-underline text-sm [&>svg]:hidden">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {/* Icon */}
                  <Icon className="w-3 h-3 flex-shrink-0 opacity-70 dark:opacity-60 hover:opacity-100 transition-opacity" strokeWidth={1.5} />

                  {/* Label */}
                  <span className="flex-shrink-0 font-light opacity-70 dark:opacity-60 hover:opacity-100 transition-opacity">
                    {label}
                  </span>

                  {/* Summary */}
                  {summary && (
                    <span className="text-sm truncate ml-1 font-light opacity-70 dark:opacity-60 hover:opacity-100 transition-opacity">
                      · {summary}
                    </span>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-2 pt-1 ml-6">
                {renderStepDetail(step)}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
};

ReasoningAccordion.displayName = 'ReasoningAccordion';
