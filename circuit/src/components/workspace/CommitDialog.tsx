import React, { useState, useEffect } from 'react';
import type { Workspace } from '@/types/workspace';
import { X, GitCommit, GitPullRequest, Loader2, ExternalLink, GitMerge, AlertTriangle } from 'lucide-react';
import { ConflictResolverDialog } from './ConflictResolverDialog';

// @ts-ignore - Electron IPC
const { ipcRenderer } = window.require('electron');

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
  const [commitMessage, setCommitMessage] = useState('');
  const [prTitle, setPrTitle] = useState('');
  const [prBody, setPrBody] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingStep, setSubmittingStep] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prUrl, setPrUrl] = useState<string | null>(null);
  const [conflictFiles, setConflictFiles] = useState<string[]>([]);
  const [showConflictResolver, setShowConflictResolver] = useState(false);

  // Load git diff on mount
  useEffect(() => {
    const loadDiff = async () => {
      try {
        console.log('[CommitDialog] Loading diff for:', workspace.path);
        const result = await ipcRenderer.invoke('workspace:git-diff', workspace.path);

        if (result.success) {
          setDiff(result.diff || 'No changes detected');
        } else {
          setError(result.error);
        }
      } catch (err) {
        console.error('[CommitDialog] Failed to load diff:', err);
        setError(String(err));
      } finally {
        setIsLoadingDiff(false);
      }
    };

    loadDiff();
  }, [workspace.path]);

  const handleSyncWithMain = async () => {
    setIsSyncing(true);
    setError(null);
    setConflictFiles([]);

    try {
      console.log('[CommitDialog] Syncing with main...');
      const result = await ipcRenderer.invoke('workspace:sync-with-main', workspace.path);

      if (result.success) {
        console.log('[CommitDialog] Successfully synced with main');
        alert('✅ Successfully synced with main branch!\n\nYour workspace now has the latest changes from main.');

        // Reload diff to show updated changes
        const diffResult = await ipcRenderer.invoke('workspace:git-diff', workspace.path);
        if (diffResult.success) {
          setDiff(diffResult.diff || 'No changes detected');
        }
      } else if (result.hasUncommittedChanges) {
        console.log('[CommitDialog] Uncommitted changes detected:', result.modifiedFiles);
        setError(`You have uncommitted changes. Please commit them first using the form below, then try syncing again.\n\nModified files: ${result.modifiedFiles?.join(', ')}`);
      } else if (result.hasConflicts) {
        console.log('[CommitDialog] Conflicts detected:', result.conflictFiles);
        setConflictFiles(result.conflictFiles || []);
        setError(`Merge conflicts detected in: ${result.conflictFiles?.join(', ')}`);
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (err) {
      console.error('[CommitDialog] Sync error:', err);
      setError(String(err));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreatePR = async () => {
    if (!commitMessage.trim() || !prTitle.trim()) {
      setError('Commit message and PR title are required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Step 1: Commit changes first
      setSubmittingStep('Committing changes...');
      console.log('[CommitDialog] Committing changes...');
      const commitResult = await ipcRenderer.invoke('workspace:commit-and-push', workspace.path, commitMessage);

      if (!commitResult.success) {
        throw new Error(`Failed to commit: ${commitResult.error}`);
      }

      console.log('[CommitDialog] Committed to branch:', commitResult.branch);

      // Step 2: Auto-sync with main to avoid conflicts
      setSubmittingStep('Syncing with main...');
      console.log('[CommitDialog] Auto-syncing with main before PR...');
      const syncResult = await ipcRenderer.invoke('workspace:sync-with-main', workspace.path);

      if (!syncResult.success) {
        if (syncResult.hasConflicts) {
          setConflictFiles(syncResult.conflictFiles || []);
          setShowConflictResolver(true);
          setIsSubmitting(false);
          return;
        } else {
          throw new Error(`Sync failed: ${syncResult.error}`);
        }
      }

      console.log('[CommitDialog] Successfully synced with main');

      // Step 3: Create PR (merge already pushed)
      setSubmittingStep('Creating PR...');
      console.log('[CommitDialog] Creating PR...');
      const prResult = await ipcRenderer.invoke('workspace:create-pr', workspace.path, prTitle, prBody || 'Auto-generated PR from Circuit Workspace');

      if (!prResult.success) {
        throw new Error(`Failed to create PR: ${prResult.error}`);
      }

      console.log('[CommitDialog] PR created:', prResult.prUrl);
      setPrUrl(prResult.prUrl);

      // Success! Don't close yet - show PR URL
    } catch (err) {
      console.error('[CommitDialog] Error:', err);
      setError(String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (prUrl) {
    // Success state - show PR URL
    return (
      <div className="fixed inset-0 bg-[var(--overlay-backdrop)] flex items-center justify-center z-50">
        <div className="bg-card border border-border rounded-lg w-[600px] p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <GitPullRequest className="text-primary" size={24} />
              <h2 className="text-xl font-semibold text-foreground">PR Created Successfully!</h2>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="bg-muted border border-border rounded p-4 mb-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Pull Request URL:</span>
              <a
                href={prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/90 flex items-center gap-1 text-sm"
              >
                Open in GitHub <ExternalLink size={14} />
              </a>
            </div>
            <div className="mt-2 text-sm break-all text-foreground">{prUrl}</div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onSuccess}
              className="flex-1 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[var(--overlay-backdrop)] flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-lg w-[800px] max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <GitCommit className="text-primary" size={20} />
            <h2 className="text-lg font-semibold text-foreground">Commit & Create Pull Request</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background">
          {/* Sync with main button */}
          <div className="bg-muted border border-border rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitMerge size={16} className="text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Sync with Main Branch (Optional)</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Test merge before creating PR. PR creation will auto-sync anyway.
                  </p>
                </div>
              </div>
              <button
                onClick={handleSyncWithMain}
                disabled={isSyncing}
                className="px-4 py-2 bg-secondary hover:bg-secondary/80 disabled:bg-muted disabled:cursor-not-allowed text-secondary-foreground text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="animate-spin" size={14} />
                    Syncing...
                  </>
                ) : (
                  <>
                    <GitMerge size={14} />
                    Sync
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm">
              <div className="flex items-center gap-2 text-destructive mb-2">
                <AlertTriangle size={16} />
                <span className="font-medium">Error</span>
              </div>
              <p className="text-destructive">{error}</p>
              {conflictFiles.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-destructive/80 mb-1">Conflicted files:</p>
                  <ul className="list-disc list-inside text-xs text-destructive/80 space-y-1">
                    {conflictFiles.map((file) => (
                      <li key={file}>{file}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-destructive/80 mt-2">
                    Resolve conflicts manually in the workspace, then try syncing again.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Diff Preview */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Changes</label>
            <div className="bg-muted border border-border rounded-lg p-3 max-h-[200px] overflow-y-auto">
              {isLoadingDiff ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="animate-spin" size={14} />
                  Loading changes...
                </div>
              ) : (
                <pre className="text-xs font-mono whitespace-pre-wrap text-foreground">{diff}</pre>
              )}
            </div>
          </div>

          {/* Commit Message */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Commit Message <span className="text-destructive">*</span>
            </label>
            <textarea
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="feat: Add new feature..."
              className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-input resize-none"
              rows={3}
            />
          </div>

          {/* PR Title */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Pull Request Title <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={prTitle}
              onChange={(e) => setPrTitle(e.target.value)}
              placeholder="Add new feature"
              className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-input"
            />
          </div>

          {/* PR Body */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Pull Request Description (optional)</label>
            <textarea
              value={prBody}
              onChange={(e) => setPrBody(e.target.value)}
              placeholder="Describe your changes..."
              className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-input resize-none"
              rows={4}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border bg-card">
          <div className="text-xs text-muted-foreground">
            Branch: <span className="text-foreground font-medium">{workspace.branch}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreatePR}
              disabled={!commitMessage.trim() || !prTitle.trim() || isSubmitting}
              className="px-4 py-2 bg-primary hover:bg-primary/90 disabled:bg-secondary disabled:cursor-not-allowed text-primary-foreground text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" size={14} />
                  {submittingStep || 'Processing...'}
                </>
              ) : (
                <>
                  <GitPullRequest size={14} />
                  Create Pull Request
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Conflict Resolver Dialog */}
      {showConflictResolver && (
        <ConflictResolverDialog
          workspace={workspace}
          onClose={() => {
            setShowConflictResolver(false);
            setIsSubmitting(false);
          }}
          onResolved={async () => {
            setShowConflictResolver(false);
            setError(null);
            // Retry PR creation from sync step
            try {
              setIsSubmitting(true);
              setSubmittingStep('Creating PR...');
              console.log('[CommitDialog] Creating PR after conflict resolution...');
              const prResult = await ipcRenderer.invoke('workspace:create-pr', workspace.path, prTitle, prBody || 'Auto-generated PR from Circuit Workspace');

              if (!prResult.success) {
                throw new Error(`Failed to create PR: ${prResult.error}`);
              }

              console.log('[CommitDialog] PR created:', prResult.prUrl);
              setPrUrl(prResult.prUrl);
            } catch (err) {
              console.error('[CommitDialog] Error:', err);
              setError(String(err));
            } finally {
              setIsSubmitting(false);
            }
          }}
          onRequestDirectEdit={onRequestDirectEdit}
        />
      )}
    </div>
  );
};
