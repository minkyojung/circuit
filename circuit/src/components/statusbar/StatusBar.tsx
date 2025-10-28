import React, { useState } from 'react';
import { RefreshCw, ChevronUp, ChevronDown, Zap, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useClaudeMetrics } from '@/hooks/useClaudeMetrics';

export const StatusBar: React.FC = () => {
  const { metrics, loading, refresh } = useClaudeMetrics();
  const [isExpanded, setIsExpanded] = useState(false);

  if (loading || !metrics) {
    return (
      <div className="h-5 border-t border-statusbar-border bg-statusbar flex items-center justify-center">
        <span className="text-[10px] text-statusbar-value">Loading...</span>
      </div>
    );
  }

  const { usage, context } = metrics;

  // Debug: Log percentage values
  console.log('[StatusBar] Usage:', usage.percentage, '% Context:', context.percentage, '%');

  const formatTime = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const formatTokens = (n: number) => `${(n / 1000).toFixed(1)}k`;

  // Helper to get progress bar color
  const getProgressColor = (percentage: number) => {
    if (percentage >= 95) return 'var(--statusbar-progress-red)';
    if (percentage >= 85) return 'var(--statusbar-progress-yellow)';
    if (percentage >= 70) return 'var(--statusbar-progress-orange)';
    return 'var(--statusbar-progress-green)';
  };

  return (
    <div className="relative">
      {/* Main status bar */}
      <div
        className={cn(
          "h-5 border-t border-statusbar-border bg-statusbar",
          "flex items-center px-3 gap-2.5",
          "transition-all duration-200",
          isExpanded && "border-b border-statusbar-border"
        )}
      >
        {/* Spacer - push everything to the right */}
        <div className="flex-1" />

        {/* Usage - minimal */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-statusbar-label font-normal">Usage</span>
          <div
            style={{
              width: '64px',
              height: '12px',
              backgroundColor: 'var(--statusbar-progress-bg)',
              borderRadius: '9999px',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                height: '100%',
                width: `${Math.max(Math.min(usage.percentage, 100), 5)}%`,
                backgroundColor: getProgressColor(usage.percentage),
                borderRadius: '9999px',
                transition: 'width 400ms cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            />
          </div>
          <span className="text-[10px] text-statusbar-value font-mono min-w-[26px] text-right">
            {usage.percentage.toFixed(0)}%
          </span>
        </div>

        {/* Divider */}
        <div className="w-px h-2.5 bg-statusbar-border" />

        {/* Context - minimal */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-statusbar-label font-normal">Context</span>
          <div
            style={{
              width: '64px',
              height: '12px',
              backgroundColor: 'var(--statusbar-progress-bg)',
              borderRadius: '9999px',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                height: '100%',
                width: `${Math.max(Math.min(context.percentage, 100), 5)}%`,
                backgroundColor: getProgressColor(context.percentage),
                borderRadius: '9999px',
                transition: 'width 400ms cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            />
          </div>
          <span className="text-[10px] text-statusbar-value font-mono min-w-[26px] text-right">
            {context.percentage.toFixed(0)}%
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 ml-1.5">
          <button
            onClick={refresh}
            className="p-0.5 rounded hover:bg-statusbar-progress-bg transition-colors"
            title="Refresh metrics"
          >
            <RefreshCw size={9} className="text-statusbar-value" />
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-0.5 rounded hover:bg-statusbar-progress-bg transition-colors"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <ChevronDown size={9} className="text-statusbar-value" />
            ) : (
              <ChevronUp size={9} className="text-statusbar-value" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded panel */}
      {isExpanded && (
        <div className="absolute bottom-5 left-0 right-0 bg-statusbar border-t border-statusbar-border p-3 shadow-lg animate-in slide-in-from-bottom duration-200">
          <div className="grid grid-cols-2 gap-4 text-[10px]">
            {/* Usage details */}
            <div className="space-y-1.5">
              <div className="font-semibold text-statusbar-label flex items-center gap-1.5">
                <Zap size={12} />
                Usage (5h window)
              </div>
              <div className="space-y-0.5 text-statusbar-value pl-5">
                <div className="flex justify-between">
                  <span>Total:</span>
                  <span className="font-mono">{formatTokens(usage.total)} / {formatTokens(usage.planLimit)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Rate:</span>
                  <span className="font-mono">{formatTokens(usage.burnRate)}/hr</span>
                </div>
                <div className="flex justify-between">
                  <span>Resets in:</span>
                  <span className="font-mono">{formatTime(usage.resetTime)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Time left:</span>
                  <span className="font-mono">{formatTime(usage.timeLeft)}</span>
                </div>
              </div>
            </div>

            {/* Context details */}
            <div className="space-y-1.5">
              <div className="font-semibold text-statusbar-label flex items-center gap-1.5">
                <Brain size={12} />
                Context Window
              </div>
              <div className="space-y-0.5 text-statusbar-value pl-5">
                <div className="flex justify-between">
                  <span>Current:</span>
                  <span className="font-mono">{formatTokens(context.current)} / {formatTokens(context.limit)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Prunable:</span>
                  <span className="font-mono">~{formatTokens(context.prunableTokens)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Last compact:</span>
                  <span className="font-mono">{context.lastCompact || 'Never'}</span>
                </div>
                {context.shouldCompact && (
                  <div className="mt-2 pt-1.5 border-t border-statusbar-border">
                    <button
                      className="w-full py-1 px-2 rounded font-medium transition-colors"
                      style={{
                        backgroundColor: 'rgba(var(--statusbar-progress-yellow), 0.2)',
                        color: 'var(--statusbar-progress-yellow)'
                      }}
                    >
                      Compact Now
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
