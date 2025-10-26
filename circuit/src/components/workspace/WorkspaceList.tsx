import React from 'react';
import type { Workspace, WorkspaceStatus } from '@/types/workspace';
import { WorkspaceItem } from './WorkspaceItem';

interface WorkspaceListProps {
  workspaces: Workspace[];
  statuses: Record<string, WorkspaceStatus>;
  activeWorkspaceId: string | null;
  onSelectWorkspace: (workspace: Workspace) => void;
  onDeleteWorkspace: (workspaceId: string) => void;
}

export const WorkspaceList: React.FC<WorkspaceListProps> = ({
  workspaces,
  statuses,
  activeWorkspaceId,
  onSelectWorkspace,
  onDeleteWorkspace,
}) => {
  if (workspaces.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>No workspaces yet</p>
        <p className="text-sm mt-2">
          Create your first workspace to get started
        </p>
      </div>
    );
  }

  return (
    <div className="py-2">
      {workspaces.map((workspace) => (
        <WorkspaceItem
          key={workspace.id}
          workspace={workspace}
          status={statuses[workspace.id]}
          isActive={workspace.id === activeWorkspaceId}
          onSelect={onSelectWorkspace}
          onDelete={onDeleteWorkspace}
        />
      ))}
    </div>
  );
};
