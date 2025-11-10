import React, { useState, useEffect } from 'react';
import type { Workspace } from '@/types/workspace';
import { X, GitMerge, Loader2, GitBranch, ArrowDown, FileText, ChevronDown, ChevronRight } from 'lucide-react';
import type { GitWorkspaceState } from '../../../electron/gitHandlers';

const ipcRenderer = window.electron.ipcRenderer;

interface MergeDialogProps {
  workspace: Workspace;
  onClose: () => void;
  onRequestDirectEdit: (message: string) => void;
}

/**
 * MergeDialog - Simplified modal for reviewing Git state before merging
 * Used when user wants to see details before merging from main
 */
export const MergeDialog: React.FC<MergeDialogProps> = ({
  workspace,
  onClose,
  onRequestDirectEdit
}) => {
  const [gitState, setGitState] = useState<GitWorkspaceState | null>(null);
  const [isLoadingGitState, setIsLoadingGitState] = useState(true);
  const [showDiff, setShowDiff] = useState(false);
  const [diff, setDiff] = useState<string>('');
  const [isLoadingDiff, setIsLoadingDiff] = useState(false);

  // Load git workspace state on mount
  useEffect(() => {
    const loadGitState = async () => {
      try {
        console.log('[MergeDialog] Loading git state for:', workspace.path);
        const result = await ipcRenderer.invoke('git:get-workspace-state', workspace.path);

        if (result.success && result.data) {
          setGitState(result.data.state);
        } else {
          console.error('[MergeDialog] Failed to load git state:', result.error);
        }
      } catch (err) {
        console.error('[MergeDialog] Failed to load git state:', err);
      } finally {
        setIsLoadingGitState(false);
      }
    };

    loadGitState();
  }, [workspace.path]);

  // Load diff when showing
  useEffect(() => {
    if (!showDiff || diff || isLoadingDiff) return;

    const loadDiff = async () => {
      setIsLoadingDiff(true);
      try {
        console.log('[MergeDialog] Loading diff for:', workspace.path);
        const result = await ipcRenderer.invoke('workspace:git-diff', workspace.path);

        if (result.success) {
          setDiff(result.diff || 'No changes detected');
        } else {
          console.error('[MergeDialog] Failed to load diff:', result.error);
        }
      } catch (err) {
        console.error('[MergeDialog] Failed to load diff:', err);
      } finally {
        setIsLoadingDiff(false);
      }
    };

    loadDiff();
  }, [showDiff, workspace.path]);

  // AI-Delegated: Smart Merge/Resolve
  const handleMergeOrResolve = () => {
    if (gitState?.hasConflicts) {
      console.log('[MergeDialog] Delegating conflict resolution to Claude Code');
      onRequestDirectEdit(
        `There are merge conflicts in this workspace (${workspace.path}). ` +
        `Please analyze the conflicts and help me resolve them intelligently. ` +
        `Explain what caused the conflicts and suggest the best resolution strategy.`
      );
    } else if (gitState && gitState.behind > 0) {
      console.log('[MergeDialog] Delegating merge from main to Claude Code');
      onRequestDirectEdit(
        `Please merge the latest changes from main branch into my current branch (${workspace.branch}). ` +
        `The branch is ${gitState.behind} commit(s) behind.`
      );
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-[var(--overlay-backdrop)] flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-lg w-[700px] max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <GitMerge className="text-primary" size={20} />
            <h2 className="text-lg font-semibold text-foreground">
              {gitState?.hasConflicts ? 'Resolve Conflicts' : 'Merge from Main'}
            </h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-background">
          {/* Git State Summary */}
          {isLoadingGitState ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="animate-spin" size={14} />
              <span>Loading git status...</span>
            </div>
          ) : gitState ? (
            <div className="space-y-3">
              {/* Branch Info */}
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <GitBranch size={16} className="text-primary" />
                  <span className="font-medium">{gitState.currentBranch}</span>
                </div>
                {gitState.behind > 0 && (
                  <div className="flex items-center gap-1.5 text-orange-500">
                    <ArrowDown size={16} />
                    <span className="font-medium">{gitState.behind} commits behind</span>
                  </div>
                )}
              </div>

              {/* Uncommitted changes warning */}
              {gitState.uncommitted > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                    <FileText size={14} />
                    <span className="font-medium">{gitState.uncommitted} uncommitted changes</span>
                  </div>
                  <p className="text-xs mt-1 text-amber-600 dark:text-amber-500">
                    These changes will need to be stashed or committed before merging.
                  </p>
                </div>
              )}

              {/* Conflicts warning */}
              {gitState.hasConflicts && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm">
                  <div className="flex items-center gap-2 text-destructive font-medium">
                    <span>⚠️</span>
                    <span>Merge conflicts detected</span>
                  </div>
                  <p className="text-xs mt-1 text-destructive/80">
                    Claude Code will help you analyze and resolve these conflicts.
                  </p>
                </div>
              )}

              {/* Up to date message */}
              {gitState.behind === 0 && !gitState.hasConflicts && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-sm text-green-700 dark:text-green-400">
                  <span className="font-medium">✓ Already up to date with main</span>
                </div>
              )}
            </div>
          ) : null}

          {/* Collapsible Diff */}
          {gitState && gitState.uncommitted > 0 && (
            <div>
              <button
                onClick={() => setShowDiff(!showDiff)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {showDiff ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <span>{showDiff ? 'Hide' : 'Show'} uncommitted changes</span>
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
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border bg-card">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleMergeOrResolve}
            disabled={!gitState || (gitState.behind === 0 && !gitState.hasConflicts)}
            className={`px-5 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
              gitState?.hasConflicts
                ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed'
                : 'bg-primary hover:bg-primary/90 text-primary-foreground disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed'
            }`}
          >
            <GitMerge size={16} />
            <span>
              {gitState?.hasConflicts
                ? 'Resolve with Claude'
                : 'Merge with Claude'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
