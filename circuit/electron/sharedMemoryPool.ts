/**
 * Shared Memory Pool
 *
 * Optimizes memory usage across multiple conversations by:
 * - Deduplicating global memories (shared across all conversations)
 * - Caching frequently accessed memories
 * - Providing conversation-specific context building
 *
 * Expected memory reduction: 50-70% for multi-conversation scenarios
 */

import { getMemoryStorage, ProjectMemory, MemoryQuery } from './memoryStorage'
import { getConversationStorage } from './conversationStorage'

export interface SharedMemory {
  globalMemories: ProjectMemory[]
  conversationMemories: Map<string, ProjectMemory[]>  // conversationId -> memories
  lastAccessed: number
  projectPath: string
}

export interface AgentContext {
  projectPath: string
  conversationId: string
  todoId: string
  globalMemories: ProjectMemory[]
  conversationMemories: ProjectMemory[]
  todoContext: {
    content: string
    activeForm: string
    status: string
    createdAt: number
  } | null
  conversationHistory: {
    id: string
    role: 'user' | 'assistant' | 'system'
    timestamp: number
    // We don't include full content here - agent will load only recent messages
  }[]
}

/**
 * SharedMemoryPool - Manages memory deduplication and caching
 */
export class SharedMemoryPool {
  private cache = new Map<string, SharedMemory>()
  private readonly CACHE_TTL = 5 * 60 * 1000  // 5 minutes
  private readonly MAX_CACHE_SIZE = 10  // Max 10 projects in cache

  /**
   * Get global memories for a project (shared across all conversations)
   */
  async getGlobalMemories(projectPath: string): Promise<ProjectMemory[]> {
    // Check cache first
    const cached = this.cache.get(projectPath)
    if (cached && Date.now() - cached.lastAccessed < this.CACHE_TTL) {
      cached.lastAccessed = Date.now()
      return cached.globalMemories
    }

    // Load from database
    const storage = await getMemoryStorage()
    const query: MemoryQuery = {
      projectPath,
      scope: 'global',
      limit: 1000
    }

    const memories = await storage.getMemories(query)

    // Update cache
    this.updateCache(projectPath, {
      globalMemories: memories,
      conversationMemories: cached?.conversationMemories || new Map(),
      lastAccessed: Date.now(),
      projectPath
    })

    return memories
  }

  /**
   * Get conversation-specific memories
   */
  async getConversationMemories(
    projectPath: string,
    conversationId: string
  ): Promise<ProjectMemory[]> {
    // Check cache first
    const cached = this.cache.get(projectPath)
    if (cached) {
      const convMemories = cached.conversationMemories.get(conversationId)
      if (convMemories && Date.now() - cached.lastAccessed < this.CACHE_TTL) {
        cached.lastAccessed = Date.now()
        return convMemories
      }
    }

    // Load from database
    const storage = await getMemoryStorage()
    const query: MemoryQuery = {
      projectPath,
      scope: 'conversation',
      conversationId,
      limit: 1000
    }

    const memories = await storage.getMemories(query)

    // Update cache
    const existing = cached || {
      globalMemories: [],
      conversationMemories: new Map(),
      lastAccessed: Date.now(),
      projectPath
    }

    existing.conversationMemories.set(conversationId, memories)
    existing.lastAccessed = Date.now()

    this.updateCache(projectPath, existing)

    return memories
  }

  /**
   * Build complete context for an agent working on a todo
   * This is the minimal context needed - significantly reduces memory usage
   */
  async buildAgentContext(
    projectPath: string,
    conversationId: string,
    todoId: string
  ): Promise<AgentContext> {
    const convStorage = await getConversationStorage()

    // Get global memories (shared, cached)
    const globalMemories = await this.getGlobalMemories(projectPath)

    // Get conversation-specific memories (cached)
    const conversationMemories = await this.getConversationMemories(
      projectPath,
      conversationId
    )

    // Get the specific todo
    const todos = await convStorage.getTodos(conversationId)
    const todo = todos.find(t => t.id === todoId)

    // Get conversation metadata (NOT full messages - just metadata)
    const messages = await convStorage.getMessages(conversationId)
    const conversationHistory = messages.map(msg => ({
      id: msg.id,
      role: msg.role,
      timestamp: msg.timestamp
      // Note: We don't include content here to save memory
      // Agent will load recent messages on-demand if needed
    }))

    return {
      projectPath,
      conversationId,
      todoId,
      globalMemories,
      conversationMemories,
      todoContext: todo ? {
        content: todo.content,
        activeForm: todo.activeForm,
        status: todo.status,
        createdAt: todo.createdAt
      } : null,
      conversationHistory
    }
  }

  /**
   * Get recent messages for agent (on-demand loading)
   * This is separate from buildAgentContext to allow lazy loading
   */
  async getRecentMessages(conversationId: string, limit: number = 20) {
    const convStorage = await getConversationStorage()
    const messages = await convStorage.getMessages(conversationId)

    // Return only the most recent N messages
    return messages.slice(-limit)
  }

  /**
   * Invalidate cache for a project (call when memories are updated)
   */
  invalidate(projectPath: string): void {
    this.cache.delete(projectPath)
    console.log('[SharedMemoryPool] Cache invalidated for:', projectPath)
  }

  /**
   * Invalidate conversation-specific cache
   */
  invalidateConversation(projectPath: string, conversationId: string): void {
    const cached = this.cache.get(projectPath)
    if (cached) {
      cached.conversationMemories.delete(conversationId)
      console.log('[SharedMemoryPool] Conversation cache invalidated:', conversationId)
    }
  }

  /**
   * Update cache with LRU eviction
   */
  private updateCache(projectPath: string, memory: SharedMemory): void {
    // If cache is full, remove oldest entry
    if (this.cache.size >= this.MAX_CACHE_SIZE && !this.cache.has(projectPath)) {
      const oldestKey = this.findOldestCacheEntry()
      if (oldestKey) {
        this.cache.delete(oldestKey)
        console.log('[SharedMemoryPool] Evicted cache entry:', oldestKey)
      }
    }

    this.cache.set(projectPath, memory)
  }

  /**
   * Find the oldest cache entry for LRU eviction
   */
  private findOldestCacheEntry(): string | null {
    let oldestKey: string | null = null
    let oldestTime = Date.now()

    for (const [key, value] of this.cache.entries()) {
      if (value.lastAccessed < oldestTime) {
        oldestTime = value.lastAccessed
        oldestKey = key
      }
    }

    return oldestKey
  }

  /**
   * Clear all cache (for testing/debugging)
   */
  clearCache(): void {
    this.cache.clear()
    console.log('[SharedMemoryPool] Cache cleared')
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const stats = {
      cacheSize: this.cache.size,
      entries: [] as Array<{
        projectPath: string
        globalMemoryCount: number
        conversationCount: number
        age: number
      }>
    }

    for (const [projectPath, memory] of this.cache.entries()) {
      stats.entries.push({
        projectPath,
        globalMemoryCount: memory.globalMemories.length,
        conversationCount: memory.conversationMemories.size,
        age: Date.now() - memory.lastAccessed
      })
    }

    return stats
  }
}

// Singleton instance
let poolInstance: SharedMemoryPool | null = null

export function getSharedMemoryPool(): SharedMemoryPool {
  if (!poolInstance) {
    poolInstance = new SharedMemoryPool()
    console.log('[SharedMemoryPool] Singleton instance created')
  }
  return poolInstance
}
