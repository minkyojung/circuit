/**
 * IPC Handlers for Project Memory
 *
 * Handles frontend requests for memory storage, retrieval, and management.
 * Uses SharedMemoryPool for optimized multi-conversation memory access.
 */

import { ipcMain } from 'electron'
import { getMemoryStorage } from './memoryStorage.js'
import { getSharedMemoryPool } from './sharedMemoryPool.js'
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
      console.log('[MemoryHandlers] 📝 Storing memory:', {
        key: memory.key,
        scope: memory.scope,
        projectPath: memory.projectPath?.substring(0, 50) + '...'
      })

      const storage = await getMemoryStorage()
      const pool = getSharedMemoryPool()
      const id = await storage.storeMemory(memory)

      console.log('[MemoryHandlers] ✅ Memory stored with ID:', id)

      // Invalidate cache for this project
      if (memory.projectPath) {
        console.log('[MemoryHandlers] 🗑️  Invalidating cache for project')
        pool.invalidate(memory.projectPath)

        // Pre-warm cache: Reload global memories if this is a global memory
        if (memory.scope === 'global') {
          console.log('[MemoryHandlers] 🔥 Pre-warming GLOBAL cache...')
          const globals = await pool.getGlobalMemories(memory.projectPath)
          console.log('[MemoryHandlers] ✅ Pre-warmed', globals.length, 'global memories')

          // Verify cache was populated
          const stats = pool.getCacheStats()
          console.log('[MemoryHandlers] 📊 Cache size after pre-warm:', stats.cacheSize)
          console.log('[MemoryHandlers] 📊 Cache entries:', stats.entries.length)
        }

        // Pre-warm cache: Reload conversation memories if this is a conversation memory
        if (memory.scope === 'conversation' && memory.conversationId) {
          console.log('[MemoryHandlers] 🔥 Pre-warming CONVERSATION cache...')
          const convMemories = await pool.getConversationMemories(memory.projectPath, memory.conversationId)
          console.log('[MemoryHandlers] ✅ Pre-warmed', convMemories.length, 'conversation memories')
        }
      }

      return { success: true, id }
    } catch (error: any) {
      console.error('[MemoryHandlers] ❌ Error storing memory:', error)
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
      const pool = getSharedMemoryPool()
      const deleted = await storage.deleteMemory(projectPath, key)

      // Invalidate cache
      pool.invalidate(projectPath)

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
      const pool = getSharedMemoryPool()
      const count = await storage.clearProject(projectPath)

      // Invalidate cache
      pool.invalidate(projectPath)

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

  // ============================================================================
  // SharedMemoryPool Handlers (Multi-Conversation Optimization)
  // ============================================================================

  /**
   * Get global memories (shared across all conversations)
   * Uses SharedMemoryPool for caching and deduplication
   */
  ipcMain.handle('circuit:memory-get-global', async (event, projectPath: string) => {
    try {
      const pool = getSharedMemoryPool()
      const memories = await pool.getGlobalMemories(projectPath)

      return { success: true, memories }
    } catch (error: any) {
      console.error('[MemoryHandlers] Error getting global memories:', error)
      return { success: false, error: error.message }
    }
  })

  /**
   * Get conversation-specific memories
   * Uses SharedMemoryPool for caching
   */
  ipcMain.handle('circuit:memory-get-conversation', async (event, projectPath: string, conversationId: string) => {
    try {
      const pool = getSharedMemoryPool()

      // Get both global (shared) and conversation-specific memories
      const globalMemories = await pool.getGlobalMemories(projectPath)
      const conversationMemories = await pool.getConversationMemories(projectPath, conversationId)

      // Merge them (conversation-specific memories take precedence if there are key conflicts)
      const allMemories = [...globalMemories, ...conversationMemories]

      return { success: true, memories: allMemories }
    } catch (error: any) {
      console.error('[MemoryHandlers] Error getting conversation memories:', error)
      return { success: false, error: error.message }
    }
  })

  /**
   * Build minimal agent context for todo execution
   * Returns only the essential context needed for an agent to work on a todo
   */
  ipcMain.handle('circuit:memory-build-agent-context', async (event, projectPath: string, conversationId: string, todoId: string) => {
    try {
      const pool = getSharedMemoryPool()
      // Import conversationHandlers to get the storage instance
      const { getStorage } = await import('./conversationHandlers.js')
      const convStorage = getStorage()

      const context = await pool.buildAgentContext(projectPath, conversationId, todoId, convStorage)

      return { success: true, context }
    } catch (error: any) {
      console.error('[MemoryHandlers] Error building agent context:', error)
      return { success: false, error: error.message }
    }
  })

  /**
   * Get cache statistics for monitoring
   */
  ipcMain.handle('circuit:memory-pool-stats', async (event) => {
    try {
      console.log('[MemoryHandlers] 📊 Getting pool stats...')
      const pool = getSharedMemoryPool()
      const stats = pool.getCacheStats()
      console.log('[MemoryHandlers] 📊 Stats:', {
        cacheSize: stats.cacheSize,
        entriesCount: stats.entries.length,
        entries: stats.entries.map(e => ({
          project: e.projectPath.split('/').pop(),
          globalCount: e.globalMemoryCount,
          convCount: e.conversationCount,
          age: Math.floor(e.age / 1000) + 's'
        }))
      })

      return { success: true, stats }
    } catch (error: any) {
      console.error('[MemoryHandlers] ❌ Error getting pool stats:', error)
      return { success: false, error: error.message }
    }
  })

  /**
   * Clear memory pool cache (for debugging/testing)
   */
  ipcMain.handle('circuit:memory-pool-clear', async (event) => {
    try {
      const pool = getSharedMemoryPool()
      pool.clearCache()

      return { success: true }
    } catch (error: any) {
      console.error('[MemoryHandlers] Error clearing pool:', error)
      return { success: false, error: error.message }
    }
  })

  console.log('[MemoryHandlers] IPC handlers registered (with SharedMemoryPool integration)')
}
