/**
 * Todo IPC Handlers
 *
 * Handles todo-related operations between renderer and main process
 */

import { ipcMain, IpcMainInvokeEvent, BrowserWindow } from 'electron'
import type { ConversationStorage, Todo, TodoStatus } from './conversationStorage'

export function registerTodoHandlers(storage: ConversationStorage) {
  /**
   * Load todos for a conversation
   */
  ipcMain.handle('todos:load', async (_event: IpcMainInvokeEvent, conversationId: string) => {
    try {
      const todos = storage.getTodos(conversationId)
      const stats = storage.getTodoStats(conversationId)

      return {
        success: true,
        todos,
        stats,
      }
    } catch (error) {
      console.error('[TodoHandlers] Failed to load todos:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  /**
   * Load todos for a specific message
   */
  ipcMain.handle('todos:load-by-message', async (_event: IpcMainInvokeEvent, messageId: string) => {
    try {
      const todos = storage.getTodosByMessage(messageId)

      return {
        success: true,
        todos,
      }
    } catch (error) {
      console.error('[TodoHandlers] Failed to load todos by message:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  /**
   * Save a single todo
   */
  ipcMain.handle('todos:save', async (_event: IpcMainInvokeEvent, todo: Todo) => {
    try {
      storage.saveTodo(todo)

      return {
        success: true,
      }
    } catch (error) {
      console.error('[TodoHandlers] Failed to save todo:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  /**
   * Save multiple todos
   */
  ipcMain.handle('todos:save-multiple', async (_event: IpcMainInvokeEvent, todos: Todo[]) => {
    try {
      storage.saveTodos(todos)

      return {
        success: true,
      }
    } catch (error) {
      console.error('[TodoHandlers] Failed to save todos:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  /**
   * Update todo status
   */
  ipcMain.handle(
    'todos:update-status',
    async (
      _event: IpcMainInvokeEvent,
      data: {
        todoId: string
        status: TodoStatus
        progress?: number
        completedAt?: number
      }
    ) => {
      try {
        storage.updateTodoStatus(data.todoId, data.status, data.progress, data.completedAt)

        return {
          success: true,
        }
      } catch (error) {
        console.error('[TodoHandlers] Failed to update todo status:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      }
    }
  )

  /**
   * Update todo timing
   */
  ipcMain.handle(
    'todos:update-timing',
    async (
      _event: IpcMainInvokeEvent,
      data: {
        todoId: string
        startedAt?: number
        completedAt?: number
        actualDuration?: number
      }
    ) => {
      try {
        storage.updateTodoTiming(data.todoId, {
          startedAt: data.startedAt,
          completedAt: data.completedAt,
          actualDuration: data.actualDuration,
        })

        return {
          success: true,
        }
      } catch (error) {
        console.error('[TodoHandlers] Failed to update todo timing:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      }
    }
  )

  /**
   * Delete a todo
   */
  ipcMain.handle('todos:delete', async (_event: IpcMainInvokeEvent, todoId: string) => {
    try {
      storage.deleteTodo(todoId)

      return {
        success: true,
      }
    } catch (error) {
      console.error('[TodoHandlers] Failed to delete todo:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  /**
   * Get a single todo
   */
  ipcMain.handle('todos:get', async (_event: IpcMainInvokeEvent, todoId: string) => {
    try {
      const todo = storage.getTodo(todoId)

      if (!todo) {
        return {
          success: false,
          error: 'Todo not found',
        }
      }

      return {
        success: true,
        todo,
      }
    } catch (error) {
      console.error('[TodoHandlers] Failed to get todo:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  /**
   * Get todo statistics
   */
  ipcMain.handle('todos:stats', async (_event: IpcMainInvokeEvent, conversationId: string) => {
    try {
      const stats = storage.getTodoStats(conversationId)

      return {
        success: true,
        stats,
      }
    } catch (error) {
      console.error('[TodoHandlers] Failed to get todo stats:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  })

  /**
   * Trigger task execution
   * Sends event to renderer process to handle execution
   */
  ipcMain.handle(
    'todos:trigger-execution',
    async (
      event: IpcMainInvokeEvent,
      data: {
        conversationId: string
        messageId: string
        mode: 'auto' | 'manual'
        todos: any[]
      }
    ) => {
      try {
        console.log('[TodoHandlers] Triggering task execution:', data.mode, data.todos.length, 'tasks')

        // Get the sender window
        const senderWindow = BrowserWindow.fromWebContents(event.sender)

        if (senderWindow) {
          // Send event back to renderer to handle execution
          senderWindow.webContents.send('todos:execute-tasks', {
            conversationId: data.conversationId,
            messageId: data.messageId,
            mode: data.mode,
            todos: data.todos,
          })
        }

        return {
          success: true,
        }
      } catch (error) {
        console.error('[TodoHandlers] Failed to trigger execution:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      }
    }
  )

  console.log('[TodoHandlers] Todo IPC handlers registered')
}
