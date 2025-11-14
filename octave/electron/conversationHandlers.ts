/**
 * IPC Handlers for Conversation and Message Operations
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { ConversationStorage, Conversation, Message, Block, BlockBookmark, BlockExecution } from './conversationStorage'
import { parseMessageToBlocks, Block as ParsedBlock } from './messageParser'
import { FileChangeAggregator } from './fileChangeAggregator'
import { exec } from 'child_process'
import { promisify } from 'util'
import { randomUUID } from 'crypto'

const execAsync = promisify(exec)

let storage: ConversationStorage | null = null

/**
 * Get storage instance (for use by other handlers)
 */
export function getStorage(): ConversationStorage | null {
  return storage
}

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
   * Get conversation by ID
   */
  ipcMain.handle(
    'conversation:get-by-id',
    async (_event: IpcMainInvokeEvent, conversationId: string) => {
      try {
        if (!storage) throw new Error('Storage not initialized')

        const conversation = storage.getById(conversationId)

        return {
          success: true,
          conversation: conversation || null
        }
      } catch (error: any) {
        console.error('[conversation:get-by-id] Error:', error)
        return {
          success: false,
          error: error.message
        }
      }
    }
  )

  /**
   * Create a new conversation
   * @param workspaceId - Workspace ID
   * @param options - { workspaceName?: string, title?: string }
   */
  ipcMain.handle(
    'conversation:create',
    async (_event: IpcMainInvokeEvent, workspaceId: string, options?: { workspaceName?: string; title?: string } | string) => {
      try {
        if (!storage) throw new Error('Storage not initialized')

        // Handle legacy API: second parameter might be a string (title)
        let workspaceName: string | undefined
        let title: string | undefined

        if (typeof options === 'string') {
          // Legacy: conversation:create(workspaceId, title)
          title = options
        } else if (options) {
          // New: conversation:create(workspaceId, { workspaceName, title })
          workspaceName = options.workspaceName
          title = options.title
        }

        // Generate title if not provided
        if (!title && workspaceName) {
          const now = new Date()
          const dateStr = now.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          }).replace(/\. /g, '-').replace('.', '')  // "2025-01-15"
          title = `${workspaceName} ${dateStr}`
        }

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
    async (_event: IpcMainInvokeEvent, message: Message, workspacePath?: string) => {
      try {
        if (!storage) throw new Error('Storage not initialized')

        console.log('[message:save] 💾 Saving message:', message.id);
        console.log('[message:save] 💾 Metadata type:', typeof message.metadata);
        if (message.metadata && typeof message.metadata === 'object') {
          console.log('[message:save] 💾 Metadata keys:', Object.keys(message.metadata));
          console.log('[message:save] 💾 Has planResult:', !!(message.metadata as any).planResult);
        }

        // Normalize message metadata to JSON string
        const normalizedMessage = {
          ...message,
          metadata: message.metadata
            ? (typeof message.metadata === 'string'
                ? message.metadata
                : JSON.stringify(message.metadata))
            : undefined
        }

        console.log('[message:save] 💾 Normalized metadata length:', normalizedMessage.metadata?.length || 0);
        console.log('[message:save] 💾 Normalized metadata preview:', normalizedMessage.metadata?.substring(0, 200));

        // Parse message content into text blocks
        const parseResult = parseMessageToBlocks(message.content, message.id)

        if (parseResult.errors.length > 0) {
          console.warn('[message:save] Parse errors:', parseResult.errors)
        }

        // Note: Tool blocks are NOT stored in message body
        // They are stored in metadata.thinkingSteps and displayed in ReasoningAccordion only
        // This prevents duplicate rendering and reduces message body clutter
        let allBlocks: ParsedBlock[] = [...parseResult.blocks]

        // Track file changes from diff blocks and tool calls (only for assistant messages)
        if (message.role === 'assistant') {
          // ✅ Use workspacePath directly as projectRoot
          // Note: workspace.path is the absolute path to the worktree directory,
          // which is the actual project root for file operations
          let projectRoot = ''
          if (workspacePath) {
            projectRoot = workspacePath  // ✅ Don't strip .conductor - workspace IS the project root
            console.log('[message:save] 📁 Using projectRoot:', projectRoot)
          } else {
            console.warn('[message:save] ⚠️  No workspacePath provided, file path normalization disabled')
          }

          const fileAggregator = new FileChangeAggregator(projectRoot)

          // Track changes from diff blocks
          for (const block of allBlocks) {
            if (block.type === 'diff') {
              fileAggregator.trackFromDiffBlock(block as any)
            }
          }

          // Track changes from metadata.thinkingSteps (Edit/Write tool calls)
          if (message.metadata) {
            try {
              const metadata = typeof message.metadata === 'string'
                ? JSON.parse(message.metadata)
                : message.metadata

              const thinkingSteps = metadata?.thinkingSteps || []
              console.log('[message:save] 🔍 Checking', thinkingSteps.length, 'thinking steps for file changes')

              for (const step of thinkingSteps) {
                if (step.type === 'tool-use') {
                  // Edit tool: track as modification
                  if (step.tool === 'Edit' && step.filePath) {
                    fileAggregator.trackFromEdit(
                      {
                        file_path: step.filePath,
                        old_string: step.oldString || '',
                        new_string: step.newString || ''
                      },
                      undefined,
                      undefined
                    )
                  }
                  // Write tool: track as creation or modification
                  else if (step.tool === 'Write' && step.filePath) {
                    fileAggregator.trackFromWrite(
                      {
                        file_path: step.filePath,
                        content: step.content || ''
                      },
                      undefined,
                      undefined
                    )
                  }
                }
              }
            } catch (e) {
              console.warn('[message:save] Failed to parse thinkingSteps:', e)
            }
          }

          // Add file summary block if there are changes
          if (fileAggregator.hasChanges()) {
            const summaryBlock = fileAggregator.createFileSummaryBlock(message.id)
            if (summaryBlock) {
              console.log('[message:save] 📊 Adding file summary block with', fileAggregator.getFileCount(), 'files')
              allBlocks.push(summaryBlock as any)
            }
          }
        }

        // Convert blocks to storage format (metadata as JSON string)
        const blocksForStorage = allBlocks.map(block => ({
          ...block,
          metadata: JSON.stringify(block.metadata)
        }))

        // Save message with blocks
        storage.saveMessageWithBlocks(normalizedMessage, blocksForStorage as any)

        return {
          success: true,
          blockCount: allBlocks.length,
          blocks: allBlocks // Return all blocks (including tool blocks) for UI update
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
   * Delete all messages after a specific message
   * Used for retry functionality
   */
  ipcMain.handle(
    'db:messages:delete-after',
    async (_event: IpcMainInvokeEvent, conversationId: string, afterMessageId: string) => {
      try {
        if (!storage) throw new Error('Storage not initialized')

        console.log('[db:messages:delete-after] Deleting messages after:', afterMessageId, 'in conversation:', conversationId)
        storage.deleteMessagesAfter(conversationId, afterMessageId)

        return {
          success: true
        }
      } catch (error: any) {
        console.error('[db:messages:delete-after] Error:', error)
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

  // ============================================================================
  // SimpleBranchPlan Handlers
  // ============================================================================

  /**
   * Get all plans for a workspace
   */
  ipcMain.handle(
    'plan:list',
    async (_event: IpcMainInvokeEvent, workspaceId: string) => {
      try {
        if (!storage) throw new Error('Storage not initialized')

        const plans = storage.getPlansByWorkspaceId(workspaceId)

        return {
          success: true,
          plans
        }
      } catch (error: any) {
        console.error('[plan:list] Error:', error)
        return {
          success: false,
          error: error.message
        }
      }
    }
  )

  /**
   * Get plan by ID
   */
  ipcMain.handle(
    'plan:get',
    async (_event: IpcMainInvokeEvent, planId: string) => {
      try {
        if (!storage) throw new Error('Storage not initialized')

        const plan = storage.getPlanById(planId)

        return {
          success: true,
          plan
        }
      } catch (error: any) {
        console.error('[plan:get] Error:', error)
        return {
          success: false,
          error: error.message
        }
      }
    }
  )

  /**
   * Get all conversations for a plan
   */
  ipcMain.handle(
    'conversation:list-by-plan',
    async (_event: IpcMainInvokeEvent, planId: string) => {
      try {
        if (!storage) throw new Error('Storage not initialized')

        const conversations = storage.getConversationsByPlanId(planId)

        return {
          success: true,
          conversations
        }
      } catch (error: any) {
        console.error('[conversation:list-by-plan] Error:', error)
        return {
          success: false,
          error: error.message
        }
      }
    }
  )

  /**
   * Analyze plan goal and generate clarifying questions
   * Phase 4 v1: Mock implementation
   */
  ipcMain.handle(
    'plan:analyze',
    async (_event: IpcMainInvokeEvent, request: { workspaceId: string; goal: string }) => {
      try {
        console.log('[plan:analyze] Analyzing goal:', request.goal)

        // TODO Phase 4 v2: Integrate with AI
        // For now, return mock questions
        const mockAnalysis = {
          reasoning: `To create an effective plan for "${request.goal}", I need to understand a few key details about your requirements and constraints.`,
          questions: [
            {
              id: 'q1',
              type: 'single-select',
              text: 'What is the primary goal of this task?',
              options: ['Build new feature', 'Fix bug', 'Refactor code', 'Add tests'],
              required: true
            },
            {
              id: 'q2',
              type: 'text',
              text: 'Are there any specific technical constraints or requirements?',
              placeholder: 'e.g., must use TypeScript, React, etc.',
              required: false
            },
            {
              id: 'q3',
              type: 'number',
              text: 'How many conversations would you like to split this into?',
              defaultValue: 3,
              required: true
            }
          ],
          suggestedConversations: [],
          estimatedComplexity: 'medium' as const,
          estimatedTotalTime: 3600,
          confidence: 0.8
        }

        return {
          success: true,
          analysis: mockAnalysis
        }
      } catch (error: any) {
        console.error('[plan:analyze] Error:', error)
        return {
          success: false,
          error: error.message
        }
      }
    }
  )

  /**
   * Generate plan from goal and user answers
   * Phase 4 v1: Mock implementation
   */
  ipcMain.handle(
    'plan:generate',
    async (_event: IpcMainInvokeEvent, request: {
      workspaceId: string;
      goal: string;
      planDocument?: string;
      todos?: any[];
      totalTodos?: number;
      totalEstimatedDuration?: number;
      aiAnalysis?: any;
      answers: any;
    }) => {
      try {
        if (!storage) throw new Error('Storage not initialized')

        console.log('[plan:generate] Generating plan for goal:', request.goal)
        console.log('[plan:generate] User answers:', request.answers)
        console.log('[plan:generate] 📊 Received request.todos:', request.todos ? request.todos.length : 'null')
        if (request.todos) {
          console.log('[plan:generate] 📊 First 3 todos from request:', request.todos.slice(0, 3).map(t => t.content))
        }

        // If todos are provided (from multiplan mode), use them directly
        // Otherwise, create mock plan based on answers (legacy behavior)
        const todos = request.todos || (() => {
          const numTodos = request.answers['q3'] || 5
          const mockTodos = []

          for (let i = 0; i < numTodos; i++) {
            mockTodos.push({
              content: `Complete task ${i + 1} for: ${request.goal}`,
              activeForm: `Working on task ${i + 1}`,
              complexity: 'medium' as const,
              estimatedDuration: 600,
              order: i
            })
          }

          return mockTodos
        })()

        console.log('[plan:generate] 📊 Final todos array:', todos.length, 'items')

        // Create plan object
        const planId = randomUUID()
        const planData = {
          id: planId,
          workspaceId: request.workspaceId,
          goal: request.goal,
          description: `Plan for: ${request.goal}`,
          planDocument: request.planDocument || undefined,
          todos,
          totalTodos: request.totalTodos || todos.length,
          totalEstimatedDuration: request.totalEstimatedDuration || todos.reduce((sum, t) => sum + (t.estimatedDuration || 0), 0),
          status: 'pending',
          aiAnalysis: request.aiAnalysis || {
            reasoning: `Generated plan for: ${request.goal}`,
            questions: [],
            answers: request.answers,
            confidence: 0.8
          },
          createdAt: Date.now(),
          updatedAt: Date.now()
        }

        console.log('[plan:generate] 📊 About to save plan with', planData.todos.length, 'todos')

        // Save to database
        storage.createPlan(planData)

        console.log('[plan:generate] 📊 Plan saved to database')

        // Retrieve saved plan
        const plan = storage.getPlanById(planId)
        if (!plan) {
          throw new Error('Failed to retrieve created plan')
        }

        console.log('[plan:generate] Plan created:', planId)
        console.log('[plan:generate] 📊 Retrieved plan has', plan.todos.length, 'todos')
        console.log('[plan:generate] 📊 Retrieved plan totalTodos:', plan.totalTodos)
        console.log('[plan:generate] 📊 First 3 todos from DB:', plan.todos.slice(0, 3).map((t: any) => t.content))

        return {
          success: true,
          plan
        }
      } catch (error: any) {
        console.error('[plan:generate] Error:', error)
        return {
          success: false,
          error: error.message
        }
      }
    }
  )

  /**
   * Execute plan: Create single conversation with todo queue
   * Phase 4 v2: Single conversation with flat todos
   */
  ipcMain.handle(
    'plan:execute',
    async (_event: IpcMainInvokeEvent, planId: string) => {
      try {
        if (!storage) throw new Error('Storage not initialized')

        console.log('[plan:execute] Executing plan:', planId)

        const plan = storage.getPlanById(planId)
        if (!plan) {
          throw new Error(`Plan not found: ${planId}`)
        }

        console.log('[plan:execute] 📊 Retrieved plan has', plan.todos?.length || 0, 'todos')
        console.log('[plan:execute] 📊 Plan totalTodos:', plan.totalTodos)
        if (plan.todos && plan.todos.length > 0) {
          console.log('[plan:execute] 📊 First 3 todos:', plan.todos.slice(0, 3).map((t: any) => t.content))
        }

        // Create single conversation with plan goal as title
        const conversation = storage.create(plan.workspaceId, plan.goal, planId)
        console.log('[plan:execute] Created conversation:', conversation.id)

        const todoIds: string[] = []

        // Create all todos for this conversation (flat structure)
        console.log('[plan:execute] 📊 Starting to create', plan.todos.length, 'todos in DB')
        for (const todoData of plan.todos) {
          // Map 'moderate' to 'medium' for DB compatibility
          const normalizedComplexity = todoData.complexity === 'moderate'
            ? 'medium'
            : (todoData.complexity || 'medium');

          const todo: any = {
            id: randomUUID(),
            conversationId: conversation.id,
            messageId: null,
            parentId: null,
            order: todoData.order,
            depth: 0,  // Flat structure - all todos at depth 0
            content: todoData.content,
            description: null,
            activeForm: todoData.activeForm || todoData.content,
            status: 'pending',
            progress: null,
            priority: null,
            complexity: normalizedComplexity,
            thinkingStepIds: [],  // Empty array for new todos
            blockIds: [],         // Empty array for new todos
            estimatedDuration: todoData.estimatedDuration || 0,
            actualDuration: null,
            startedAt: null,
            completedAt: null,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            metadata: null
          }
          storage.saveTodo(todo)
          todoIds.push(todo.id)
        }

        console.log('[plan:execute] 📊 Created', todoIds.length, 'todos in database')
        console.log('[plan:execute] 📊 Todo IDs:', todoIds)

        // Update plan status to active
        storage.updatePlan(planId, {
          status: 'active',
          startedAt: Date.now()
        })

        console.log('[plan:execute] Plan executed. Created', todoIds.length, 'todos in conversation:', conversation.id)

        return {
          success: true,
          planId,
          conversationId: conversation.id,
          todoIds
        }
      } catch (error: any) {
        console.error('[plan:execute] Error:', error)
        return {
          success: false,
          error: error.message
        }
      }
    }
  )

  /**
   * Update plan metadata (goal, description, etc.)
   * Used for conversation-based plan editing
   */
  ipcMain.handle(
    'plan:update',
    async (_event: IpcMainInvokeEvent, updates: {
      planId: string;
      goal?: string;
      description?: string;
      planDocument?: string;
      totalTodos?: number;
      totalEstimatedDuration?: number;
    }) => {
      try {
        if (!storage) throw new Error('Storage not initialized')

        console.log('[plan:update] Updating plan:', updates.planId)
        console.log('[plan:update] Updates:', updates)

        storage.updatePlan(updates.planId, {
          goal: updates.goal,
          description: updates.description,
          planDocument: updates.planDocument,
          totalTodos: updates.totalTodos,
          totalEstimatedDuration: updates.totalEstimatedDuration,
        })

        const plan = storage.getPlanById(updates.planId)
        console.log('[plan:update] Plan updated successfully')

        return {
          success: true,
          plan
        }
      } catch (error: any) {
        console.error('[plan:update] Error:', error)
        return {
          success: false,
          error: error.message
        }
      }
    }
  )

  /**
   * Get active plan for a workspace
   */
  ipcMain.handle(
    'plan:get-active',
    async (_event: IpcMainInvokeEvent, workspaceId: string) => {
      try {
        if (!storage) throw new Error('Storage not initialized')

        const plans = storage.getPlansByWorkspaceId(workspaceId)
        const activePlan = plans.find(p => p.status === 'active' || p.status === 'pending')

        return {
          success: true,
          plan: activePlan || null
        }
      } catch (error: any) {
        console.error('[plan:get-active] Error:', error)
        return {
          success: false,
          error: error.message
        }
      }
    }
  )

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

  // Register todo handlers
  if (storage) {
    const { registerTodoHandlers } = require('./todoHandlers')
    registerTodoHandlers(storage)
  }
}

/**
 * Get storage instance (for internal use by other electron modules)
 */
export function getConversationStorage() {
  return storage;
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
