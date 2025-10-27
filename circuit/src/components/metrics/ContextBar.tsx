import React from 'react';
import { Brain, Archive, Recycle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ContextBarProps {
  current: number;
  limit: number;
  percentage: number;
  lastCompact: string | null;
  prunableTokens: number;
  shouldCompact: boolean;
  onCompact?: () => void;
  onRefresh?: () => void;
}

export const ContextBar: React.FC<ContextBarProps> = ({
  current,
  limit,
  percentage,
  lastCompact,
  prunableTokens,
  shouldCompact,
  onCompact,
  onRefresh
}) => {
  const getColor = () => {
    if (percentage >= 95) return 'text-red-500 dark:text-red-400';
    if (percentage >= 80) return 'text-yellow-500 dark:text-yellow-400';
    return 'text-green-500 dark:text-green-400';
  };

  const getProgressColor = () => {
    if (percentage >= 95) return 'bg-red-500/80';
    if (percentage >= 80) return 'bg-yellow-500/80';
    return 'bg-green-500/80';
  };

  const formatTokens = (n: number) => `${(n / 1000).toFixed(0)}k`;

  const formatTimeSince = (dateStr: string | null): string => {
    if (!dateStr) return 'Never';

    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = now - then;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
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
          <Brain size={14} className={getColor()} />
          <span className="text-xs font-medium text-sidebar-foreground opacity-90">
            Context
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-black/20 dark:bg-white/10 text-sidebar-foreground-muted">
            ~estimated
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-0.5 rounded hover:bg-sidebar-accent transition-colors"
              title="Refresh metrics"
            >
              <RefreshCw size={10} className="text-sidebar-foreground-muted" />
            </button>
          )}
          <span className="text-xs font-mono text-sidebar-foreground-muted">
            {formatTokens(current)} / {formatTokens(limit)}
          </span>
        </div>
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
            <Archive size={10} />
            <span>Compacted {formatTimeSince(lastCompact)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Recycle size={10} />
            <span>~{formatTokens(prunableTokens)} prunable</span>
          </div>
        </div>
        <span className={cn("font-medium", getColor())}>
          {percentage.toFixed(1)}%
        </span>
      </div>

      {/* Compact Button */}
      {shouldCompact && onCompact && (
        <Button
          size="sm"
          variant="outline"
          className="w-full h-7 text-xs gap-1.5"
          onClick={onCompact}
        >
          <Archive size={12} />
          Compact Now
        </Button>
      )}
    </div>
  );
};
