/**
 * ArchiveSection - Archived workspaces management
 */

import React, { useState, useEffect } from 'react';
import { SettingsGroup, SettingsItem } from '../SettingsItem';
import { Folder, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';

// @ts-ignore
const ipcRenderer = typeof window !== 'undefined' && (window as any).require
  ? (window as any).require('electron').ipcRenderer
  : null;

interface ArchivedWorkspace {
  id: string;
  name: string;
  path: string;
  archivedAt: number;
}

export const ArchiveSection: React.FC = () => {
  const [workspaces, setWorkspaces] = useState<ArchivedWorkspace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadArchivedWorkspaces();
  }, []);

  const loadArchivedWorkspaces = async () => {
    if (!ipcRenderer) {
      setLoading(false);
      return;
    }

    try {
      const result = await ipcRenderer.invoke('workspace:list-archived');
      if (result.success) {
        setWorkspaces(result.workspaces || []);
      }
    } catch (error) {
      console.error('Failed to load archived workspaces:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (workspaceId: string) => {
    if (!ipcRenderer) return;

    try {
      const result = await ipcRenderer.invoke('workspace:restore', workspaceId);
      if (result.success) {
        await loadArchivedWorkspaces();
      }
    } catch (error) {
      console.error('Failed to restore workspace:', error);
    }
  };

  const handleDelete = async (workspaceId: string) => {
    if (!ipcRenderer) return;
    if (!confirm('Permanently delete this archived workspace? This cannot be undone.')) return;

    try {
      const result = await ipcRenderer.invoke('workspace:delete-archived', workspaceId);
      if (result.success) {
        await loadArchivedWorkspaces();
      }
    } catch (error) {
      console.error('Failed to delete workspace:', error);
    }
  };

  return (
    <div className="space-y-8">
      <SettingsGroup
        title="Archived Workspaces"
        description={`${workspaces.length} archived workspace${workspaces.length !== 1 ? 's' : ''}`}
      >
        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Loading...</div>
        ) : workspaces.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No archived workspaces
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
                  <div className="text-sm text-muted-foreground">
                    {workspace.path}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar size={12} />
                    Archived {new Date(workspace.archivedAt).toLocaleDateString()}
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
