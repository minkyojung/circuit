/**
 * useGitStatus Hook
 *
 * Manages Git status for multiple workspaces with auto-refresh.
 * Loads status for all workspaces and refreshes periodically.
 *
 * @example
 * const { statuses, loadStatuses } = useGitStatus(
 *   workspaces,
 *   currentRepository?.id,
 *   30000  // 30 seconds
 * );
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Workspace, WorkspaceStatus } from '@/types/workspace';

const ipcRenderer = window.electron.ipcRenderer;

interface UseGitStatusReturn {
  statuses: Record<string, WorkspaceStatus>;
  loadStatuses: (workspaceList: Workspace[]) => Promise<void>;
}

export function useGitStatus(
  workspaces: Workspace[],
  repositoryId: string | undefined,
  autoRefreshInterval: number = 30000
): UseGitStatusReturn {
  const [statuses, setStatuses] = useState<Record<string, WorkspaceStatus>>({});

  // Load statuses for all workspaces
  const loadStatuses = useCallback(async (workspaceList: Workspace[]) => {
    const statusPromises = workspaceList.map(async (workspace) => {
      try {
        const result = await ipcRenderer.invoke('workspace:get-status', workspace.path);
        if (result.success && result.status) {
          return { id: workspace.id, status: result.status };
        }
      } catch (error) {
        console.error(`Failed to get status for ${workspace.name}:`, error);
      }
      return null;
    });

    const results = await Promise.all(statusPromises);
    const newStatuses: Record<string, WorkspaceStatus> = {};
    results.forEach((result) => {
      if (result) {
        newStatuses[result.id] = result.status;
      }
    });

    setStatuses(newStatuses);
  }, []);

  // Store workspaces in a ref to avoid useEffect re-triggering on every render
  const workspacesRef = useRef(workspaces);
  workspacesRef.current = workspaces;

  // Auto-refresh statuses
  useEffect(() => {
    const currentWorkspaces = workspacesRef.current;

    if (!repositoryId || currentWorkspaces.length === 0) {
      return;
    }

    console.log('[useGitStatus] Setting up status auto-refresh (30s)');

    // Load immediately on mount
    loadStatuses(currentWorkspaces);

    // Then refresh periodically
    const interval = setInterval(() => {
      console.log('[useGitStatus] Status auto-refresh triggered');
      loadStatuses(workspacesRef.current);
    }, autoRefreshInterval);

    return () => {
      console.log('[useGitStatus] Cleaning up status auto-refresh');
      clearInterval(interval);
    };
  }, [repositoryId, workspaces.length, loadStatuses, autoRefreshInterval]);

  return { statuses, loadStatuses };
}
