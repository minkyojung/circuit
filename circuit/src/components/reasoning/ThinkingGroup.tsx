import React from 'react';
import { Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StepGroup, ThinkingStep } from '@/types/thinking';
import { formatDuration } from '@/lib/thinkingUtils';

interface ThinkingGroupProps {
  group: StepGroup;
  className?: string;
}

export const ThinkingGroup: React.FC<ThinkingGroupProps> = ({ group, className }) => {
  return (
    <div className={cn('border-l border-border/40 pl-3 py-2 space-y-1.5', className)}>
      {/* Group Header */}
      <div className="flex items-center gap-2 mb-2">
        <Circle className="w-2 h-2 fill-current text-muted-foreground/50" />
        <span className="text-xs font-medium text-muted-foreground">{group.label}</span>
        {group.duration > 0 && (
          <span className="text-[10px] text-muted-foreground/60">
            {formatDuration(group.duration)}
          </span>
        )}
      </div>

      {/* Steps */}
      <div className="space-y-1">
        {group.steps.map((step, index) => (
          <ThinkingStepItem key={index} step={step} />
        ))}
      </div>
    </div>
  );
};

interface ThinkingStepItemProps {
  step: ThinkingStep;
}

const ThinkingStepItem: React.FC<ThinkingStepItemProps> = ({ step }) => {
  if (step.type === 'thinking') {
    return (
      <div className="text-xs text-muted-foreground/70 leading-relaxed pl-4">
        {step.message}
      </div>
    );
  }

  // Tool use - simple inline format
  const detail = getToolDetail(step);
  return (
    <div className="text-xs pl-4">
      <span className="text-foreground/80 font-mono">{step.tool}</span>
      {detail && (
        <span className="text-muted-foreground/60 ml-1.5">{detail}</span>
      )}
    </div>
  );
};

function getToolDetail(step: ThinkingStep): string {
  if (step.filePath) {
    const fileName = step.filePath.split('/').pop();
    return fileName || step.filePath;
  }
  if (step.command) {
    return step.command.length > 30 ? step.command.substring(0, 30) + '...' : step.command;
  }
  if (step.pattern) {
    return step.pattern;
  }
  return '';
}

ThinkingGroup.displayName = 'ThinkingGroup';
