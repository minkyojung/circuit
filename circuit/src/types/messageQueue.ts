/**
 * Message Queue System Types
 *
 * Enables users to queue multiple messages while one is being processed,
 * improving UX by not blocking input during agent responses.
 */

/**
 * Attached file type (shared with ChatInput)
 */
export interface AttachedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  code?: {
    filePath: string;
    lineStart: number;
    lineEnd: number;
    content: string;
  };
}

/**
 * Queue status for tracking message processing state
 */
export type QueueStatus =
  | 'queued'      // Waiting to be processed
  | 'processing'  // Currently being processed
  | 'completed'   // Successfully completed
  | 'failed'      // Failed with error
  | 'cancelled'   // Cancelled by user

/**
 * Thinking mode for Claude API
 */
export type ThinkingMode = 'normal' | 'think' | 'megathink' | 'ultrathink' | 'plan'

/**
 * A message queued for processing
 */
export interface QueuedMessage {
  // Identifiers
  id: string
  queuedAt: number  // Timestamp when added to queue

  // Message content
  content: string
  attachments: AttachedFile[]
  thinkingMode: ThinkingMode

  // Status tracking
  status: QueueStatus
  error?: string

  // UI display
  preview: string  // First 50 chars for display

  // Processing results (set after completion)
  userMessageId?: string      // DB stored user message ID
  assistantMessageId?: string // DB stored assistant message ID
  processedAt?: number        // Timestamp when processing completed
}

/**
 * Queue state management interface
 */
export interface MessageQueueState {
  queue: QueuedMessage[]
  isProcessing: boolean
  currentlyProcessing: QueuedMessage | null
}
