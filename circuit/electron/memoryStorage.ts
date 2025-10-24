/**
 * Project Memory Storage Layer
 *
 * SQLite-based storage for project-specific memories and conventions.
 * Stores coding patterns, decisions, rules that Claude Code can reference.
 */

import Database from 'better-sqlite3'
import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'

// Type definitions
export interface ProjectMemory {
  id: string
  timestamp: number
  projectPath: string
  type: 'convention' | 'decision' | 'snippet' | 'rule' | 'note'
  key: string
  value: string
  metadata?: string // JSON string for extra data
  usageCount: number
  priority: 'high' | 'medium' | 'low'
  createdAt: number
  updatedAt: number
}

export interface MemoryQuery {
  projectPath?: string
  type?: string
  key?: string
  searchQuery?: string
  limit?: number
}

export interface MemoryStats {
  totalMemories: number
  byType: Record<string, number>
  byPriority: Record<string, number>
  mostUsed: Array<{ key: string; usageCount: number }>
}

/**
 * SQLite-based memory storage
 */
export class MemoryStorage {
  private db: Database.Database | null = null
  private dbPath: string
  private backupDir: string
  private schemaVersion = 1

  constructor() {
    const userData = app.getPath('userData')
    const circuitDir = path.join(userData, 'circuit-data')

    // Ensure directory exists
    if (!fs.existsSync(circuitDir)) {
      fs.mkdirSync(circuitDir, { recursive: true })
    }

    this.dbPath = path.join(circuitDir, 'memory.db')
    this.backupDir = path.join(circuitDir, 'backups')

    // Ensure backup directory exists
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true })
    }

    console.log('[MemoryStorage] Database path:', this.dbPath)
    console.log('[MemoryStorage] Backup directory:', this.backupDir)
  }

  /**
   * Initialize database and run migrations
   */
  async initialize(): Promise<void> {
    try {
      console.log('[MemoryStorage] Initializing database...')

      // Open database
      this.db = new Database(this.dbPath)
      this.db.pragma('journal_mode = WAL') // Better concurrency

      // Run migrations
      await this.migrate()

      console.log('[MemoryStorage] Database initialized successfully')
    } catch (error) {
      console.error('[MemoryStorage] Failed to initialize:', error)
      throw error
    }
  }

  /**
   * Run database migrations
   */
  private async migrate(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')

    // Create schema_version table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at INTEGER NOT NULL
      )
    `)

    // Get current version
    const currentVersion = this.getCurrentVersion()

    console.log(`[MemoryStorage] Current schema version: ${currentVersion}`)

    // Migration v1: Initial schema
    if (currentVersion < 1) {
      console.log('[MemoryStorage] Running migration v1: Initial schema')

      this.db.exec(`
        CREATE TABLE project_memories (
          id TEXT PRIMARY KEY,
          timestamp INTEGER NOT NULL,
          project_path TEXT NOT NULL,
          type TEXT NOT NULL,
          key TEXT NOT NULL,
          value TEXT NOT NULL,
          metadata TEXT,
          usage_count INTEGER DEFAULT 0,
          priority TEXT DEFAULT 'medium',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE INDEX idx_project_path ON project_memories(project_path);
        CREATE INDEX idx_type ON project_memories(type);
        CREATE INDEX idx_key ON project_memories(key);
        CREATE INDEX idx_project_type ON project_memories(project_path, type);
        CREATE INDEX idx_usage_count ON project_memories(usage_count DESC);
        CREATE INDEX idx_priority ON project_memories(priority);
        CREATE UNIQUE INDEX idx_project_key ON project_memories(project_path, key);
      `)

      // Record migration
      this.db.prepare(`
        INSERT INTO schema_version (version, name, applied_at)
        VALUES (?, ?, ?)
      `).run(1, 'initial_schema', Date.now())

      console.log('[MemoryStorage] Migration v1 complete')
    }
  }

  /**
   * Get current schema version
   */
  private getCurrentVersion(): number {
    if (!this.db) return 0

    try {
      const result = this.db
        .prepare('SELECT MAX(version) as version FROM schema_version')
        .get() as { version: number | null }

      return result?.version || 0
    } catch (error) {
      // Table doesn't exist yet
      return 0
    }
  }

  /**
   * Store a memory (or update if key exists)
   */
  async storeMemory(memory: Omit<ProjectMemory, 'id' | 'timestamp' | 'usageCount' | 'createdAt' | 'updatedAt'>): Promise<string> {
    if (!this.db) throw new Error('Database not initialized')

    const now = Date.now()
    const id = this.generateId()

    try {
      // Check if memory with same project_path + key exists
      const existing = this.db.prepare(`
        SELECT id, created_at, usage_count FROM project_memories
        WHERE project_path = ? AND key = ?
      `).get(memory.projectPath, memory.key) as any

      if (existing) {
        // Update existing memory
        this.db.prepare(`
          UPDATE project_memories
          SET value = ?, metadata = ?, type = ?, priority = ?, updated_at = ?
          WHERE id = ?
        `).run(
          memory.value,
          memory.metadata || null,
          memory.type,
          memory.priority,
          now,
          existing.id
        )

        console.log('[MemoryStorage] Updated existing memory:', memory.key)
        return existing.id
      } else {
        // Insert new memory
        this.db.prepare(`
          INSERT INTO project_memories (
            id, timestamp, project_path, type, key, value, metadata,
            usage_count, priority, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          now,
          memory.projectPath,
          memory.type,
          memory.key,
          memory.value,
          memory.metadata || null,
          0,
          memory.priority,
          now,
          now
        )

        console.log('[MemoryStorage] Stored new memory:', memory.key)
        return id
      }
    } catch (error) {
      console.error('[MemoryStorage] Failed to store memory:', error)
      throw error
    }
  }

  /**
   * Retrieve memories with optional filters
   */
  async getMemories(query: MemoryQuery = {}): Promise<ProjectMemory[]> {
    if (!this.db) throw new Error('Database not initialized')

    const {
      projectPath,
      type,
      key,
      searchQuery,
      limit = 100,
    } = query

    let sql = 'SELECT * FROM project_memories WHERE 1=1'
    const params: any[] = []

    // Filters
    if (projectPath) {
      sql += ' AND project_path = ?'
      params.push(projectPath)
    }

    if (type) {
      sql += ' AND type = ?'
      params.push(type)
    }

    if (key) {
      sql += ' AND key = ?'
      params.push(key)
    }

    if (searchQuery) {
      sql += ' AND (key LIKE ? OR value LIKE ?)'
      const searchPattern = `%${searchQuery}%`
      params.push(searchPattern, searchPattern)
    }

    // Order by priority and usage
    sql += ' ORDER BY CASE priority WHEN \'high\' THEN 1 WHEN \'medium\' THEN 2 ELSE 3 END, usage_count DESC LIMIT ?'
    params.push(limit)

    try {
      const rows = this.db.prepare(sql).all(...params) as any[]
      return rows.map(this.rowToMemory)
    } catch (error) {
      console.error('[MemoryStorage] Failed to query memories:', error)
      throw error
    }
  }

  /**
   * Get a single memory by key
   */
  async getMemory(projectPath: string, key: string): Promise<ProjectMemory | null> {
    if (!this.db) throw new Error('Database not initialized')

    try {
      const row = this.db.prepare(`
        SELECT * FROM project_memories
        WHERE project_path = ? AND key = ?
      `).get(projectPath, key) as any

      if (!row) return null

      // Increment usage count
      this.db.prepare(`
        UPDATE project_memories
        SET usage_count = usage_count + 1
        WHERE id = ?
      `).run(row.id)

      return this.rowToMemory(row)
    } catch (error) {
      console.error('[MemoryStorage] Failed to get memory:', error)
      throw error
    }
  }

  /**
   * Delete a memory
   */
  async deleteMemory(projectPath: string, key: string): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized')

    try {
      const result = this.db.prepare(`
        DELETE FROM project_memories
        WHERE project_path = ? AND key = ?
      `).run(projectPath, key)

      console.log('[MemoryStorage] Deleted memory:', key, result.changes > 0 ? 'success' : 'not found')
      return result.changes > 0
    } catch (error) {
      console.error('[MemoryStorage] Failed to delete memory:', error)
      throw error
    }
  }

  /**
   * Clear all memories for a project
   */
  async clearProject(projectPath: string): Promise<number> {
    if (!this.db) throw new Error('Database not initialized')

    try {
      const result = this.db.prepare(`
        DELETE FROM project_memories WHERE project_path = ?
      `).run(projectPath)

      console.log(`[MemoryStorage] Cleared ${result.changes} memories for project`)
      return result.changes
    } catch (error) {
      console.error('[MemoryStorage] Failed to clear project:', error)
      throw error
    }
  }

  /**
   * Get statistics for memories
   */
  async getStats(projectPath?: string): Promise<MemoryStats> {
    if (!this.db) throw new Error('Database not initialized')

    let whereClause = 'WHERE 1=1'
    const params: any[] = []

    if (projectPath) {
      whereClause += ' AND project_path = ?'
      params.push(projectPath)
    }

    // Total count
    const countRow = this.db.prepare(`
      SELECT COUNT(*) as total FROM project_memories ${whereClause}
    `).get(...params) as any

    // By type
    const typeRows = this.db.prepare(`
      SELECT type, COUNT(*) as count
      FROM project_memories
      ${whereClause}
      GROUP BY type
    `).all(...params) as any[]

    const byType: Record<string, number> = {}
    typeRows.forEach(row => {
      byType[row.type] = row.count
    })

    // By priority
    const priorityRows = this.db.prepare(`
      SELECT priority, COUNT(*) as count
      FROM project_memories
      ${whereClause}
      GROUP BY priority
    `).all(...params) as any[]

    const byPriority: Record<string, number> = {}
    priorityRows.forEach(row => {
      byPriority[row.priority] = row.count
    })

    // Most used
    const mostUsedRows = this.db.prepare(`
      SELECT key, usage_count
      FROM project_memories
      ${whereClause}
      ORDER BY usage_count DESC
      LIMIT 10
    `).all(...params) as any[]

    return {
      totalMemories: countRow.total || 0,
      byType,
      byPriority,
      mostUsed: mostUsedRows.map(row => ({
        key: row.key,
        usageCount: row.usage_count
      }))
    }
  }

  /**
   * Create a backup of the database
   */
  async createBackup(): Promise<string> {
    if (!this.db) throw new Error('Database not initialized')

    const timestamp = Date.now()
    const backupPath = path.join(this.backupDir, `memory-${timestamp}.db`)

    try {
      // Close current connection temporarily
      this.db.close()

      // Copy file
      fs.copyFileSync(this.dbPath, backupPath)

      // Reopen database
      this.db = new Database(this.dbPath)
      this.db.pragma('journal_mode = WAL')

      console.log('[MemoryStorage] Backup created:', backupPath)

      return backupPath
    } catch (error) {
      console.error('[MemoryStorage] Failed to create backup:', error)
      throw error
    }
  }

  /**
   * Export memories as JSON
   */
  async exportMemories(projectPath?: string): Promise<ProjectMemory[]> {
    const query: MemoryQuery = { limit: 10000 }
    if (projectPath) {
      query.projectPath = projectPath
    }
    return this.getMemories(query)
  }

  /**
   * Import memories from JSON
   */
  async importMemories(memories: Omit<ProjectMemory, 'id' | 'timestamp' | 'usageCount' | 'createdAt' | 'updatedAt'>[]): Promise<number> {
    let imported = 0
    for (const memory of memories) {
      try {
        await this.storeMemory(memory)
        imported++
      } catch (error) {
        console.error('[MemoryStorage] Failed to import memory:', memory.key, error)
      }
    }
    return imported
  }

  /**
   * Convert database row to ProjectMemory object
   */
  private rowToMemory(row: any): ProjectMemory {
    return {
      id: row.id,
      timestamp: row.timestamp,
      projectPath: row.project_path,
      type: row.type,
      key: row.key,
      value: row.value,
      metadata: row.metadata || undefined,
      usageCount: row.usage_count,
      priority: row.priority,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close()
      this.db = null
      console.log('[MemoryStorage] Database closed')
    }
  }
}

// Singleton instance
let storageInstance: MemoryStorage | null = null

export async function getMemoryStorage(): Promise<MemoryStorage> {
  if (!storageInstance) {
    storageInstance = new MemoryStorage()
    await storageInstance.initialize()
  }
  return storageInstance
}
