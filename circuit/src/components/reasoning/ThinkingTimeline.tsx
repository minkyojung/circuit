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

export const ThinkingTimeline: React.FC<ThinkingTimelineProps> = ({
  groupedSteps,
  startTime: _startTime,
  className,
  isStreaming = true,
}) => {
  if (groupedSteps.groups.length === 0) {
    return (
      <div className="text-base text-muted-foreground py-2 font-normal">
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

  return (
    <div className={className}>
      {isStreaming ? (
        <div className="relative min-h-[28px]">
          <AnimatePresence mode="wait">
            {visibleSteps.map((step) => (
              <StepLine
                key={step.timestamp}
                step={step}
                isStreaming={isStreaming}
              />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="space-y-1.5">
          {allSteps.map((step, index) => (
            <StepLine
              key={step.timestamp}
              step={step}
              isStreaming={false}
              isLast={index === allSteps.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface StepLineProps {
  step: ThinkingStep;
  isStreaming: boolean;
  isLast?: boolean;
}

const StepLine: React.FC<StepLineProps> = ({ step, isStreaming, isLast = false }) => {
  const getIcon = () => {
    if (step.type === 'thinking') return Brain;

    switch (step.tool) {
      case 'Read':
      case 'Write':
        return FileText;
      case 'Glob':
      case 'Grep':
        return Search;
      case 'Bash':
        return Terminal;
      default:
        return Wrench;
    }
  };

  const getLabel = () => {
    if (step.type === 'thinking') return 'Thinking';

    switch (step.tool) {
      case 'Read': return 'Reading';
      case 'Write': return 'Writing';
      case 'Edit': return 'Editing';
      case 'Glob': return 'Searching';
      case 'Grep': return 'Searching';
      case 'Bash': return 'Running';
      default: return step.tool;
    }
  };

  const getDetail = () => {
    if (step.type === 'thinking') {
      // Truncate thinking message only when streaming
      if (isStreaming) {
        return step.message.length > 60
          ? step.message.substring(0, 60) + '...'
          : step.message;
      }
      return step.message;
    }

    if (step.filePath) {
      // Show full path when not streaming, filename when streaming
      if (isStreaming) {
        const fileName = step.filePath.split('/').pop();
        return fileName || step.filePath;
      }
      return step.filePath;
    }
    if (step.command) {
      // Show full command when not streaming
      if (isStreaming) {
        return step.command.length > 40
          ? step.command.substring(0, 40) + '...'
          : step.command;
      }
      return step.command;
    }
    if (step.pattern) {
      return step.pattern;
    }
    return '';
  };

  const Icon = getIcon();
  const label = getLabel();
  const detail = getDetail();

  if (isStreaming) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="flex items-center gap-2 text-base text-muted-foreground font-light"
      >
        <Icon className="w-3 h-3 flex-shrink-0 opacity-40" strokeWidth={1.5} />
        <span
          className="opacity-70 relative inline-block bg-gradient-to-r from-transparent via-muted-foreground/20 to-transparent bg-[length:200%_100%] animate-shimmer"
        >
          {label} {detail}
        </span>
      </motion.div>
    );
  }

  // Timeline layout for completed reasoning
  return (
    <div className="flex gap-2.5">
      {/* Timeline indicator */}
      <div className="flex flex-col items-center">
        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-secondary/40 flex-shrink-0">
          <Icon className="w-3 h-3 text-muted-foreground/80" strokeWidth={2} />
        </div>
        {!isLast && (
          <div className="w-px h-full min-h-[12px] bg-border/40 mt-1" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 pt-0 pb-0.5">
        <div className="text-xs text-foreground/90 font-medium">{label}</div>
        {detail && (
          <div className="text-xs text-muted-foreground/70 mt-0.5 break-words leading-tight">
            {detail}
          </div>
        )}
      </div>
    </div>
  );
};

ThinkingTimeline.displayName = 'ThinkingTimeline';
