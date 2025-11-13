import React, { useState, useEffect } from 'react';
import type { Workspace } from '@/types/workspace';
import { X, GitCommit, GitPullRequest, Loader2, GitMerge, GitBranch, ArrowUp, ArrowDown, FileText, ChevronDown, ChevronRight } from 'lucide-react';
import type { GitWorkspaceState } from '../../../electron/gitHandlers';

const ipcRenderer = window.electron.ipcRenderer;

interface CommitDialogProps {
  workspace: Workspace;
  onClose: () => void;
  onSuccess: () => void;
  onRequestDirectEdit: (message: string) => void;
}

export const CommitDialog: React.FC<CommitDialogProps> = ({
  workspace,
  onClose,
  onSuccess,
  onRequestDirectEdit
}) => {
  const [diff, setDiff] = useState<string>('');
  const [isLoadingDiff, setIsLoadingDiff] = useState(true);
  const [gitState, setGitState] = useState<GitWorkspaceState | null>(null);
  const [isLoadingGitState, setIsLoadingGitState] = useState(true);
  const [showDiff, setShowDiff] = useState(false);

  // Load git diff on mount
  useEffect(() => {
    const loadDiff = async () => {
      try {
        console.log('[CommitDialog] Loading diff for:', workspace.path);
        const result = await ipcRenderer.invoke('workspace:git-diff', workspace.path);

        if (result.success) {
          setDiff(result.diff || 'No changes detected');
        } else {
          console.error('[CommitDialog] Failed to load diff:', result.error);
        }
      } catch (err) {
        console.error('[CommitDialog] Failed to load diff:', err);
      } finally {
        setIsLoadingDiff(false);
      }
    };

    loadDiff();
  }, [workspace.path]);

  // Load git workspace state on mount
  useEffect(() => {
    const loadGitState = async () => {
      try {
        console.log('[CommitDialog] Loading git state for:', workspace.path);
        const result = await ipcRenderer.invoke('git:get-workspace-state', workspace.path);

        if (result.success && result.data) {
          setGitState(result.data);
        } else {
          console.error('[CommitDialog] Failed to load git state:', result.error);
        }
      } catch (err) {
        console.error('[CommitDialog] Failed to load git state:', err);
      } finally {
        setIsLoadingGitState(false);
      }
    };

    loadGitState();
  }, [workspace.path]);

  // AI-Delegated: Commit & Push
  const handleCommitAndPush = () => {
    console.log('[CommitDialog] Delegating commit & push to Claude Code');
    onRequestDirectEdit(
      `Please commit and push the current changes in this workspace (${workspace.path}). ` +
      `Analyze the git diff and create an appropriate commit message.`
    );
    onClose();
  };

  // AI-Delegated: Create PR
  const handleCreatePR = () => {
    console.log('[CommitDialog] Delegating PR creation to Claude Code');
    onRequestDirectEdit(
      `Please create a pull request for branch "${workspace.branch}". ` +
      `Analyze the commit history and generate appropriate PR title and description. ` +
      `Return the GitHub PR URL when done.`
    );
    onClose();
  };

  // AI-Delegated: Smart Merge/Resolve
  const handleMergeOrResolve = () => {
    if (gitState?.hasConflicts) {
      console.log('[CommitDialog] Delegating conflict resolution to Claude Code');
      onRequestDirectEdit(
        `There are merge conflicts in this workspace (${workspace.path}). ` +
        `Please analyze the conflicts and help me resolve them intelligently. ` +
        `Explain what caused the conflicts and suggest the best resolution strategy.`
      );
    } else if (gitState && gitState.behind > 0) {
      console.log('[CommitDialog] Delegating merge from main to Claude Code');
      onRequestDirectEdit(
        `Please merge the latest changes from main branch into my current branch (${workspace.branch}). ` +
        `The branch is ${gitState.behind} commit(s) behind.`
      );
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-[var(--overlay-backdrop)] flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-lg w-[800px] max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <GitCommit className="text-primary" size={20} />
            <h2 className="text-lg font-semibold text-foreground">Git Actions</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-background">
          {/* Action Buttons - TOP PRIORITY */}
          <div className="grid grid-cols-2 gap-3">
            {/* Commit & Push Button */}
            <div className="relative group">
              <button
                onClick={handleCommitAndPush}
                disabled={!gitState?.canCommit || gitState?.hasConflicts || gitState?.isMerging || gitState?.isRebasing}
                className="w-full px-5 py-4 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed text-primary-foreground text-sm font-medium rounded-lg transition-colors flex flex-col items-center gap-2"
              >
                <GitCommit size={22} />
                <span>Commit & Push</span>
              </button>
              {/* Tooltips */}
              {gitState && !gitState.canCommit && !gitState.hasConflicts && (
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-64 p-2 bg-popover border border-border rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none text-xs text-popover-foreground z-10">
                  No uncommitted changes to commit. Make changes first.
                </div>
              )}
              {gitState?.hasConflicts && (
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-64 p-2 bg-popover border border-border rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none text-xs text-popover-foreground z-10">
                  Resolve merge conflicts first.
                </div>
              )}
            </div>

            {/* Create PR Button */}
            <div className="relative group">
              <button
                onClick={handleCreatePR}
                disabled={!gitState || gitState.ahead === 0}
                className="w-full px-5 py-4 bg-secondary hover:bg-secondary/80 disabled:bg-muted disabled:cursor-not-allowed text-secondary-foreground text-sm font-medium rounded-lg transition-colors flex flex-col items-center gap-2"
              >
                <GitPullRequest size={22} />
                <span>Create PR</span>
              </button>
              {/* Tooltip */}
              {gitState && gitState.ahead === 0 && (
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-64 p-2 bg-popover border border-border rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none text-xs text-popover-foreground z-10">
                  No commits to create PR. Commit and push first.
                </div>
              )}
            </div>

            {/* Smart Merge/Resolve Button */}
            <div className="relative group col-span-2">
              <button
                onClick={handleMergeOrResolve}
                disabled={!gitState || (gitState.behind === 0 && !gitState.hasConflicts)}
                className={`w-full px-5 py-4 disabled:bg-muted disabled:cursor-not-allowed text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${
                  gitState?.hasConflicts
                    ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
                    : 'bg-accent hover:bg-accent/80 text-accent-foreground'
                }`}
              >
                <GitMerge size={22} />
                <span>
                  {gitState?.hasConflicts
                    ? 'Resolve Conflicts'
                    : gitState && gitState.behind > 0
                    ? `Merge from Main (${gitState.behind} behind)`
                    : 'Merge from Main'}
                </span>
              </button>
              {/* Tooltip */}
              {gitState && gitState.behind === 0 && !gitState.hasConflicts && (
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-64 p-2 bg-popover border border-border rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none text-xs text-popover-foreground z-10">
                  Already up to date with main.
                </div>
              )}
            </div>
          </div>

          {/* Compact Status - One-line summary */}
          <div className="border-t border-border pt-4">
            {isLoadingGitState ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="animate-spin" size={14} />
                <span>Loading status...</span>
              </div>
            ) : gitState ? (
              <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                {/* Branch */}
                <div className="flex items-center gap-1.5">
                  <GitBranch size={14} className="text-primary" />
                  <span className="font-medium text-foreground">{gitState.currentBranch}</span>
                </div>

                {/* Ahead/Behind */}
                {gitState.ahead > 0 && (
                  <div className="flex items-center gap-1 text-blue-500">
                    <ArrowUp size={14} />
                    <span className="font-medium">{gitState.ahead}</span>
                  </div>
                )}
                {gitState.behind > 0 && (
                  <div className="flex items-center gap-1 text-orange-500">
                    <ArrowDown size={14} />
                    <span className="font-medium">{gitState.behind}</span>
                  </div>
                )}
                {gitState.ahead === 0 && gitState.behind === 0 && gitState.upstreamBranch && (
                  <span className="text-primary">Up to date</span>
                )}

                {/* Uncommitted changes */}
                <div className="flex items-center gap-1.5">
                  <FileText size={14} />
                  <span>
                    {gitState.uncommitted > 0
                      ? `${gitState.uncommitted} uncommitted`
                      : 'No changes'}
                  </span>
                </div>

                {/* Special states */}
                {gitState.hasConflicts && (
                  <span className="text-destructive font-medium">Conflicts!</span>
                )}
                {!gitState.upstreamBranch && (
                  <span className="text-amber-600">No upstream</span>
                )}
              </div>
            ) : null}
          </div>

          {/* Collapsible Diff */}
          <div>
            <button
              onClick={() => setShowDiff(!showDiff)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {showDiff ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <span>{showDiff ? 'Hide' : 'Show'} diff</span>
            </button>

            {showDiff && (
              <div className="mt-2 bg-muted border border-border rounded-lg p-3 max-h-[300px] overflow-y-auto">
                {isLoadingDiff ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="animate-spin" size={14} />
                    Loading changes...
                  </div>
                ) : (
                  <pre className="text-xs font-mono whitespace-pre-wrap text-foreground">{diff}</pre>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-4 border-t border-border bg-card">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
