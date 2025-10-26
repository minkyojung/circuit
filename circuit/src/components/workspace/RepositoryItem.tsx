import React, { useState } from 'react';
import { ChevronRight, ChevronDown, FolderGit2, MoreHorizontal } from 'lucide-react';
import type { Repository, Workspace, WorkspaceStatus } from '@/types/workspace';
import { WorkspaceItem } from './WorkspaceItem';

interface RepositoryItemProps {
  repository: Repository;
  workspaces: Workspace[];
  statuses: Record<string, WorkspaceStatus>;
  activeWorkspaceId: string | null;
  onSelectWorkspace: (workspace: Workspace) => void;
  onDeleteWorkspace: (workspaceId: string) => void;
  defaultExpanded?: boolean;
}

export const RepositoryItem: React.FC<RepositoryItemProps> = ({
  repository,
  workspaces,
  statuses,
  activeWorkspaceId,
  onSelectWorkspace,
  onDeleteWorkspace,
  defaultExpanded = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="mb-2">
      {/* Repository Header */}
      <div
        className="group flex items-center justify-between px-3 py-2 mx-2 rounded-md hover:bg-sidebar-hover cursor-pointer transition-all duration-200 ease-out"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Collapse/Expand Icon */}
          {isExpanded ? (
            <ChevronDown size={16} className="flex-shrink-0 text-sidebar-foreground-muted" />
          ) : (
            <ChevronRight size={16} className="flex-shrink-0 text-sidebar-foreground-muted" />
          )}

          {/* Repository Icon */}
          <FolderGit2 size={16} className="flex-shrink-0 text-sidebar-foreground" />

          {/* Repository Name */}
          <span className="text-sm font-semibold text-sidebar-foreground truncate">
            {repository.name}
          </span>

          {/* Workspace Count Badge */}
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sidebar-accent text-sidebar-foreground-muted font-medium">
            {workspaces.length}
          </span>
        </div>

        {/* Context Menu Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            // TODO: Open context menu
          }}
          className="flex-shrink-0 p-1 opacity-0 group-hover:opacity-100 hover:bg-sidebar-accent rounded transition-all"
        >
          <MoreHorizontal size={14} className="text-sidebar-foreground-muted" />
        </button>
      </div>

      {/* Workspaces List */}
      {isExpanded && (
        <div className="ml-4">
          {workspaces.length === 0 ? (
            <div className="px-3 py-2 text-xs text-sidebar-foreground-muted">
              No workspaces
            </div>
          ) : (
            workspaces.map((workspace) => (
              <WorkspaceItem
                key={workspace.id}
                workspace={workspace}
                status={statuses[workspace.id]}
                isActive={workspace.id === activeWorkspaceId}
                onSelect={onSelectWorkspace}
                onDelete={onDeleteWorkspace}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};
