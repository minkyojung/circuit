import React, { useState, useEffect } from 'react';
import type { Workspace, WorkspaceCreateResult, WorkspaceListResult, WorkspaceStatus } from '@/types/workspace';
import { WorkspaceList } from './WorkspaceList';
import { Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const ipcRenderer = window.electron.ipcRenderer;

interface WorkspaceManagerProps {
  onSelectWorkspace: (workspace: Workspace) => void;
}

export const WorkspaceManager: React.FC<WorkspaceManagerProps> = ({ onSelectWorkspace }) => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [statuses, setStatuses] = useState<Record<string, WorkspaceStatus>>({});
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

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

  const selectWorkspace = (workspace: Workspace) => {
    setActiveWorkspaceId(workspace.id);
    console.log('Selected workspace:', workspace.name);
    onSelectWorkspace(workspace);
  };

  const deleteWorkspace = async (workspaceId: string) => {
    try {
      const result = await ipcRenderer.invoke('workspace:delete', workspaceId);

      if (result.success) {
        console.log('✅ Workspace deleted:', workspaceId);
        setWorkspaces(workspaces.filter((w) => w.id !== workspaceId));

        // Clear active workspace if it was deleted
        if (activeWorkspaceId === workspaceId) {
          setActiveWorkspaceId(null);
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
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h2 className="m-0 text-lg font-semibold text-foreground">Workspaces</h2>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadWorkspaces();
              if (workspaces.length > 0) {
                loadStatuses(workspaces);
              }
            }}
            disabled={isLoading}
          >
            <RefreshCw size={16} className={cn(isLoading && 'animate-spin')} />
            Refresh
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={createWorkspace}
            disabled={isCreating}
          >
            <Plus size={16} />
            {isCreating ? 'Creating...' : 'New Workspace'}
          </Button>
        </div>
      </div>

      {/* Workspace List */}
      <div className="flex-1 overflow-auto">
        <WorkspaceList
          workspaces={workspaces}
          statuses={statuses}
          activeWorkspaceId={activeWorkspaceId}
          onSelectWorkspace={selectWorkspace}
          onDeleteWorkspace={deleteWorkspace}
        />
      </div>

      {/* Footer Info */}
      <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground flex justify-between">
        <span>{workspaces.length} workspace(s)</span>
        <span>Git Worktree Isolation</span>
      </div>
    </div>
  );
};
