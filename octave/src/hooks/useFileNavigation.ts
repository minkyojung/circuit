/**
 * useFileNavigation Hook
 *
 * Manages file navigation and tab management logic extracted from App.tsx.
 * Handles file opening, path normalization, file existence validation, and unsaved changes tracking.
 *
 * Key Features:
 * - File path normalization via PathResolver
 * - File existence validation (IPC)
 * - File tab creation and opening
 * - Line cursor positioning (jump to line)
 * - Unsaved changes tracking
 *
 * Risk Assessment: MEDIUM-RISK
 * - PathResolver dependency
 * - IPC calls (file-exists)
 * - Complex error handling
 * - Tab system integration
 *
 * @example
 * const {
 *   handleFileSelect,
 *   handleUnsavedChange,
 *   fileCursorPosition,
 * } = useFileNavigation({
 *   pathResolver,
 *   selectedWorkspace,
 *   openTab,
 *   findTab,
 *   updateTab,
 *   focusedGroupIdRef,
 * });
 */

import { useState, useCallback, type RefObject } from 'react';
import { toast } from 'sonner';
import type { Workspace } from '@/types/workspace';
import type { PathResolver } from '@/lib/pathResolver';
import { createFileTab } from '@/types/editor';
import { getFileName } from '@/lib/fileUtils';

const ipcRenderer = window.electron.ipcRenderer;

interface UseFileNavigationParams {
  pathResolver: PathResolver | null;
  selectedWorkspace: Workspace | null;
  openTab: (tab: any, groupId: string) => void;
  findTab: (tabId: string) => { tab: any; groupId: string } | null;
  updateTab: (tabId: string, groupId: string, updates: any) => void;
  focusedGroupIdRef: RefObject<string>;
}

interface FileCursorPosition {
  filePath: string;
  lineStart: number;
  lineEnd: number;
}

interface UseFileNavigationReturn {
  handleFileSelect: (filePath: string, lineStart?: number, lineEnd?: number) => Promise<void>;
  handleUnsavedChange: (filePath: string, hasChanges: boolean) => void;
  fileCursorPosition: FileCursorPosition | null;
}

export function useFileNavigation({
  pathResolver,
  selectedWorkspace,
  openTab,
  findTab,
  updateTab,
  focusedGroupIdRef,
}: UseFileNavigationParams): UseFileNavigationReturn {
  // File cursor position for jumping to line
  const [fileCursorPosition, setFileCursorPosition] = useState<FileCursorPosition | null>(null);

  // Handle file selection from sidebar or file reference pills
  const handleFileSelect = useCallback(
    async (filePath: string, lineStart?: number, lineEnd?: number) => {
      // Guard: PathResolver must be initialized
      if (!pathResolver) {
        console.error('[useFileNavigation] PathResolver not initialized - cannot open file');
        toast.error('파일 경로 변환기가 초기화되지 않았습니다');
        return;
      }

      // Guard: Workspace must be selected
      if (!selectedWorkspace) {
        console.error('[useFileNavigation] No workspace selected - cannot open file');
        toast.error('워크스페이스가 선택되지 않았습니다');
        return;
      }

      // ✅ STEP 1: Normalize file path using PathResolver
      const normalizedPath = pathResolver.normalize(filePath);
      const absolutePath = pathResolver.toAbsolute(normalizedPath);

      console.log('[useFileNavigation] Opening file:', {
        original: filePath,
        normalized: normalizedPath,
        absolute: absolutePath,
        workspaceId: selectedWorkspace.id,
        projectRoot: pathResolver.getProjectRoot(),
      });

      // ✅ STEP 2: Validate file existence
      try {
        const exists = await ipcRenderer.invoke('file-exists', absolutePath);

        if (!exists) {
          console.warn('[useFileNavigation] File does not exist:', normalizedPath);
          toast.error(`파일을 찾을 수 없습니다: ${normalizedPath}`);
          return;
        }
      } catch (error) {
        console.error('[useFileNavigation] Error checking file existence:', normalizedPath, error);
        toast.error(`파일 확인 중 오류 발생: ${normalizedPath}`);
        return;
      }

      // ✅ STEP 3: Create file tab with workspace-scoped identity
      const currentFocusedGroup = focusedGroupIdRef.current!;
      const tab = createFileTab(
        normalizedPath,
        selectedWorkspace.id, // ✅ Workspace-scoped tab ID
        getFileName(normalizedPath)
      );

      // Open in currently focused group
      openTab(tab, currentFocusedGroup);

      // ✅ STEP 4: Store line selection with normalized path
      if (lineStart) {
        setFileCursorPosition({
          filePath: normalizedPath,
          lineStart,
          lineEnd: lineEnd || lineStart,
        });
      } else {
        setFileCursorPosition(null);
      }
    },
    [pathResolver, selectedWorkspace, openTab, focusedGroupIdRef]
  );

  // Handle unsaved changes notification from editor
  const handleUnsavedChange = useCallback(
    (filePath: string, hasChanges: boolean) => {
      if (!selectedWorkspace) return;

      // Find the file tab (using workspace-scoped ID)
      const tabId = `file-${selectedWorkspace.id}-${filePath}`;
      const result = findTab(tabId);
      if (result) {
        updateTab(result.tab.id, result.groupId, {
          data: {
            ...result.tab.data,
            unsavedChanges: hasChanges,
          },
        } as any);
      }
    },
    [selectedWorkspace, findTab, updateTab]
  );

  return {
    handleFileSelect,
    handleUnsavedChange,
    fileCursorPosition,
  };
}
