import React, { useState } from 'react';
import type { Workspace, WorkspaceStatus } from '@/types/workspace';
import {
  Trash2, FolderGit2, Check, GitMerge, ArrowUp, ArrowDown, GitCommit, Loader2,
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
          <div className="flex items-start gap-3 w-full min-w-0">
            {/* Icon with status glow */}
            <FolderGit2
              size={18}
              strokeWidth={1.5}
              className={cn(
                "flex-shrink-0 mt-0.5 transition-all duration-300",
                status?.clean
                  ? "text-status-synced drop-shadow-[0_0_6px_rgba(34,197,94,0.5)]"
                  : "text-status-behind drop-shadow-[0_0_6px_rgba(249,115,22,0.5)]"
              )}
            />

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-1">
              {/* Top row: Name */}
              <div className="flex items-center gap-2">
                <span className="text-base font-normal text-sidebar-foreground-muted truncate flex-1">
                  {workspace.name}
                </span>

                {/* Diff stats - only show when dirty */}
                {status && !status.clean && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-1.5 text-sm font-mono flex-shrink-0"
                  >
                    {(status.added > 0 || status.modified > 0) && (
                      <span className="text-status-synced">
                        +{status.added + status.modified}
                      </span>
                    )}
                    {status.deleted > 0 && (
                      <span className="text-status-behind">
                        -{status.deleted}
                      </span>
                    )}
                  </motion.div>
                )}
              </div>

              {/* Bottom row: Metadata */}
              <div className="flex items-center gap-1 text-sm font-normal opacity-40 text-sidebar-foreground">
                {/* Branch name */}
                <span className="text-sm font-normal flex-shrink-0">{workspace.branch}</span>

                {/* Creation time */}
                <span className="flex-shrink-0 text-sm font-normal">
                  {(() => {
                    const now = Date.now()
                    const created = new Date(workspace.createdAt).getTime()

                    if (isNaN(created) || created < new Date('2020-01-01').getTime()) {
                      return 'just now'
                    }

                    const diff = now - created
                    const minutes = Math.floor(diff / 60000)
                    const hours = Math.floor(diff / 3600000)
                    const days = Math.floor(diff / 86400000)

                    if (minutes < 1) return 'just now'
                    if (minutes < 60) return `${minutes}m ago`
                    if (hours < 24) return `${hours}h ago`
                    if (days < 7) return `${days}d ago`
                    if (days < 30) return `${Math.floor(days / 7)}w ago`
                    if (days < 365) return `${Math.floor(days / 30)}mo ago`
                    return `${Math.floor(days / 365)}y ago`
                  })()}
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
