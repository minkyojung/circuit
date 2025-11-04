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
 * Helper to get todo with retry logic
 * Handles async DB persistence by retrying with exponential backoff
 */
async function getTodoWithRetry(
  storage: ConversationStorage,
  todoId: string,
  options: {
    maxRetries: number
    initialDelay: number
    maxDelay: number
  }
): Promise<Todo | undefined> {
  const { maxRetries, initialDelay, maxDelay } = options

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const todo = storage.getTodo(todoId)

    if (todo) {
      if (attempt > 0) {
        console.log(`[AgentHandlers] Todo found after ${attempt} retries`)
      }
      return todo
    }

    // If this was the last attempt, give up
    if (attempt === maxRetries) {
      console.warn(`[AgentHandlers] Todo not found after ${maxRetries} retries`)
      return undefined
    }

    // Calculate delay with exponential backoff
    const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay)
    console.log(`[AgentHandlers] Todo not found, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`)

    // Wait before next attempt
    await new Promise(resolve => setTimeout(resolve, delay))
  }

  return undefined
}

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
      // Validate input
      if (!data || typeof data.todoId !== 'string' || !data.todoId.trim()) {
        return { success: false, error: 'Invalid todoId: must be a non-empty string' }
      }

      if (data.workspaceId !== undefined && typeof data.workspaceId !== 'string') {
        return { success: false, error: 'Invalid workspaceId: must be a string' }
      }

      if (data.relevantFiles !== undefined && !Array.isArray(data.relevantFiles)) {
        return { success: false, error: 'Invalid relevantFiles: must be an array' }
      }

      // Sanitize relevantFiles (filter out non-strings and path traversal attempts)
      const sanitizedFiles = (data.relevantFiles || []).filter(
        f => typeof f === 'string' && !f.includes('..') && f.trim().length > 0
      )

      console.log('[AgentHandlers] Starting agent for todo:', data.todoId)

      // Get todo with retry logic (handles async DB persistence)
      const todo = await getTodoWithRetry(storage, data.todoId, {
        maxRetries: 5,
        initialDelay: 50,
        maxDelay: 500
      })

      if (!todo) {
        return { success: false, error: 'Todo not found after retries' }
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
        relevantFiles: sanitizedFiles  // Use sanitized files
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
      // Validate input
      if (typeof todoId !== 'string' || !todoId.trim()) {
        return { success: false, error: 'Invalid todoId: must be a non-empty string' }
      }

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
      // Validate input
      if (typeof todoId !== 'string' || !todoId.trim()) {
        return { success: false, error: 'Invalid todoId: must be a non-empty string' }
      }

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
