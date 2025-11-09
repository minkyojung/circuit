/**
 * GitHubCloneStep - Clone selected repositories
 *
 * Allows user to select destination directory
 * Clones repositories with real-time progress tracking
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Loader2, AlertCircle, FolderOpen, CheckCircle2, XCircle } from 'lucide-react';

interface Repository {
  id: number;
  name: string;
  fullName: string;
  description: string;
  cloneUrl: string;
  private: boolean;
  stars: number;
  language: string;
  defaultBranch: string;
}

interface CloneProgress {
  repo: string;
  percent: number;
  stage: 'receiving' | 'resolving';
}

interface RepoCloneStatus {
  id: number;
  name: string;
  status: 'pending' | 'cloning' | 'completed' | 'error';
  progress: number;
  error?: string;
}

interface GitHubCloneStepProps {
  repositories: Repository[];
  accessToken: string;
  onComplete: (clonePath: string) => void;
}

export function GitHubCloneStep({ repositories, accessToken, onComplete }: GitHubCloneStepProps) {
  const [clonePath, setClonePath] = useState<string | null>(null);
  const [selectingPath, setSelectingPath] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repoStatuses, setRepoStatuses] = useState<Record<number, RepoCloneStatus>>({});

  useEffect(() => {
    // Initialize repo statuses
    const initialStatuses: Record<number, RepoCloneStatus> = {};
    repositories.forEach(repo => {
      initialStatuses[repo.id] = {
        id: repo.id,
        name: repo.name,
        status: 'pending',
        progress: 0,
      };
    });
    setRepoStatuses(initialStatuses);
  }, [repositories]);

  useEffect(() => {
    // Listen for clone progress events
    const ipcRenderer = window.electron.ipcRenderer;
    const cleanup = ipcRenderer.on('onboarding:clone-progress', (_, progress: CloneProgress) => {
      setRepoStatuses(prev => {
        const repo = repositories.find(r => r.name === progress.repo);
        if (!repo) return prev;

        return {
          ...prev,
          [repo.id]: {
            ...prev[repo.id],
            status: 'cloning',
            progress: progress.percent,
          },
        };
      });
    });

    return cleanup;
  }, [repositories]);

  const handleSelectPath = async () => {
    setSelectingPath(true);
    setError(null);

    try {
      const ipcRenderer = window.electron.ipcRenderer;
      const result = await ipcRenderer.invoke('dialog:open-folder');

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        setSelectingPath(false);
        return;
      }

      setClonePath(result.filePaths[0]);
    } catch (err: any) {
      setError(err.message || 'Failed to select directory');
    } finally {
      setSelectingPath(false);
    }
  };

  const handleStartClone = async () => {
    if (!clonePath) return;

    setCloning(true);
    setError(null);

    try {
      const ipcRenderer = window.electron.ipcRenderer;

      // Clone repositories sequentially
      for (const repo of repositories) {
        const destination = `${clonePath}/${repo.name}`;

        try {
          // Check if destination already exists
          const exists = await ipcRenderer.invoke('directory-exists', destination);

          if (exists) {
            // Directory already exists - skip or warn user
            setRepoStatuses(prev => ({
              ...prev,
              [repo.id]: {
                ...prev[repo.id],
                status: 'error',
                error: 'Directory already exists. Please choose a different location or remove the existing directory.',
              },
            }));

            throw new Error(`Directory '${repo.name}' already exists at ${clonePath}. Please choose a different location or remove the existing directory.`);
          }

          // Update status to cloning
          setRepoStatuses(prev => ({
            ...prev,
            [repo.id]: {
              ...prev[repo.id],
              status: 'cloning',
              progress: 0,
            },
          }));

          const result = await ipcRenderer.invoke('onboarding:clone-repository', {
            repo,
            destination,
            token: accessToken,
          });

          if (result.success) {
            setRepoStatuses(prev => ({
              ...prev,
              [repo.id]: {
                ...prev[repo.id],
                status: 'completed',
                progress: 100,
              },
            }));
          } else {
            throw new Error(result.error || 'Clone failed');
          }
        } catch (err: any) {
          setRepoStatuses(prev => ({
            ...prev,
            [repo.id]: {
              ...prev[repo.id],
              status: 'error',
              error: err.message,
            },
          }));
          throw err;
        }
      }

      // All clones completed successfully
      setCompleted(true);
      setTimeout(() => {
        onComplete(clonePath);
      }, 1500);

    } catch (err: any) {
      setError(err.message || 'Failed to clone repositories');
    } finally {
      setCloning(false);
    }
  };

  const allCompleted = Object.values(repoStatuses).every(s => s.status === 'completed');
  const canStartClone = clonePath && !cloning && !completed;

  if (completed && allCompleted) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <CheckCircle2 className="h-16 w-16 text-green-600 animate-in fade-in duration-500" />
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold">Repositories Cloned!</h3>
          <p className="text-sm text-muted-foreground">
            All repositories have been cloned successfully
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Clone Repositories</h3>
        <p className="text-sm text-muted-foreground">
          Choose where to clone {repositories.length} {repositories.length === 1 ? 'repository' : 'repositories'}
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Clone Destination */}
      {!cloning && !completed && (
        <div className="space-y-3">
          <label className="text-sm font-medium">Clone Location</label>
          {!clonePath ? (
            <Button
              onClick={handleSelectPath}
              disabled={selectingPath}
              variant="outline"
              className="w-full h-24 flex flex-col gap-2"
            >
              {selectingPath ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span>Opening folder picker...</span>
                </>
              ) : (
                <>
                  <FolderOpen className="h-6 w-6" />
                  <span>Choose Destination Folder</span>
                </>
              )}
            </Button>
          ) : (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="text-sm font-medium">Selected Location</div>
                  <div className="text-sm text-muted-foreground font-mono mt-1 break-all">
                    {clonePath}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectPath}
                  disabled={cloning}
                >
                  Change
                </Button>
              </div>

              <div className="pt-3 border-t space-y-1">
                <div className="text-xs font-medium">Repositories will be cloned to:</div>
                {repositories.map((repo) => (
                  <div key={repo.id} className="text-xs text-muted-foreground font-mono pl-2">
                    {clonePath}/{repo.name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Clone Progress */}
      {(cloning || completed) && (
        <div className="space-y-3">
          {repositories.map((repo) => {
            const status = repoStatuses[repo.id];
            if (!status) return null;

            return (
              <div key={repo.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium">{repo.fullName}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {status.status === 'pending' && 'Waiting...'}
                      {status.status === 'cloning' && `Cloning... ${status.progress}%`}
                      {status.status === 'completed' && 'Completed'}
                      {status.status === 'error' && status.error}
                    </div>
                  </div>
                  <div>
                    {status.status === 'completed' && (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    )}
                    {status.status === 'cloning' && (
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    )}
                    {status.status === 'error' && (
                      <XCircle className="h-5 w-5 text-destructive" />
                    )}
                  </div>
                </div>

                {status.status === 'cloning' && (
                  <Progress value={status.progress} className="h-2" />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Start Clone Button */}
      {canStartClone && (
        <div className="pt-4">
          <Button
            onClick={handleStartClone}
            disabled={!canStartClone}
            className="w-full"
            size="lg"
          >
            Start Cloning
          </Button>
        </div>
      )}
    </div>
  );
}
