import React, { useState } from 'react';
import { ChevronDown, FolderPlus, GitFork, Settings, ExternalLink, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Repository } from '@/types/workspace';
import { DotMatrixAvatar } from './DotMatrixAvatar';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

interface RepositorySwitcherProps {
  currentRepository: Repository;
  repositories?: Repository[];
  onSelectRepository?: (repo: Repository) => void;
  onCreateRepository?: () => void;
  onCloneRepository?: () => void;
  onRemoveRepository?: (repoId: string) => void;
}

// Generate consistent color from string (repository name)
const getAvatarColor = (name: string): string => {
  const colors = [
    'oklch(0.58 0.10 40)',   // Muted orange
    'oklch(0.55 0.15 250)',  // Blue
    'oklch(0.55 0.15 150)',  // Green
    'oklch(0.55 0.18 290)',  // Purple
    'oklch(0.55 0.20 25)',   // Red
    'oklch(0.62 0.12 60)',   // Yellow
  ];

  // Simple hash function to get consistent color index
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

export const RepositorySwitcher: React.FC<RepositorySwitcherProps> = ({
  currentRepository,
  repositories = [],
  onSelectRepository,
  onCreateRepository,
  onCloneRepository,
  onRemoveRepository,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [repoToDelete, setRepoToDelete] = useState<Repository | null>(null);

  // Get first letter for avatar
  const firstLetter = currentRepository.name.charAt(0).toUpperCase();
  const avatarColor = getAvatarColor(currentRepository.name);

  // Filter repositories based on search
  const filteredRepositories = repositories.filter(repo =>
    repo.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle delete click
  const handleDeleteClick = (repo: Repository, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setRepoToDelete(repo);
    setDeleteDialogOpen(true);
    setIsOpen(false);
  };

  // Handle delete confirm
  const handleDeleteConfirm = async () => {
    if (!repoToDelete || !onRemoveRepository) return;
    onRemoveRepository(repoToDelete.id);
    setDeleteDialogOpen(false);
    setRepoToDelete(null);
  };

  // Handle delete cancel
  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setRepoToDelete(null);
  };

  return (
    <>
      <div className="relative">
        {/* Main Button */}
        <motion.button
          onClick={() => setIsOpen(!isOpen)}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          className={cn(
            "w-full flex items-center justify-between gap-2 px-2 py-2 rounded-md",
            "transition-all duration-200 ease-out",
            "bg-transparent",
            "hover:bg-sidebar/20",
            "group min-w-0"
          )}
        >
          {/* Repository Name */}
          <span className="text-base font-normal text-sidebar-foreground-muted truncate text-left min-w-0 flex-1">
            {currentRepository.name}
          </span>

          {/* Chevron */}
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="flex-shrink-0"
          >
            <ChevronDown
              size={18}
              strokeWidth={1.5}
              className="text-sidebar-foreground-muted"
            />
          </motion.div>
        </motion.button>

        {/* Dropdown Menu */}
        <AnimatePresence>
          {isOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => {
                  setIsOpen(false);
                  setSearchQuery('');
                }}
              />

              {/* Menu */}
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                className="absolute top-full left-0 right-0 mt-2 z-20 bg-sidebar border border-border rounded-lg shadow-2xl overflow-hidden"
              >
                {/* Search bar (only show when many repos) */}
                {repositories.length > 3 && (
                  <div className="p-2 border-b border-border">
                    <input
                      type="text"
                      placeholder="Search repositories..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={cn(
                        "w-full px-3 py-1.5 text-sm rounded-md",
                        "bg-sidebar-accent border border-sidebar-border",
                        "text-sidebar-foreground placeholder:text-sidebar-foreground-muted",
                        "focus:outline-none focus:ring-1 focus:ring-sidebar-ring"
                      )}
                      autoFocus
                    />
                  </div>
                )}

                {/* Current Repository */}
                <div className="p-2 border-b border-border">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-sidebar-accent">
                    <DotMatrixAvatar
                      letter={firstLetter}
                      color={avatarColor}
                      size="sm"
                      animate={false}
                    />
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-base font-normal text-foreground truncate">
                        {currentRepository.name}
                      </span>
                      <span className="text-xs font-normal text-muted-foreground truncate">
                        {currentRepository.defaultBranch || 'main'}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsDetailModalOpen(true);
                        setIsOpen(false);
                      }}
                      className="p-1 rounded hover:bg-sidebar-hover transition-colors"
                      title="Repository details"
                    >
                      <Settings size={14} className="text-sidebar-foreground-muted" />
                    </button>
                  </div>
                </div>

                {/* Other Repositories */}
                {filteredRepositories.filter(r => r.id !== currentRepository.id).length > 0 && (
                  <div className="p-2 border-b border-border max-h-64 overflow-y-auto">
                    <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Switch Repository
                    </div>
                    {filteredRepositories
                      .filter((repo) => repo.id !== currentRepository.id)
                      .map((repo) => {
                        const repoFirstLetter = repo.name.charAt(0).toUpperCase();
                        const repoColor = getAvatarColor(repo.name);

                        return (
                          <ContextMenu key={repo.id}>
                            <ContextMenuTrigger asChild>
                              <motion.button
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => {
                                  onSelectRepository?.(repo);
                                  setIsOpen(false);
                                  setSearchQuery('');
                                }}
                                className={cn(
                                  "w-full flex items-center gap-3 px-3 py-2 rounded-md",
                                  "transition-all duration-200",
                                  "hover:bg-sidebar-hover"
                                )}
                              >
                                <DotMatrixAvatar
                                  letter={repoFirstLetter}
                                  color={repoColor}
                                  size="sm"
                                  animate={false}
                                />
                                <div className="flex flex-col items-start flex-1 min-w-0">
                                  <span className="text-base font-normal text-foreground truncate w-full">
                                    {repo.name}
                                  </span>
                                  <span className="text-xs font-normal text-muted-foreground truncate w-full">
                                    {repo.defaultBranch || 'main'}
                                  </span>
                                </div>
                              </motion.button>
                            </ContextMenuTrigger>
                            <ContextMenuContent>
                              <ContextMenuItem
                                onClick={(e) => handleDeleteClick(repo, e)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Remove Repository
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
                        );
                      })}
                  </div>
                )}

                {/* Add Repository Options */}
                <div className="p-2 space-y-1">
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      onCreateRepository?.();
                      setIsOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 rounded-md",
                      "transition-all duration-200",
                      "hover:bg-sidebar-hover",
                      "text-sidebar-foreground-muted hover:text-sidebar-foreground"
                    )}
                  >
                    <FolderPlus size={18} strokeWidth={1.5} />
                    <span className="text-base font-normal">Add Local Repository</span>
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      onCloneRepository?.();
                      setIsOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 rounded-md",
                      "transition-all duration-200",
                      "hover:bg-sidebar-hover",
                      "text-sidebar-foreground-muted hover:text-sidebar-foreground"
                    )}
                  >
                    <GitFork size={18} strokeWidth={1.5} />
                    <span className="text-base font-normal">Clone from Git</span>
                  </motion.button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Repository Detail Modal */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DotMatrixAvatar
                letter={firstLetter}
                color={avatarColor}
                size="sm"
                animate={false}
              />
              {currentRepository.name}
            </DialogTitle>
            <DialogDescription>
              Repository details and settings
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Repository Info */}
            <div className="space-y-2">
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm text-muted-foreground">Path</span>
                <span className="text-sm font-mono text-foreground truncate max-w-[300px]" title={currentRepository.path}>
                  {currentRepository.path}
                </span>
              </div>

              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm text-muted-foreground">Default Branch</span>
                <span className="text-sm text-foreground">{currentRepository.defaultBranch || 'main'}</span>
              </div>

              {currentRepository.remoteUrl && (
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-sm text-muted-foreground">Remote URL</span>
                  <a
                    href={currentRepository.remoteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    View <ExternalLink size={12} />
                  </a>
                </div>
              )}

              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-muted-foreground">Created</span>
                <span className="text-sm text-foreground">
                  {new Date(currentRepository.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Quick Actions</h4>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" className="w-full">
                  Open in Finder
                </Button>
                <Button variant="outline" size="sm" className="w-full">
                  Open in Terminal
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Repository?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove "{repoToDelete?.name}" from Octave?
              This will only remove it from the sidebar - your files will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
