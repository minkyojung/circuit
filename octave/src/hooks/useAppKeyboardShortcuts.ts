/**
 * useAppKeyboardShortcuts Hook
 *
 * Extracts all keyboard shortcut definitions from App.tsx.
 * This hook centralizes keyboard shortcut configuration for better maintainability.
 *
 * Keyboard Shortcuts:
 * - Cmd+P: Quick Open (focus search bar)
 * - Cmd+1-9: Switch to workspace 1-9
 * - Cmd+N: New workspace
 * - Cmd+W: Close active tab
 * - Cmd+Shift+[: Move tab left
 * - Cmd+Shift+]: Move tab right
 * - Cmd+Shift+W: Close workspace
 * - Cmd+,: Open settings
 * - Cmd+Enter: Open commit dialog
 * - Escape: Close dialog
 *
 * @example
 * const shortcuts = useAppKeyboardShortcuts({
 *   selectedWorkspace,
 *   primaryGroup,
 *   searchBarRef,
 *   showCommitDialog,
 *   workspacesRef,
 *   handleCreateWorkspace,
 *   handleCloseActiveTab,
 *   handleMoveActiveTab,
 *   handleWorkspaceSelect,
 *   handleOpenSettings,
 *   setShowCommitDialog,
 * });
 */

import { useMemo, type RefObject } from 'react';
import type { Workspace } from '@/types/workspace';
import type { EditorGroup } from '@/types/editor';

interface UseAppKeyboardShortcutsParams {
  selectedWorkspace: Workspace | null;
  primaryGroup: EditorGroup;
  searchBarRef: RefObject<HTMLInputElement | null>;
  showCommitDialog: boolean;
  workspacesRef: RefObject<Workspace[]>;
  handleCreateWorkspace: () => void;
  handleCloseActiveTab: () => void;
  handleMoveActiveTab: (direction: 'left' | 'right') => void;
  handleWorkspaceSelect: (workspace: Workspace | null) => void;
  handleOpenSettings: () => void;
  setShowCommitDialog: (show: boolean) => void;
}

interface KeyboardShortcut {
  handler: () => void;
  description: string;
  enabled?: boolean;
}

type KeyboardShortcuts = Record<string, KeyboardShortcut>;

export function useAppKeyboardShortcuts({
  selectedWorkspace,
  primaryGroup,
  searchBarRef,
  showCommitDialog,
  workspacesRef,
  handleCreateWorkspace,
  handleCloseActiveTab,
  handleMoveActiveTab,
  handleWorkspaceSelect,
  handleOpenSettings,
  setShowCommitDialog,
}: UseAppKeyboardShortcutsParams): KeyboardShortcuts {
  return useMemo(
    () => ({
      // Quick Open (Cmd+P) - Focus search bar
      'cmd+p': {
        handler: () => searchBarRef.current?.focus(),
        description: 'Quick Open',
        enabled: !!selectedWorkspace,
      },

      // Workspace navigation (Cmd+1 through Cmd+9)
      'cmd+1': {
        handler: () => workspacesRef.current[0] && handleWorkspaceSelect(workspacesRef.current[0]),
        description: 'Switch to workspace 1',
      },
      'cmd+2': {
        handler: () => workspacesRef.current[1] && handleWorkspaceSelect(workspacesRef.current[1]),
        description: 'Switch to workspace 2',
      },
      'cmd+3': {
        handler: () => workspacesRef.current[2] && handleWorkspaceSelect(workspacesRef.current[2]),
        description: 'Switch to workspace 3',
      },
      'cmd+4': {
        handler: () => workspacesRef.current[3] && handleWorkspaceSelect(workspacesRef.current[3]),
        description: 'Switch to workspace 4',
      },
      'cmd+5': {
        handler: () => workspacesRef.current[4] && handleWorkspaceSelect(workspacesRef.current[4]),
        description: 'Switch to workspace 5',
      },
      'cmd+6': {
        handler: () => workspacesRef.current[5] && handleWorkspaceSelect(workspacesRef.current[5]),
        description: 'Switch to workspace 6',
      },
      'cmd+7': {
        handler: () => workspacesRef.current[6] && handleWorkspaceSelect(workspacesRef.current[6]),
        description: 'Switch to workspace 7',
      },
      'cmd+8': {
        handler: () => workspacesRef.current[7] && handleWorkspaceSelect(workspacesRef.current[7]),
        description: 'Switch to workspace 8',
      },
      'cmd+9': {
        handler: () => workspacesRef.current[8] && handleWorkspaceSelect(workspacesRef.current[8]),
        description: 'Switch to workspace 9',
      },

      // New Workspace (Cmd+N)
      'cmd+n': {
        handler: handleCreateWorkspace,
        description: 'New workspace',
      },

      // Close active tab (Cmd+W)
      'cmd+w': {
        handler: handleCloseActiveTab,
        description: 'Close active tab',
        enabled: primaryGroup.tabs.length > 0,
      },

      // Move active tab left (Cmd+Shift+[)
      'cmd+shift+[': {
        handler: () => handleMoveActiveTab('left'),
        description: 'Move tab left',
        enabled: primaryGroup.tabs.length > 0,
      },

      // Move active tab right (Cmd+Shift+])
      'cmd+shift+]': {
        handler: () => handleMoveActiveTab('right'),
        description: 'Move tab right',
        enabled: primaryGroup.tabs.length > 0,
      },

      // Close current workspace (Cmd+Shift+W)
      'cmd+shift+w': {
        handler: () => handleWorkspaceSelect(null),
        description: 'Close workspace',
        enabled: !!selectedWorkspace,
      },

      // Open Settings (Cmd+,)
      'cmd+,': {
        handler: handleOpenSettings,
        description: 'Open settings',
      },

      // Commit dialog (Cmd+Enter when workspace is selected)
      'cmd+enter': {
        handler: () => setShowCommitDialog(true),
        description: 'Open commit dialog',
        enabled: !!selectedWorkspace,
      },

      // Close dialogs with Escape
      escape: {
        handler: () => {
          if (showCommitDialog) {
            setShowCommitDialog(false);
          }
        },
        description: 'Close dialog',
        enabled: showCommitDialog,
      },
    }),
    [
      selectedWorkspace,
      primaryGroup.tabs.length,
      searchBarRef,
      showCommitDialog,
      workspacesRef,
      handleCreateWorkspace,
      handleCloseActiveTab,
      handleMoveActiveTab,
      handleWorkspaceSelect,
      handleOpenSettings,
      setShowCommitDialog,
    ]
  );
}
