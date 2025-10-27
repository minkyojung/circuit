import React, { useState } from 'react';
import type { Workspace, WorkspaceStatus } from '@/types/workspace';
import {
  Trash2, GitBranch, Check, GitMerge, ArrowUp, ArrowDown, GitCommit, Loader2,
  FolderOpen, GitPullRequest, RefreshCw, Terminal
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

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
  const [isHovered, setIsHovered] = useState(false);

  const handleDelete = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (confirm(`Delete workspace "${workspace.name}"?`)) {
      onDelete(workspace.id);
    }
  };

  const handleOpenInFinder = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    // TODO: Implement open in Finder
    console.log('Open in Finder:', workspace.path);
  };

  const handleOpenInTerminal = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    // TODO: Implement open in Terminal
    console.log('Open in Terminal:', workspace.path);
  };

  const handleCreatePR = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    // TODO: Implement create PR
    console.log('Create PR:', workspace.id);
  };

  const handleRefreshStatus = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    // TODO: Implement refresh status
    console.log('Refresh status:', workspace.id);
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <motion.div
          className={cn(
            "group px-2 py-2 mx-2 mb-1 cursor-pointer rounded-md transition-all duration-200 ease-out",
            "hover:bg-sidebar-hover",
            isActive ? "bg-sidebar-accent" : "bg-transparent"
          )}
          onClick={() => onSelect(workspace)}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
        >
          <div className="flex items-start gap-2.5 w-full min-w-0">
            {/* Branch icon */}
            <GitBranch
              size={14}
              strokeWidth={1.5}
              className="flex-shrink-0 mt-0.5 text-sidebar-foreground-muted opacity-30 transition-opacity duration-200"
            />

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-1">
              {/* Top row: Name + Time */}
              <div className="flex items-center gap-2">
                <span className="text-base font-medium text-sidebar-foreground truncate flex-1">
                  {workspace.name}
                </span>

                {/* Time */}
                <span className="text-xs text-sidebar-foreground opacity-50 flex-shrink-0">
                  {(() => {
                    const now = Date.now()
                    const created = new Date(workspace.createdAt).getTime()

                    if (isNaN(created) || created < new Date('2020-01-01').getTime()) {
                      return 'now'
                    }

                    const diff = now - created
                    const minutes = Math.floor(diff / 60000)
                    const hours = Math.floor(diff / 3600000)
                    const days = Math.floor(diff / 86400000)

                    if (minutes < 1) return 'now'
                    if (minutes < 60) return `${minutes}m`
                    if (hours < 24) return `${hours}h`
                    if (days < 7) return `${days}d`
                    if (days < 30) return `${Math.floor(days / 7)}w`
                    if (days < 365) return `${Math.floor(days / 30)}mo`
                    return `${Math.floor(days / 365)}y`
                  })()}
                </span>

                {/* Diff stats - always show */}
                <div className="flex items-center gap-1.5 text-sm font-mono flex-shrink-0">
                  <span className={cn(
                    status && (status.added > 0 || status.modified > 0)
                      ? "text-green-400/60"
                      : "text-sidebar-foreground-muted/30"
                  )}>
                    +{status ? (status.added + status.modified) : 0}
                  </span>
                  <span className={cn(
                    status && status.deleted > 0
                      ? "text-red-400/60"
                      : "text-sidebar-foreground-muted/30"
                  )}>
                    -{status ? status.deleted : 0}
                  </span>
                </div>
              </div>

              {/* Bottom row: Metadata */}
              <div className="flex items-center gap-1.5 text-xs font-normal opacity-40 text-sidebar-foreground">
                {/* Branch name */}
                <span className="flex-shrink-0">{workspace.branch}</span>

                {/* Divider */}
                <span>·</span>

                {/* File count - TODO: get actual file count */}
                <span className="flex-shrink-0">
                  {status && !status.clean
                    ? `${status.added + status.modified + status.deleted} File${(status.added + status.modified + status.deleted) > 1 ? 's' : ''}`
                    : '0 Files'
                  }
                </span>
              </div>
            </div>

            {/* Quick actions (shown on hover) */}
            <AnimatePresence>
              {isHovered && !isActive && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.1 }}
                  className="flex items-center gap-0.5 flex-shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className="p-1 rounded hover:bg-sidebar-accent transition-colors"
                    title="Refresh status"
                    onClick={handleRefreshStatus}
                  >
                    <RefreshCw size={12} strokeWidth={1.5} className="text-sidebar-foreground-muted" />
                  </button>
                  <button
                    className="p-1 rounded hover:bg-sidebar-accent transition-colors"
                    title="Delete workspace"
                    onClick={handleDelete}
                  >
                    <Trash2 size={12} strokeWidth={1.5} className="text-sidebar-foreground-muted hover:text-destructive" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </ContextMenuTrigger>

      {/* Context Menu */}
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={() => onSelect(workspace)}>
          <FolderOpen size={14} className="mr-2" />
          Open Workspace
        </ContextMenuItem>
        <ContextMenuItem onClick={handleOpenInFinder}>
          <FolderOpen size={14} className="mr-2" />
          Show in Finder
        </ContextMenuItem>
        <ContextMenuItem onClick={handleOpenInTerminal}>
          <Terminal size={14} className="mr-2" />
          Open in Terminal
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleRefreshStatus}>
          <RefreshCw size={14} className="mr-2" />
          Refresh Status
        </ContextMenuItem>
        <ContextMenuItem onClick={handleCreatePR}>
          <GitPullRequest size={14} className="mr-2" />
          Create Pull Request
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
          <Trash2 size={14} className="mr-2" />
          Delete Workspace
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};
