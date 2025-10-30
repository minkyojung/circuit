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

// Group steps by action type for Perplexity-style display
interface StepSection {
  type: 'searching' | 'reading' | 'thinking' | 'running';
  label: string;
  steps: ThinkingStep[];
}

function organizeStepsIntoSections(steps: ThinkingStep[]): StepSection[] {
  const sections: StepSection[] = [];

  // Group search steps
  const searchSteps = steps.filter(s =>
    s.tool === 'Glob' || s.tool === 'Grep'
  );
  if (searchSteps.length > 0) {
    sections.push({
      type: 'searching',
      label: 'Searching',
      steps: searchSteps
    });
  }

  // Group read/write steps
  const fileSteps = steps.filter(s =>
    s.tool === 'Read' || s.tool === 'Write' || s.tool === 'Edit'
  );
  if (fileSteps.length > 0) {
    sections.push({
      type: 'reading',
      label: `Reading ${fileSteps.length} file${fileSteps.length > 1 ? 's' : ''}`,
      steps: fileSteps
    });
  }

  // Group bash/terminal steps
  const bashSteps = steps.filter(s => s.tool === 'Bash');
  if (bashSteps.length > 0) {
    sections.push({
      type: 'running',
      label: 'Running commands',
      steps: bashSteps
    });
  }

  // Group thinking steps
  const thinkingSteps = steps.filter(s => s.type === 'thinking');
  if (thinkingSteps.length > 0) {
    sections.push({
      type: 'thinking',
      label: 'Thinking',
      steps: thinkingSteps
    });
  }

  return sections;
}

function generateSummary(steps: ThinkingStep[]): string {
  const hasSearch = steps.some(s => s.tool === 'Glob' || s.tool === 'Grep');
  const fileCount = steps.filter(s => s.tool === 'Read' || s.tool === 'Write' || s.tool === 'Edit').length;
  const hasThinking = steps.some(s => s.type === 'thinking');

  const parts = [];
  if (hasSearch) parts.push('searching codebase');
  if (fileCount > 0) parts.push(`analyzing ${fileCount} file${fileCount > 1 ? 's' : ''}`);
  if (hasThinking) parts.push('processing information');

  return parts.length > 0
    ? `Completing task by ${parts.join(', ')}.`
    : 'Processing your request.';
}

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

  // For completed reasoning, use Perplexity-style sections
  if (!isStreaming) {
    const sections = organizeStepsIntoSections(allSteps);
    const summary = generateSummary(allSteps);

    return (
      <div className={className}>
        {/* Summary sentence */}
        <div className="text-xs text-muted-foreground/70 mb-4 leading-relaxed">
          {summary}
        </div>

        {/* Sections */}
        <div className="space-y-6">
          {sections.map((section, idx) => (
            <Section key={idx} section={section} />
          ))}
        </div>

        {/* Finished marker */}
        <div className="mt-4 text-xs text-muted-foreground/50">
          Finished
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
              isStreaming={isStreaming}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

// Section component for Perplexity-style display
interface SectionProps {
  section: StepSection;
}

const Section: React.FC<SectionProps> = ({ section }) => {
  // For search queries, show as horizontal pills
  if (section.type === 'searching') {
    return (
      <div className="space-y-2">
        <div className="text-sm font-medium text-foreground/80">{section.label}</div>
        <div className="flex flex-wrap gap-2">
          {section.steps.map((step, idx) => (
            <div
              key={idx}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary/50 text-xs text-muted-foreground/80"
            >
              <Search className="w-3 h-3" strokeWidth={2} />
              <span>{step.pattern || 'searching'}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // For files, show as list with filenames only
  if (section.type === 'reading') {
    return (
      <div className="space-y-2">
        <div className="text-sm font-medium text-foreground/80">{section.label}</div>
        <div className="space-y-1.5">
          {section.steps.map((step, idx) => {
            const fileName = step.filePath?.split('/').pop() || 'file';
            const fullPath = step.filePath || '';

            return (
              <div
                key={idx}
                className="flex items-center gap-2 px-3 py-2 rounded-md bg-secondary/30 hover:bg-secondary/40 transition-colors"
                title={fullPath}
              >
                <FileText className="w-3 h-3 text-muted-foreground/60 flex-shrink-0" strokeWidth={2} />
                <span className="text-xs text-foreground/80 truncate">{fileName}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // For other types, show as simple list
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-foreground/80">{section.label}</div>
      <div className="space-y-1.5">
        {section.steps.map((step, idx) => {
          const Icon = section.type === 'thinking' ? Brain : Terminal;
          const detail = step.message || step.command || '';

          return (
            <div
              key={idx}
              className="flex items-start gap-2 px-3 py-2 rounded-md bg-secondary/30"
            >
              <Icon className="w-3 h-3 text-muted-foreground/60 flex-shrink-0 mt-0.5" strokeWidth={2} />
              <span className="text-xs text-muted-foreground/70 leading-relaxed break-words">
                {detail}
              </span>
            </div>
          );
        })}
      </div>
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
