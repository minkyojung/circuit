import React from 'react';
import { GitBranch, ArrowUp, ArrowDown, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import type { GitWorkspaceState } from '../../../electron/gitHandlers';

interface GitStateIndicatorProps {
  state: GitWorkspaceState;
  compact?: boolean;
}

/**
 * GitStateIndicator displays the current Git workspace state
 * Shows branch, ahead/behind status, uncommitted changes, and AI recommendations
 */
export const GitStateIndicator: React.FC<GitStateIndicatorProps> = ({ state, compact = false }) => {
  // Generate AI recommendation based on state
  const getRecommendation = (): { message: string; type: 'info' | 'warning' | 'error' | 'success' } => {
    // Critical states first
    if (state.hasConflicts) {
      return {
        message: 'Merge conflicts detected. Resolve conflicts before continuing.',
        type: 'error'
      };
    }

    if (state.isRebasing) {
      return {
        message: 'Rebase in progress. Complete or abort the rebase.',
        type: 'warning'
      };
    }

    if (state.isMerging) {
      return {
        message: 'Merge in progress. Complete or abort the merge.',
        type: 'warning'
      };
    }

    // Normal workflow recommendations
    if (state.uncommitted > 0 && state.behind > 0) {
      return {
        message: `You have ${state.uncommitted} uncommitted change(s) and are ${state.behind} commit(s) behind. Commit first, then pull.`,
        type: 'warning'
      };
    }

    if (state.uncommitted > 0) {
      return {
        message: `You have ${state.uncommitted} uncommitted change(s). Ready to commit.`,
        type: 'info'
      };
    }

    if (state.behind > 0 && state.ahead > 0) {
      return {
        message: `Your branch has diverged (${state.ahead} ahead, ${state.behind} behind). Pull to sync with remote.`,
        type: 'warning'
      };
    }

    if (state.behind > 0) {
      return {
        message: `You're ${state.behind} commit(s) behind. Pull to get latest changes.`,
        type: 'info'
      };
    }

    if (state.ahead > 0) {
      return {
        message: `You have ${state.ahead} unpushed commit(s). Ready to push.`,
        type: 'info'
      };
    }

    if (!state.upstreamBranch) {
      return {
        message: 'No upstream branch set. First push will set up tracking.',
        type: 'info'
      };
    }

    return {
      message: 'Working tree clean. Everything up to date.',
      type: 'success'
    };
  };

  const recommendation = getRecommendation();

  if (compact) {
    // Compact mode: single line with essential info
    return (
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <GitBranch size={12} />
          <span className="font-medium text-foreground">{state.currentBranch}</span>
        </div>

        {state.uncommitted > 0 && (
          <span className="text-amber-500">{state.uncommitted} uncommitted</span>
        )}

        {state.ahead > 0 && (
          <div className="flex items-center gap-1 text-blue-500">
            <ArrowUp size={12} />
            <span>{state.ahead}</span>
          </div>
        )}

        {state.behind > 0 && (
          <div className="flex items-center gap-1 text-orange-500">
            <ArrowDown size={12} />
            <span>{state.behind}</span>
          </div>
        )}

        {state.hasConflicts && (
          <span className="text-destructive">Conflicts!</span>
        )}
      </div>
    );
  }

  // Full mode: detailed state with recommendation
  return (
    <div className="bg-muted border border-border rounded-lg p-3 space-y-3">
      {/* Branch and sync status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch size={16} className="text-primary" />
          <span className="text-sm font-medium text-foreground">{state.currentBranch}</span>
          {state.upstreamBranch && (
            <span className="text-xs text-muted-foreground">→ {state.upstreamBranch}</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Ahead/Behind indicators */}
          {state.ahead > 0 && (
            <div className="flex items-center gap-1 text-xs text-blue-500">
              <ArrowUp size={14} />
              <span className="font-medium">{state.ahead}</span>
            </div>
          )}

          {state.behind > 0 && (
            <div className="flex items-center gap-1 text-xs text-orange-500">
              <ArrowDown size={14} />
              <span className="font-medium">{state.behind}</span>
            </div>
          )}

          {state.ahead === 0 && state.behind === 0 && state.upstreamBranch && (
            <div className="flex items-center gap-1 text-xs text-green-500">
              <CheckCircle2 size={14} />
              <span>Up to date</span>
            </div>
          )}
        </div>
      </div>

      {/* Uncommitted changes breakdown */}
      {state.uncommitted > 0 && (
        <div className="flex items-center gap-4 text-xs">
          {state.staged > 0 && (
            <span className="text-green-600">
              <strong>{state.staged}</strong> staged
            </span>
          )}
          {state.unstaged > 0 && (
            <span className="text-amber-600">
              <strong>{state.unstaged}</strong> unstaged
            </span>
          )}
          {state.untracked > 0 && (
            <span className="text-muted-foreground">
              <strong>{state.untracked}</strong> untracked
            </span>
          )}
        </div>
      )}

      {/* AI Recommendation */}
      <div
        className={`flex items-start gap-2 p-2 rounded text-xs ${
          recommendation.type === 'error'
            ? 'bg-destructive/10 text-destructive'
            : recommendation.type === 'warning'
            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
            : recommendation.type === 'success'
            ? 'bg-green-500/10 text-green-700 dark:text-green-400'
            : 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
        }`}
      >
        {recommendation.type === 'error' && <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />}
        {recommendation.type === 'warning' && <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />}
        {recommendation.type === 'success' && <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" />}
        {recommendation.type === 'info' && <Info size={14} className="flex-shrink-0 mt-0.5" />}
        <span>{recommendation.message}</span>
      </div>

      {/* Special states warnings */}
      {(state.isMerging || state.isRebasing) && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded p-2 text-xs text-amber-700 dark:text-amber-400">
          <div className="flex items-center gap-1 font-medium">
            <AlertTriangle size={12} />
            {state.isMerging && 'Merge in progress'}
            {state.isRebasing && 'Rebase in progress'}
          </div>
        </div>
      )}
    </div>
  );
};
