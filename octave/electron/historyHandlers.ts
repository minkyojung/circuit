/**
 * IPC Handlers for MCP Call History
 *
 * Handles frontend requests for history data, statistics, and management.
 */

import { ipcMain } from 'electron'
import { getHistoryStorage } from './historyStorage.js'
import type { HistoryQuery } from './historyStorage.js'

/**
 * Register all history-related IPC handlers
 */
export function registerHistoryHandlers(): void {
  console.log('[HistoryHandlers] Registering IPC handlers...')

  /**
   * Get call history with filters
   */
  ipcMain.handle('octave:history-get', async (event, query: HistoryQuery = {}) => {
    try {
      const storage = await getHistoryStorage()
      const calls = await storage.getCalls(query)

      return {
        success: true,
        calls,
        hasMore: calls.length >= (query.limit || 50),
        nextCursor: calls.length > 0 ? calls[calls.length - 1].timestamp : undefined,
      }
    } catch (error: any) {
      console.error('[HistoryHandlers] Error getting history:', error)
      return { success: false, error: error.message }
    }
  })

  /**
   * Get statistics for calls
   */
  ipcMain.handle('octave:history-get-stats', async (event, query: Omit<HistoryQuery, 'limit' | 'cursor'> = {}) => {
    try {
      const storage = await getHistoryStorage()
      const stats = await storage.getStats(query)

      return { success: true, stats }
    } catch (error: any) {
      console.error('[HistoryHandlers] Error getting stats:', error)
      return { success: false, error: error.message }
    }
  })

  /**
   * Clear all history
   */
  ipcMain.handle('octave:history-clear', async (event) => {
    try {
      const storage = await getHistoryStorage()

      // Create backup before clearing
      const backupPath = await storage.createBackup()
      console.log('[HistoryHandlers] Backup created before clearing:', backupPath)

      // Delete all calls by applying 0-day retention
      await storage.applyRetention(0)

      return { success: true }
    } catch (error: any) {
      console.error('[HistoryHandlers] Error clearing history:', error)
      return { success: false, error: error.message }
    }
  })

  /**
   * Apply retention policy
   */
  ipcMain.handle('octave:history-apply-retention', async (event, days: number) => {
    try {
      const storage = await getHistoryStorage()
      const deletedCount = await storage.applyRetention(days)

      return { success: true, deletedCount }
    } catch (error: any) {
      console.error('[HistoryHandlers] Error applying retention:', error)
      return { success: false, error: error.message }
    }
  })

  /**
   * Create backup
   */
  ipcMain.handle('octave:history-create-backup', async (event) => {
    try {
      const storage = await getHistoryStorage()
      const backupPath = await storage.createBackup()

      return { success: true, backupPath }
    } catch (error: any) {
      console.error('[HistoryHandlers] Error creating backup:', error)
      return { success: false, error: error.message }
    }
  })

  console.log('[HistoryHandlers] All IPC handlers registered')
}
