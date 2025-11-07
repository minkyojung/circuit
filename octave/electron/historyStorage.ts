/**
 * MCP Call History Storage Layer
 *
 * SQLite-based storage for MCP call history with migrations, backups,
 * and efficient querying.
 */

import Database from 'better-sqlite3'
import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'

// Type definitions (duplicated here for Electron process)
export interface MCPCall {
  id: string
  timestamp: number
  duration?: number
  serverId: string
  serverName: string
  method: string
  toolName?: string
  requestParams: string // JSON string
  requestRaw: string
  responseResult?: string // JSON string
  responseError?: string // JSON string
  responseRaw?: string
  status: 'pending' | 'success' | 'error' | 'timeout'
  source: string
  sessionId?: string
  conversationId?: string
  truncated?: boolean
}

export interface HistoryQuery {
  serverId?: string
  toolName?: string
  status?: string
  after?: number
  before?: number
  cursor?: number
  limit?: number
  searchQuery?: string
}

export interface CallStats {
  totalCalls: number
  successCount: number
  errorCount: number
  successRate: number
  avgDuration: number
  callsByTool: Record<string, number>
  callsByStatus: Record<string, number>
}

/**
 * SQLite-based history storage
 */
export class HistoryStorage {
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

    this.dbPath = path.join(circuitDir, 'history.db')
    this.backupDir = path.join(circuitDir, 'backups')

    // Ensure backup directory exists
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true })
    }

    console.log('[HistoryStorage] Database path:', this.dbPath)
    console.log('[HistoryStorage] Backup directory:', this.backupDir)
  }

  /**
   * Initialize database and run migrations
   */
  async initialize(): Promise<void> {
    try {
      console.log('[HistoryStorage] Initializing database...')

      // Open database
      this.db = new Database(this.dbPath)
      this.db.pragma('journal_mode = WAL') // Better concurrency

      // Run migrations
      await this.migrate()

      console.log('[HistoryStorage] Database initialized successfully')
    } catch (error) {
      console.error('[HistoryStorage] Failed to initialize:', error)
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

    console.log(`[HistoryStorage] Current schema version: ${currentVersion}`)

    // Migration v1: Initial schema
    if (currentVersion < 1) {
      console.log('[HistoryStorage] Running migration v1: Initial schema')

      this.db.exec(`
        CREATE TABLE mcp_calls (
          id TEXT PRIMARY KEY,
          timestamp INTEGER NOT NULL,
          duration INTEGER,
          server_id TEXT NOT NULL,
          server_name TEXT NOT NULL,
          method TEXT NOT NULL,
          tool_name TEXT,
          request_params TEXT NOT NULL,
          request_raw TEXT NOT NULL,
          response_result TEXT,
          response_error TEXT,
          response_raw TEXT,
          status TEXT NOT NULL,
          source TEXT NOT NULL,
          session_id TEXT,
          conversation_id TEXT,
          truncated INTEGER DEFAULT 0
        );

        CREATE INDEX idx_timestamp ON mcp_calls(timestamp DESC);
        CREATE INDEX idx_server_id ON mcp_calls(server_id);
        CREATE INDEX idx_tool_name ON mcp_calls(tool_name);
        CREATE INDEX idx_status ON mcp_calls(status);
        CREATE INDEX idx_server_tool ON mcp_calls(server_id, tool_name);
        CREATE INDEX idx_server_timestamp ON mcp_calls(server_id, timestamp DESC);
      `)

      // Record migration
      this.db.prepare(`
        INSERT INTO schema_version (version, name, applied_at)
        VALUES (?, ?, ?)
      `).run(1, 'initial_schema', Date.now())

      console.log('[HistoryStorage] Migration v1 complete')
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
   * Store a call in history
   */
  async storeCall(call: Omit<MCPCall, 'id'>): Promise<string> {
    if (!this.db) throw new Error('Database not initialized')

    const id = this.generateId()
    const fullCall: MCPCall = { id, ...call }

    try {
      this.db.prepare(`
        INSERT INTO mcp_calls (
          id, timestamp, duration, server_id, server_name, method, tool_name,
          request_params, request_raw, response_result, response_error, response_raw,
          status, source, session_id, conversation_id, truncated
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        fullCall.id,
        fullCall.timestamp,
        fullCall.duration || null,
        fullCall.serverId,
        fullCall.serverName,
        fullCall.method,
        fullCall.toolName || null,
        fullCall.requestParams,
        fullCall.requestRaw,
        fullCall.responseResult || null,
        fullCall.responseError || null,
        fullCall.responseRaw || null,
        fullCall.status,
        fullCall.source,
        fullCall.sessionId || null,
        fullCall.conversationId || null,
        fullCall.truncated ? 1 : 0
      )

      return id
    } catch (error) {
      console.error('[HistoryStorage] Failed to store call:', error)
      throw error
    }
  }

  /**
   * Query calls with filters and pagination
   */
  async getCalls(query: HistoryQuery = {}): Promise<MCPCall[]> {
    if (!this.db) throw new Error('Database not initialized')

    const {
      serverId,
      toolName,
      status,
      after,
      before,
      cursor,
      limit = 50,
      searchQuery,
    } = query

    let sql = 'SELECT * FROM mcp_calls WHERE 1=1'
    const params: any[] = []

    // Filters
    if (serverId) {
      sql += ' AND server_id = ?'
      params.push(serverId)
    }

    if (toolName) {
      sql += ' AND tool_name = ?'
      params.push(toolName)
    }

    if (status) {
      sql += ' AND status = ?'
      params.push(status)
    }

    if (after) {
      sql += ' AND timestamp > ?'
      params.push(after)
    }

    if (before) {
      sql += ' AND timestamp < ?'
      params.push(before)
    }

    if (cursor) {
      sql += ' AND timestamp < ?'
      params.push(cursor)
    }

    if (searchQuery) {
      sql += ' AND (request_params LIKE ? OR response_result LIKE ?)'
      const searchPattern = `%${searchQuery}%`
      params.push(searchPattern, searchPattern)
    }

    // Order and limit
    sql += ' ORDER BY timestamp DESC LIMIT ?'
    params.push(limit)

    try {
      const rows = this.db.prepare(sql).all(...params) as any[]

      return rows.map(this.rowToCall)
    } catch (error) {
      console.error('[HistoryStorage] Failed to query calls:', error)
      throw error
    }
  }

  /**
   * Get statistics for calls
   */
  async getStats(query: Omit<HistoryQuery, 'limit' | 'cursor'> = {}): Promise<CallStats> {
    if (!this.db) throw new Error('Database not initialized')

    const { serverId, toolName, after, before } = query

    let whereClause = 'WHERE 1=1'
    const params: any[] = []

    if (serverId) {
      whereClause += ' AND server_id = ?'
      params.push(serverId)
    }

    if (toolName) {
      whereClause += ' AND tool_name = ?'
      params.push(toolName)
    }

    if (after) {
      whereClause += ' AND timestamp > ?'
      params.push(after)
    }

    if (before) {
      whereClause += ' AND timestamp < ?'
      params.push(before)
    }

    // Aggregate stats
    const statsRow = this.db.prepare(`
      SELECT
        COUNT(*) as totalCalls,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successCount,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errorCount,
        AVG(duration) as avgDuration
      FROM mcp_calls
      ${whereClause}
    `).get(...params) as any

    // Calls by tool
    const toolRows = this.db.prepare(`
      SELECT tool_name, COUNT(*) as count
      FROM mcp_calls
      ${whereClause}
      GROUP BY tool_name
    `).all(...params) as any[]

    const callsByTool: Record<string, number> = {}
    toolRows.forEach(row => {
      if (row.tool_name) {
        callsByTool[row.tool_name] = row.count
      }
    })

    // Calls by status
    const statusRows = this.db.prepare(`
      SELECT status, COUNT(*) as count
      FROM mcp_calls
      ${whereClause}
      GROUP BY status
    `).all(...params) as any[]

    const callsByStatus: Record<string, number> = {}
    statusRows.forEach(row => {
      callsByStatus[row.status] = row.count
    })

    return {
      totalCalls: statsRow.totalCalls || 0,
      successCount: statsRow.successCount || 0,
      errorCount: statsRow.errorCount || 0,
      successRate: statsRow.totalCalls > 0
        ? (statsRow.successCount || 0) / statsRow.totalCalls
        : 0,
      avgDuration: statsRow.avgDuration || 0,
      callsByTool,
      callsByStatus,
    }
  }

  /**
   * Delete calls older than specified days
   */
  async applyRetention(days: number): Promise<number> {
    if (!this.db) throw new Error('Database not initialized')

    const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000

    try {
      const result = this.db.prepare(`
        DELETE FROM mcp_calls WHERE timestamp < ?
      `).run(cutoffTime)

      console.log(`[HistoryStorage] Deleted ${result.changes} old calls (>${days} days)`)

      // Vacuum to reclaim space
      this.db.prepare('VACUUM').run()

      return result.changes
    } catch (error) {
      console.error('[HistoryStorage] Failed to apply retention:', error)
      throw error
    }
  }

  /**
   * Create a backup of the database
   */
  async createBackup(): Promise<string> {
    if (!this.db) throw new Error('Database not initialized')

    const timestamp = Date.now()
    const backupPath = path.join(this.backupDir, `history-${timestamp}.db`)

    try {
      // Close current connection temporarily
      this.db.close()

      // Copy file
      fs.copyFileSync(this.dbPath, backupPath)

      // Reopen database
      this.db = new Database(this.dbPath)
      this.db.pragma('journal_mode = WAL')

      console.log('[HistoryStorage] Backup created:', backupPath)

      // Clean up old backups (keep last 10)
      await this.cleanupOldBackups()

      return backupPath
    } catch (error) {
      console.error('[HistoryStorage] Failed to create backup:', error)
      throw error
    }
  }

  /**
   * Clean up old backups (keep last 10)
   */
  private async cleanupOldBackups(): Promise<void> {
    try {
      const backups = fs.readdirSync(this.backupDir)
        .filter(f => f.startsWith('history-') && f.endsWith('.db'))
        .map(f => ({
          name: f,
          path: path.join(this.backupDir, f),
          mtime: fs.statSync(path.join(this.backupDir, f)).mtime.getTime()
        }))
        .sort((a, b) => b.mtime - a.mtime)

      // Delete old backups (keep 10 most recent)
      for (const backup of backups.slice(10)) {
        fs.unlinkSync(backup.path)
        console.log('[HistoryStorage] Deleted old backup:', backup.name)
      }
    } catch (error) {
      console.error('[HistoryStorage] Failed to cleanup backups:', error)
    }
  }

  /**
   * Convert database row to MCPCall object
   */
  private rowToCall(row: any): MCPCall {
    return {
      id: row.id,
      timestamp: row.timestamp,
      duration: row.duration || undefined,
      serverId: row.server_id,
      serverName: row.server_name,
      method: row.method,
      toolName: row.tool_name || undefined,
      requestParams: row.request_params,
      requestRaw: row.request_raw,
      responseResult: row.response_result || undefined,
      responseError: row.response_error || undefined,
      responseRaw: row.response_raw || undefined,
      status: row.status,
      source: row.source,
      sessionId: row.session_id || undefined,
      conversationId: row.conversation_id || undefined,
      truncated: row.truncated === 1,
    }
  }

  /**
   * Generate unique ID for call
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
      console.log('[HistoryStorage] Database closed')
    }
  }
}

// Singleton instance
let storageInstance: HistoryStorage | null = null

export async function getHistoryStorage(): Promise<HistoryStorage> {
  if (!storageInstance) {
    storageInstance = new HistoryStorage()
    await storageInstance.initialize()
  }
  return storageInstance
}
