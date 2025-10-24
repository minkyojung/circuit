/**
 * IPC Handlers for Project Memory
 *
 * Handles frontend requests for memory storage, retrieval, and management.
 */

import { ipcMain } from 'electron'
import { getMemoryStorage } from './memoryStorage.js'
import type { MemoryQuery } from './memoryStorage.js'

/**
 * Register all memory-related IPC handlers
 */
export function registerMemoryHandlers(): void {
  console.log('[MemoryHandlers] Registering IPC handlers...')

  /**
   * Store a memory
   */
  ipcMain.handle('circuit:memory-store', async (event, memory) => {
    try {
      const storage = await getMemoryStorage()
      const id = await storage.storeMemory(memory)

      return { success: true, id }
    } catch (error: any) {
      console.error('[MemoryHandlers] Error storing memory:', error)
      return { success: false, error: error.message }
    }
  })

  /**
   * Retrieve memories with filters
   */
  ipcMain.handle('circuit:memory-list', async (event, query: MemoryQuery = {}) => {
    try {
      const storage = await getMemoryStorage()
      const memories = await storage.getMemories(query)

      return { success: true, memories }
    } catch (error: any) {
      console.error('[MemoryHandlers] Error listing memories:', error)
      return { success: false, error: error.message }
    }
  })

  /**
   * Get a specific memory
   */
  ipcMain.handle('circuit:memory-get', async (event, projectPath: string, key: string) => {
    try {
      const storage = await getMemoryStorage()
      const memory = await storage.getMemory(projectPath, key)

      return { success: true, memory }
    } catch (error: any) {
      console.error('[MemoryHandlers] Error getting memory:', error)
      return { success: false, error: error.message }
    }
  })

  /**
   * Delete a memory
   */
  ipcMain.handle('circuit:memory-delete', async (event, projectPath: string, key: string) => {
    try {
      const storage = await getMemoryStorage()
      const deleted = await storage.deleteMemory(projectPath, key)

      return { success: true, deleted }
    } catch (error: any) {
      console.error('[MemoryHandlers] Error deleting memory:', error)
      return { success: false, error: error.message }
    }
  })

  /**
   * Clear all memories for a project
   */
  ipcMain.handle('circuit:memory-clear-project', async (event, projectPath: string) => {
    try {
      const storage = await getMemoryStorage()
      const count = await storage.clearProject(projectPath)

      return { success: true, count }
    } catch (error: any) {
      console.error('[MemoryHandlers] Error clearing project:', error)
      return { success: false, error: error.message }
    }
  })

  /**
   * Get memory statistics
   */
  ipcMain.handle('circuit:memory-stats', async (event, projectPath?: string) => {
    try {
      const storage = await getMemoryStorage()
      const stats = await storage.getStats(projectPath)

      return { success: true, stats }
    } catch (error: any) {
      console.error('[MemoryHandlers] Error getting stats:', error)
      return { success: false, error: error.message }
    }
  })

  /**
   * Export memories
   */
  ipcMain.handle('circuit:memory-export', async (event, projectPath?: string) => {
    try {
      const storage = await getMemoryStorage()
      const memories = await storage.exportMemories(projectPath)

      return { success: true, memories }
    } catch (error: any) {
      console.error('[MemoryHandlers] Error exporting memories:', error)
      return { success: false, error: error.message }
    }
  })

  /**
   * Import memories
   */
  ipcMain.handle('circuit:memory-import', async (event, memories) => {
    try {
      const storage = await getMemoryStorage()
      const count = await storage.importMemories(memories)

      return { success: true, count }
    } catch (error: any) {
      console.error('[MemoryHandlers] Error importing memories:', error)
      return { success: false, error: error.message }
    }
  })

  /**
   * Create backup
   */
  ipcMain.handle('circuit:memory-backup', async (event) => {
    try {
      const storage = await getMemoryStorage()
      const backupPath = await storage.createBackup()

      return { success: true, backupPath }
    } catch (error: any) {
      console.error('[MemoryHandlers] Error creating backup:', error)
      return { success: false, error: error.message }
    }
  })

  console.log('[MemoryHandlers] IPC handlers registered')
}
