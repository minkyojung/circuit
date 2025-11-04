/**
 * Agent IPC Handlers
 *
 * Handles agent-related IPC communication between renderer and main process
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { getAgentManager } from './agentManager'
import type { ConversationStorage, Todo } from './conversationStorage'
import type { AgentContext } from './agentWorker'

// Import storage getter from conversationHandlers
import { getStorage } from './conversationHandlers'

/**
 * Register agent IPC handlers
 *
 * NOTE: This must be called AFTER conversation handlers are initialized
 * because it depends on the storage instance
 */
export function registerAgentHandlers() {
  const storage = getStorage()
  if (!storage) {
    console.error('[AgentHandlers] Storage not initialized! Agent handlers will not work.')
    return
  }

  const agentManager = getAgentManager()
  agentManager.setStorage(storage)

  /**
   * Helper to get workspace path from workspaceId
   * TODO: This is a placeholder. Need to get actual workspace info from main.cjs
   */
  function getWorkspacePath(workspaceId: string): string | undefined {
    // For now, just return current working directory
    // This will be improved when we integrate with workspace management
    console.warn('[AgentHandlers] Using cwd as workspace path (temporary)')
    return process.cwd()
  }

  /**
   * Start an agent for a todo
   */
  ipcMain.handle('agent:start', async (_event: IpcMainInvokeEvent, data: {
    todoId: string
    workspaceId?: string
    relevantFiles?: string[]
  }) => {
    try {
      console.log('[AgentHandlers] Starting agent for todo:', data.todoId)

      // Get todo
      const todo = storage.getTodo(data.todoId)
      if (!todo) {
        return { success: false, error: 'Todo not found' }
      }

      // Get workspace path
      // Option 1: From workspaceId parameter
      let workspacePath: string | undefined
      if (data.workspaceId) {
        workspacePath = getWorkspacePath(data.workspaceId)
      }

      // Option 2: From conversation's workspaceId
      // TODO: Re-enable when storage.getConversation is implemented
      // if (!workspacePath) {
      //   const conversation = storage.getConversation(todo.conversationId)
      //   if (conversation && conversation.workspaceId) {
      //     workspacePath = getWorkspacePath(conversation.workspaceId)
      //   }
      // }

      // Fallback: Use current working directory
      if (!workspacePath) {
        workspacePath = process.cwd()
        console.warn('[AgentHandlers] No workspace path found, using cwd:', workspacePath)
      }

      // Build context
      const context: AgentContext = {
        conversationId: todo.conversationId,
        workspacePath,
        instruction: todo.content,
        relevantFiles: data.relevantFiles || []
      }

      // Start agent
      await agentManager.startAgent(todo, context)

      return { success: true }

    } catch (error) {
      console.error('[AgentHandlers] Failed to start agent:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  /**
   * Cancel an agent
   */
  ipcMain.handle('agent:cancel', async (_event: IpcMainInvokeEvent, todoId: string) => {
    try {
      console.log('[AgentHandlers] Cancelling agent for todo:', todoId)
      await agentManager.cancelAgent(todoId)
      return { success: true }

    } catch (error) {
      console.error('[AgentHandlers] Failed to cancel agent:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  /**
   * Get agent status
   */
  ipcMain.handle('agent:get-status', async (_event: IpcMainInvokeEvent, todoId: string) => {
    try {
      const status = agentManager.getAgentStatus(todoId)
      return { success: true, status }

    } catch (error) {
      console.error('[AgentHandlers] Failed to get agent status:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  /**
   * Get all agent statuses
   */
  ipcMain.handle('agent:get-all-statuses', async (_event: IpcMainInvokeEvent) => {
    try {
      const statuses = agentManager.getAllAgentStatuses()
      return { success: true, statuses }

    } catch (error) {
      console.error('[AgentHandlers] Failed to get all agent statuses:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  console.log('[AgentHandlers] Agent IPC handlers registered')
}
