/**
 * GitTestPanel - Quick test component for git:status IPC
 *
 * This is a temporary component to verify that git handlers are working.
 * Will be replaced with full GitPanel later.
 */

import { useState, useEffect } from 'react';
import type { GitStatus } from '@/types/git';

// @ts-ignore - Electron IPC
const { ipcRenderer } = window.require('electron');

interface GitTestPanelProps {
  workspacePath: string;
}

export function GitTestPanel({ workspacePath }: GitTestPanelProps) {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('[GitTestPanel] Loading status for:', workspacePath);
      const result = await ipcRenderer.invoke('git:status', workspacePath);

      console.log('[GitTestPanel] Result:', result);

      if (result.success) {
        setStatus(result.status);
      } else {
        setError(result.error);
      }
    } catch (err) {
      console.error('[GitTestPanel] Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, [workspacePath]);

  const handleStageFile = async (filePath: string) => {
    try {
      const result = await ipcRenderer.invoke('git:stage', workspacePath, filePath);
      if (result.success) {
        loadStatus(); // Reload status
      }
    } catch (err) {
      console.error('Failed to stage file:', err);
    }
  };

  const handleUnstageFile = async (filePath: string) => {
    try {
      const result = await ipcRenderer.invoke('git:unstage', workspacePath, filePath);
      if (result.success) {
        loadStatus(); // Reload status
      }
    } catch (err) {
      console.error('Failed to unstage file:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="text-sm text-muted-foreground">Loading git status...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="text-sm text-red-500">Error: {error}</div>
        <button
          onClick={loadStatus}
          className="mt-2 px-3 py-1 bg-primary text-primary-foreground rounded text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="p-4">
        <div className="text-sm text-muted-foreground">No status</div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold mb-2">Git Status Test</h3>
        <button
          onClick={loadStatus}
          className="px-3 py-1 bg-primary text-primary-foreground rounded text-sm"
        >
          Refresh
        </button>
      </div>

      {/* Current Branch */}
      <div className="p-3 bg-sidebar-accent rounded">
        <div className="text-xs text-muted-foreground">Branch</div>
        <div className="text-sm font-semibold">{status.currentBranch}</div>
        {status.remoteBranch && (
          <div className="text-xs text-muted-foreground mt-1">
            Remote: {status.remoteBranch}
            {status.ahead > 0 && <span className="ml-2 text-green-500">↑{status.ahead}</span>}
            {status.behind > 0 && <span className="ml-2 text-red-500">↓{status.behind}</span>}
          </div>
        )}
      </div>

      {/* Staged Files */}
      {status.staged.length > 0 && (
        <div>
          <div className="text-xs font-semibold mb-2">Staged ({status.staged.length})</div>
          <div className="space-y-1">
            {status.staged.map((file) => (
              <div
                key={file.path}
                className="flex items-center justify-between p-2 bg-sidebar-accent rounded text-sm"
              >
                <span>
                  <span className="text-green-500 mr-2">{file.status}</span>
                  {file.path}
                </span>
                <button
                  onClick={() => handleUnstageFile(file.path)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Unstage
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unstaged Files */}
      {status.unstaged.length > 0 && (
        <div>
          <div className="text-xs font-semibold mb-2">Unstaged ({status.unstaged.length})</div>
          <div className="space-y-1">
            {status.unstaged.map((file) => (
              <div
                key={file.path}
                className="flex items-center justify-between p-2 bg-sidebar-accent rounded text-sm"
              >
                <span>
                  <span className="text-yellow-500 mr-2">{file.status}</span>
                  {file.path}
                </span>
                <button
                  onClick={() => handleStageFile(file.path)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Stage
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Untracked Files */}
      {status.untracked.length > 0 && (
        <div>
          <div className="text-xs font-semibold mb-2">Untracked ({status.untracked.length})</div>
          <div className="space-y-1">
            {status.untracked.map((file) => (
              <div
                key={file.path}
                className="flex items-center justify-between p-2 bg-sidebar-accent rounded text-sm"
              >
                <span>
                  <span className="text-gray-500 mr-2">{file.status}</span>
                  {file.path}
                </span>
                <button
                  onClick={() => handleStageFile(file.path)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Stage
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {status.staged.length === 0 &&
       status.unstaged.length === 0 &&
       status.untracked.length === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          No changes
        </div>
      )}
    </div>
  );
}
