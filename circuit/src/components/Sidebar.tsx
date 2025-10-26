import React, { useState, useEffect, useMemo } from 'react';
import type { Workspace, WorkspaceCreateResult, WorkspaceListResult, WorkspaceStatus, Repository } from '@/types/workspace';
import { WorkspaceItem } from './workspace/WorkspaceItem';
import { RepositorySwitcher } from './workspace/RepositorySwitcher';
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

  // Create a temporary repository from project path
  // TODO: Later, fetch actual repositories from backend
  const repository: Repository = useMemo(() => {
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
          currentRepository={repository}
          repositories={[repository]}
          onCreateRepository={() => {
            // TODO: Implement repository creation
            console.log('Create new repository');
          }}
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
        {workspaces.length === 0 ? (
          <div className="p-6 text-center text-sidebar-foreground-muted">
            <p className="text-sm">No workspaces yet</p>
            <p className="text-xs mt-2">Create your first workspace</p>
          </div>
        ) : (
          workspaces.map((workspace) => (
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
          <span>{workspaces.length} workspace(s)</span>
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
    </aside>
  );
};
