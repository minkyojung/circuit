import React from 'react';
import { cn } from '@/lib/utils';

interface ProgressBarProps {
  percentage: number;
  className?: string;
  barClassName?: string;
  showLabel?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  percentage,
  className,
  barClassName,
  showLabel = true
}) => {
  const getColor = () => {
    if (percentage >= 95) return 'bg-[var(--statusbar-progress-red)]';
    if (percentage >= 85) return 'bg-[var(--statusbar-progress-yellow)]';
    if (percentage >= 70) return 'bg-[var(--statusbar-progress-orange)]';
    return 'bg-[var(--statusbar-progress-green)]';
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Progress bar */}
      <div className="relative h-1.5 flex-1 bg-[var(--state-hover)] rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full transition-all duration-300 rounded-full",
            getColor(),
            barClassName
          )}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>

      {/* Percentage label */}
      {showLabel && (
        <span className="text-[10px] font-mono text-[var(--label-secondary)] min-w-[32px] text-right">
          {percentage.toFixed(0)}%
        </span>
      )}
    </div>
  );
};
