import React, { useState } from 'react';
import { ChevronDown, Plus, FolderGit2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Repository } from '@/types/workspace';

interface RepositorySwitcherProps {
  currentRepository: Repository;
  repositories?: Repository[];
  onSelectRepository?: (repo: Repository) => void;
  onCreateRepository?: () => void;
}

export const RepositorySwitcher: React.FC<RepositorySwitcherProps> = ({
  currentRepository,
  repositories = [],
  onSelectRepository,
  onCreateRepository,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      {/* Main Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg",
          "transition-all duration-200 ease-out",
          "hover:bg-sidebar-hover active:bg-sidebar-hover",
          "group"
        )}
      >
        {/* Repository Icon */}
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <FolderGit2 size={16} className="text-primary-foreground" />
        </div>

        {/* Repository Info */}
        <div className="flex flex-col items-start flex-1 min-w-0">
          <span className="text-sm font-semibold text-sidebar-foreground truncate w-full">
            {currentRepository.name}
          </span>
          <span className="text-xs text-sidebar-foreground-muted truncate w-full">
            {repositories.length} workspace(s)
          </span>
        </div>

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
          <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
            {/* Current Repository */}
            <div className="p-2 border-b border-border">
              <div className="px-3 py-2 rounded-md bg-sidebar-accent">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
                    <FolderGit2 size={16} className="text-primary-foreground" />
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-sm font-medium text-foreground truncate">
                      {currentRepository.name}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      Current repository
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Other Repositories */}
            {repositories.length > 1 && (
              <div className="p-2 border-b border-border">
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  Switch Repository
                </div>
                {repositories
                  .filter((repo) => repo.id !== currentRepository.id)
                  .map((repo) => (
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
                      <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center">
                        <FolderGit2 size={16} className="text-muted-foreground" />
                      </div>
                      <div className="flex flex-col items-start flex-1 min-w-0">
                        <span className="text-sm font-medium text-foreground truncate w-full">
                          {repo.name}
                        </span>
                        <span className="text-xs text-muted-foreground truncate w-full">
                          {repo.path}
                        </span>
                      </div>
                    </button>
                  ))}
              </div>
            )}

            {/* Add New Repository */}
            <div className="p-2">
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
                <Plus size={16} />
                <span className="text-sm font-medium">Add Repository</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
