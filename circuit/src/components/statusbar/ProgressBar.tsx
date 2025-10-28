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
    if (percentage >= 95) return 'bg-red-500/80';
    if (percentage >= 85) return 'bg-yellow-500/80';
    if (percentage >= 70) return 'bg-orange-500/80';
    return 'bg-green-500/80';
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Progress bar */}
      <div className="relative h-1.5 flex-1 bg-white/10 rounded-full overflow-hidden">
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
        <span className="text-[10px] font-mono text-white/70 min-w-[32px] text-right">
          {percentage.toFixed(0)}%
        </span>
      )}
    </div>
  );
};
