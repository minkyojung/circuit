/**
 * Custom hook for conversation deletion logic
 * Handles deletion with automatic conversation creation when deleting the last one
 * Includes rollback logic for failed deletions
 */

import { useState, useCallback } from 'react'

// @ts-ignore
const { ipcRenderer } = window.require('electron')

interface Conversation {
  id: string
  workspaceId: string
  title: string
  createdAt: number
  updatedAt: number
  lastViewedAt?: number
}

interface UseConversationDeletionParams {
  workspaceId: string | null
  conversations: Conversation[]
  activeConversationId: string | null
  onConversationChange: (conversationId: string) => void
  loadConversations: () => Promise<void>
}

export function useConversationDeletion({
  workspaceId,
  conversations,
  activeConversationId,
  onConversationChange,
  loadConversations
}: UseConversationDeletionParams) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const confirmDelete = useCallback(async () => {
    if (!deletingId || isDeleting) return

    setIsDeleting(true)
    try {
      // If this is the last conversation, create a new one first
      if (conversations.length === 1) {
        console.log('[useConversationDeletion] Last conversation - creating new one before deleting')
        const createResult = await ipcRenderer.invoke('conversation:create', workspaceId)

        if (createResult.success && createResult.conversation) {
          const newConversationId = createResult.conversation.id

          // Switch to the new conversation immediately (fast UX)
          onConversationChange(newConversationId)

          // Now delete the old one
          const deleteResult = await ipcRenderer.invoke('conversation:delete', deletingId)
          if (!deleteResult.success) {
            console.error('[useConversationDeletion] Failed to delete old conversation, rolling back')

            // Rollback: delete the newly created conversation and switch back
            await ipcRenderer.invoke('conversation:delete', newConversationId)
            onConversationChange(deletingId)

            alert(`Failed to delete conversation: ${deleteResult.error || 'Unknown error'}`)
          }

          await loadConversations()
        } else {
          console.error('[useConversationDeletion] Failed to create new conversation:', createResult.error)
          alert(`Cannot delete last conversation: Failed to create replacement conversation`)
        }
      } else {
        // Normal deletion - not the last conversation
        const result = await ipcRenderer.invoke('conversation:delete', deletingId)
        if (result.success) {
          if (deletingId === activeConversationId) {
            const otherConversation = conversations.find(c => c.id !== deletingId)
            if (otherConversation) {
              onConversationChange(otherConversation.id)
            }
          }

          await loadConversations()
        } else {
          console.error('[useConversationDeletion] Failed to delete:', result.error)
          alert(`Failed to delete conversation: ${result.error || 'Unknown error'}`)
        }
      }
    } catch (error) {
      console.error('[useConversationDeletion] Error deleting conversation:', error)
      alert(`Error deleting conversation: ${error}`)
    } finally {
      setDeletingId(null)
      setIsDeleting(false)
    }
  }, [deletingId, isDeleting, conversations, workspaceId, activeConversationId, onConversationChange, loadConversations])

  return {
    deletingId,
    setDeletingId,
    isDeleting,
    confirmDelete
  }
}
