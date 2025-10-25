import React from 'react';
import type { Workspace } from '@/types/workspace';
import { WorkspaceItem } from './WorkspaceItem';

interface WorkspaceListProps {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  onSelectWorkspace: (workspace: Workspace) => void;
  onDeleteWorkspace: (workspaceId: string) => void;
}

export const WorkspaceList: React.FC<WorkspaceListProps> = ({
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  onDeleteWorkspace,
}) => {
  if (workspaces.length === 0) {
    return (
      <div
        style={{
          padding: '32px',
          textAlign: 'center',
          color: '#888',
        }}
      >
        <p>No workspaces yet</p>
        <p style={{ fontSize: '14px', marginTop: '8px' }}>
          Create your first workspace to get started
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px' }}>
      {workspaces.map((workspace) => (
        <WorkspaceItem
          key={workspace.id}
          workspace={workspace}
          isActive={workspace.id === activeWorkspaceId}
          onSelect={onSelectWorkspace}
          onDelete={onDeleteWorkspace}
        />
      ))}
    </div>
  );
};
