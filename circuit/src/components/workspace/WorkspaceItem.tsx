import React from 'react';
import type { Workspace, WorkspaceStatus } from '@/types/workspace';
import { Trash2, GitBranch, FolderGit2, Check, GitMerge, ArrowUp, ArrowDown, GitCommit, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WorkspaceItemProps {
  workspace: Workspace;
  status?: WorkspaceStatus;
  isActive: boolean;
  onSelect: (workspace: Workspace) => void;
  onDelete: (workspaceId: string) => void;
}

const getStatusBadge = (status?: WorkspaceStatus) => {
  if (!status) {
    return { icon: <Loader2 size={12} className="animate-spin" />, text: 'Loading...', className: 'bg-muted text-muted-foreground' };
  }

  switch (status.status) {
    case 'merged':
      return { icon: <GitMerge size={12} />, text: 'Merged', className: 'bg-status-merged/10 text-status-merged' };
    case 'working':
      return { icon: <GitCommit size={12} />, text: 'Working', className: 'bg-status-working/10 text-status-working' };
    case 'ahead':
      return { icon: <ArrowUp size={12} />, text: `Ahead ${status.ahead}`, className: 'bg-status-ahead/10 text-status-ahead' };
    case 'behind':
      return { icon: <ArrowDown size={12} />, text: `Behind ${status.behind}`, className: 'bg-status-behind/10 text-status-behind' };
    case 'diverged':
      return { icon: <GitCommit size={12} />, text: 'Diverged', className: 'bg-status-diverged/10 text-status-diverged' };
    case 'synced':
      return { icon: <Check size={12} />, text: 'Synced', className: 'bg-status-synced/10 text-status-synced' };
    case 'local':
      return { icon: <GitBranch size={12} />, text: 'Local Only', className: 'bg-muted text-muted-foreground' };
    default:
      return { icon: <Loader2 size={12} />, text: 'Unknown', className: 'bg-muted text-muted-foreground' };
  }
};

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

  const badge = getStatusBadge(status);

  // Check if workspace name and branch are the same (hide branch if redundant)
  const showBranch = workspace.name !== workspace.branch;

  return (
    <div
      className={cn(
        "group px-3 py-2 mx-2 mb-1 cursor-pointer rounded-md transition-all duration-200 ease-out",
        "hover:bg-sidebar-hover",
        isActive ? "bg-sidebar-accent" : "bg-transparent"
      )}
      onClick={() => onSelect(workspace)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Workspace Name */}
          <div className="flex items-center gap-2 mb-1">
            <FolderGit2
              size={14}
              className={cn(
                "flex-shrink-0",
                isActive ? "text-sidebar-foreground" : "text-sidebar-foreground-muted"
              )}
            />
            <span className={cn(
              "text-sm font-medium truncate",
              isActive ? "text-sidebar-foreground" : "text-sidebar-foreground-muted"
            )}>
              {workspace.name}
            </span>
          </div>

          {/* Branch (only if different from workspace name) */}
          {showBranch && (
            <div className="flex items-center gap-1.5 mb-1 ml-5">
              <GitBranch size={10} className="text-sidebar-foreground-muted flex-shrink-0" />
              <span className="text-[11px] text-sidebar-foreground-muted truncate">{workspace.branch}</span>
            </div>
          )}

          {/* Status Badge and File Changes */}
          <div className="ml-5 flex items-center gap-2 flex-wrap">
            <div className={cn(
              "inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium",
              badge.className
            )}>
              {badge.icon}
              <span>{badge.text}</span>
            </div>

            {status && !status.clean && (
              <div className="text-[10px] text-status-working">
                {status.modified > 0 && `${status.modified}M`}
                {status.added > 0 && ` ${status.added}A`}
                {status.deleted > 0 && ` ${status.deleted}D`}
                {status.untracked > 0 && ` ${status.untracked}U`}
              </div>
            )}
          </div>
        </div>

        {/* Delete Button */}
        <button
          onClick={handleDelete}
          className="flex-shrink-0 p-1 text-sidebar-foreground-muted hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
};
