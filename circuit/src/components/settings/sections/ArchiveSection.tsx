/**
 * ArchiveSection - Archived workspaces management
 */

import React, { useState, useEffect } from 'react';
import { SettingsGroup, SettingsItem } from '../SettingsItem';
import { Folder, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRepository } from '@/contexts/RepositoryContext';

// @ts-ignore
const ipcRenderer = typeof window !== 'undefined' && (window as any).require
  ? (window as any).require('electron').ipcRenderer
  : null;

interface ArchivedWorkspace {
  id: string;
  name: string;
  path: string;
  branch: string;
  archivedAt?: string;
  archived: boolean;
}

export const ArchiveSection: React.FC = () => {
  const { currentRepository } = useRepository();
  const [workspaces, setWorkspaces] = useState<ArchivedWorkspace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadArchivedWorkspaces();
  }, [currentRepository]); // Reload when repository changes

  const loadArchivedWorkspaces = async () => {
    if (!ipcRenderer) {
      setLoading(false);
      return;
    }

    if (!currentRepository) {
      console.log('[ArchiveSection] ⚠️ No repository selected');
      setWorkspaces([]);
      setLoading(false);
      return;
    }

    try {
      console.log('[ArchiveSection] 🔍 Loading workspaces from repository:', currentRepository.name, currentRepository.path);
      const result = await ipcRenderer.invoke('workspace:list', currentRepository.path);
      console.log('[ArchiveSection] 📦 Result:', result);

      if (result.success && result.workspaces) {
        // Filter for archived workspaces only
        const archived = result.workspaces.filter((w: ArchivedWorkspace) => w.archived);
        console.log('[ArchiveSection] 📁 Found archived workspaces:', archived.length);
        setWorkspaces(archived);
      }
    } catch (error) {
      console.error('[ArchiveSection] ❌ Failed to load archived workspaces:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (workspaceId: string) => {
    if (!ipcRenderer) return;
    if (!currentRepository) return;

    try {
      console.log('[ArchiveSection] ♻️ Restoring workspace:', workspaceId, 'from repository:', currentRepository.name);
      const result = await ipcRenderer.invoke('workspace:unarchive', workspaceId, currentRepository.path);
      if (result.success) {
        console.log('[ArchiveSection] ✅ Workspace restored successfully');
        await loadArchivedWorkspaces();
      } else {
        console.error('[ArchiveSection] ❌ Failed to restore:', result.error);
      }
    } catch (error) {
      console.error('[ArchiveSection] ❌ Failed to restore workspace:', error);
    }
  };

  const handleDelete = async (workspaceId: string) => {
    if (!ipcRenderer) return;
    if (!currentRepository) return;
    if (!confirm('Permanently delete this archived workspace? This cannot be undone.')) return;

    try {
      console.log('[ArchiveSection] 🗑️ Deleting workspace:', workspaceId);
      const result = await ipcRenderer.invoke('workspace:delete', workspaceId, currentRepository.path);
      if (result.success) {
        console.log('[ArchiveSection] ✅ Workspace deleted successfully');
        await loadArchivedWorkspaces();
      } else {
        console.error('[ArchiveSection] ❌ Failed to delete:', result.error);
      }
    } catch (error) {
      console.error('[ArchiveSection] ❌ Failed to delete workspace:', error);
    }
  };

  return (
    <div className="space-y-8">
      <SettingsGroup
        title="Archived Workspaces"
        description={
          currentRepository
            ? `${workspaces.length} archived workspace${workspaces.length !== 1 ? 's' : ''} in ${currentRepository.name}`
            : 'Select a repository to view archived workspaces'
        }
      >
        {!currentRepository ? (
          <div className="py-8 text-center text-muted-foreground">
            <div className="text-2xl mb-2">📁</div>
            <p>No repository selected</p>
            <p className="text-xs mt-1">Select a repository from the sidebar to view its archived workspaces</p>
          </div>
        ) : loading ? (
          <div className="py-8 text-center text-muted-foreground">Loading...</div>
        ) : workspaces.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <div className="text-2xl mb-2">📦</div>
            <p>No archived workspaces in {currentRepository.name}</p>
            <p className="text-xs mt-1">Archive workspaces by right-clicking them in the sidebar</p>
          </div>
        ) : (
          <div className="space-y-0 divide-y divide-border/50">
            {workspaces.map((workspace) => (
              <div key={workspace.id} className="py-4 flex items-start justify-between gap-4">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Folder size={16} className="text-muted-foreground" />
                    <div className="text-sm font-medium text-foreground">
                      {workspace.name}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground font-mono">
                    {workspace.branch}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar size={12} />
                    {workspace.archivedAt
                      ? `Archived ${new Date(workspace.archivedAt).toLocaleDateString()}`
                      : 'Archived (date unknown)'}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRestore(workspace.id)}
                  >
                    Restore
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(workspace.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SettingsGroup>
    </div>
  );
};
