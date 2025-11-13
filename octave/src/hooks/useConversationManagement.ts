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

import { useState, useCallback } from 'react';
import type { Workspace } from '@/types/workspace';

const ipcRenderer = window.electron.ipcRenderer;

interface UseConversationManagementParams {
  selectedWorkspace: Workspace | null;
  setActiveConversationId: (conversationId: string | null) => void;
  closeTab: (tabId: string, groupId: string) => void;
}

interface PendingDeleteConversation {
  conversationId: string;
  tabId: string;
  groupId: string;
}

interface UseConversationManagementReturn {
  handleConversationSelect: (conversationId: string) => void;
  handleCreateConversation: () => Promise<void>;
  confirmDeleteConversation: () => Promise<void>;
  pendingDeleteConversation: PendingDeleteConversation | null;
  setPendingDeleteConversation: (pending: PendingDeleteConversation | null) => void;
}

export function useConversationManagement({
  selectedWorkspace,
  setActiveConversationId,
  closeTab,
}: UseConversationManagementParams): UseConversationManagementReturn {
  // State for conversation deletion confirmation modal
  const [pendingDeleteConversation, setPendingDeleteConversation] = useState<PendingDeleteConversation | null>(null);

  // Handle conversation selection - simply set active conversation ID
  const handleConversationSelect = useCallback(
    (conversationId: string) => {
      console.log('[useConversationManagement] Setting active conversation:', conversationId);
      setActiveConversationId(conversationId);
    },
    [setActiveConversationId]
  );

  // Handle new conversation creation
  const handleCreateConversation = useCallback(async () => {
    if (!selectedWorkspace) return;

    try {
      const createResult = await ipcRenderer.invoke('conversation:create', selectedWorkspace.id, {
        workspaceName: selectedWorkspace.name,
      });

      if (createResult.success && createResult.conversation) {
        // Set newly created conversation as active
        setActiveConversationId(createResult.conversation.id);
        console.log('[useConversationManagement] New conversation created and set as active:', createResult.conversation.id);
      } else {
        console.error('[useConversationManagement] Failed to create conversation:', createResult.error);
      }
    } catch (error) {
      console.error('[useConversationManagement] Error creating conversation:', error);
    }
  }, [selectedWorkspace, setActiveConversationId]);

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
