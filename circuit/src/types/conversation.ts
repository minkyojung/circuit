/**
 * Type definitions for conversations and messages
 */

import type { ThinkingStep } from './thinking'

export interface Conversation {
  id: string
  workspaceId: string
  title: string
  createdAt: number
  updatedAt: number
  lastViewedAt?: number
  isActive?: boolean
}

export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  metadata?: {
    files?: string[]
    toolCalls?: string[]
    tokens?: number
    thinkingSteps?: ThinkingStep[]
    thinkingDuration?: number
    attachments?: Array<{
      id: string
      name: string
      type: string
      size: number
    }>
    planResult?: any  // TodoGenerationResult from Plan Mode (displays in sidebar)
    todoWriteResult?: any  // TodoGenerationResult from TodoWrite tool (displays inline)
    hasPendingPlan?: boolean
    planConfirmed?: boolean
    planCancelled?: boolean
    cancelled?: boolean  // Message was cancelled by user
    // Task-related
    isTask?: boolean
    todoId?: string
    // Session compact-related
    isCompactSummary?: boolean
    originalMessageCount?: number
    tokensBeforeEstimate?: number
    tokensAfterEstimate?: number
    // Plan mode retry
    planRetryAttempt?: number
    planGenerationFailed?: boolean
  }
  blocks?: Block[]  // New: Block-based message structure
}

export interface WorkspaceMetadata {
  workspaceId: string
  lastActiveConversationId: string | null
  settings?: Record<string, any>
}

/**
 * Block types for structured message content
 * Inspired by Warp Terminal's block-based architecture
 */
export type BlockType =
  | 'text'       // Plain text or Markdown
  | 'code'       // Code snippet
  | 'command'    // Executable command
  | 'file'       // File reference
  | 'diff'       // Git diff
  | 'error'      // Error message
  | 'result'     // Command output
  | 'diagram'    // Mermaid diagram
  | 'link'       // URL reference
  | 'quote'      // Quote block
  | 'list'       // List (generic)
  | 'checklist'  // Checklist with checkboxes
  | 'table'      // Table data
  | 'tool'       // Tool invocation (AI SDK integration)
  | 'file-summary' // Summary of file changes in a message

/**
 * Metadata for different block types
 */
export interface BlockMetadata {
  // Code/Command blocks
  language?: string
  fileName?: string
  lineStart?: number
  lineEnd?: number
  isExecutable?: boolean

  // Command execution
  exitCode?: number
  executedAt?: string

  // File blocks
  filePath?: string
  changeType?: 'created' | 'modified' | 'deleted'

  // Diff blocks
  additions?: number
  deletions?: number

  // Error blocks
  errorType?: string
  stack?: string
  suggestedFix?: string
  errorCode?: string | number

  // Diagram blocks
  diagramType?: 'mermaid' | 'graphviz'

  // List blocks
  totalItems?: number
  completedItems?: number

  // Link blocks
  title?: string
  description?: string

  // Quote blocks
  author?: string
  source?: string

  // Bookmark
  isBookmarked?: boolean
  bookmarkNote?: string

  // Tool blocks (AI SDK integration)
  toolName?: string
  toolCallId?: string
  type?: string
  state?: 'input-streaming' | 'input-available' | 'output-available' | 'output-error'
  args?: Record<string, unknown>
  result?: unknown
  error?: unknown
  duration?: number  // Execution duration in milliseconds
  status?: 'pending' | 'running' | 'success' | 'error'

  // File summary blocks
  files?: Array<{
    filePath: string
    changeType: 'created' | 'modified' | 'deleted'
    additions: number
    deletions: number
    toolCallId?: string
  }>
  totalAdditions?: number
  totalDeletions?: number
  totalFiles?: number
}

/**
 * Block represents a semantic unit within a message
 */
export interface Block {
  id: string
  messageId: string
  type: BlockType
  content: string
  metadata: BlockMetadata
  order: number
  createdAt: string
}

/**
 * Block bookmark for saving important blocks
 */
export interface BlockBookmark {
  id: string
  blockId: string
  title?: string
  note?: string
  tags?: string[]
  createdAt: string
}

/**
 * Execution history for command blocks
 */
export interface BlockExecution {
  id: string
  blockId: string
  executedAt: string
  exitCode?: number
  output?: string
  durationMs?: number
}
