/**
 * useWorkspaces Hook
 *
 * Manages workspaces (CRUD operations) with IPC event listening.
 * Automatically reloads workspaces when workspace:list-changed event fires.
 *
 * ✅ FIX: Memory leak fixed by using ref for callback stability
 *
 * @example
 * const {
 *   workspaces,
 *   isCreating,
 *   loadWorkspaces,
 *   createWorkspace,
 *   archiveWorkspace,
 *   deleteWorkspace,
 *   setWorkspaces
 * } = useWorkspaces({
 *   onWorkspacesLoaded: (ws) => console.log('Workspaces loaded:', ws)
 * });
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { Workspace, WorkspaceListResult, WorkspaceCreateResult } from '@/types/workspace';

const ipcRenderer = window.electron.ipcRenderer;

interface UseWorkspacesParams {
  onWorkspacesLoaded?: (workspaces: Workspace[]) => void;
}

interface UseWorkspacesReturn {
  // State
  workspaces: Workspace[];
  isCreating: boolean;

  // Actions
  loadWorkspaces: (repositoryPath: string) => Promise<void>;
  createWorkspace: (repositoryPath: string) => Promise<void>;
  archiveWorkspace: (workspaceId: string, repositoryPath: string) => Promise<void>;
  deleteWorkspace: (workspaceId: string, repositoryPath: string) => Promise<void>;

  // Direct state setter (for repository switching)
  setWorkspaces: React.Dispatch<React.SetStateAction<Workspace[]>>;
}

export function useWorkspaces({ onWorkspacesLoaded }: UseWorkspacesParams = {}): UseWorkspacesReturn {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  // ✅ Store callback in ref to avoid stale closures and prevent memory leak
  const onWorkspacesLoadedRef = useRef(onWorkspacesLoaded);

  useEffect(() => {
    onWorkspacesLoadedRef.current = onWorkspacesLoaded;
  }, [onWorkspacesLoaded]);

  // Load workspaces for a repository
  const loadWorkspaces = useCallback(async (repositoryPath: string): Promise<void> => {
    try {
      console.log('[useWorkspaces] Loading workspaces for:', repositoryPath);

      const result: WorkspaceListResult = await ipcRenderer.invoke('workspace:list', repositoryPath);

      console.log('[useWorkspaces] Workspace list result:', {
        success: result.success,
        count: result.workspaces?.length,
      });

      if (result.success && result.workspaces) {
        setWorkspaces(result.workspaces);
        // Use ref to get latest callback
        onWorkspacesLoadedRef.current?.(result.workspaces);
      } else {
        console.error('[useWorkspaces] Failed to load workspaces:', result.error);
        setWorkspaces([]);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[useWorkspaces] Error loading workspaces:', errorMessage);
      setWorkspaces([]);
    }
  }, []); // ✅ No dependencies - callback is stable

  // Create new workspace
  const createWorkspace = useCallback(
    async (repositoryPath: string): Promise<void> => {
      console.log('[useWorkspaces] Creating workspace for:', repositoryPath);
      setIsCreating(true);
      try {
        const result: WorkspaceCreateResult = await ipcRenderer.invoke(
          'workspace:create',
          repositoryPath
        );

        console.log('[useWorkspaces] Workspace create result:', result);

        if (result.success && result.workspace) {
          console.log('[useWorkspaces] Workspace created:', result.workspace.name, result.workspace.id);
          setWorkspaces((prev) => [...prev, result.workspace!]);
        } else {
          console.error('[useWorkspaces] Failed to create workspace:', result.error);
          alert(`Failed to create workspace: ${result.error}`);
        }
      } catch (error) {
        console.error('[useWorkspaces] Error creating workspace:', error);
        alert(`Error creating workspace: ${error}`);
      } finally {
        setIsCreating(false);
      }
    },
    []
  );

  // Archive workspace
  const archiveWorkspace = useCallback(
    async (workspaceId: string, repositoryPath: string): Promise<void> => {
      try {
        const result = await ipcRenderer.invoke('workspace:archive', workspaceId, repositoryPath);

        if (result.success) {
          // Reload workspaces to update the list
          await loadWorkspaces(repositoryPath);
        } else {
          console.error('Failed to archive workspace:', result.error);
          alert(`Failed to archive workspace: ${result.error}`);
        }
      } catch (error) {
        console.error('Error archiving workspace:', error);
        alert(`Error archiving workspace: ${error}`);
      }
    },
    [loadWorkspaces]
  );

  // Delete workspace
  const deleteWorkspace = useCallback(
    async (workspaceId: string, repositoryPath: string): Promise<void> => {
      try {
        const result = await ipcRenderer.invoke('workspace:delete', workspaceId, repositoryPath);

        if (result.success) {
          // Reload workspaces to update the list
          await loadWorkspaces(repositoryPath);
        } else {
          console.error('Failed to delete workspace:', result.error);
          alert(`Failed to delete workspace: ${result.error}`);
        }
      } catch (error) {
        console.error('Error deleting workspace:', error);
        alert(`Error deleting workspace: ${error}`);
      }
    },
    [loadWorkspaces]
  );

  // ✅ FIX: Listen for workspace:list-changed events (memory leak fixed)
  useEffect(() => {
    const handleWorkspaceListChanged = async (
      _event: unknown,
      changedRepositoryPath: string
    ): Promise<void> => {
      console.log('[useWorkspaces] 🔔 Workspace list changed for:', changedRepositoryPath);

      // Reload workspaces for the changed repository
      // Note: The caller (AppSidebar) should check if this matches current repository
      await loadWorkspaces(changedRepositoryPath);
    };

    console.log('[useWorkspaces] ✅ Registering workspace:list-changed listener');
    ipcRenderer.on('workspace:list-changed', handleWorkspaceListChanged);

    return () => {
      console.log('[useWorkspaces] ✅ Unregistering workspace:list-changed listener');
      // ✅ Critical: Remove the same function reference
      ipcRenderer.removeListener('workspace:list-changed', handleWorkspaceListChanged);
    };
  }, [loadWorkspaces]); // ✅ loadWorkspaces is stable (no dependencies)

  return {
    // State
    workspaces,
    isCreating,

    // Actions
    loadWorkspaces,
    createWorkspace,
    archiveWorkspace,
    deleteWorkspace,

    // Direct state setter (for repository switching without reloading)
    setWorkspaces,
  };
}
