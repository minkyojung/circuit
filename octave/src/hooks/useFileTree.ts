/**
 * useFileTree Hook
 *
 * Loads and manages file tree for a workspace.
 * Automatically reloads when workspace path changes.
 *
 * @example
 * const { fileTree, isLoadingFiles } = useFileTree(workspace?.path);
 */

import { useState, useEffect, useCallback } from 'react';
import type { FileNode } from '@/components/workspace/FileExplorer';

const ipcRenderer = window.electron.ipcRenderer;

interface UseFileTreeReturn {
  fileTree: FileNode[];
  isLoadingFiles: boolean;
  refresh: () => void;
}

export function useFileTree(workspacePath: string | undefined): UseFileTreeReturn {
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);

  const loadFileTree = useCallback(async () => {
    if (!workspacePath) {
      setFileTree([]);
      return;
    }

    setIsLoadingFiles(true);
    try {
      const result = await ipcRenderer.invoke('workspace:get-file-tree', workspacePath);

      if (result.success && result.fileTree) {
        setFileTree(result.fileTree);
      } else {
        console.error('Failed to load file tree:', result.error);
        setFileTree([]);
      }
    } catch (error) {
      console.error('Error loading file tree:', error);
      setFileTree([]);
    } finally {
      setIsLoadingFiles(false);
    }
  }, [workspacePath]);

  useEffect(() => {
    loadFileTree();
  }, [loadFileTree]);

  return { fileTree, isLoadingFiles, refresh: loadFileTree };
}
