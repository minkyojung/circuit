/**
 * Type definitions for conversations and messages
 */

import type { ThinkingStep } from './thinking'

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
    planResult?: any  // TodoGenerationResult from Plan Mode
    hasPendingPlan?: boolean
    planConfirmed?: boolean
    planCancelled?: boolean
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
  | 'list'       // Checklist
  | 'table'      // Table data
  | 'tool'       // Tool invocation (AI SDK integration)

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
