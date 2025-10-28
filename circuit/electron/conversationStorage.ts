/**
 * Conversation Storage Layer
 *
 * SQLite-based storage for chat conversations with workspace isolation.
 * Each workspace can have multiple conversations (threads).
 */

import Database from 'better-sqlite3'
import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { randomUUID } from 'crypto'

// Type definitions
export interface Conversation {
  id: string
  workspaceId: string
  title: string
  createdAt: string
  updatedAt: string
  isActive: boolean
}

export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  metadata?: string // JSON string
}

export interface WorkspaceMetadata {
  workspaceId: string
  lastActiveConversationId: string | null
  settings?: string // JSON string
}

/**
 * SQLite-based conversation storage
 */
export class ConversationStorage {
  private db: Database.Database | null = null
  private dbPath: string
  private schemaVersion = 1

  constructor() {
    const userData = app.getPath('userData')
    const circuitDir = path.join(userData, 'circuit-data')

    // Ensure directory exists
    if (!fs.existsSync(circuitDir)) {
      fs.mkdirSync(circuitDir, { recursive: true })
    }

    this.dbPath = path.join(circuitDir, 'conversations.db')

    console.log('[ConversationStorage] Database path:', this.dbPath)
  }

  /**
   * Initialize database and run migrations
   */
  async initialize(): Promise<void> {
    try {
      console.log('[ConversationStorage] Initializing database...')

      // Open database
      this.db = new Database(this.dbPath)
      this.db.pragma('journal_mode = WAL') // Better concurrency
      this.db.pragma('foreign_keys = ON') // Enable foreign key constraints

      // Run migrations
      await this.migrate()

      console.log('[ConversationStorage] Database initialized successfully')
    } catch (error) {
      console.error('[ConversationStorage] Failed to initialize:', error)
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

    console.log(`[ConversationStorage] Current schema version: ${currentVersion}`)

    // Migration v1: Initial schema
    if (currentVersion < 1) {
      console.log('[ConversationStorage] Running migration v1: Initial schema')

      this.db.exec(`
        -- Conversations table
        CREATE TABLE conversations (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          title TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          is_active INTEGER DEFAULT 1
        );

        CREATE INDEX idx_conversations_workspace ON conversations(workspace_id, updated_at DESC);
        CREATE INDEX idx_conversations_active ON conversations(workspace_id, is_active);

        -- Messages table
        CREATE TABLE messages (
          id TEXT PRIMARY KEY,
          conversation_id TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
          content TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          metadata TEXT,
          FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        );

        CREATE INDEX idx_messages_conversation ON messages(conversation_id, timestamp ASC);
        CREATE INDEX idx_messages_timestamp ON messages(timestamp DESC);

        -- Workspace metadata table
        CREATE TABLE workspace_metadata (
          workspace_id TEXT PRIMARY KEY,
          last_active_conversation_id TEXT,
          settings TEXT
        );
      `)

      // Record migration
      this.db.prepare(`
        INSERT INTO schema_version (version, name, applied_at)
        VALUES (?, ?, ?)
      `).run(1, 'initial_schema', Date.now())

      console.log('[ConversationStorage] Migration v1 complete')
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

      return result?.version ?? 0
    } catch {
      return 0
    }
  }

  // ============================================================================
  // Conversation Methods
  // ============================================================================

  /**
   * Get all conversations for a workspace
   */
  getByWorkspaceId(workspaceId: string): Conversation[] {
    if (!this.db) throw new Error('Database not initialized')

    const conversations = this.db
      .prepare(`
        SELECT id, workspace_id as workspaceId, title, created_at as createdAt,
               updated_at as updatedAt, is_active as isActive
        FROM conversations
        WHERE workspace_id = ?
        ORDER BY updated_at DESC
      `)
      .all(workspaceId) as Conversation[]

    return conversations.map(c => ({
      ...c,
      isActive: Boolean(c.isActive)
    }))
  }

  /**
   * Get active conversation for a workspace
   */
  getActiveConversation(workspaceId: string): Conversation | null {
    if (!this.db) throw new Error('Database not initialized')

    const conversation = this.db
      .prepare(`
        SELECT id, workspace_id as workspaceId, title, created_at as createdAt,
               updated_at as updatedAt, is_active as isActive
        FROM conversations
        WHERE workspace_id = ? AND is_active = 1
        ORDER BY updated_at DESC
        LIMIT 1
      `)
      .get(workspaceId) as Conversation | undefined

    if (!conversation) return null

    return {
      ...conversation,
      isActive: Boolean(conversation.isActive)
    }
  }

  /**
   * Create a new conversation
   */
  create(workspaceId: string, title?: string): Conversation {
    if (!this.db) throw new Error('Database not initialized')

    const id = randomUUID()
    const now = new Date().toISOString()
    const conversationTitle = title || `Conversation ${now.split('T')[0]}`

    this.db
      .prepare(`
        INSERT INTO conversations (id, workspace_id, title, created_at, updated_at, is_active)
        VALUES (?, ?, ?, ?, ?, 1)
      `)
      .run(id, workspaceId, conversationTitle, now, now)

    return {
      id,
      workspaceId,
      title: conversationTitle,
      createdAt: now,
      updatedAt: now,
      isActive: true
    }
  }

  /**
   * Update conversation title
   */
  updateTitle(conversationId: string, title: string): void {
    if (!this.db) throw new Error('Database not initialized')

    this.db
      .prepare(`
        UPDATE conversations
        SET title = ?, updated_at = ?
        WHERE id = ?
      `)
      .run(title, new Date().toISOString(), conversationId)
  }

  /**
   * Update conversation updated_at timestamp
   */
  touch(conversationId: string): void {
    if (!this.db) throw new Error('Database not initialized')

    this.db
      .prepare(`
        UPDATE conversations
        SET updated_at = ?
        WHERE id = ?
      `)
      .run(new Date().toISOString(), conversationId)
  }

  /**
   * Delete a conversation (cascade deletes messages)
   */
  delete(conversationId: string): void {
    if (!this.db) throw new Error('Database not initialized')

    this.db
      .prepare('DELETE FROM conversations WHERE id = ?')
      .run(conversationId)
  }

  /**
   * Set active conversation for a workspace
   */
  setActive(workspaceId: string, conversationId: string): void {
    if (!this.db) throw new Error('Database not initialized')

    // Start transaction
    const transaction = this.db.transaction(() => {
      // Deactivate all conversations for this workspace
      this.db!
        .prepare('UPDATE conversations SET is_active = 0 WHERE workspace_id = ?')
        .run(workspaceId)

      // Activate the selected conversation
      this.db!
        .prepare('UPDATE conversations SET is_active = 1 WHERE id = ?')
        .run(conversationId)
    })

    transaction()
  }

  // ============================================================================
  // Message Methods
  // ============================================================================

  /**
   * Get all messages for a conversation
   */
  getMessages(conversationId: string, options?: { limit?: number; offset?: number }): Message[] {
    if (!this.db) throw new Error('Database not initialized')

    let query = `
      SELECT id, conversation_id as conversationId, role, content, timestamp, metadata
      FROM messages
      WHERE conversation_id = ?
      ORDER BY timestamp ASC
    `

    const params: any[] = [conversationId]

    if (options?.limit) {
      query += ' LIMIT ?'
      params.push(options.limit)
    }

    if (options?.offset) {
      query += ' OFFSET ?'
      params.push(options.offset)
    }

    return this.db.prepare(query).all(...params) as Message[]
  }

  /**
   * Save a single message
   */
  saveMessage(message: Message): void {
    if (!this.db) throw new Error('Database not initialized')

    this.db
      .prepare(`
        INSERT INTO messages (id, conversation_id, role, content, timestamp, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(
        message.id,
        message.conversationId,
        message.role,
        message.content,
        message.timestamp,
        message.metadata || null
      )

    // Update conversation timestamp
    this.touch(message.conversationId)
  }

  /**
   * Save multiple messages (transaction)
   */
  saveMessages(messages: Message[]): void {
    if (!this.db) throw new Error('Database not initialized')
    if (messages.length === 0) return

    const transaction = this.db.transaction(() => {
      const stmt = this.db!.prepare(`
        INSERT INTO messages (id, conversation_id, role, content, timestamp, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
      `)

      for (const message of messages) {
        stmt.run(
          message.id,
          message.conversationId,
          message.role,
          message.content,
          message.timestamp,
          message.metadata || null
        )
      }

      // Update conversation timestamp
      this.touch(messages[0].conversationId)
    })

    transaction()
  }

  /**
   * Delete a message
   */
  deleteMessage(messageId: string): void {
    if (!this.db) throw new Error('Database not initialized')

    this.db
      .prepare('DELETE FROM messages WHERE id = ?')
      .run(messageId)
  }

  /**
   * Get message count for a conversation
   */
  getMessageCount(conversationId: string): number {
    if (!this.db) throw new Error('Database not initialized')

    const result = this.db
      .prepare('SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?')
      .get(conversationId) as { count: number }

    return result.count
  }

  // ============================================================================
  // Workspace Metadata Methods
  // ============================================================================

  /**
   * Get workspace metadata
   */
  getWorkspaceMetadata(workspaceId: string): WorkspaceMetadata | null {
    if (!this.db) throw new Error('Database not initialized')

    const metadata = this.db
      .prepare(`
        SELECT workspace_id as workspaceId, last_active_conversation_id as lastActiveConversationId, settings
        FROM workspace_metadata
        WHERE workspace_id = ?
      `)
      .get(workspaceId) as WorkspaceMetadata | undefined

    return metadata || null
  }

  /**
   * Set workspace metadata
   */
  setWorkspaceMetadata(metadata: WorkspaceMetadata): void {
    if (!this.db) throw new Error('Database not initialized')

    this.db
      .prepare(`
        INSERT INTO workspace_metadata (workspace_id, last_active_conversation_id, settings)
        VALUES (?, ?, ?)
        ON CONFLICT(workspace_id) DO UPDATE SET
          last_active_conversation_id = excluded.last_active_conversation_id,
          settings = excluded.settings
      `)
      .run(metadata.workspaceId, metadata.lastActiveConversationId, metadata.settings || null)
  }

  /**
   * Update last active conversation for a workspace
   */
  updateLastActive(workspaceId: string, conversationId: string): void {
    if (!this.db) throw new Error('Database not initialized')

    this.db
      .prepare(`
        INSERT INTO workspace_metadata (workspace_id, last_active_conversation_id)
        VALUES (?, ?)
        ON CONFLICT(workspace_id) DO UPDATE SET
          last_active_conversation_id = excluded.last_active_conversation_id
      `)
      .run(workspaceId, conversationId)
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }

  /**
   * Get database statistics
   */
  getStats(): {
    totalConversations: number
    totalMessages: number
    databaseSize: number
  } {
    if (!this.db) throw new Error('Database not initialized')

    const conversationCount = this.db
      .prepare('SELECT COUNT(*) as count FROM conversations')
      .get() as { count: number }

    const messageCount = this.db
      .prepare('SELECT COUNT(*) as count FROM messages')
      .get() as { count: number }

    const stats = fs.statSync(this.dbPath)

    return {
      totalConversations: conversationCount.count,
      totalMessages: messageCount.count,
      databaseSize: stats.size
    }
  }
}
