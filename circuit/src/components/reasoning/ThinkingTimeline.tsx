import React from 'react';
import { Brain, FileText, Search, Terminal, Wrench } from 'lucide-react';
import type { GroupedThinkingSteps, ThinkingStep } from '@/types/thinking';
import { motion, AnimatePresence } from 'motion/react';

interface ThinkingTimelineProps {
  groupedSteps: GroupedThinkingSteps;
  startTime: number;
  className?: string;
  isStreaming?: boolean;
}

const MAX_VISIBLE_STEPS = 1;

// Group consecutive steps of same tool type
interface ToolGroup {
  tool: string;
  icon: React.ElementType;
  label: string;
  steps: ThinkingStep[];
}

function groupStepsByTool(steps: ThinkingStep[]): ToolGroup[] {
  const groups: ToolGroup[] = [];

  for (const step of steps) {
    const tool = step.type === 'thinking' ? 'thinking' : (step.tool || 'unknown');

    // Check if we can append to the last group
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.tool === tool) {
      lastGroup.steps.push(step);
    } else {
      // Create new group
      const icon = getIconForTool(step);
      const label = getLabelForTool(step);
      groups.push({
        tool,
        icon,
        label,
        steps: [step]
      });
    }
  }

  return groups;
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

export const ThinkingTimeline: React.FC<ThinkingTimelineProps> = ({
  groupedSteps,
  startTime: _startTime,
  className,
  isStreaming = true,
}) => {
  if (groupedSteps.groups.length === 0) {
    return (
      <div className="text-base text-[#A7A6A5] py-2 font-normal">
        Analyzing your request...
      </div>
    );
  }

  // Flatten all steps from all groups
  const allSteps: ThinkingStep[] = [];
  groupedSteps.groups.forEach(group => {
    allSteps.push(...group.steps);
  });

  // Show only recent steps while streaming
  const visibleSteps = isStreaming
    ? allSteps.slice(-MAX_VISIBLE_STEPS)
    : allSteps;

  // For completed reasoning, use flat tool-grouped display
  if (!isStreaming) {
    const toolGroups = groupStepsByTool(allSteps);

    return (
      <div className={className}>
        <div className="space-y-3">
          {toolGroups.map((group, idx) => (
            <ToolGroupDisplay key={idx} group={group} />
          ))}
        </div>
      </div>
    );
  }

  // Streaming mode - keep existing compact display
  return (
    <div className={className}>
      <div className="relative min-h-[28px]">
        <AnimatePresence mode="wait">
          {visibleSteps.map((step) => (
            <StepLine
              key={step.timestamp}
              step={step}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

// Tool group display component - flat hierarchy with indented details
interface ToolGroupDisplayProps {
  group: ToolGroup;
}

const ToolGroupDisplay: React.FC<ToolGroupDisplayProps> = ({ group }) => {
  const Icon = group.icon;
  const count = group.steps.length;

  // For search/glob tools, show patterns as pills
  if (group.tool === 'Glob' || group.tool === 'Grep') {
    return (
      <div>
        {/* Header */}
        <div className="flex items-center gap-2 text-base text-[#DDDEDD]/70">
          <Icon className="w-3 h-3 opacity-70" strokeWidth={1.5} />
          <span>{group.label} {count > 1 ? `${count} patterns` : '1 pattern'}</span>
        </div>

        {/* Details - indented pills */}
        <div className="ml-6 mt-1.5 flex flex-wrap gap-2">
          {group.steps.map((step, idx) => (
            <div
              key={idx}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary/40 text-base text-[#A7A6A5]/80"
            >
              <span>{step.pattern || 'pattern'}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // For file operations, show filenames as pills
  if (group.tool === 'Read' || group.tool === 'Write' || group.tool === 'Edit') {
    return (
      <div>
        {/* Header */}
        <div className="flex items-center gap-2 text-base text-[#DDDEDD]/70">
          <Icon className="w-3 h-3 opacity-70" strokeWidth={1.5} />
          <span>{group.label} {count > 1 ? `${count} files` : '1 file'}</span>
        </div>

        {/* Details - indented pills */}
        <div className="ml-6 mt-1.5 flex flex-wrap gap-2">
          {group.steps.map((step, idx) => {
            const fileName = step.filePath?.split('/').pop() || 'file';
            const fullPath = step.filePath || '';

            return (
              <div
                key={idx}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary/40 text-base text-[#A7A6A5]/80 hover:bg-secondary/50 transition-colors cursor-default"
                title={fullPath}
              >
                <span>{fileName}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // For thinking/bash, show messages as text
  if (group.tool === 'thinking' || group.tool === 'Bash') {
    return (
      <div>
        {/* Header */}
        <div className="flex items-center gap-2 text-base text-[#DDDEDD]/70">
          <Icon className="w-3 h-3 opacity-70" strokeWidth={1.5} />
          <span>{group.label}</span>
        </div>

        {/* Details - indented text */}
        <div className="ml-6 mt-1 space-y-1">
          {group.steps.map((step, idx) => {
            const detail = step.message || step.command || '';

            return (
              <div
                key={idx}
                className="text-base text-[#A7A6A5]/80 leading-relaxed"
              >
                {detail}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Default fallback
  return (
    <div>
      <div className="flex items-center gap-2 text-base text-[#DDDEDD]/70">
        <Icon className="w-3 h-3 opacity-70" strokeWidth={1.5} />
        <span>{group.label} ({count})</span>
      </div>
    </div>
  );
};

// Streaming display - simple single line
interface StepLineProps {
  step: ThinkingStep;
}

const StepLine: React.FC<StepLineProps> = ({ step }) => {
  const Icon = getIconForTool(step);
  const label = getLabelForTool(step);

  const getDetail = () => {
    if (step.type === 'thinking') {
      return step.message.length > 60
        ? step.message.substring(0, 60) + '...'
        : step.message;
    }

    if (step.filePath) {
      const fileName = step.filePath.split('/').pop();
      return fileName || step.filePath;
    }
    if (step.command) {
      return step.command.length > 40
        ? step.command.substring(0, 40) + '...'
        : step.command;
    }
    if (step.pattern) {
      return step.pattern;
    }
    return '';
  };

  const detail = getDetail();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex items-center gap-2 text-base text-[#A7A6A5] font-light"
    >
      <Icon className="w-3 h-3 flex-shrink-0 opacity-50" strokeWidth={1.5} />
      <span className="opacity-70">
        {label} {detail}
      </span>
    </motion.div>
  );
};

ThinkingTimeline.displayName = 'ThinkingTimeline';
