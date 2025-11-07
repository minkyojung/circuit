/**
 * GitTestPanel - Quick test component for git:status IPC
 *
 * This is a temporary component to verify that git handlers are working.
 * Will be replaced with full GitPanel later.
 *
 * REFACTORED: Now using design system primitives (Stack, Inline, PanelHeader, Button)
 */

import { useState, useEffect } from 'react';
import { GitBranch, RefreshCw } from 'lucide-react';
import type { GitStatus } from '@/types/git';
import { CommitInterface } from './CommitInterface';
import { GitGraphV3 } from './GitGraphV3';
import { MCPTimeline } from '../mcp/MCPTimeline';
import { Stack } from '../ui/stack';
import { Inline } from '../ui/inline';
import { PanelHeader } from '../ui/panel-header';
import { Button } from '../ui/button';
import { FEATURES } from '@/config/features';

const ipcRenderer = window.electron.ipcRenderer;

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
      <Stack space="4" className="p-4">
        <div className="text-sm text-muted-foreground">Loading git status...</div>
      </Stack>
    );
  }

  if (error) {
    return (
      <Stack space="4" className="p-4">
        <div className="text-sm text-destructive">Error: {error}</div>
        <Button onClick={loadStatus} size="sm">
          Retry
        </Button>
      </Stack>
    );
  }

  if (!status) {
    return (
      <Stack space="4" className="p-4">
        <div className="text-sm text-muted-foreground">No status</div>
      </Stack>
    );
  }

  return (
    <Stack space="4">
      {/* Header with standardized spacing and alignment */}
      <PanelHeader
        icon={<GitBranch />}
        title="Git Status"
        badge={status.staged.length + status.unstaged.length + status.untracked.length || undefined}
        actions={
          <Button onClick={loadStatus} size="sm" variant="outline">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        }
      />

      {/* Git Commit Graph OR MCP Timeline (feature flag controlled) */}
      <div className="border-t border-sidebar-border">
        {FEATURES.GIT_GRAPH ? (
          <GitGraphV3 workspacePath={workspacePath} limit={5000} />
        ) : (
          <MCPTimeline limit={50} refreshInterval={5000} />
        )}
      </div>

      {/* Content area with consistent padding */}
      <Stack space="4" className="px-4 pb-4">
        {/* Current Branch */}
        <Stack space="1" className="p-3 bg-sidebar-accent rounded">
          <div className="text-xs text-muted-foreground">Branch</div>
          <div className="text-sm font-semibold">{status.currentBranch}</div>
          {status.remoteBranch && (
            <Inline space="2" className="text-xs text-muted-foreground">
              <span>Remote: {status.remoteBranch}</span>
              {status.ahead > 0 && <span className="text-success">↑{status.ahead}</span>}
              {status.behind > 0 && <span className="text-destructive">↓{status.behind}</span>}
            </Inline>
          )}
        </Stack>

        {/* Staged Files */}
        {status.staged.length > 0 && (
          <Stack space="2">
            <div className="text-xs font-semibold">Staged ({status.staged.length})</div>
            <Stack space="1">
              {status.staged.map((file) => (
                <Inline
                  key={file.path}
                  align="center"
                  justify="between"
                  className="p-2 bg-sidebar-accent rounded text-sm"
                >
                  <Inline space="2" align="center">
                    <span className="text-success">{file.status}</span>
                    <span>{file.path}</span>
                  </Inline>
                  <Button
                    onClick={() => handleUnstageFile(file.path)}
                    variant="ghost"
                    size="sm"
                    className="h-auto py-1 text-xs"
                  >
                    Unstage
                  </Button>
                </Inline>
              ))}
            </Stack>
          </Stack>
        )}

        {/* Unstaged Files */}
        {status.unstaged.length > 0 && (
          <Stack space="2">
            <div className="text-xs font-semibold">Unstaged ({status.unstaged.length})</div>
            <Stack space="1">
              {status.unstaged.map((file) => (
                <Inline
                  key={file.path}
                  align="center"
                  justify="between"
                  className="p-2 bg-sidebar-accent rounded text-sm"
                >
                  <Inline space="2" align="center">
                    <span className="text-warning">{file.status}</span>
                    <span>{file.path}</span>
                  </Inline>
                  <Button
                    onClick={() => handleStageFile(file.path)}
                    variant="ghost"
                    size="sm"
                    className="h-auto py-1 text-xs"
                  >
                    Stage
                  </Button>
                </Inline>
              ))}
            </Stack>
          </Stack>
        )}

        {/* Untracked Files */}
        {status.untracked.length > 0 && (
          <Stack space="2">
            <div className="text-xs font-semibold">Untracked ({status.untracked.length})</div>
            <Stack space="1">
              {status.untracked.map((file) => (
                <Inline
                  key={file.path}
                  align="center"
                  justify="between"
                  className="p-2 bg-sidebar-accent rounded text-sm"
                >
                  <Inline space="2" align="center">
                    <span className="text-muted-foreground">{file.status}</span>
                    <span>{file.path}</span>
                  </Inline>
                  <Button
                    onClick={() => handleStageFile(file.path)}
                    variant="ghost"
                    size="sm"
                    className="h-auto py-1 text-xs"
                  >
                    Stage
                  </Button>
                </Inline>
              ))}
            </Stack>
          </Stack>
        )}

        {/* Empty state */}
        {status.staged.length === 0 &&
         status.unstaged.length === 0 &&
         status.untracked.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No changes
          </div>
        )}

        {/* Commit Interface */}
        <CommitInterface
          workspacePath={workspacePath}
          stagedCount={status.staged.length}
          onCommitSuccess={loadStatus}
        />
      </Stack>
    </Stack>
  );
}
