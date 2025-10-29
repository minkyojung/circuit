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
      <div className="space-y-1">
        <AnimatePresence mode="popLayout">
          {visibleSteps.map((step) => (
            <StepLine
              key={step.timestamp}
              step={step}
              isStreaming={isStreaming}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

interface StepLineProps {
  step: ThinkingStep;
  isStreaming: boolean;
}

const StepLine: React.FC<StepLineProps> = ({ step, isStreaming }) => {
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex items-center gap-2 text-base text-muted-foreground font-thin"
    >
      <Icon className="w-3 h-3 flex-shrink-0 opacity-40" strokeWidth={1.5} />
      {isStreaming ? (
        <span
          className="opacity-70 relative inline-block bg-gradient-to-r from-transparent via-muted-foreground/20 to-transparent bg-[length:200%_100%] animate-shimmer"
        >
          {label} {detail}
        </span>
      ) : (
        <>
          <span className="opacity-70">{label}</span>
          {detail && <span className="opacity-50 break-words">{detail}</span>}
        </>
      )}
    </motion.div>
  );
};

ThinkingTimeline.displayName = 'ThinkingTimeline';
