import React, { useState } from 'react';
import { RefreshCw, ChevronUp, ChevronDown, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkspaceContext } from '@/hooks/useWorkspaceContext';
import { CompactIndicator } from './CompactIndicator';

interface Workspace {
  id: string;
  path: string;
  displayName?: string;
  name: string;
}

interface StatusBarProps {
  selectedWorkspace?: Workspace | null;
}

export const StatusBar: React.FC<StatusBarProps> = ({ selectedWorkspace }) => {
  const { context, loading, error, refresh } = useWorkspaceContext(
    selectedWorkspace?.id,
    selectedWorkspace?.path
  );
  const [isExpanded, setIsExpanded] = useState(false);

  // No workspace selected - show minimal hint
  if (!selectedWorkspace) {
    return (
      <div className="h-5 border-t border-statusbar-border bg-statusbar flex items-center justify-end px-3">
        <span className="text-[10px] text-statusbar-value opacity-60">Select workspace</span>
      </div>
    );
  }

  // Loading/Waiting state (waiting for Claude Code session to start)
  if (loading) {
    return (
      <div className="h-5 border-t border-statusbar-border bg-statusbar flex items-center justify-end px-3 gap-2">
        <div className="flex items-center gap-1.5">
          <div className="w-1 h-1 rounded-full bg-statusbar-value opacity-60 animate-pulse" />
          <span className="text-[10px] text-statusbar-value opacity-60">Waiting for session</span>
        </div>
      </div>
    );
  }

  // Error state (actual errors, not "no session" which is now handled in loading)
  if (error) {
    return (
      <div className="h-5 border-t border-statusbar-border bg-statusbar flex items-center justify-end px-3">
        <span className="text-[10px] text-statusbar-value opacity-60">{error}</span>
      </div>
    );
  }

  // No context but not loading - shouldn't happen with new architecture, but handle gracefully
  if (!context) {
    return (
      <div className="h-5 border-t border-statusbar-border bg-statusbar flex items-center justify-end px-3 gap-2">
        <div className="flex items-center gap-1.5">
          <div className="w-1 h-1 rounded-full bg-statusbar-value opacity-60 animate-pulse" />
          <span className="text-[10px] text-statusbar-value opacity-60">Waiting for session</span>
        </div>
      </div>
    );
  }

  const formatTokens = (n: number) => `${(n / 1000).toFixed(1)}k`;

  const formatLastCompact = (timestamp: string | null) => {
    if (!timestamp) return 'Never';

    const now = Date.now();
    const compactTime = new Date(timestamp).getTime();
    const minutesAgo = Math.floor((now - compactTime) / 60000);

    if (minutesAgo < 1) return 'Just now';
    if (minutesAgo < 60) return `${minutesAgo}m ago`;

    const hoursAgo = Math.floor(minutesAgo / 60);
    if (hoursAgo < 24) return `${hoursAgo}h ago`;

    const daysAgo = Math.floor(hoursAgo / 24);
    return `${daysAgo}d ago`;
  };

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
          "flex items-center px-3 gap-2",
          "transition-all duration-200",
          isExpanded && "border-b border-statusbar-border"
        )}
      >
        {/* Spacer - push everything to the right */}
        <div className="flex-1" />

        {/* Context - minimal */}
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-statusbar-label font-normal">Context</span>
          <div
            style={{
              width: '56px',
              height: '8px',
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
          <span className="text-[9px] text-statusbar-value font-mono min-w-[24px] text-right">
            {context.percentage.toFixed(0)}%
          </span>
        </div>

        {/* Compact Warning Indicator */}
        <CompactIndicator
          workspaceId={selectedWorkspace?.id}
          workspacePath={selectedWorkspace?.path}
        />

        {/* Actions */}
        <div className="flex items-center gap-0.5 ml-1.5">
          <button
            onClick={refresh}
            className="p-0.5 rounded hover:bg-statusbar-progress-bg transition-colors"
            title="Refresh context"
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
          <div className="text-[10px] max-w-md">
            {/* Context details */}
            <div className="space-y-1.5">
              <div className="font-semibold text-statusbar-label flex items-center gap-1.5">
                <Brain size={12} />
                Context Window
              </div>
              <div className="space-y-0.5 text-statusbar-value pl-5">
                <div className="flex justify-between">
                  <span>Workspace:</span>
                  <span className="font-mono">{selectedWorkspace.displayName || selectedWorkspace.name}</span>
                </div>
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
                  <span className="font-mono">{formatLastCompact(context.lastCompact)}</span>
                </div>
                {context.shouldCompact && (
                  <div className="mt-2 pt-1.5 border-t border-statusbar-border">
                    <button
                      className="w-full py-1 px-2 rounded font-medium transition-colors text-[9px]"
                      style={{
                        backgroundColor: 'var(--statusbar-progress-yellow)',
                        opacity: 0.2,
                        color: 'var(--statusbar-label)'
                      }}
                    >
                      Run /compact in Claude Code
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
