/**
 * RepositoryStep - Select or create Git repository
 *
 * Options:
 * - Select existing repository
 * - Create new repository (future)
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FolderOpen, GitBranch, Clock, AlertCircle, Loader2 } from 'lucide-react';
import type { RepositoryInfo } from '@/types/onboarding';

interface RepositoryStepProps {
  onSelect: (repo: RepositoryInfo) => void;
  selectedRepository: RepositoryInfo | null;
}

export function RepositoryStep({ onSelect, selectedRepository }: RepositoryStepProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repository, setRepository] = useState<RepositoryInfo | null>(selectedRepository);

  const handleSelectRepository = async () => {
    setLoading(true);
    setError(null);

    try {
      const ipcRenderer = window.electron.ipcRenderer;

      // Open folder picker
      const result = await ipcRenderer.invoke('dialog:open-folder');

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        setLoading(false);
        return;
      }

      const folderPath = result.filePaths[0];

      // Check if it's a Git repository
      const gitCheck = await ipcRenderer.invoke('git:check-repository', folderPath);

      if (!gitCheck.isRepository) {
        setError('Selected folder is not a Git repository. Please select a folder that contains a .git directory.');
        setLoading(false);
        return;
      }

      // Get repository info
      const repoInfo: RepositoryInfo = {
        path: folderPath,
        name: folderPath.split('/').pop() || 'Unknown',
        defaultBranch: gitCheck.defaultBranch || 'main',
        remote: gitCheck.remote,
        branchCount: gitCheck.branchCount,
        lastCommit: gitCheck.lastCommit,
      };

      setRepository(repoInfo);
      onSelect(repoInfo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select repository');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Checking repository...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Select Your Repository</h3>
        <p className="text-sm text-muted-foreground">
          Octave works with Git repositories. Choose a folder that contains your code.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Repository Selection */}
      {!repository ? (
        <div className="space-y-4">
          <Button
            onClick={handleSelectRepository}
            size="lg"
            className="w-full h-32 flex flex-col gap-3"
            variant="outline"
          >
            <FolderOpen className="h-8 w-8" />
            <div>
              <div className="font-semibold">Select Existing Repository</div>
              <div className="text-xs text-muted-foreground font-normal">
                Choose a folder with a .git directory
              </div>
            </div>
          </Button>

          {/* Future: Create new repository option */}
          {/* <Button
            onClick={handleCreateRepository}
            size="lg"
            className="w-full h-32 flex flex-col gap-3"
            variant="outline"
            disabled
          >
            <Plus className="h-8 w-8" />
            <div>
              <div className="font-semibold">Create New Repository</div>
              <div className="text-xs text-muted-foreground font-normal">
                Initialize a new Git repository
              </div>
            </div>
          </Button> */}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Selected Repository Info */}
          <div className="rounded-lg border p-6 space-y-4 bg-muted/30">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-semibold text-lg">{repository.name}</h4>
                <p className="text-sm text-muted-foreground font-mono mt-1">
                  {repository.path}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectRepository}
              >
                Change
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4 border-t">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <GitBranch className="h-4 w-4" />
                  <span>Default Branch</span>
                </div>
                <p className="font-medium">{repository.defaultBranch}</p>
              </div>

              {repository.branchCount !== undefined && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <GitBranch className="h-4 w-4" />
                    <span>Branches</span>
                  </div>
                  <p className="font-medium">{repository.branchCount}</p>
                </div>
              )}

              {repository.lastCommit && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>Last Commit</span>
                  </div>
                  <p className="font-medium text-sm truncate">{repository.lastCommit}</p>
                </div>
              )}
            </div>

            {repository.remote && (
              <div className="pt-4 border-t">
                <p className="text-xs text-muted-foreground">
                  Remote: <span className="font-mono">{repository.remote}</span>
                </p>
              </div>
            )}
          </div>

          {/* Info Alert */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Circuit will create an isolated workspace for this repository.
              Your files won't be modified until you explicitly make changes.
            </AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
}
