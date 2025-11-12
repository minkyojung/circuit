import React from 'react';
import { Brain, FileText, Search, Terminal, Wrench, ListTodo } from 'lucide-react';
import type { ThinkingStep } from '@/types/thinking';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from '@/lib/utils';
import { Shimmer } from '@/components/ai-elements/shimmer';
import { motion, AnimatePresence } from 'motion/react';
import { TodoQueue } from '@/components/blocks/TodoQueue';

interface ReasoningAccordionProps {
  steps: ThinkingStep[];
  className?: string;
  isLive?: boolean;  // Whether thinking is currently in progress
  duration?: number;  // Duration in seconds
  onFileClick?: (filePath: string) => void;  // Callback for file path clicks
  todoWriteResult?: any;  // TodoWrite result data
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
    case 'TodoWrite':
      return ListTodo;
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
    case 'TodoWrite': return 'Todo';
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
    case 'TodoWrite':
      return 'Created task list';
    default:
      return '';
  }
}

// Constants for code preview
const MAX_PREVIEW_LINES = 15;

// Helper: Render code preview with line numbers
function renderCodePreview(content: string, showAll = false) {
  const lines = content.split('\n');
  const totalLines = lines.length;
  const displayLines = showAll ? lines : lines.slice(0, MAX_PREVIEW_LINES);
  const hasMore = totalLines > MAX_PREVIEW_LINES;

  return (
    <div className="space-y-2">
      <code className="block text-sm leading-relaxed font-light opacity-80 hover:opacity-100 transition-opacity bg-secondary/80 px-4 py-3 rounded-md border border-border/50 font-mono overflow-x-auto">
        {displayLines.map((line, i) => (
          <div key={i} className="flex gap-3">
            <span className="opacity-40 select-none text-right w-8 flex-shrink-0">{i + 1}</span>
            <span className="flex-1">{line || ' '}</span>
          </div>
        ))}
      </code>
      {!showAll && hasMore && (
        <div className="text-sm font-light opacity-50 px-4">
          ⚡ +{totalLines - MAX_PREVIEW_LINES} more lines (click filename above to view full file)
        </div>
      )}
    </div>
  );
}

// Helper: Render diff
function renderDiff(oldString: string, newString: string) {
  const oldLines = oldString.split('\n');
  const newLines = newString.split('\n');

  return (
    <div className="space-y-2">
      <code className="block text-sm leading-relaxed font-light opacity-80 hover:opacity-100 transition-opacity bg-secondary/80 px-4 py-3 rounded-md border border-border/50 font-mono overflow-x-auto">
        {oldLines.map((line, i) => (
          <div key={`old-${i}`} className="flex gap-3 bg-red-500/10">
            <span className="opacity-40 select-none">-</span>
            <span className="flex-1 text-red-400">{line || ' '}</span>
          </div>
        ))}
        {newLines.map((line, i) => (
          <div key={`new-${i}`} className="flex gap-3 bg-green-500/10">
            <span className="opacity-40 select-none">+</span>
            <span className="flex-1 text-green-400">{line || ' '}</span>
          </div>
        ))}
      </code>
      <div className="text-sm font-light opacity-50 px-4">
        ⚡ Changed {oldLines.length} → {newLines.length} lines (click filename above to view full file)
      </div>
    </div>
  );
}

// Render detail content for expanded step
function renderStepDetail(step: ThinkingStep, todoWriteResult?: any) {
  if (step.type === 'thinking') {
    return (
      <code className="block text-base leading-relaxed font-light opacity-80 hover:opacity-100 transition-opacity bg-secondary/80 px-4 py-3 rounded-md border border-border/50">
        {step.message}
      </code>
    );
  }

  switch (step.tool) {
    case 'Glob':
    case 'Grep':
      return (
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-secondary text-base font-light opacity-70 hover:opacity-90 transition-all">
          <span>{step.pattern || 'pattern'}</span>
        </div>
      );

    case 'Read':
      return (
        <div className="text-sm font-light opacity-60 px-4 py-2 italic">
          📄 Click filename above to open file
        </div>
      );

    case 'Write':
      return step.content
        ? renderCodePreview(step.content)
        : (
          <div className="text-sm font-light opacity-60 px-4 py-2 italic">
            📄 Click filename above to open file
          </div>
        );

    case 'Edit':
      return (step.oldString && step.newString)
        ? renderDiff(step.oldString, step.newString)
        : (
          <div className="text-sm font-light opacity-60 px-4 py-2 italic">
            📄 Click filename above to open file
          </div>
        );

    case 'Bash':
      return (
        <div className="text-base leading-relaxed font-light opacity-60 hover:opacity-90 transition-opacity font-mono">
          {step.command}
        </div>
      );

    case 'TodoWrite':
      return todoWriteResult ? (
        <TodoQueue
          todos={todoWriteResult.todos.map((todo: any) => ({
            content: todo.title || todo.content,
            activeForm: todo.activeForm || `${todo.title || todo.content}...`,
            status: todo.status,
            description: todo.description,
          }))}
          defaultExpanded={true}
          showProgressBar={true}
        />
      ) : (
        <div className="text-sm font-light opacity-60 px-4 py-2 italic">
          📋 Task list created
        </div>
      );

    default:
      return (
        <div className="text-base font-light opacity-50 hover:opacity-80 transition-opacity">
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
  onFileClick,
  todoWriteResult,
}) => {
  if (steps.length === 0) {
    return (
      <div className="text-base py-2 font-light">
        {isLive ? (
          <div className="flex items-center gap-2">
            <Brain className="w-3 h-3 animate-pulse opacity-70" />
            <Shimmer duration={1.5}>
              Thinking{duration > 0 ? ` (${duration}s)` : '...'}
            </Shimmer>
          </div>
        ) : (
          <span className="opacity-50">No reasoning steps recorded.</span>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      <Accordion type="multiple" className="space-y-3">
        <AnimatePresence mode="popLayout">
          {steps.map((step, idx) => {
            const Icon = getIconForStep(step);
            const label = getLabelForStep(step);
            const summary = getStepSummary(step);

            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <AccordionItem
                  value={`step-${idx}`}
                  className="border-b-0 group"
                >
              <AccordionTrigger className="py-1.5 hover:no-underline text-base [&>svg]:hidden transition-colors">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {/* Icon */}
                  <Icon className="w-3 h-3 flex-shrink-0 opacity-60 group-hover:opacity-90 transition-opacity" strokeWidth={1.5} />

                  {/* Label */}
                  <span className="flex-shrink-0 font-light opacity-60 group-hover:opacity-90 transition-opacity">
                    {label}
                  </span>

                  {/* For file tools: show filename when closed, clickable when open */}
                  {step.filePath ? (
                    <>
                      {/* Closed: show as summary */}
                      <span className="truncate ml-1 font-light opacity-50 group-hover:opacity-80 transition-opacity group-data-[state=open]:hidden">
                        · {step.filePath.split('/').pop()}
                      </span>
                      {/* Open: show as clickable link */}
                      <span
                        className="truncate ml-1 font-light opacity-50 group-hover:opacity-80 transition-opacity group-data-[state=closed]:hidden cursor-pointer hover:underline hover:opacity-100"
                        title={step.filePath}
                        onClick={(e) => {
                          e.stopPropagation();
                          onFileClick?.(step.filePath!);
                        }}
                      >
                        · {step.filePath.split('/').pop()}
                      </span>
                    </>
                  ) : (
                    /* For non-file tools: show summary when closed */
                    summary && (
                      <span className="truncate ml-1 font-light opacity-50 group-hover:opacity-80 transition-opacity group-data-[state=open]:hidden">
                        · {summary}
                      </span>
                    )
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent
                className={cn(
                  "pb-2 pt-3",
                  "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-1",
                  "data-[state=open]:animate-in data-[state=open]:slide-in-from-top-1 data-[state=open]:fade-in-0"
                )}
              >
                {renderStepDetail(step, todoWriteResult)}
              </AccordionContent>
                </AccordionItem>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </Accordion>
    </div>
  );
};

ReasoningAccordion.displayName = 'ReasoningAccordion';
