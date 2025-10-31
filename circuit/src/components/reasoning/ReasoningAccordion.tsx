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
}

// Group consecutive steps of same tool type
interface ToolGroup {
  tool: string;
  icon: React.ElementType;
  label: string;
  steps: ThinkingStep[];
}

function groupStepsByTool(steps: ThinkingStep[]): ToolGroup[] {
  // Group ALL steps by tool type (not just consecutive)
  // This creates one group per tool type: Thinking, Read, Glob, Bash, etc.
  const toolMap = new Map<string, ThinkingStep[]>();

  for (const step of steps) {
    const tool = step.type === 'thinking' ? 'thinking' : (step.tool || 'unknown');

    if (!toolMap.has(tool)) {
      toolMap.set(tool, []);
    }
    toolMap.get(tool)!.push(step);
  }

  // Convert Map to ToolGroup array
  return Array.from(toolMap.entries()).map(([tool, toolSteps]) => ({
    tool,
    icon: getIconForTool(toolSteps[0]),
    label: getLabelForTool(toolSteps[0]),
    steps: toolSteps
  }));
}

function getIconForTool(step: ThinkingStep): React.ElementType {
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

function getLabelForTool(step: ThinkingStep): string {
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

function getSummary(group: ToolGroup): string {
  const count = group.steps.length;

  if (group.tool === 'Glob' || group.tool === 'Grep') {
    return count === 1 ? '1 pattern' : `${count} patterns`;
  }

  if (group.tool === 'Read' || group.tool === 'Write' || group.tool === 'Edit') {
    return count === 1 ? '1 file' : `${count} files`;
  }

  if (group.tool === 'Bash') {
    return count === 1 ? '1 command' : `${count} commands`;
  }

  return count === 1 ? '' : `${count} steps`;
}

function renderGroupDetails(group: ToolGroup) {
  // For search/glob tools, show patterns as pills
  if (group.tool === 'Glob' || group.tool === 'Grep') {
    return (
      <div className="flex flex-wrap gap-2">
        {group.steps.map((step, idx) => (
          <div
            key={idx}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary/40 text-sm text-muted-foreground/80"
          >
            <span>{step.pattern || 'pattern'}</span>
          </div>
        ))}
      </div>
    );
  }

  // For file operations, show filenames as pills
  if (group.tool === 'Read' || group.tool === 'Write' || group.tool === 'Edit') {
    return (
      <div className="flex flex-wrap gap-2">
        {group.steps.map((step, idx) => {
          const fileName = step.filePath?.split('/').pop() || 'file';
          const fullPath = step.filePath || '';

          return (
            <div
              key={idx}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary/40 text-sm text-muted-foreground/80 hover:bg-secondary/50 transition-colors cursor-default"
              title={fullPath}
            >
              <span>{fileName}</span>
            </div>
          );
        })}
      </div>
    );
  }

  // For thinking/bash, show messages as text
  if (group.tool === 'thinking' || group.tool === 'Bash') {
    return (
      <div className="space-y-1">
        {group.steps.map((step, idx) => {
          const detail = step.message || step.command || '';

          return (
            <div
              key={idx}
              className="text-sm text-muted-foreground/80 leading-relaxed"
            >
              {detail}
            </div>
          );
        })}
      </div>
    );
  }

  // Default fallback
  return (
    <div className="text-sm text-muted-foreground">
      {group.steps.length} step{group.steps.length !== 1 ? 's' : ''}
    </div>
  );
}

export const ReasoningAccordion: React.FC<ReasoningAccordionProps> = ({
  steps,
  className,
}) => {
  if (steps.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-2">
        No reasoning steps recorded.
      </div>
    );
  }

  const toolGroups = groupStepsByTool(steps);

  return (
    <Accordion type="multiple" className={cn("space-y-1", className)}>
      {toolGroups.map((group, idx) => {
        const Icon = group.icon;
        const summary = getSummary(group);

        return (
          <AccordionItem
            value={`step-${idx}`}
            key={idx}
            className="border-b-0"
          >
            <AccordionTrigger className="py-2 hover:no-underline text-sm [&[data-state=open]>svg]:rotate-180">
              <div className="flex items-center gap-2 flex-1">
                {/* Icon + Label */}
                <Icon className="w-3.5 h-3.5 flex-shrink-0 opacity-70" strokeWidth={1.5} />
                <span className="text-muted-foreground/90">{group.label}</span>

                {/* Summary */}
                {summary && (
                  <span className="ml-auto text-xs text-muted-foreground/60 mr-2">
                    {summary}
                  </span>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-2 pt-1 ml-6">
              {renderGroupDetails(group)}
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
};

ReasoningAccordion.displayName = 'ReasoningAccordion';
