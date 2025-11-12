/**
 * useRepositories Hook
 *
 * Manages Git repositories (CRUD operations).
 * Includes GitHub cloning, local folder selection, and repository switching.
 *
 * @example
 * const {
 *   repositories,
 *   currentRepository,
 *   isCloneDialogOpen,
 *   loadRepositories,
 *   switchRepository,
 *   removeRepository,
 *   ...
 * } = useRepositories({
 *   projectPath,
 *   onRepositoryChange,
 *   onWorkspaceLoad
 * });
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { Repository, Workspace, WorkspaceListResult } from '@/types/workspace';

const ipcRenderer = window.electron.ipcRenderer;

interface UseRepositoriesParams {
  projectPath: string;
  onRepositoryChange?: (repository: Repository | null) => void;
  onWorkspaceLoad?: (workspaces: Workspace[], repositoryPath: string) => void;
}

interface UseRepositoriesReturn {
  // State
  repositories: Repository[];
  currentRepository: Repository;
  isCloneDialogOpen: boolean;

  // Actions
  loadRepositories: () => Promise<void>;
  createRepository: () => Promise<void>;
  cloneRepository: (url: string) => Promise<void>;
  removeRepository: (repoId: string) => Promise<void>;
  switchRepository: (repo: Repository) => Promise<void>;
  openCloneDialog: () => void;
  closeCloneDialog: () => void;
}

export function useRepositories({
  projectPath,
  onRepositoryChange,
  onWorkspaceLoad,
}: UseRepositoriesParams): UseRepositoriesReturn {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [currentRepository, setCurrentRepository] = useState<Repository | null>(null);
  const [isCloneDialogOpen, setIsCloneDialogOpen] = useState(false);

  // Create a temporary repository from project path (fallback)
  const defaultRepository: Repository = useMemo(() => {
    const projectName = projectPath.split('/').filter(Boolean).pop() || 'Unknown Project';
    return {
      id: 'temp-repo-1',
      name: projectName,
      path: projectPath,
      remoteUrl: null,
      defaultBranch: 'main',
      createdAt: new Date().toISOString(),
    };
  }, [projectPath]);

  // Use current repository or fallback to default
  const repository = currentRepository || defaultRepository;

  // Keep current repository in a ref to avoid stale closures
  const currentRepositoryRef = useRef<Repository | null>(null);

  useEffect(() => {
    currentRepositoryRef.current = currentRepository;
  }, [currentRepository]);

  // Notify parent when repository changes
  useEffect(() => {
    onRepositoryChange?.(repository);
  }, [repository.id, onRepositoryChange]);

  // Load repositories from backend
  const loadRepositories = useCallback(async () => {
    try {
      console.log('[useRepositories] Loading repositories...');
      const result = await ipcRenderer.invoke('repository:list');
      console.log('[useRepositories] Repository list result:', result);

      if (result.success && result.repositories) {
        console.log('[useRepositories] Setting repositories:', result.repositories.length);
        setRepositories(result.repositories);

        // Set first repository as current if none selected
        if (!currentRepository && result.repositories.length > 0) {
          console.log('[useRepositories] Setting current repository to:', result.repositories[0].name);
          setCurrentRepository(result.repositories[0]);
        }
      } else {
        console.error('[useRepositories] Failed to load repositories:', result.error);
        // Fallback to default repository
        setRepositories([defaultRepository]);
        setCurrentRepository(defaultRepository);
      }
    } catch (error) {
      console.error('[useRepositories] Error loading repositories:', error);
      // Fallback to default repository
      setRepositories([defaultRepository]);
      setCurrentRepository(defaultRepository);
    }
  }, [currentRepository, defaultRepository]);

  // Create new repository (select local folder)
  const createRepository = useCallback(async () => {
    try {
      console.log('[useRepositories] Opening folder selection dialog');

      // Step 1: Select folder
      const selectResult = await ipcRenderer.invoke('repository:select-folder');

      if (!selectResult.success) {
        if (selectResult.cancelled) {
          console.log('[useRepositories] Folder selection cancelled');
          return;
        }
        console.error('[useRepositories] Failed to select folder:', selectResult.error);
        alert(`Failed to select folder: ${selectResult.error}`);
        return;
      }

      console.log('[useRepositories] Selected folder:', selectResult.folderPath);

      // Step 2: Add repository
      const addResult = await ipcRenderer.invoke('repository:add', selectResult.folderPath);

      if (addResult.success && addResult.repository) {
        console.log('[useRepositories] Repository added successfully:', addResult.repository.name);

        // Reload repositories to get the updated list
        await loadRepositories();

        // Set the newly added repository as current
        setCurrentRepository(addResult.repository);
      } else {
        console.error('[useRepositories] Failed to add repository:', addResult.error);
        alert(`Failed to add repository: ${addResult.error}`);
      }
    } catch (error) {
      console.error('[useRepositories] Error adding repository:', error);
      alert(`Error adding repository: ${error}`);
    }
  }, [loadRepositories]);

  // Clone repository from GitHub
  const cloneRepository = useCallback(async (url: string) => {
    try {
      const result = await ipcRenderer.invoke('repository:clone', url);

      if (result.success && result.repository) {
        setRepositories((prev) => [...prev, result.repository]);
        setCurrentRepository(result.repository);
        alert(`Repository cloned successfully: ${result.repository.name}`);
      } else {
        console.error('Failed to clone repository:', result.error);
        alert(`Failed to clone repository: ${result.error}`);
      }
    } catch (error) {
      console.error('Error cloning repository:', error);
      alert(`Error cloning repository: ${error}`);
    }
  }, []);

  // Switch to a different repository
  const switchRepository = useCallback(
    async (repo: Repository): Promise<void> => {
      try {
        console.log('[useRepositories] Switching to repository:', repo.name);

        // Step 1: Load workspaces for the new repository
        const workspaceResult: WorkspaceListResult = await ipcRenderer.invoke('workspace:list', repo.path);

        // Step 2: Update repository state
        setCurrentRepository(repo);

        // Step 3: Notify workspace loader
        if (workspaceResult.success && workspaceResult.workspaces) {
          onWorkspaceLoad?.(workspaceResult.workspaces, repo.path);
          console.log('[useRepositories] Successfully switched to', repo.name);
        } else {
          console.error(
            '[useRepositories] Failed to load workspaces for new repository:',
            workspaceResult.error
          );
          onWorkspaceLoad?.([], repo.path);
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[useRepositories] Error switching repository:', errorMessage);
      }
    },
    [onWorkspaceLoad]
  );

  // Remove repository
  const removeRepository = useCallback(
    async (repoId: string): Promise<void> => {
      try {
        console.log('[useRepositories] Removing repository:', repoId);

        // Step 1: Track if we're removing the current repository
        const wasCurrentRepo = currentRepository?.id === repoId;

        // Step 2: Call backend to remove
        const removeResult = await ipcRenderer.invoke('repository:remove', repoId);

        if (!removeResult.success) {
          console.error('Failed to remove repository:', removeResult.error);
          alert(`Failed to remove repository: ${removeResult.error}`);
          return;
        }

        // Step 3: Fetch fresh repository list from backend (source of truth)
        const listResult = await ipcRenderer.invoke('repository:list');

        if (!listResult.success || !listResult.repositories) {
          console.error('[useRepositories] Failed to reload repositories after deletion');

          // Fallback: manual state cleanup
          setRepositories((prev) => prev.filter((r) => r.id !== repoId));

          if (wasCurrentRepo) {
            const fallbackRepos = repositories.filter((r) => r.id !== repoId);
            if (fallbackRepos.length > 0) {
              await switchRepository(fallbackRepos[0]);
            } else {
              setCurrentRepository(defaultRepository);
              setRepositories([defaultRepository]);
              onWorkspaceLoad?.([], defaultRepository.path);
            }
          }
          return;
        }

        // Step 4: Update repositories state with fresh data
        const updatedRepositories: Repository[] = listResult.repositories;
        setRepositories(updatedRepositories);

        // Step 5: Handle repository switching if needed
        if (wasCurrentRepo) {
          if (updatedRepositories.length > 0) {
            // Switch to first available repository (loads its workspaces)
            await switchRepository(updatedRepositories[0]);
          } else {
            // No repositories left - fallback to default
            setCurrentRepository(defaultRepository);
            setRepositories([defaultRepository]);
            onWorkspaceLoad?.([], defaultRepository.path);
          }
        }

        console.log('[useRepositories] Repository removed successfully');
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error removing repository:', errorMessage);
        alert(`Error removing repository: ${errorMessage}`);
      }
    },
    [currentRepository, repositories, defaultRepository, switchRepository, onWorkspaceLoad]
  );

  return {
    // State
    repositories,
    currentRepository: repository,
    isCloneDialogOpen,

    // Actions
    loadRepositories,
    createRepository,
    cloneRepository,
    removeRepository,
    switchRepository,
    openCloneDialog: () => setIsCloneDialogOpen(true),
    closeCloneDialog: () => setIsCloneDialogOpen(false),
  };
}
