/**
 * CommitInterface - Commit message input with AI generation and Smart Commit
 */

import { useState } from 'react';
import { Sparkles, Loader2, Check, RotateCcw, Upload, ChevronDown, GitCommit, Copy, FileText, Download, GitMerge, AlertCircle } from 'lucide-react';
import { useSmartCommit } from '@/hooks/useSmartCommit';
import type { GitWorkspaceState } from '../../../electron/gitHandlers';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

const ipcRenderer = window.electron.ipcRenderer;

interface CommitInterfaceProps {
  workspacePath: string;
  stagedCount: number;
  gitState?: GitWorkspaceState | null;
  onCommitSuccess: () => void;
}

export function CommitInterface({ workspacePath, stagedCount, gitState, onCommitSuccess }: CommitInterfaceProps) {
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>('All');

  // Smart Commit hook
  const {
    status: smartStatus,
    result: smartResult,
    error: smartError,
    completedShas,
    needsReview,
    reviewReason,
    execute: executeSmartCommit,
    undo: undoSmartCommit
  } = useSmartCommit(workspacePath);

  const getErrorHint = (errorMsg: string): string => {
    // Push errors
    if (errorMsg.includes('push_rejected') || errorMsg.includes('non-fast-forward')) {
      return 'Push rejected (non-fast-forward).\n💡 Ask Claude: "safely force push to remote"';
    }
    if (errorMsg.includes('no upstream') || errorMsg.includes('no tracking')) {
      return 'No upstream branch configured.\n💡 Ask Claude: "set upstream to origin/main"';
    }
    if (errorMsg.includes('auth') || errorMsg.includes('authentication')) {
      return 'Authentication failed.\n💡 Ask Claude: "help me configure git authentication"';
    }

    // Pull errors
    if (errorMsg.includes('merge_conflict') || errorMsg.includes('conflict')) {
      return 'Pull failed: merge conflicts detected.\n💡 Ask Claude: "resolve merge conflicts"';
    }
    if (errorMsg.includes('uncommitted_changes') || errorMsg.includes('uncommitted')) {
      return 'Pull blocked: uncommitted changes exist.\n💡 Ask Claude: "stash changes and pull"';
    }

    // Generic error - return as is
    return errorMsg;
  };

  const handlePush = async () => {
    setIsPushing(true);
    setError(null);

    try {
      const result = await ipcRenderer.invoke('git:push', workspacePath);

      if (result.success) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);
        onCommitSuccess();
      } else {
        const errorWithHint = getErrorHint(result.error || 'Failed to push');
        setError(errorWithHint);
      }
    } catch (err) {
      console.error('Failed to push:', err);
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(getErrorHint(errorMsg));
    } finally {
      setIsPushing(false);
    }
  };

  const handlePull = async () => {
    setIsPulling(true);
    setError(null);

    try {
      const result = await ipcRenderer.invoke('git:pull', workspacePath);

      if (result.success) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);
        onCommitSuccess();
      } else {
        const errorWithHint = getErrorHint(result.error || 'Failed to pull');
        setError(errorWithHint);
      }
    } catch (err) {
      console.error('Failed to pull:', err);
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(getErrorHint(errorMsg));
    } finally {
      setIsPulling(false);
    }
  };

  const handleSmartCommit = async (push: boolean = false, force: boolean = false) => {
    setError(null);

    try {
      const success = await executeSmartCommit(force);

      // If successful and push requested, push after commits complete
      if (success && push) {
        await handlePush();
      } else if (success) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);
        onCommitSuccess();
      }
    } catch (err) {
      console.error('Smart commit failed:', err);
      setError(err instanceof Error ? err.message : 'Smart commit failed');
    }
  };

  const handleUndoCommit = async () => {
    try {
      await undoSmartCommit();
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
      onCommitSuccess();
    } catch (err) {
      console.error('Undo failed:', err);
      setError(err instanceof Error ? err.message : 'Undo failed');
    }
  };

  // Get unique commit types for filtering
  const commitTypes = ['All', ...new Set(smartResult?.map(c => c.type) || [])];

  // Filter commits based on selected filter
  const filteredCommits = selectedFilter === 'All'
    ? smartResult
    : smartResult?.filter(c => c.type === selectedFilter);

  return (
    <div className="p-3 space-y-3">
      {/* Header: File count + Actions dropdown */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {stagedCount > 0 ? (
            <span className="font-medium text-foreground">{stagedCount} {stagedCount === 1 ? 'file' : 'files'} to commit</span>
          ) : (
            <span>No changes</span>
          )}
          {completedShas.length > 0 && (
            <>
              <span>•</span>
              <span className="font-medium text-foreground">{completedShas.length} {completedShas.length === 1 ? 'Commit' : 'Commits'}</span>
            </>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="inline-flex items-center gap-1 h-[28px] px-2 py-1 text-xs rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              disabled={smartStatus === 'analyzing' || smartStatus === 'executing' || isPulling || isPushing}
            >
              <Sparkles size={12} />
              <span>Commit</span>
              <ChevronDown size={12} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={handlePull} disabled={isPulling}>
              <Download size={14} className="mr-2" />
              Pull
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSmartCommit(false)} disabled={stagedCount === 0}>
              <GitCommit size={14} className="mr-2" />
              Commit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handlePush} disabled={isPushing}>
              <Upload size={14} className="mr-2" />
              Push
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Commit Type Filter Buttons */}
      {commitTypes.length > 1 && (
        <div className="flex items-center gap-1 flex-wrap">
          {commitTypes.map((type) => (
            <button
              key={type}
              onClick={() => setSelectedFilter(type)}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${
                selectedFilter === type
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      )}

      {/* Git State Indicator */}
      {gitState && (
        <>
          {/* Merging State */}
          {gitState.isMerging && (
            <div className="flex items-center gap-2 p-2 bg-orange-500/10 border border-orange-500/20 rounded-lg text-orange-600 text-xs">
              <GitMerge size={14} />
              <div className="flex-1">
                <span className="font-medium">Merge in progress</span>
                <div className="text-orange-600/80 mt-0.5">
                  💡 Ask Claude: "help me complete this merge"
                </div>
              </div>
            </div>
          )}

          {/* Rebasing State */}
          {gitState.isRebasing && (
            <div className="flex items-center gap-2 p-2 bg-purple-500/10 border border-purple-500/20 rounded-lg text-purple-600 text-xs">
              <GitMerge size={14} />
              <div className="flex-1">
                <span className="font-medium">Rebase in progress</span>
                <div className="text-purple-600/80 mt-0.5">
                  💡 Ask Claude: "help me complete this rebase"
                </div>
              </div>
            </div>
          )}

          {/* Conflicts State */}
          {gitState.hasConflicts && (
            <div className="flex items-center gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-600 text-xs">
              <AlertCircle size={14} />
              <div className="flex-1">
                <span className="font-medium">Conflicts detected</span>
                <div className="text-red-600/80 mt-0.5">
                  💡 Ask Claude: "resolve conflicts"
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Success Message */}
      {showSuccess && (
        <div className="flex items-center gap-2 p-2 bg-green-500/10 border border-green-500/20 rounded-lg text-green-600 text-sm">
          <Check size={16} />
          <span>Committed successfully!</span>
        </div>
      )}

      {/* Error Message */}
      {(error || smartError) && !needsReview && (
        <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-600 text-xs">
          <div className="whitespace-pre-line">
            {error || smartError}
          </div>
        </div>
      )}

      {/* Review Warning */}
      {needsReview && reviewReason && (
        <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg space-y-2">
          <div className="flex items-start gap-2 text-yellow-700 dark:text-yellow-500">
            <span className="text-base">⚠️</span>
            <div className="flex-1">
              <div className="font-semibold text-sm mb-1">검토 필요</div>
              <div className="text-xs">{reviewReason}</div>
            </div>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => handleSmartCommit(false, true)}
              className="inline-flex items-center gap-1.5 h-[32px] px-2 py-1.5 text-sm rounded-md bg-yellow-600 hover:bg-yellow-700 text-white transition-colors"
            >
              <Sparkles size={14} />
              <span className="font-light">무시하고 커밋</span>
            </button>
            <button
              onClick={() => handleSmartCommit(true, true)}
              className="inline-flex items-center gap-1.5 flex-1 h-[32px] px-2 py-1.5 text-sm rounded-md bg-yellow-600 hover:bg-yellow-700 text-white transition-colors"
            >
              <Sparkles size={14} />
              <Upload size={14} />
              <span className="font-light">무시하고 커밋 & 푸시</span>
            </button>
          </div>
        </div>
      )}

      {/* Smart Commit Status */}
      {smartStatus !== 'idle' && smartStatus !== 'error' && smartStatus !== 'complete' && (
        <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <div className="flex items-center gap-2 text-blue-600 text-sm">
            {smartStatus === 'analyzing' && (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Analyzing changes...</span>
              </>
            )}
            {smartStatus === 'executing' && (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Creating commits...</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Commit Results - Show completed commits */}
      {smartStatus === 'complete' && filteredCommits && completedShas.length > 0 && (
        <div className="space-y-2">
          {filteredCommits.map((commit, idx) => {
            const sha = completedShas[idx]?.substring(0, 7) || '---';
            const commitTypeColors: Record<string, string> = {
              feat: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
              fix: 'bg-red-500/10 text-red-600 border-red-500/20',
              refactor: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
              docs: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
              test: 'bg-green-500/10 text-green-600 border-green-500/20',
              chore: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
              style: 'bg-pink-500/10 text-pink-600 border-pink-500/20',
              perf: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
            };
            const colorClass = commitTypeColors[commit.type] || 'bg-gray-500/10 text-gray-600 border-gray-500/20';

            return (
              <div
                key={commit.id}
                className="p-3 rounded-md space-y-3 hover:bg-sidebar-accent transition-colors cursor-pointer"
              >
                {/* Header: Type badge + SHA + Actions menu */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-xs font-mono px-2 py-0.5 ${colorClass}`}>
                      {commit.type}
                    </Badge>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(completedShas[idx] || '');
                      }}
                      className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
                      title="Copy SHA"
                    >
                      {sha}
                    </button>
                    <span className="text-xs text-muted-foreground">• just now</span>
                    <span className="text-xs text-muted-foreground">
                      • {commit.files.length} {commit.files.length === 1 ? 'file' : 'files'} changed
                    </span>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1 rounded hover:bg-background transition-colors">
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className="text-muted-foreground">
                          <circle cx="8" cy="2" r="1.5" />
                          <circle cx="8" cy="8" r="1.5" />
                          <circle cx="8" cy="14" r="1.5" />
                        </svg>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36">
                      <DropdownMenuItem onClick={() => {/* TODO: View Diff */}}>
                        <FileText size={14} className="mr-2" />
                        View Diff
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleUndoCommit}>
                        <RotateCcw size={14} className="mr-2" />
                        Undo
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        navigator.clipboard.writeText(completedShas[idx] || '');
                      }}>
                        <Copy size={14} className="mr-2" />
                        Copy SHA
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Commit message */}
                <div className="text-xs text-foreground line-clamp-2">
                  {commit.title}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state - No commits yet */}
      {smartStatus === 'idle' && !smartResult && !needsReview && !error && stagedCount === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <GitCommit size={32} className="text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">No recent commits</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Make changes and commit to see them here</p>
        </div>
      )}

      {/* Helper text */}
      <div className="text-xs text-muted-foreground">
        💡 Smart commits automatically create logical, atomic commits
      </div>
    </div>
  );
}
