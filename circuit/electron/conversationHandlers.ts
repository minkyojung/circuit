/**
 * IPC Handlers for Conversation and Message Operations
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { ConversationStorage, Conversation, Message } from './conversationStorage'

let storage: ConversationStorage | null = null

/**
 * Initialize conversation storage
 */
export async function initializeConversationStorage(): Promise<void> {
  try {
    storage = new ConversationStorage()
    await storage.initialize()
    console.log('[ConversationHandlers] Storage initialized')
  } catch (error) {
    console.error('[ConversationHandlers] Failed to initialize storage:', error)
    throw error
  }
}

/**
 * Register all conversation-related IPC handlers
 */
export function registerConversationHandlers(): void {
  console.log('[ConversationHandlers] Registering IPC handlers...')

  // ============================================================================
  // Conversation Handlers
  // ============================================================================

  /**
   * Get all conversations for a workspace
   */
  ipcMain.handle(
    'conversation:list',
    async (_event: IpcMainInvokeEvent, workspaceId: string) => {
      try {
        if (!storage) throw new Error('Storage not initialized')

        const conversations = storage.getByWorkspaceId(workspaceId)

        return {
          success: true,
          conversations
        }
      } catch (error: any) {
        console.error('[conversation:list] Error:', error)
        return {
          success: false,
          error: error.message
        }
      }
    }
  )

  /**
   * Get active conversation for a workspace
   */
  ipcMain.handle(
    'conversation:get-active',
    async (_event: IpcMainInvokeEvent, workspaceId: string) => {
      try {
        if (!storage) throw new Error('Storage not initialized')

        const conversation = storage.getActiveConversation(workspaceId)

        return {
          success: true,
          conversation
        }
      } catch (error: any) {
        console.error('[conversation:get-active] Error:', error)
        return {
          success: false,
          error: error.message
        }
      }
    }
  )

  /**
   * Create a new conversation
   */
  ipcMain.handle(
    'conversation:create',
    async (_event: IpcMainInvokeEvent, workspaceId: string, title?: string) => {
      try {
        if (!storage) throw new Error('Storage not initialized')

        const conversation = storage.create(workspaceId, title)

        // Set as active conversation
        storage.setActive(workspaceId, conversation.id)
        storage.updateLastActive(workspaceId, conversation.id)

        return {
          success: true,
          conversation
        }
      } catch (error: any) {
        console.error('[conversation:create] Error:', error)
        return {
          success: false,
          error: error.message
        }
      }
    }
  )

  /**
   * Update conversation title
   */
  ipcMain.handle(
    'conversation:update-title',
    async (_event: IpcMainInvokeEvent, conversationId: string, title: string) => {
      try {
        if (!storage) throw new Error('Storage not initialized')

        storage.updateTitle(conversationId, title)

        return {
          success: true
        }
      } catch (error: any) {
        console.error('[conversation:update-title] Error:', error)
        return {
          success: false,
          error: error.message
        }
      }
    }
  )

  /**
   * Delete a conversation
   */
  ipcMain.handle(
    'conversation:delete',
    async (_event: IpcMainInvokeEvent, conversationId: string) => {
      try {
        if (!storage) throw new Error('Storage not initialized')

        storage.delete(conversationId)

        return {
          success: true
        }
      } catch (error: any) {
        console.error('[conversation:delete] Error:', error)
        return {
          success: false,
          error: error.message
        }
      }
    }
  )

  /**
   * Set active conversation
   */
  ipcMain.handle(
    'conversation:set-active',
    async (_event: IpcMainInvokeEvent, workspaceId: string, conversationId: string) => {
      try {
        if (!storage) throw new Error('Storage not initialized')

        storage.setActive(workspaceId, conversationId)
        storage.updateLastActive(workspaceId, conversationId)

        return {
          success: true
        }
      } catch (error: any) {
        console.error('[conversation:set-active] Error:', error)
        return {
          success: false,
          error: error.message
        }
      }
    }
  )

  // ============================================================================
  // Message Handlers
  // ============================================================================

  /**
   * Load all messages for a conversation
   */
  ipcMain.handle(
    'message:load',
    async (_event: IpcMainInvokeEvent, conversationId: string, options?: { limit?: number; offset?: number }) => {
      try {
        if (!storage) throw new Error('Storage not initialized')

        const messages = storage.getMessages(conversationId, options)

        return {
          success: true,
          messages
        }
      } catch (error: any) {
        console.error('[message:load] Error:', error)
        return {
          success: false,
          error: error.message
        }
      }
    }
  )

  /**
   * Save a single message
   */
  ipcMain.handle(
    'message:save',
    async (_event: IpcMainInvokeEvent, message: Message) => {
      try {
        if (!storage) throw new Error('Storage not initialized')

        storage.saveMessage(message)

        return {
          success: true
        }
      } catch (error: any) {
        console.error('[message:save] Error:', error)
        return {
          success: false,
          error: error.message
        }
      }
    }
  )

  /**
   * Save multiple messages (batch)
   */
  ipcMain.handle(
    'message:save-batch',
    async (_event: IpcMainInvokeEvent, messages: Message[]) => {
      try {
        if (!storage) throw new Error('Storage not initialized')

        storage.saveMessages(messages)

        return {
          success: true
        }
      } catch (error: any) {
        console.error('[message:save-batch] Error:', error)
        return {
          success: false,
          error: error.message
        }
      }
    }
  )

  /**
   * Delete a message
   */
  ipcMain.handle(
    'message:delete',
    async (_event: IpcMainInvokeEvent, messageId: string) => {
      try {
        if (!storage) throw new Error('Storage not initialized')

        storage.deleteMessage(messageId)

        return {
          success: true
        }
      } catch (error: any) {
        console.error('[message:delete] Error:', error)
        return {
          success: false,
          error: error.message
        }
      }
    }
  )

  /**
   * Get message count for a conversation
   */
  ipcMain.handle(
    'message:count',
    async (_event: IpcMainInvokeEvent, conversationId: string) => {
      try {
        if (!storage) throw new Error('Storage not initialized')

        const count = storage.getMessageCount(conversationId)

        return {
          success: true,
          count
        }
      } catch (error: any) {
        console.error('[message:count] Error:', error)
        return {
          success: false,
          error: error.message
        }
      }
    }
  )

  // ============================================================================
  // Workspace Metadata Handlers
  // ============================================================================

  /**
   * Get workspace metadata
   */
  ipcMain.handle(
    'conversation:get-workspace-metadata',
    async (_event: IpcMainInvokeEvent, workspaceId: string) => {
      try {
        if (!storage) throw new Error('Storage not initialized')

        const metadata = storage.getWorkspaceMetadata(workspaceId)

        return {
          success: true,
          metadata
        }
      } catch (error: any) {
        console.error('[conversation:get-workspace-metadata] Error:', error)
        return {
          success: false,
          error: error.message
        }
      }
    }
  )

  // ============================================================================
  // Statistics Handlers
  // ============================================================================

  /**
   * Get database statistics
   */
  ipcMain.handle(
    'conversation:get-stats',
    async (_event: IpcMainInvokeEvent) => {
      try {
        if (!storage) throw new Error('Storage not initialized')

        const stats = storage.getStats()

        return {
          success: true,
          stats
        }
      } catch (error: any) {
        console.error('[conversation:get-stats] Error:', error)
        return {
          success: false,
          error: error.message
        }
      }
    }
  )

  console.log('[ConversationHandlers] All IPC handlers registered')
}

/**
 * Cleanup on app quit
 */
export function cleanupConversationStorage(): void {
  if (storage) {
    storage.close()
    storage = null
    console.log('[ConversationHandlers] Storage closed')
  }
}
