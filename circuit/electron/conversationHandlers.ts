/**
 * IPC Handlers for Conversation and Message Operations
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { ConversationStorage, Conversation, Message, Block, BlockBookmark, BlockExecution } from './conversationStorage'
import { parseMessageToBlocks } from './messageParser'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

let storage: ConversationStorage | null = null

/**
 * Initialize conversation storage
 */
export async function initializeConversationStorage(): Promise<void> {
  try {
    storage = new ConversationStorage()
    await storage.initialize()
    console.log('[ConversationHandlers] Storage initialized')
  } catch (error) {
    console.error('[ConversationHandlers] Failed to initialize storage:', error)
    throw error
  }
}

/**
 * Register all conversation-related IPC handlers
 */
export function registerConversationHandlers(): void {
  console.log('[ConversationHandlers] Registering IPC handlers...')

  // ============================================================================
  // Conversation Handlers
  // ============================================================================

  /**
   * Get all conversations for a workspace
   */
  ipcMain.handle(
    'conversation:list',
    async (_event: IpcMainInvokeEvent, workspaceId: string) => {
      try {
        if (!storage) throw new Error('Storage not initialized')

        const conversations = storage.getByWorkspaceId(workspaceId)

        return {
          success: true,
          conversations
        }
      } catch (error: any) {
        console.error('[conversation:list] Error:', error)
        return {
          success: false,
          error: error.message
        }
      }
    }
  )

  /**
   * Get active conversation for a workspace
   */
  ipcMain.handle(
    'conversation:get-active',
    async (_event: IpcMainInvokeEvent, workspaceId: string) => {
      try {
        if (!storage) throw new Error('Storage not initialized')

        const conversation = storage.getActiveConversation(workspaceId)

        return {
          success: true,
          conversation
        }
      } catch (error: any) {
        console.error('[conversation:get-active] Error:', error)
        return {
          success: false,
          error: error.message
        }
      }
    }
  )

  /**
   * Create a new conversation
   */
  ipcMain.handle(
    'conversation:create',
    async (_event: IpcMainInvokeEvent, workspaceId: string, title?: string) => {
      try {
        if (!storage) throw new Error('Storage not initialized')

        const conversation = storage.create(workspaceId, title)

        // Set as active conversation
        storage.setActive(workspaceId, conversation.id)
        storage.updateLastActive(workspaceId, conversation.id)

        return {
          success: true,
          conversation
        }
      } catch (error: any) {
        console.error('[conversation:create] Error:', error)
        return {
          success: false,
          error: error.message
        }
      }
    }
  )

  /**
   * Update conversation title
   */
  ipcMain.handle(
    'conversation:update-title',
    async (_event: IpcMainInvokeEvent, conversationId: string, title: string) => {
      try {
        if (!storage) throw new Error('Storage not initialized')

        storage.updateTitle(conversationId, title)

        return {
          success: true
        }
      } catch (error: any) {
        console.error('[conversation:update-title] Error:', error)
        return {
          success: false,
          error: error.message
        }
      }
    }
  )

  /**
   * Delete a conversation
   */
  ipcMain.handle(
    'conversation:delete',
    async (_event: IpcMainInvokeEvent, conversationId: string) => {
      try {
        if (!storage) throw new Error('Storage not initialized')

        storage.delete(conversationId)

        return {
          success: true
        }
      } catch (error: any) {
        console.error('[conversation:delete] Error:', error)
        return {
          success: false,
          error: error.message
        }
      }
    }
  )

  /**
   * Set active conversation
   */
  ipcMain.handle(
    'conversation:set-active',
    async (_event: IpcMainInvokeEvent, workspaceId: string, conversationId: string) => {
      try {
        if (!storage) throw new Error('Storage not initialized')

        storage.setActive(workspaceId, conversationId)
        storage.updateLastActive(workspaceId, conversationId)

        return {
          success: true
        }
      } catch (error: any) {
        console.error('[conversation:set-active] Error:', error)
        return {
          success: false,
          error: error.message
        }
      }
    }
  )

  // ============================================================================
  // Message Handlers
  // ============================================================================

  /**
   * Load all messages for a conversation (with blocks)
   */
  ipcMain.handle(
    'message:load',
    async (_event: IpcMainInvokeEvent, conversationId: string, options?: { limit?: number; offset?: number }) => {
      try {
        if (!storage) throw new Error('Storage not initialized')

        const messages = storage.getMessages(conversationId, options)

        // Load blocks for each message
        const messagesWithBlocks = messages.map(message => {
          const blocks = storage!.getBlocks(message.id)
          return {
            ...message,
            metadata: message.metadata
              ? (typeof message.metadata === 'string'
                  ? JSON.parse(message.metadata)
                  : message.metadata)
              : undefined,
            blocks: blocks.length > 0 ? blocks.map(b => ({
              ...b,
              metadata: JSON.parse(b.metadata || '{}')
            })) : undefined
          }
        })

        return {
          success: true,
          messages: messagesWithBlocks
        }
      } catch (error: any) {
        console.error('[message:load] Error:', error)
        return {
          success: false,
          error: error.message
        }
      }
    }
  )

  /**
   * Save a single message (with automatic block parsing)
   */
  ipcMain.handle(
    'message:save',
    async (_event: IpcMainInvokeEvent, message: Message) => {
      try {
        if (!storage) throw new Error('Storage not initialized')

        // Normalize message metadata to JSON string
        const normalizedMessage = {
          ...message,
          metadata: message.metadata
            ? (typeof message.metadata === 'string'
                ? message.metadata
                : JSON.stringify(message.metadata))
            : undefined
        }

        // Parse message content into blocks
        const parseResult = parseMessageToBlocks(message.content, message.id)

        if (parseResult.errors.length > 0) {
          console.warn('[message:save] Parse errors:', parseResult.errors)
        }

        // Convert blocks to storage format (metadata as JSON string)
        const blocksForStorage = parseResult.blocks.map(block => ({
          ...block,
          metadata: JSON.stringify(block.metadata)
        }))

        // Save message with blocks
        storage.saveMessageWithBlocks(normalizedMessage, blocksForStorage as any)

        return {
          success: true,
          blockCount: parseResult.blocks.length,
          blocks: parseResult.blocks // Return parsed blocks for UI update
        }
      } catch (error: any) {
        console.error('[message:save] Error:', error)
        return {
          success: false,
          error: error.message
        }
      }
    }
  )

  /**
   * Save multiple messages (batch)
   */
  ipcMain.handle(
    'message:save-batch',
    async (_event: IpcMainInvokeEvent, messages: Message[]) => {
      try {
        if (!storage) throw new Error('Storage not initialized')

        storage.saveMessages(messages)

        return {
          success: true
        }
      } catch (error: any) {
        console.error('[message:save-batch] Error:', error)
        return {
          success: false,
          error: error.message
        }
      }
    }
  )

  /**
   * Delete a message
   */
  ipcMain.handle(
    'message:delete',
    async (_event: IpcMainInvokeEvent, messageId: string) => {
      try {
        if (!storage) throw new Error('Storage not initialized')

        storage.deleteMessage(messageId)

        return {
          success: true
        }
      } catch (error: any) {
        console.error('[message:delete] Error:', error)
        return {
          success: false,
          error: error.message
        }
      }
    }
  )

  /**
   * Get message count for a conversation
   */
  ipcMain.handle(
    'message:count',
    async (_event: IpcMainInvokeEvent, conversationId: string) => {
      try {
        if (!storage) throw new Error('Storage not initialized')

        const count = storage.getMessageCount(conversationId)

        return {
          success: true,
          count
        }
      } catch (error: any) {
        console.error('[message:count] Error:', error)
        return {
          success: false,
          error: error.message
        }
      }
    }
  )

  // ============================================================================
  // Workspace Metadata Handlers
  // ============================================================================

  /**
   * Get workspace metadata
   */
  ipcMain.handle(
    'conversation:get-workspace-metadata',
    async (_event: IpcMainInvokeEvent, workspaceId: string) => {
      try {
        if (!storage) throw new Error('Storage not initialized')

        const metadata = storage.getWorkspaceMetadata(workspaceId)

        return {
          success: true,
          metadata
        }
      } catch (error: any) {
        console.error('[conversation:get-workspace-metadata] Error:', error)
        return {
          success: false,
          error: error.message
        }
      }
    }
  )

  // ============================================================================
  // Block Handlers
  // ============================================================================

  /**
   * Get blocks for a message
   */
  ipcMain.handle(
    'block:get-blocks',
    async (_event: IpcMainInvokeEvent, messageId: string) => {
      try {
        if (!storage) throw new Error('Storage not initialized')

        const blocks = storage.getBlocks(messageId)

        // Parse metadata JSON
        const blocksWithMetadata = blocks.map(b => ({
          ...b,
          metadata: JSON.parse(b.metadata || '{}')
        }))

        return {
          success: true,
          blocks: blocksWithMetadata
        }
      } catch (error: any) {
        console.error('[block:get-blocks] Error:', error)
        return {
          success: false,
          error: error.message
        }
      }
    }
  )

  /**
   * Search blocks
   */
  ipcMain.handle(
    'block:search',
    async (_event: IpcMainInvokeEvent, query: string, filters?: { blockType?: string; workspaceId?: string; limit?: number }) => {
      try {
        if (!storage) throw new Error('Storage not initialized')

        const results = storage.searchBlocks(query, filters as any)

        // Parse metadata JSON
        const resultsWithMetadata = results.map(b => ({
          ...b,
          metadata: JSON.parse(b.metadata || '{}')
        }))

        return {
          success: true,
          results: resultsWithMetadata
        }
      } catch (error: any) {
        console.error('[block:search] Error:', error)
        return {
          success: false,
          error: error.message
        }
      }
    }
  )

  /**
   * Save block bookmark
   */
  ipcMain.handle(
    'block:bookmark',
    async (_event: IpcMainInvokeEvent, bookmark: BlockBookmark) => {
      try {
        if (!storage) throw new Error('Storage not initialized')

        // Convert tags array to JSON string
        const bookmarkForStorage = {
          ...bookmark,
          tags: bookmark.tags ? JSON.stringify(bookmark.tags) : undefined
        }

        storage.saveBlockBookmark(bookmarkForStorage as any)

        return {
          success: true
        }
      } catch (error: any) {
        console.error('[block:bookmark] Error:', error)
        return {
          success: false,
          error: error.message
        }
      }
    }
  )

  /**
   * Get all block bookmarks
   */
  ipcMain.handle(
    'block:get-bookmarks',
    async (_event: IpcMainInvokeEvent) => {
      try {
        if (!storage) throw new Error('Storage not initialized')

        const bookmarks = storage.getBlockBookmarks()

        // Parse tags JSON
        const bookmarksWithTags = bookmarks.map(b => ({
          ...b,
          tags: b.tags ? JSON.parse(b.tags) : []
        }))

        return {
          success: true,
          bookmarks: bookmarksWithTags
        }
      } catch (error: any) {
        console.error('[block:get-bookmarks] Error:', error)
        return {
          success: false,
          error: error.message
        }
      }
    }
  )

  /**
   * Delete block bookmark
   */
  ipcMain.handle(
    'block:delete-bookmark',
    async (_event: IpcMainInvokeEvent, bookmarkId: string) => {
      try {
        if (!storage) throw new Error('Storage not initialized')

        storage.deleteBlockBookmark(bookmarkId)

        return {
          success: true
        }
      } catch (error: any) {
        console.error('[block:delete-bookmark] Error:', error)
        return {
          success: false,
          error: error.message
        }
      }
    }
  )

  /**
   * Record block execution
   */
  ipcMain.handle(
    'block:record-execution',
    async (_event: IpcMainInvokeEvent, execution: BlockExecution) => {
      try {
        if (!storage) throw new Error('Storage not initialized')

        storage.recordBlockExecution(execution)

        return {
          success: true
        }
      } catch (error: any) {
        console.error('[block:record-execution] Error:', error)
        return {
          success: false,
          error: error.message
        }
      }
    }
  )

  /**
   * Get block execution history
   */
  ipcMain.handle(
    'block:get-executions',
    async (_event: IpcMainInvokeEvent, blockId: string) => {
      try {
        if (!storage) throw new Error('Storage not initialized')

        const executions = storage.getBlockExecutions(blockId)

        return {
          success: true,
          executions
        }
      } catch (error: any) {
        console.error('[block:get-executions] Error:', error)
        return {
          success: false,
          error: error.message
        }
      }
    }
  )

  /**
   * Execute a command block
   *
   * Security: Basic validation to prevent dangerous commands
   */
  ipcMain.handle(
    'command:execute',
    async (_event: IpcMainInvokeEvent, options: {
      command: string
      workingDirectory: string
      blockId?: string
    }) => {
      try {
        const { command, workingDirectory, blockId } = options

        // Basic security checks
        const dangerousPatterns = [
          /rm\s+-rf\s+\//, // rm -rf /
          /sudo/i,          // sudo commands
          /:\(\)\{/,        // Fork bomb
          /mkfs/i,          // Format disk
          /dd\s+if=/i,      // Disk operations
        ]

        for (const pattern of dangerousPatterns) {
          if (pattern.test(command)) {
            throw new Error('Command contains potentially dangerous operations and was blocked')
          }
        }

        console.log(`[command:execute] Executing: ${command}`)
        console.log(`[command:execute] Working directory: ${workingDirectory}`)

        const startTime = Date.now()

        // Execute command with timeout
        const result = await execAsync(command, {
          cwd: workingDirectory,
          timeout: 30000, // 30 seconds timeout
          maxBuffer: 1024 * 1024 * 10, // 10MB max output
        })

        const duration = Date.now() - startTime
        const exitCode = result.stdout || result.stderr ? 0 : 1

        // Combine stdout and stderr
        const output = (result.stdout + result.stderr).trim()

        console.log(`[command:execute] Success (${duration}ms)`)
        console.log(`[command:execute] Output length: ${output.length} bytes`)

        // Record execution if blockId provided
        if (blockId && storage) {
          const execution: BlockExecution = {
            id: `exec-${Date.now()}`,
            blockId,
            executedAt: new Date().toISOString(),
            exitCode: 0,
            output: output.slice(0, 10000), // Limit to 10KB
            durationMs: duration
          }

          storage.recordBlockExecution(execution)
        }

        return {
          success: true,
          output,
          exitCode: 0,
          duration
        }
      } catch (error: any) {
        console.error('[command:execute] Error:', error.message)

        // Check if it's a timeout
        if (error.killed || error.signal === 'SIGTERM') {
          return {
            success: false,
            error: 'Command timed out after 30 seconds',
            exitCode: 124
          }
        }

        // Record failed execution
        if (options.blockId && storage) {
          const execution: BlockExecution = {
            id: `exec-${Date.now()}`,
            blockId: options.blockId,
            executedAt: new Date().toISOString(),
            exitCode: error.code || 1,
            output: error.message,
            durationMs: 0
          }

          storage.recordBlockExecution(execution)
        }

        return {
          success: false,
          error: error.message,
          output: error.stdout || error.stderr || error.message,
          exitCode: error.code || 1
        }
      }
    }
  )

  // ============================================================================
  // Statistics Handlers
  // ============================================================================

  /**
   * Get database statistics
   */
  ipcMain.handle(
    'conversation:get-stats',
    async (_event: IpcMainInvokeEvent) => {
      try {
        if (!storage) throw new Error('Storage not initialized')

        const stats = storage.getStats()

        return {
          success: true,
          stats
        }
      } catch (error: any) {
        console.error('[conversation:get-stats] Error:', error)
        return {
          success: false,
          error: error.message
        }
      }
    }
  )

  console.log('[ConversationHandlers] All IPC handlers registered')
}

/**
 * Cleanup on app quit
 */
export function cleanupConversationStorage(): void {
  if (storage) {
    storage.close()
    storage = null
    console.log('[ConversationHandlers] Storage closed')
  }
}
