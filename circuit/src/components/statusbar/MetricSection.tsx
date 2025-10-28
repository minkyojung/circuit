import React from 'react';
import { cn } from '@/lib/utils';
import { ProgressBar } from './ProgressBar';

interface MetricSectionProps {
  icon: React.ReactNode;
  label: string;
  percentage: number;
  detail?: string;
  className?: string;
}

export const MetricSection: React.FC<MetricSectionProps> = ({
  icon,
  label,
  percentage,
  detail,
  className
}) => {
  return (
    <div className={cn("flex items-center gap-2 flex-1", className)}>
      {/* Icon + Label */}
      <div className="flex items-center gap-1.5 min-w-[80px]">
        <span className="text-xs opacity-80">{icon}</span>
        <span className="text-[10px] font-medium text-white/70">{label}</span>
      </div>

      {/* Progress bar */}
      <ProgressBar
        percentage={percentage}
        className="flex-1 max-w-[120px]"
      />

      {/* Optional detail */}
      {detail && (
        <span className="text-[9px] text-white/50 min-w-[60px] text-right">
          {detail}
        </span>
      )}
    </div>
  );
};
