/**
 * useConversationManagement Hook
 *
 * Manages conversation-related operations extracted from App.tsx.
 * Handles conversation creation, selection, and deletion with confirmation.
 *
 * Key Features:
 * - Create new conversations via IPC
 * - Select and open conversation tabs
 * - Delete conversations with confirmation modal
 * - Manages pending deletion state
 *
 * @example
 * const {
 *   handleConversationSelect,
 *   handleCreateConversation,
 *   confirmDeleteConversation,
 *   pendingDeleteConversation,
 *   setPendingDeleteConversation,
 * } = useConversationManagement({
 *   selectedWorkspace,
 *   openTab,
 *   closeTab,
 *   focusedGroupIdRef,
 * });
 */

import { useState, useCallback, type RefObject } from 'react';
import type { Workspace } from '@/types/workspace';
import { createConversationTab } from '@/types/editor';

const ipcRenderer = window.electron.ipcRenderer;

interface UseConversationManagementParams {
  selectedWorkspace: Workspace | null;
  openTab: (tab: any, groupId: string) => void;
  closeTab: (tabId: string, groupId: string) => void;
  focusedGroupIdRef: RefObject<string>;
}

interface PendingDeleteConversation {
  conversationId: string;
  tabId: string;
  groupId: string;
}

interface UseConversationManagementReturn {
  handleConversationSelect: (conversationId: string, workspaceId: string, title?: string) => void;
  handleCreateConversation: () => Promise<void>;
  confirmDeleteConversation: () => Promise<void>;
  pendingDeleteConversation: PendingDeleteConversation | null;
  setPendingDeleteConversation: (pending: PendingDeleteConversation | null) => void;
}

export function useConversationManagement({
  selectedWorkspace,
  openTab,
  closeTab,
  focusedGroupIdRef,
}: UseConversationManagementParams): UseConversationManagementReturn {
  // State for conversation deletion confirmation modal
  const [pendingDeleteConversation, setPendingDeleteConversation] = useState<PendingDeleteConversation | null>(null);

  // Handle conversation selection
  const handleConversationSelect = useCallback(
    (conversationId: string, workspaceId: string, title?: string) => {
      // Use ref to get latest focusedGroupId (avoid stale closure)
      const currentFocusedGroup = focusedGroupIdRef.current;
      // Create or activate conversation tab in focused group
      const tab = createConversationTab(
        conversationId,
        workspaceId,
        title,
        selectedWorkspace?.name
      );
      openTab(tab, currentFocusedGroup);
    },
    [selectedWorkspace?.name, openTab, focusedGroupIdRef]
  );

  // Handle new conversation creation
  const handleCreateConversation = useCallback(async () => {
    if (!selectedWorkspace) return;

    try {
      const createResult = await ipcRenderer.invoke('conversation:create', selectedWorkspace.id, {
        workspaceName: selectedWorkspace.name,
      });

      if (createResult.success && createResult.conversation) {
        const tab = createConversationTab(
          createResult.conversation.id,
          selectedWorkspace.id,
          createResult.conversation.title,
          selectedWorkspace.name
        );
        // Open in currently focused group
        openTab(tab, focusedGroupIdRef.current!);
      } else {
        console.error('[useConversationManagement] Failed to create conversation:', createResult.error);
      }
    } catch (error) {
      console.error('[useConversationManagement] Error creating conversation:', error);
    }
  }, [selectedWorkspace, openTab, focusedGroupIdRef]);

  // Confirm and execute conversation deletion
  const confirmDeleteConversation = useCallback(async () => {
    if (!pendingDeleteConversation) return;

    const { conversationId, tabId, groupId } = pendingDeleteConversation;

    try {
      console.log('[useConversationManagement] Confirming deletion of conversation:', conversationId);
      const result = await ipcRenderer.invoke('conversation:delete', conversationId);

      if (result.success) {
        // Close the tab
        closeTab(tabId, groupId);
        console.log('[useConversationManagement] Conversation deleted and tab closed:', conversationId);
      } else {
        console.error('[useConversationManagement] Failed to delete conversation:', result.error);
        alert(`Failed to delete conversation: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('[useConversationManagement] Error deleting conversation:', error);
      alert(`Error deleting conversation: ${error}`);
    } finally {
      // Clear the pending deletion state
      setPendingDeleteConversation(null);
    }
  }, [pendingDeleteConversation, closeTab]);

  return {
    handleConversationSelect,
    handleCreateConversation,
    confirmDeleteConversation,
    pendingDeleteConversation,
    setPendingDeleteConversation,
  };
}
