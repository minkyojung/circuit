import React from 'react';
import { Zap, Clock, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UsageBarProps {
  input: number;
  output: number;
  total: number;
  percentage: number;
  planLimit: number;
  burnRate: number;
  timeLeft: number;
}

export const UsageBar: React.FC<UsageBarProps> = ({
  input,
  output,
  total,
  percentage,
  planLimit,
  burnRate,
  timeLeft
}) => {
  const getColor = () => {
    if (percentage >= 90) return 'text-red-500 dark:text-red-400';
    if (percentage >= 70) return 'text-yellow-500 dark:text-yellow-400';
    return 'text-green-500 dark:text-green-400';
  };

  const getProgressColor = () => {
    if (percentage >= 90) return 'bg-red-500/80';
    if (percentage >= 70) return 'bg-yellow-500/80';
    return 'bg-green-500/80';
  };

  const formatTokens = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toString();

  const formatTime = (minutes: number) => {
    if (minutes === Infinity || minutes > 1000) return '∞';
    const h = Math.floor(minutes / 60);
    const m = Math.floor(minutes % 60);
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
  };

  return (
    <div className={cn(
      "rounded-lg p-3 space-y-2",
      "bg-black/20 dark:bg-white/5",
      "backdrop-blur-sm border border-white/10"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap size={14} className={getColor()} />
          <span className="text-xs font-medium text-sidebar-foreground opacity-90">
            Usage (5h)
          </span>
        </div>
        <span className="text-xs font-mono text-sidebar-foreground-muted">
          {formatTokens(total)} / {formatTokens(planLimit)}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="relative h-1.5 bg-black/20 dark:bg-white/10 rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full transition-all duration-300 rounded-full",
            getProgressColor()
          )}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>

      {/* Metadata */}
      <div className="flex items-center justify-between text-[10px] text-sidebar-foreground-muted">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <TrendingUp size={10} />
            <span>{formatTokens(burnRate)}/hr</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock size={10} />
            <span>{formatTime(timeLeft)} left</span>
          </div>
        </div>
        <span className={cn("font-medium", getColor())}>
          {percentage.toFixed(1)}%
        </span>
      </div>
    </div>
  );
};
