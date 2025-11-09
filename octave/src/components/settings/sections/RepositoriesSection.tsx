/**
 * RepositoriesSection - Manage local repositories
 *
 * Provides UI for viewing, adding, and removing local git repositories
 * Integrates with electron-store for persistent storage
 */

import React, { useState, useEffect } from 'react';
import { SettingsItem, SettingsGroup } from '../SettingsItem';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { FolderGit2, Plus, Trash2, RefreshCw, AlertCircle } from 'lucide-react';

interface Repository {
  id: string;
  name: string;
  path: string;
  branch: string;
  createdAt: string;
}

export const RepositoriesSection: React.FC = () => {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [repoToDelete, setRepoToDelete] = useState<Repository | null>(null);

  useEffect(() => {
    loadRepositories();
  }, []);

  const loadRepositories = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await window.electron.ipcRenderer.invoke('repository:list');

      if (result.success) {
        setRepositories(result.repositories || []);
      } else {
        setError(result.error || 'Failed to load repositories');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load repositories');
      console.error('Failed to load repositories:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddRepository = async () => {
    try {
      const result = await window.electron.ipcRenderer.invoke('dialog:open-folder');

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return;
      }

      const folderPath = result.filePaths[0];

      const addResult = await window.electron.ipcRenderer.invoke('repository:add', folderPath);

      if (addResult.success) {
        // Reload the repository list
        await loadRepositories();
      } else {
        setError(addResult.error || 'Failed to add repository');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to add repository');
      console.error('Failed to add repository:', err);
    }
  };

  const handleDeleteClick = (repo: Repository) => {
    setRepoToDelete(repo);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!repoToDelete) return;

    try {
      const result = await window.electron.ipcRenderer.invoke('repository:remove', repoToDelete.id);

      if (result.success) {
        // Reload the repository list
        await loadRepositories();
        setDeleteDialogOpen(false);
        setRepoToDelete(null);
      } else {
        setError(result.error || 'Failed to remove repository');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to remove repository');
      console.error('Failed to remove repository:', err);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setRepoToDelete(null);
  };

  return (
    <>
      <div className="space-y-8">
        {/* Repository Management */}
        <SettingsGroup title="Local Repositories">
          <SettingsItem
            type="custom"
            title="Repositories"
            description={`${repositories.length} ${repositories.length === 1 ? 'repository' : 'repositories'} registered`}
          >
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={loadRepositories}
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                size="sm"
                onClick={handleAddRepository}
                disabled={isLoading}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Repository
              </Button>
            </div>
          </SettingsItem>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-red-900 dark:text-red-100">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {repositories.length === 0 && !isLoading && (
            <div className="text-center p-8 rounded-lg border border-dashed border-border">
              <FolderGit2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <div className="text-sm text-muted-foreground mb-4">
                No repositories registered yet
              </div>
              <Button size="sm" onClick={handleAddRepository}>
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Repository
              </Button>
            </div>
          )}

          {repositories.length > 0 && (
            <div className="space-y-2">
              {repositories.map((repo) => (
                <div
                  key={repo.id}
                  className="p-4 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <FolderGit2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <div className="font-medium text-sm truncate">{repo.name}</div>
                        <Badge variant="secondary" className="text-xs">
                          {repo.branch}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground font-mono truncate">
                        {repo.path}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Added {new Date(repo.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteClick(repo)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SettingsGroup>

        {/* Help Text */}
        <SettingsGroup title="About Repositories">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              Repositories are local Git repositories on your machine that Octave can access.
              Each repository can have multiple workspaces, one for each branch you're working on.
            </p>
            <p>
              Removing a repository from this list will not delete the files on your disk.
              It only removes it from Octave's repository list.
            </p>
          </div>
        </SettingsGroup>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Repository?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{repoToDelete?.name}</strong> from Octave?
              <br />
              <br />
              This will only remove it from Octave's repository list. Your files at{' '}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">{repoToDelete?.path}</code>{' '}
              will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove Repository
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
