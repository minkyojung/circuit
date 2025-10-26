import React, { useState } from 'react';
import { ChevronDown, Plus, GitBranch, FolderPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Repository } from '@/types/workspace';
import { DotMatrixAvatar } from './DotMatrixAvatar';

interface RepositorySwitcherProps {
  currentRepository: Repository;
  repositories?: Repository[];
  onSelectRepository?: (repo: Repository) => void;
  onCreateRepository?: () => void;
  onCloneRepository?: () => void;
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
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Get first letter for avatar
  const firstLetter = currentRepository.name.charAt(0).toUpperCase();
  const avatarColor = getAvatarColor(currentRepository.name);

  return (
    <div className="relative">
      {/* Main Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between px-2 py-2 rounded-md",
          "transition-all duration-200 ease-out",
          "hover:bg-sidebar-hover active:bg-sidebar-hover",
          "group"
        )}
      >
        {/* Repository Info - Single Line */}
        <span className="text-sm font-medium text-sidebar-foreground-muted truncate">
          {currentRepository.name} - {currentRepository.defaultBranch || 'main'}
        </span>

        {/* Chevron */}
        <ChevronDown
          size={16}
          className={cn(
            "flex-shrink-0 text-sidebar-foreground-muted transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div className="absolute top-full left-0 right-0 mt-2 z-20 bg-card border border-border rounded-md shadow-lg overflow-hidden">
            {/* Current Repository */}
            <div className="p-2 border-b border-border">
              <div className="px-3 py-2 rounded-md bg-sidebar-accent">
                <div className="flex items-center gap-3">
                  <DotMatrixAvatar
                    letter={firstLetter}
                    color={avatarColor}
                    size="sm"
                    animate={false}
                  />
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-sm font-medium text-foreground truncate">
                      {currentRepository.name}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {currentRepository.defaultBranch || 'main'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Other Repositories */}
            {repositories.length > 1 && (
              <div className="p-2 border-b border-border">
                <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Switch Repository
                </div>
                {repositories
                  .filter((repo) => repo.id !== currentRepository.id)
                  .map((repo) => {
                    const repoFirstLetter = repo.name.charAt(0).toUpperCase();
                    const repoColor = getAvatarColor(repo.name);

                    return (
                      <button
                        key={repo.id}
                        onClick={() => {
                          onSelectRepository?.(repo);
                          setIsOpen(false);
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
                          <span className="text-sm font-medium text-foreground truncate w-full">
                            {repo.name}
                          </span>
                          <span className="text-xs text-muted-foreground truncate w-full">
                            {repo.defaultBranch || 'main'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
              </div>
            )}

            {/* Add Repository Options */}
            <div className="p-2 space-y-1">
              <button
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
                <FolderPlus size={16} />
                <span className="text-sm font-medium">Add Local Repository</span>
              </button>

              <button
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
                <GitBranch size={16} />
                <span className="text-sm font-medium">Clone from Git</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
