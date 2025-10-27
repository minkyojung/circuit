import React, { useState, useEffect, useMemo } from 'react';
import type { Workspace, WorkspaceCreateResult, WorkspaceListResult, WorkspaceStatus, Repository } from '@/types/workspace';
import { WorkspaceItem } from './workspace/WorkspaceItem';
import { RepositorySwitcher } from './workspace/RepositorySwitcher';
import { CloneRepositoryDialog } from './workspace/CloneRepositoryDialog';
import { Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useProjectPath } from '@/App';

// @ts-ignore - Electron IPC
const { ipcRenderer } = window.require('electron');

interface SidebarProps {
  selectedWorkspaceId: string | null;
  onSelectWorkspace: (workspace: Workspace) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ selectedWorkspaceId, onSelectWorkspace }) => {
  const { projectPath } = useProjectPath();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [statuses, setStatuses] = useState<Record<string, WorkspaceStatus>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Repository state management
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [currentRepository, setCurrentRepository] = useState<Repository | null>(null);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [isCloneDialogOpen, setIsCloneDialogOpen] = useState(false);

  // Create a temporary repository from project path as fallback
  const fallbackRepository: Repository = useMemo(() => {
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

  // Load repositories on mount
  useEffect(() => {
    loadRepositories();
  }, []);

  // Load workspaces on mount
  useEffect(() => {
    loadWorkspaces();
  }, []);

  // Load statuses for all workspaces
  const loadStatuses = async (workspaceList: Workspace[]) => {
    const newStatuses: Record<string, WorkspaceStatus> = {};

    for (const workspace of workspaceList) {
      try {
        const result = await ipcRenderer.invoke('workspace:get-status', workspace.path);
        if (result.success && result.status) {
          newStatuses[workspace.id] = result.status;
        }
      } catch (error) {
        console.error(`Failed to get status for ${workspace.name}:`, error);
      }
    }

    setStatuses(newStatuses);
  };

  // Auto-refresh statuses every 30 seconds
  useEffect(() => {
    if (workspaces.length === 0) return;

    loadStatuses(workspaces);

    const interval = setInterval(() => {
      loadStatuses(workspaces);
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [workspaces]);

  const loadRepositories = async () => {
    setIsLoadingRepos(true);
    try {
      const result = await ipcRenderer.invoke('repository:list');

      if (result.success && result.repositories) {
        setRepositories(result.repositories);

        // Select first repository or restore last selected from localStorage
        if (result.repositories.length > 0) {
          const lastSelectedId = localStorage.getItem('lastSelectedRepositoryId');
          const lastSelected = result.repositories.find((r: Repository) => r.id === lastSelectedId);
          setCurrentRepository(lastSelected || result.repositories[0]);
        }
      } else {
        console.error('Failed to load repositories:', result.error);
      }
    } catch (error) {
      console.error('Error loading repositories:', error);
    } finally {
      setIsLoadingRepos(false);
    }
  };

  const loadWorkspaces = async () => {
    setIsLoading(true);
    try {
      const result: WorkspaceListResult = await ipcRenderer.invoke('workspace:list');

      if (result.success && result.workspaces) {
        setWorkspaces(result.workspaces);
      } else {
        console.error('Failed to load workspaces:', result.error);
      }
    } catch (error) {
      console.error('Error loading workspaces:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createWorkspace = async () => {
    setIsCreating(true);
    try {
      const result: WorkspaceCreateResult = await ipcRenderer.invoke('workspace:create');

      if (result.success && result.workspace) {
        console.log('✅ Workspace created:', result.workspace.name);
        setWorkspaces([...workspaces, result.workspace]);
      } else {
        console.error('Failed to create workspace:', result.error);
        alert(`Failed to create workspace: ${result.error}`);
      }
    } catch (error) {
      console.error('Error creating workspace:', error);
      alert(`Error creating workspace: ${error}`);
    } finally {
      setIsCreating(false);
    }
  };

  const deleteWorkspace = async (workspaceId: string) => {
    try {
      const result = await ipcRenderer.invoke('workspace:delete', workspaceId);

      if (result.success) {
        console.log('✅ Workspace deleted:', workspaceId);
        setWorkspaces(workspaces.filter((w) => w.id !== workspaceId));

        // Clear active workspace if it was deleted
        if (selectedWorkspaceId === workspaceId) {
          onSelectWorkspace(null as any);
        }
      } else {
        console.error('Failed to delete workspace:', result.error);
        alert(`Failed to delete workspace: ${result.error}`);
      }
    } catch (error) {
      console.error('Error deleting workspace:', error);
      alert(`Error deleting workspace: ${error}`);
    }
  };

  const handleCreateRepository = async () => {
    try {
      const result = await ipcRenderer.invoke('repository:create');

      if (result.success && result.repository) {
        console.log('✅ Repository added:', result.repository.name);
        setRepositories([...repositories, result.repository]);
        setCurrentRepository(result.repository);
        localStorage.setItem('lastSelectedRepositoryId', result.repository.id);
      } else if (result.error !== 'User canceled selection') {
        alert(`Failed to add repository: ${result.error}`);
      }
    } catch (error) {
      console.error('Error adding repository:', error);
      alert(`Error: ${error}`);
    }
  };

  const handleCloneRepository = async (gitUrl: string) => {
    try {
      const result = await ipcRenderer.invoke('repository:clone', gitUrl);

      if (result.success && result.repository) {
        console.log('✅ Repository cloned:', result.repository.name);
        setRepositories([...repositories, result.repository]);
        setCurrentRepository(result.repository);
        localStorage.setItem('lastSelectedRepositoryId', result.repository.id);
      } else {
        alert(`Failed to clone repository: ${result.error}`);
      }
    } catch (error) {
      console.error('Error cloning repository:', error);
      alert(`Error: ${error}`);
    }
  };

  const openCloneDialog = () => {
    setIsCloneDialogOpen(true);
  };

  const handleSelectRepository = (repo: Repository) => {
    setCurrentRepository(repo);
    localStorage.setItem('lastSelectedRepositoryId', repo.id);
  };

  // Filter workspaces by current repository
  const filteredWorkspaces = useMemo(() => {
    if (!currentRepository) return workspaces;
    return workspaces.filter(w => w.repositoryId === currentRepository.id);
  }, [workspaces, currentRepository]);

  return (
    <aside className="w-[250px] bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Sidebar Top - Traffic Lights Area (Fully Draggable) */}
      <div
        className="h-[44px] border-b border-sidebar-border"
        style={{ WebkitAppRegion: 'drag' } as any}
      />

      {/* Repository Switcher */}
      <div className="p-3 border-b border-sidebar-border">
        <RepositorySwitcher
          currentRepository={currentRepository || fallbackRepository}
          repositories={repositories.length > 0 ? repositories : [fallbackRepository]}
          onSelectRepository={handleSelectRepository}
          onCreateRepository={handleCreateRepository}
          onCloneRepository={openCloneDialog}
        />
      </div>

      {/* New Workspace Button */}
      <div className="px-3 pt-3 pb-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={createWorkspace}
          disabled={isCreating}
          className="w-full justify-start text-sidebar-foreground-muted hover:text-sidebar-foreground hover:bg-sidebar-hover transition-all duration-200"
        >
          <Plus size={14} />
          {isCreating ? 'Creating...' : 'New Workspace'}
        </Button>
      </div>

      {/* Workspace List */}
      <div className="flex-1 overflow-auto py-2">
        {filteredWorkspaces.length === 0 ? (
          <div className="p-6 text-center text-sidebar-foreground-muted">
            <p className="text-sm">No workspaces yet</p>
            <p className="text-xs mt-2">Create your first workspace</p>
          </div>
        ) : (
          filteredWorkspaces.map((workspace) => (
            <WorkspaceItem
              key={workspace.id}
              workspace={workspace}
              status={statuses[workspace.id]}
              isActive={workspace.id === selectedWorkspaceId}
              onSelect={onSelectWorkspace}
              onDelete={deleteWorkspace}
            />
          ))
        )}
      </div>

      {/* Bottom Status */}
      <div className="p-3 border-t border-sidebar-border">
        <div className="flex items-center justify-between text-xs text-sidebar-foreground-muted">
          <span>{filteredWorkspaces.length} workspace(s)</span>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-status-synced" />
            <span>Ready</span>
            <button
              onClick={() => {
                loadWorkspaces();
                if (workspaces.length > 0) {
                  loadStatuses(workspaces);
                }
              }}
              disabled={isLoading}
              className="ml-1 p-1 hover:bg-sidebar-accent rounded transition-colors disabled:opacity-50"
              title="Refresh workspaces"
            >
              <RefreshCw size={12} className={cn(isLoading && 'animate-spin')} />
            </button>
          </div>
        </div>
      </div>

      {/* Clone Repository Dialog */}
      <CloneRepositoryDialog
        isOpen={isCloneDialogOpen}
        onClose={() => setIsCloneDialogOpen(false)}
        onClone={handleCloneRepository}
      />
    </aside>
  );
};
