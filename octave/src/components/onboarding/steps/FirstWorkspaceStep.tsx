/**
 * FirstWorkspaceStep - Create first workspace
 *
 * Auto-selects first cloned repository and creates a workspace
 * for immediate use after onboarding.
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, FolderGit2, GitBranch } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Repository {
  id: number;
  name: string;
  fullName: string;
  defaultBranch: string;
}

interface FirstWorkspaceStepProps {
  clonedRepos: Repository[];
  clonePath: string;
  onComplete: (workspaceId: string) => void;
}

export function FirstWorkspaceStep({ clonedRepos, clonePath, onComplete }: FirstWorkspaceStepProps) {
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [branches, setBranches] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingBranches, setLoadingBranches] = useState(false);

  // Auto-select first repository
  useEffect(() => {
    if (clonedRepos.length > 0 && !selectedRepo) {
      const firstRepo = clonedRepos[0];
      setSelectedRepo(firstRepo);
      setSelectedBranch(firstRepo.defaultBranch);
      loadBranches(firstRepo);
    }
  }, [clonedRepos, selectedRepo]);

  const loadBranches = async (repo: Repository) => {
    setLoadingBranches(true);
    try {
      const ipcRenderer = window.electron.ipcRenderer;
      const repoPath = `${clonePath}/${repo.name}`;

      const result = await ipcRenderer.invoke('git:list-branches', repoPath);

      if (result.success && result.branches) {
        setBranches(result.branches);
      } else {
        // Fallback to default branch
        setBranches([repo.defaultBranch]);
      }
    } catch (err) {
      console.error('[FirstWorkspaceStep] Error loading branches:', err);
      setBranches([repo.defaultBranch]);
    } finally {
      setLoadingBranches(false);
    }
  };

  const handleRepoChange = (repoId: string) => {
    const repo = clonedRepos.find(r => r.id.toString() === repoId);
    if (repo) {
      setSelectedRepo(repo);
      setSelectedBranch(repo.defaultBranch);
      loadBranches(repo);
    }
  };

  const handleCreateWorkspace = async () => {
    if (!selectedRepo) return;

    setCreating(true);
    setError(null);

    try {
      const ipcRenderer = window.electron.ipcRenderer;
      const repoPath = `${clonePath}/${selectedRepo.name}`;

      // Create workspace for the selected repository and branch
      const result = await ipcRenderer.invoke('workspace:create', repoPath, selectedBranch);

      if (result.success && result.workspace) {
        console.log('[FirstWorkspaceStep] Workspace created:', result.workspace.id);
        onComplete(result.workspace.id);
      } else {
        throw new Error(result.error || 'Failed to create workspace');
      }
    } catch (err: any) {
      console.error('[FirstWorkspaceStep] Error creating workspace:', err);
      setError(err.message || 'Failed to create workspace');
    } finally {
      setCreating(false);
    }
  };

  const workspacePath = selectedRepo
    ? `~/.conductor/workspaces/${selectedRepo.name}-${selectedBranch}`
    : '';

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="space-y-2">
        <h3 className="text-xl font-semibold">Create Your First Workspace</h3>
        <p className="text-sm text-muted-foreground">
          A workspace is an isolated environment for working on a specific branch
        </p>
      </div>

      {/* Repository Selection */}
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <FolderGit2 className="h-4 w-4" />
            Repository
          </label>
          <Select
            value={selectedRepo?.id.toString()}
            onValueChange={handleRepoChange}
            disabled={creating}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a repository" />
            </SelectTrigger>
            <SelectContent>
              {clonedRepos.map((repo) => (
                <SelectItem key={repo.id} value={repo.id.toString()}>
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{repo.name}</span>
                    <span className="text-xs text-muted-foreground">{repo.fullName}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Branch Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            Branch
          </label>
          <Select
            value={selectedBranch}
            onValueChange={setSelectedBranch}
            disabled={creating || loadingBranches}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a branch" />
            </SelectTrigger>
            <SelectContent>
              {branches.map((branch) => (
                <SelectItem key={branch} value={branch}>
                  {branch}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {loadingBranches && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading branches...
            </p>
          )}
        </div>
      </div>

      {/* Workspace Path Preview */}
      {selectedRepo && selectedBranch && (
        <div className="rounded-lg border p-4 bg-muted/30">
          <div className="text-sm font-medium mb-1">Workspace Location</div>
          <code className="text-xs text-muted-foreground font-mono">
            {workspacePath}
          </code>
        </div>
      )}

      {/* Info Box */}
      <Alert>
        <AlertDescription>
          <div className="text-sm space-y-2">
            <p className="font-medium">What is a workspace?</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Isolated git worktree for each branch</li>
              <li>Switch between branches without losing work</li>
              <li>Multiple workspaces can be open simultaneously</li>
            </ul>
          </div>
        </AlertDescription>
      </Alert>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Create Button */}
      <div className="flex justify-end pt-4">
        <Button
          onClick={handleCreateWorkspace}
          disabled={!selectedRepo || !selectedBranch || creating}
          size="lg"
          className="min-w-[200px]"
        >
          {creating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Creating Workspace...
            </>
          ) : (
            'Create Workspace & Continue'
          )}
        </Button>
      </div>
    </div>
  );
}
