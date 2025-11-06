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
  blocks?: Block[] // Optional blocks array (for real-time streaming)
}

export interface WorkspaceMetadata {
  workspaceId: string
  lastActiveConversationId: string | null
  settings?: string // JSON string
}

export type BlockType =
  | 'text'
  | 'code'
  | 'command'
  | 'file'
  | 'diff'
  | 'error'
  | 'result'
  | 'diagram'
  | 'link'
  | 'quote'
  | 'list'
  | 'table'

export interface Block {
  id: string
  messageId: string
  type: BlockType
  content: string
  metadata: string // JSON string in database
  order: number
  createdAt: string
}

export interface BlockBookmark {
  id: string
  blockId: string
  title?: string
  note?: string
  tags?: string // JSON array
  createdAt: string
}

export interface BlockExecution {
  id: string
  blockId: string
  executedAt: string
  exitCode?: number
  output?: string
  durationMs?: number
}

export type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped'
export type TodoPriority = 'low' | 'medium' | 'high' | 'critical'
export type TodoComplexity = 'trivial' | 'simple' | 'medium' | 'complex' | 'very_complex'

export interface Todo {
  id: string
  conversationId: string
  messageId: string
  parentId?: string
  order: number
  depth: number
  content: string
  description?: string
  activeForm?: string
  status: TodoStatus
  progress?: number
  priority?: TodoPriority
  complexity?: TodoComplexity
  thinkingStepIds: string[]
  blockIds: string[]
  estimatedDuration?: number
  actualDuration?: number
  startedAt?: number
  completedAt?: number
  createdAt: number
  updatedAt: number
  metadata?: string
}

/**
 * SQLite-based conversation storage
 */
export class ConversationStorage {
  private db: Database.Database | null = null
  private dbPath: string
  private schemaVersion = 6  // Updated to v6 for additional block types

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

    // Migration v2: Block-based message system
    if (currentVersion < 2) {
      console.log('[ConversationStorage] Running migration v2: Block-based message system')

      this.db.exec(`
        -- Blocks table: Structured storage for message content
        -- Each message is split into blocks (text, code, command, etc.)
        CREATE TABLE blocks (
          id TEXT PRIMARY KEY,
          message_id TEXT NOT NULL,
          type TEXT NOT NULL CHECK(type IN (
            'text', 'code', 'command', 'file', 'diff',
            'error', 'result', 'diagram', 'link', 'quote', 'list', 'table'
          )),
          content TEXT NOT NULL,
          metadata TEXT,              -- JSON: { language, fileName, isExecutable, ... }
          order_index INTEGER NOT NULL,
          created_at TEXT NOT NULL,

          FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
        );

        CREATE INDEX idx_blocks_message ON blocks(message_id, order_index);
        CREATE INDEX idx_blocks_type ON blocks(type);
        CREATE INDEX idx_blocks_created ON blocks(created_at);

        -- Full-text search for blocks
        -- Enables fast searching within code, commands, and text
        CREATE VIRTUAL TABLE blocks_fts USING fts5(
          content,
          block_id UNINDEXED,
          content='blocks',
          content_rowid='rowid'
        );

        -- Triggers to keep FTS index in sync
        CREATE TRIGGER blocks_fts_insert AFTER INSERT ON blocks BEGIN
          INSERT INTO blocks_fts(rowid, content, block_id)
          VALUES (new.rowid, new.content, new.id);
        END;

        CREATE TRIGGER blocks_fts_delete AFTER DELETE ON blocks BEGIN
          DELETE FROM blocks_fts WHERE rowid = old.rowid;
        END;

        CREATE TRIGGER blocks_fts_update AFTER UPDATE ON blocks BEGIN
          UPDATE blocks_fts
          SET content = new.content
          WHERE rowid = new.rowid;
        END;

        -- Block bookmarks table
        -- Users can bookmark specific blocks for quick reference
        CREATE TABLE block_bookmarks (
          id TEXT PRIMARY KEY,
          block_id TEXT NOT NULL,
          title TEXT,
          note TEXT,
          tags TEXT,                  -- JSON array: ["auth", "security"]
          created_at TEXT NOT NULL,

          FOREIGN KEY (block_id) REFERENCES blocks(id) ON DELETE CASCADE
        );

        CREATE INDEX idx_block_bookmarks_created ON block_bookmarks(created_at DESC);

        -- Block executions table
        -- Track command block execution history
        CREATE TABLE block_executions (
          id TEXT PRIMARY KEY,
          block_id TEXT NOT NULL,
          executed_at TEXT NOT NULL,
          exit_code INTEGER,
          output TEXT,
          duration_ms INTEGER,

          FOREIGN KEY (block_id) REFERENCES blocks(id) ON DELETE CASCADE
        );

        CREATE INDEX idx_block_executions_block ON block_executions(block_id, executed_at DESC);
      `)

      // Record migration
      this.db.prepare(`
        INSERT INTO schema_version (version, name, applied_at)
        VALUES (?, ?, ?)
      `).run(2, 'block_system', Date.now())

      console.log('[ConversationStorage] Migration v2 complete')
    }

    // Migration v3: Todo system
    if (currentVersion < 3) {
      console.log('[ConversationStorage] Running migration v3: Todo system')

      this.db.exec(`
        -- Todos table: Task tracking and management
        CREATE TABLE todos (
          id TEXT PRIMARY KEY,
          conversation_id TEXT NOT NULL,
          message_id TEXT NOT NULL,

          -- Hierarchy
          parent_id TEXT,
          order_index INTEGER NOT NULL,
          depth INTEGER NOT NULL DEFAULT 0,

          -- Content
          content TEXT NOT NULL,
          description TEXT,
          active_form TEXT,

          -- Status & Progress
          status TEXT NOT NULL CHECK(status IN (
            'pending', 'in_progress', 'completed', 'failed', 'skipped'
          )),
          progress INTEGER,  -- 0-100
          priority TEXT CHECK(priority IN ('low', 'medium', 'high', 'critical')),
          complexity TEXT CHECK(complexity IN (
            'trivial', 'simple', 'medium', 'complex', 'very_complex'
          )),

          -- Connections (JSON arrays)
          thinking_step_ids TEXT,  -- JSON array of thinking step indices
          block_ids TEXT,          -- JSON array of block IDs

          -- Timing
          estimated_duration INTEGER,  -- seconds
          actual_duration INTEGER,     -- seconds
          started_at INTEGER,
          completed_at INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,

          -- Metadata (JSON object)
          metadata TEXT,

          FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
          FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
          FOREIGN KEY (parent_id) REFERENCES todos(id) ON DELETE CASCADE
        );

        CREATE INDEX idx_todos_conversation ON todos(conversation_id, order_index);
        CREATE INDEX idx_todos_message ON todos(message_id);
        CREATE INDEX idx_todos_status ON todos(status);
        CREATE INDEX idx_todos_parent ON todos(parent_id);
        CREATE INDEX idx_todos_created ON todos(created_at DESC);
      `)

      // Record migration
      this.db.prepare(`
        INSERT INTO schema_version (version, name, applied_at)
        VALUES (?, ?, ?)
      `).run(3, 'todo_system', Date.now())

      console.log('[ConversationStorage] Migration v3 complete')
    }

    // Migration v4: Fix FTS triggers (drop and recreate)
    if (currentVersion < 4) {
      console.log('[ConversationStorage] Running migration v4: Fix FTS triggers')

      try {
        // Drop all triggers on blocks table
        this.db.exec(`
          DROP TRIGGER IF EXISTS blocks_fts_insert;
          DROP TRIGGER IF EXISTS blocks_fts_delete;
          DROP TRIGGER IF EXISTS blocks_fts_update;
        `)

        // Recreate FTS triggers with correct schema
        this.db.exec(`
          CREATE TRIGGER blocks_fts_insert AFTER INSERT ON blocks BEGIN
            INSERT INTO blocks_fts(rowid, content, block_id)
            VALUES (new.rowid, new.content, new.id);
          END;

          CREATE TRIGGER blocks_fts_delete AFTER DELETE ON blocks BEGIN
            DELETE FROM blocks_fts WHERE rowid = old.rowid;
          END;

          CREATE TRIGGER blocks_fts_update AFTER UPDATE ON blocks BEGIN
            UPDATE blocks_fts
            SET content = new.content
            WHERE rowid = new.rowid;
          END;
        `)

        // Record migration
        this.db.prepare(`
          INSERT INTO schema_version (version, name, applied_at)
          VALUES (?, ?, ?)
        `).run(4, 'fix_fts_triggers', Date.now())

        console.log('[ConversationStorage] Migration v4 complete')
      } catch (error) {
        console.error('[ConversationStorage] Migration v4 error:', error)
        // Continue - error might be due to missing tables in fresh DB
      }
    }

    // Migration v5: Remove FTS completely (not used, causes issues)
    if (currentVersion < 5) {
      console.log('[ConversationStorage] Running migration v5: Remove FTS')

      try {
        // Drop all FTS triggers
        this.db.exec(`
          DROP TRIGGER IF EXISTS blocks_fts_insert;
          DROP TRIGGER IF EXISTS blocks_fts_delete;
          DROP TRIGGER IF EXISTS blocks_fts_update;
        `)

        // Drop FTS table
        this.db.exec(`
          DROP TABLE IF EXISTS blocks_fts;
        `)

        // Record migration
        this.db.prepare(`
          INSERT INTO schema_version (version, name, applied_at)
          VALUES (?, ?, ?)
        `).run(5, 'remove_fts', Date.now())

        console.log('[ConversationStorage] Migration v5 complete')
      } catch (error) {
        console.error('[ConversationStorage] Migration v5 error:', error)
        // Continue - error might be due to missing tables
      }
    }

    // Migration v6: Add new block types (tool, checklist, file-summary)
    if (currentVersion < 6) {
      console.log('[ConversationStorage] Running migration v6: Add new block types')

      try {
        // Step 1: Rename existing table
        this.db.exec(`ALTER TABLE blocks RENAME TO blocks_old;`)

        // Step 2: Create new table with updated CHECK constraint
        this.db.exec(`
          CREATE TABLE blocks (
            id TEXT PRIMARY KEY,
            message_id TEXT NOT NULL,
            type TEXT NOT NULL CHECK(type IN (
              'text', 'code', 'command', 'file', 'diff',
              'error', 'result', 'diagram', 'link', 'quote', 'list', 'table',
              'tool', 'checklist', 'file-summary'
            )),
            content TEXT NOT NULL,
            metadata TEXT,
            order_index INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
          );
        `)

        // Step 3: Copy data from old table
        this.db.exec(`
          INSERT INTO blocks (id, message_id, type, content, metadata, order_index, created_at)
          SELECT id, message_id, type, content, metadata, order_index, created_at
          FROM blocks_old;
        `)

        // Step 4: Drop old table
        this.db.exec(`DROP TABLE blocks_old;`)

        // Step 5: Recreate indexes
        this.db.exec(`
          CREATE INDEX idx_blocks_message ON blocks(message_id, order_index);
          CREATE INDEX idx_blocks_type ON blocks(type);
          CREATE INDEX idx_blocks_created ON blocks(created_at);
        `)

        // Record migration
        this.db.prepare(`
          INSERT INTO schema_version (version, name, applied_at)
          VALUES (?, ?, ?)
        `).run(6, 'add_block_types', Date.now())

        console.log('[ConversationStorage] Migration v6 complete')
      } catch (error) {
        console.error('[ConversationStorage] Migration v6 error:', error)
        throw error
      }
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
   * Save a single message (UPSERT: insert or update if exists)
   */
  saveMessage(message: Message): void {
    if (!this.db) throw new Error('Database not initialized')

    console.log('[ConversationStorage] 💾 saveMessage:', message.id);
    console.log('[ConversationStorage] 💾 Metadata type:', typeof message.metadata);
    console.log('[ConversationStorage] 💾 Metadata length:', message.metadata?.length || 0);

    const result = this.db
      .prepare(`
        INSERT INTO messages (id, conversation_id, role, content, timestamp, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          content = excluded.content,
          metadata = excluded.metadata,
          timestamp = excluded.timestamp
      `)
      .run(
        message.id,
        message.conversationId,
        message.role,
        message.content,
        message.timestamp,
        message.metadata || null
      )

    console.log('[ConversationStorage] 💾 SQL result changes:', result.changes);

    // Update conversation timestamp
    this.touch(message.conversationId)
  }

  /**
   * Save multiple messages (transaction, UPSERT)
   */
  saveMessages(messages: Message[]): void {
    if (!this.db) throw new Error('Database not initialized')
    if (messages.length === 0) return

    const transaction = this.db.transaction(() => {
      const stmt = this.db!.prepare(`
        INSERT INTO messages (id, conversation_id, role, content, timestamp, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          content = excluded.content,
          metadata = excluded.metadata,
          timestamp = excluded.timestamp
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
  // Block Methods
  // ============================================================================

  /**
   * Save message with blocks (atomic transaction, UPSERT)
   *
   * This is the primary method for saving new messages with block structure.
   * It ensures both the message and its blocks are saved atomically.
   * When updating an existing message, old blocks are deleted and replaced.
   */
  saveMessageWithBlocks(message: Message, blocks: Block[]): void {
    if (!this.db) throw new Error('Database not initialized')

    const transaction = this.db.transaction(() => {
      // 1. Save or update message (UPSERT)
      this.saveMessage(message)

      // 2. Delete existing blocks for this message (if any)
      this.db!.prepare(`DELETE FROM blocks WHERE message_id = ?`).run(message.id)

      // 3. Save new blocks
      const stmt = this.db!.prepare(`
        INSERT INTO blocks (id, message_id, type, content, metadata, order_index, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)

      for (const block of blocks) {
        stmt.run(
          block.id,
          block.messageId,
          block.type,
          block.content,
          block.metadata,
          block.order,
          block.createdAt
        )
      }
    })

    transaction()
  }

  /**
   * Get all blocks for a message
   */
  getBlocks(messageId: string): Block[] {
    if (!this.db) throw new Error('Database not initialized')

    return this.db
      .prepare(`
        SELECT
          id,
          message_id as messageId,
          type,
          content,
          metadata,
          order_index as 'order',
          created_at as createdAt
        FROM blocks
        WHERE message_id = ?
        ORDER BY order_index ASC
      `)
      .all(messageId) as Block[]
  }

  /**
   * Search blocks using full-text search
   *
   * @param query - Search query
   * @param filters - Optional filters (blockType, workspaceId, dateRange)
   * @returns Matching blocks with relevance score
   */
  searchBlocks(
    query: string,
    filters?: {
      blockType?: BlockType
      workspaceId?: string
      limit?: number
    }
  ): Array<Block & { rank: number }> {
    if (!this.db) throw new Error('Database not initialized')

    let sql = `
      SELECT
        b.id,
        b.message_id as messageId,
        b.type,
        b.content,
        b.metadata,
        b.order_index as 'order',
        b.created_at as createdAt,
        bm.rank
      FROM blocks_fts bm
      JOIN blocks b ON b.rowid = bm.rowid
      WHERE blocks_fts MATCH ?
    `

    const params: any[] = [query]

    if (filters?.blockType) {
      sql += ' AND b.type = ?'
      params.push(filters.blockType)
    }

    if (filters?.workspaceId) {
      sql += `
        AND b.message_id IN (
          SELECT m.id FROM messages m
          JOIN conversations c ON c.id = m.conversation_id
          WHERE c.workspace_id = ?
        )
      `
      params.push(filters.workspaceId)
    }

    sql += ' ORDER BY bm.rank LIMIT ?'
    params.push(filters?.limit || 50)

    return this.db.prepare(sql).all(...params) as Array<Block & { rank: number }>
  }

  /**
   * Save a block bookmark
   */
  saveBlockBookmark(bookmark: BlockBookmark): void {
    if (!this.db) throw new Error('Database not initialized')

    this.db
      .prepare(`
        INSERT INTO block_bookmarks (id, block_id, title, note, tags, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(
        bookmark.id,
        bookmark.blockId,
        bookmark.title || null,
        bookmark.note || null,
        bookmark.tags || null,
        bookmark.createdAt
      )
  }

  /**
   * Get all block bookmarks
   */
  getBlockBookmarks(): BlockBookmark[] {
    if (!this.db) throw new Error('Database not initialized')

    return this.db
      .prepare(`
        SELECT
          id,
          block_id as blockId,
          title,
          note,
          tags,
          created_at as createdAt
        FROM block_bookmarks
        ORDER BY created_at DESC
      `)
      .all() as BlockBookmark[]
  }

  /**
   * Delete a block bookmark
   */
  deleteBlockBookmark(bookmarkId: string): void {
    if (!this.db) throw new Error('Database not initialized')

    this.db.prepare('DELETE FROM block_bookmarks WHERE id = ?').run(bookmarkId)
  }

  /**
   * Record block execution (for command blocks)
   */
  recordBlockExecution(execution: BlockExecution): void {
    if (!this.db) throw new Error('Database not initialized')

    this.db
      .prepare(`
        INSERT INTO block_executions (id, block_id, executed_at, exit_code, output, duration_ms)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(
        execution.id,
        execution.blockId,
        execution.executedAt,
        execution.exitCode ?? null,
        execution.output ?? null,
        execution.durationMs ?? null
      )
  }

  /**
   * Get execution history for a block
   */
  getBlockExecutions(blockId: string): BlockExecution[] {
    if (!this.db) throw new Error('Database not initialized')

    return this.db
      .prepare(`
        SELECT
          id,
          block_id as blockId,
          executed_at as executedAt,
          exit_code as exitCode,
          output,
          duration_ms as durationMs
        FROM block_executions
        WHERE block_id = ?
        ORDER BY executed_at DESC
      `)
      .all(blockId) as BlockExecution[]
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

  // ============================================================================
  // Todo Methods
  // ============================================================================

  /**
   * Save a single todo
   */
  saveTodo(todo: Todo): void {
    if (!this.db) throw new Error('Database not initialized')

    this.db
      .prepare(`
        INSERT OR REPLACE INTO todos (
          id, conversation_id, message_id, parent_id, order_index, depth,
          content, description, active_form, status, progress, priority, complexity,
          thinking_step_ids, block_ids,
          estimated_duration, actual_duration, started_at, completed_at,
          created_at, updated_at, metadata
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        todo.id,
        todo.conversationId,
        todo.messageId,
        todo.parentId || null,
        todo.order,
        todo.depth,
        todo.content,
        todo.description || null,
        todo.activeForm || null,
        todo.status,
        todo.progress ?? null,
        todo.priority || null,
        todo.complexity || null,
        JSON.stringify(todo.thinkingStepIds),
        JSON.stringify(todo.blockIds),
        todo.estimatedDuration ?? null,
        todo.actualDuration ?? null,
        todo.startedAt ?? null,
        todo.completedAt ?? null,
        todo.createdAt,
        todo.updatedAt,
        todo.metadata || null
      )
  }

  /**
   * Save multiple todos (transaction)
   */
  saveTodos(todos: Todo[]): void {
    if (!this.db) throw new Error('Database not initialized')
    if (todos.length === 0) return

    const transaction = this.db.transaction(() => {
      const stmt = this.db!.prepare(`
        INSERT OR REPLACE INTO todos (
          id, conversation_id, message_id, parent_id, order_index, depth,
          content, description, active_form, status, progress, priority, complexity,
          thinking_step_ids, block_ids,
          estimated_duration, actual_duration, started_at, completed_at,
          created_at, updated_at, metadata
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      for (const todo of todos) {
        stmt.run(
          todo.id,
          todo.conversationId,
          todo.messageId,
          todo.parentId || null,
          todo.order,
          todo.depth,
          todo.content,
          todo.description || null,
          todo.activeForm || null,
          todo.status,
          todo.progress ?? null,
          todo.priority || null,
          todo.complexity || null,
          JSON.stringify(todo.thinkingStepIds),
          JSON.stringify(todo.blockIds),
          todo.estimatedDuration ?? null,
          todo.actualDuration ?? null,
          todo.startedAt ?? null,
          todo.completedAt ?? null,
          todo.createdAt,
          todo.updatedAt,
          todo.metadata || null
        )
      }
    })

    transaction()
  }

  /**
   * Update todo status and progress
   */
  updateTodoStatus(
    todoId: string,
    status: TodoStatus,
    progress?: number,
    completedAt?: number
  ): void {
    if (!this.db) throw new Error('Database not initialized')

    this.db
      .prepare(`
        UPDATE todos
        SET status = ?, progress = ?, completed_at = ?, updated_at = ?
        WHERE id = ?
      `)
      .run(status, progress ?? null, completedAt ?? null, Date.now(), todoId)
  }

  /**
   * Update todo timing information
   */
  updateTodoTiming(
    todoId: string,
    updates: {
      startedAt?: number
      completedAt?: number
      actualDuration?: number
    }
  ): void {
    if (!this.db) throw new Error('Database not initialized')

    this.db
      .prepare(`
        UPDATE todos
        SET started_at = COALESCE(?, started_at),
            completed_at = COALESCE(?, completed_at),
            actual_duration = COALESCE(?, actual_duration),
            updated_at = ?
        WHERE id = ?
      `)
      .run(
        updates.startedAt ?? null,
        updates.completedAt ?? null,
        updates.actualDuration ?? null,
        Date.now(),
        todoId
      )
  }

  /**
   * Get all todos for a conversation
   */
  getTodos(conversationId: string): Todo[] {
    if (!this.db) throw new Error('Database not initialized')

    const todos = this.db
      .prepare(`
        SELECT
          id,
          conversation_id as conversationId,
          message_id as messageId,
          parent_id as parentId,
          order_index as 'order',
          depth,
          content,
          description,
          active_form as activeForm,
          status,
          progress,
          priority,
          complexity,
          thinking_step_ids as thinkingStepIds,
          block_ids as blockIds,
          estimated_duration as estimatedDuration,
          actual_duration as actualDuration,
          started_at as startedAt,
          completed_at as completedAt,
          created_at as createdAt,
          updated_at as updatedAt,
          metadata
        FROM todos
        WHERE conversation_id = ?
        ORDER BY order_index ASC
      `)
      .all(conversationId) as any[]

    return todos.map((todo) => ({
      ...todo,
      thinkingStepIds: JSON.parse(todo.thinkingStepIds || '[]'),
      blockIds: JSON.parse(todo.blockIds || '[]')
    }))
  }

  /**
   * Get todos for a specific message
   */
  getTodosByMessage(messageId: string): Todo[] {
    if (!this.db) throw new Error('Database not initialized')

    const todos = this.db
      .prepare(`
        SELECT
          id,
          conversation_id as conversationId,
          message_id as messageId,
          parent_id as parentId,
          order_index as 'order',
          depth,
          content,
          description,
          active_form as activeForm,
          status,
          progress,
          priority,
          complexity,
          thinking_step_ids as thinkingStepIds,
          block_ids as blockIds,
          estimated_duration as estimatedDuration,
          actual_duration as actualDuration,
          started_at as startedAt,
          completed_at as completedAt,
          created_at as createdAt,
          updated_at as updatedAt,
          metadata
        FROM todos
        WHERE message_id = ?
        ORDER BY order_index ASC
      `)
      .all(messageId) as any[]

    return todos.map((todo) => ({
      ...todo,
      thinkingStepIds: JSON.parse(todo.thinkingStepIds || '[]'),
      blockIds: JSON.parse(todo.blockIds || '[]')
    }))
  }

  /**
   * Get a single todo by ID
   */
  getTodo(todoId: string): Todo | null {
    if (!this.db) throw new Error('Database not initialized')

    const todo = this.db
      .prepare(`
        SELECT
          id,
          conversation_id as conversationId,
          message_id as messageId,
          parent_id as parentId,
          order_index as 'order',
          depth,
          content,
          description,
          active_form as activeForm,
          status,
          progress,
          priority,
          complexity,
          thinking_step_ids as thinkingStepIds,
          block_ids as blockIds,
          estimated_duration as estimatedDuration,
          actual_duration as actualDuration,
          started_at as startedAt,
          completed_at as completedAt,
          created_at as createdAt,
          updated_at as updatedAt,
          metadata
        FROM todos
        WHERE id = ?
      `)
      .get(todoId) as any

    if (!todo) return null

    return {
      ...todo,
      thinkingStepIds: JSON.parse(todo.thinkingStepIds || '[]'),
      blockIds: JSON.parse(todo.blockIds || '[]')
    }
  }

  /**
   * Delete a todo
   */
  deleteTodo(todoId: string): void {
    if (!this.db) throw new Error('Database not initialized')

    this.db.prepare('DELETE FROM todos WHERE id = ?').run(todoId)
  }

  /**
   * Get todo statistics for a conversation
   */
  getTodoStats(conversationId: string): {
    total: number
    pending: number
    inProgress: number
    completed: number
    failed: number
    skipped: number
  } {
    if (!this.db) throw new Error('Database not initialized')

    const stats = this.db
      .prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as inProgress,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped
        FROM todos
        WHERE conversation_id = ?
      `)
      .get(conversationId) as any

    return {
      total: stats.total || 0,
      pending: stats.pending || 0,
      inProgress: stats.inProgress || 0,
      completed: stats.completed || 0,
      failed: stats.failed || 0,
      skipped: stats.skipped || 0
    }
  }
}
