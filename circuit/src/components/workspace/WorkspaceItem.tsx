import React from 'react';
import type { Workspace, WorkspaceStatus } from '@/types/workspace';
import { Trash2, GitBranch, FolderGit2 } from 'lucide-react';

interface WorkspaceItemProps {
  workspace: Workspace;
  status?: WorkspaceStatus;
  isActive: boolean;
  onSelect: (workspace: Workspace) => void;
  onDelete: (workspaceId: string) => void;
}

export const WorkspaceItem: React.FC<WorkspaceItemProps> = ({
  workspace,
  status,
  isActive,
  onSelect,
  onDelete,
}) => {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete workspace "${workspace.name}"?`)) {
      onDelete(workspace.id);
    }
  };

  return (
    <div
      className={`workspace-item ${isActive ? 'active' : ''}`}
      onClick={() => onSelect(workspace)}
      style={{
        padding: '12px 16px',
        borderRadius: '8px',
        border: isActive ? '2px solid #4CAF50' : '1px solid #333',
        backgroundColor: isActive ? '#1a1a1a' : '#0a0a0a',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '8px',
        transition: 'all 0.2s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
        <FolderGit2 size={20} color={isActive ? '#4CAF50' : '#888'} />

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontWeight: 600, color: isActive ? '#4CAF50' : '#fff' }}>
              {workspace.name}
            </span>
            {isActive && (
              <span
                style={{
                  fontSize: '10px',
                  padding: '2px 6px',
                  backgroundColor: '#4CAF50',
                  color: '#000',
                  borderRadius: '4px',
                  fontWeight: 600,
                }}
              >
                ACTIVE
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <GitBranch size={14} color="#888" />
            <span style={{ fontSize: '12px', color: '#888' }}>{workspace.branch}</span>
          </div>

          {status && !status.clean && (
            <div style={{ fontSize: '11px', color: '#ff9800', marginTop: '4px' }}>
              {status.modified > 0 && `${status.modified} modified`}
              {status.added > 0 && ` • ${status.added} added`}
              {status.deleted > 0 && ` • ${status.deleted} deleted`}
              {status.untracked > 0 && ` • ${status.untracked} untracked`}
            </div>
          )}
        </div>
      </div>

      <button
        onClick={handleDelete}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '8px',
          color: '#888',
          display: 'flex',
          alignItems: 'center',
          transition: 'color 0.2s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#f44336')}
        onMouseLeave={(e) => (e.currentTarget.style.color = '#888')}
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
};
