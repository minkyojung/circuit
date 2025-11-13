/**
 * useWorkspaceNavigation Hook
 *
 * Manages workspace navigation and tab synchronization logic extracted from App.tsx.
 * Handles workspace selection, recent workspace tracking, and conversation tab management.
 *
 * Key Features:
 * - Workspace selection with state update
 * - Recent workspaces tracking (localStorage)
 * - Conversation tab creation/activation
 * - IPC calls for conversation management
 * - Workspace reference for keyboard shortcuts
 *
 * Risk Assessment: MEDIUM-RISK
 * - Complex logic with multiple IPC calls (conversation:get-active, conversation:create)
 * - localStorage access for recent workspaces
 * - Tab system integration (findTab, activateTab, openTab)
 * - Multiple state synchronization points
 *
 * @example
 * const {
 *   handleWorkspaceSelect,
 *   handleWorkspaceSelectById,
 *   workspacesRef,
 *   setWorkspacesForShortcuts,
 * } = useWorkspaceNavigation({
 *   setSelectedWorkspace,
 *   getAllTabs,
 *   findTab,
 *   activateTab,
 *   openTab,
 * });
 */

import { useRef, useCallback } from 'react';
import type { Workspace } from '@/types/workspace';
import { createConversationTab } from '@/types/editor';
import { DEFAULT_GROUP_ID } from '@/types/editor';

const ipcRenderer = window.electron.ipcRenderer;

interface UseWorkspaceNavigationParams {
  setSelectedWorkspace: (workspace: Workspace | null) => void;
  getAllTabs: () => any[];
  findTab: (tabId: string) => { tab: any; groupId: string } | null;
  activateTab: (tabId: string, groupId: string) => void;
  openTab: (tab: any, groupId: string) => void;
}

interface UseWorkspaceNavigationReturn {
  handleWorkspaceSelect: (workspace: Workspace | null) => Promise<void>;
  handleWorkspaceSelectById: (workspaceId: string) => void;
  workspacesRef: React.RefObject<Workspace[]>;
  setWorkspacesForShortcuts: (workspaces: Workspace[]) => void;
}

export function useWorkspaceNavigation({
  setSelectedWorkspace,
  getAllTabs,
  findTab,
  activateTab,
  openTab,
}: UseWorkspaceNavigationParams): UseWorkspaceNavigationReturn {
  // Workspace navigation refs (for keyboard shortcuts)
  const workspacesRef = useRef<Workspace[]>([]);

  const setWorkspacesForShortcuts = useCallback((workspaces: Workspace[]) => {
    workspacesRef.current = workspaces;
  }, []);

  // Handle workspace selection with tab synchronization
  const handleWorkspaceSelect = useCallback(
    async (workspace: Workspace | null) => {
      if (!workspace) {
        setSelectedWorkspace(null);
        return;
      }

      // Update workspace state
      setSelectedWorkspace(workspace);

      // Track recent workspace access
      try {
        const stored = localStorage.getItem('octave-recent-workspaces');
        const recentWorkspaces = stored ? JSON.parse(stored) : [];

        // Remove existing entry for this workspace
        const filtered = recentWorkspaces.filter((w: any) => w.id !== workspace.id);

        // Add to front with current timestamp
        const updated = [
          {
            id: workspace.id,
            name: workspace.name,
            path: workspace.path,
            branch: workspace.branch,
            lastAccessed: Date.now(),
          },
          ...filtered,
        ].slice(0, 20); // Keep max 20 recent workspaces

        localStorage.setItem('octave-recent-workspaces', JSON.stringify(updated));
      } catch (error) {
        console.error('[useWorkspaceNavigation] Failed to update recent workspaces:', error);
      }

      // Find existing conversation tab for this workspace
      const allTabs = getAllTabs();
      const workspaceTab = allTabs.find(
        (tab) => tab.type === 'conversation' && tab.data.workspaceId === workspace.id
      );

      if (workspaceTab) {
        // Activate existing tab
        const tabLocation = findTab(workspaceTab.id);
        if (tabLocation) {
          activateTab(workspaceTab.id, tabLocation.groupId);
        }
      } else {
        // No tab exists - load or create conversation
        try {
          // Try to get active conversation for this workspace
          const activeResult = await ipcRenderer.invoke('conversation:get-active', workspace.id);

          if (activeResult.success && activeResult.conversation) {
            // Create tab with conversation title
            const tab = createConversationTab(
              activeResult.conversation.id,
              workspace.id,
              activeResult.conversation.title,
              workspace.name
            );
            openTab(tab, DEFAULT_GROUP_ID);
          } else {
            // No active conversation - create new one
            const createResult = await ipcRenderer.invoke('conversation:create', workspace.id, {
              workspaceName: workspace.name,
            });

            if (createResult.success && createResult.conversation) {
              const tab = createConversationTab(
                createResult.conversation.id,
                workspace.id,
                createResult.conversation.title,
                workspace.name
              );
              openTab(tab, DEFAULT_GROUP_ID);
            }
          }
        } catch (error) {
          console.error('[useWorkspaceNavigation] Error loading conversation for workspace:', error);
        }
      }
    },
    [setSelectedWorkspace, getAllTabs, findTab, activateTab, openTab]
  );

  // Handle workspace selection by ID (for QuickOpenSearch)
  const handleWorkspaceSelectById = useCallback(
    (workspaceId: string) => {
      const workspace = workspacesRef.current.find((w) => w.id === workspaceId);
      if (workspace) {
        handleWorkspaceSelect(workspace);
      }
    },
    [handleWorkspaceSelect]
  );

  return {
    handleWorkspaceSelect,
    handleWorkspaceSelectById,
    workspacesRef,
    setWorkspacesForShortcuts,
  };
}
