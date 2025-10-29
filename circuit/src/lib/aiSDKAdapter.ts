/**
 * AI SDK Adapter Layer
 *
 * This module provides bidirectional conversion between AI SDK types and our
 * internal Block-based message system. It serves as the integration layer
 * that allows us to leverage AI SDK features while maintaining our existing
 * Block architecture.
 *
 * Architecture:
 *
 *   AI SDK Messages (useChat, useCompletion)
 *              ↕️ (this adapter)
 *   Block[] (our internal representation)
 *
 * @module aiSDKAdapter
 */

import { nanoid } from 'nanoid'
import type { Message as AIMessage, ToolInvocation } from 'ai'
import type { Message, Block, BlockType, BlockMetadata } from '@/types/conversation'

// Note: messageParser is in electron/ folder but we import it here for type conversion
// This creates a shared parsing logic between frontend and backend
// TODO: Consider moving shared parsing logic to src/lib/ in the future
import type { ParseResult } from '../../electron/messageParser'

// We'll need to handle parsing differently since electron code can't be imported directly
// For now, we'll inline a simplified version of the parsing logic
function parseMessageToBlocks(content: string, messageId: string): ParseResult {
  const blocks: Block[] = []
  const warnings: string[] = []
  const errors: string[] = []

  try {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g
    let lastIndex = 0
    let match: RegExpExecArray | null
    let order = 0

    while ((match = codeBlockRegex.exec(content)) !== null) {
      const matchStart = match.index
      const matchEnd = codeBlockRegex.lastIndex

      // Text before code block
      if (matchStart > lastIndex) {
        const textContent = content.slice(lastIndex, matchStart).trim()
        if (textContent) {
          blocks.push({
            id: nanoid(),
            messageId,
            type: 'text',
            content: textContent,
            metadata: {},
            order: order++,
            createdAt: new Date().toISOString(),
          })
        }
      }

      // Code block
      const language = match[1] || 'plaintext'
      const codeContent = match[2].trim()

      const isCommand = ['bash', 'sh', 'shell', 'zsh'].includes(language.toLowerCase())
      const isDiff = language.toLowerCase() === 'diff'

      if (isCommand) {
        blocks.push({
          id: nanoid(),
          messageId,
          type: 'command',
          content: codeContent,
          metadata: { language: 'bash', isExecutable: true },
          order: order++,
          createdAt: new Date().toISOString(),
        })
      } else if (isDiff) {
        blocks.push({
          id: nanoid(),
          messageId,
          type: 'diff',
          content: codeContent,
          metadata: {},
          order: order++,
          createdAt: new Date().toISOString(),
        })
      } else {
        blocks.push({
          id: nanoid(),
          messageId,
          type: 'code',
          content: codeContent,
          metadata: { language, isExecutable: false },
          order: order++,
          createdAt: new Date().toISOString(),
        })
      }

      lastIndex = matchEnd
    }

    // Remaining text
    if (lastIndex < content.length) {
      const textContent = content.slice(lastIndex).trim()
      if (textContent) {
        blocks.push({
          id: nanoid(),
          messageId,
          type: 'text',
          content: textContent,
          metadata: {},
          order: order++,
          createdAt: new Date().toISOString(),
        })
      }
    }

    // Edge case: no code blocks
    if (blocks.length === 0 && content.trim()) {
      blocks.push({
        id: nanoid(),
        messageId,
        type: 'text',
        content: content.trim(),
        metadata: {},
        order: 0,
        createdAt: new Date().toISOString(),
      })
    }
  } catch (error) {
    errors.push(`Parsing failed: ${error instanceof Error ? error.message : String(error)}`)
    blocks.push({
      id: nanoid(),
      messageId,
      type: 'text',
      content,
      metadata: {},
      order: 0,
      createdAt: new Date().toISOString(),
    })
  }

  return { blocks, warnings, errors }
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a tool invocation has a result
 */
function hasToolResult(tool: ToolInvocation): tool is ToolInvocation & { result: unknown } {
  return 'result' in tool && tool.result !== undefined
}

// ============================================================================
// AI SDK → Block Conversion
// ============================================================================

/**
 * Convert an AI SDK Message to Block array
 *
 * This is the primary conversion function that transforms AI SDK's message
 * format into our Block-based structure. It handles:
 * - Text content parsing (via messageParser)
 * - Tool invocations
 * - Attachments (future)
 *
 * @param aiMessage - Message from AI SDK (useChat, useCompletion)
 * @param conversationId - Our internal conversation ID
 * @returns Array of Blocks representing the message
 *
 * @example
 * ```typescript
 * const { messages } = useChat()
 * const blocks = aiMessageToBlocks(messages[0], conversationId)
 * ```
 */
export function aiMessageToBlocks(
  aiMessage: AIMessage,
  conversationId: string
): Block[] {
  const blocks: Block[] = []
  let order = 0

  // 1. Convert text content to blocks
  if (aiMessage.content && typeof aiMessage.content === 'string') {
    const parsed = parseMessageToBlocks(aiMessage.content, aiMessage.id)

    // Add conversationId to each block
    const contentBlocks = parsed.blocks.map(block => ({
      ...block,
      messageId: aiMessage.id,
      order: order++,
    }))

    blocks.push(...contentBlocks)
  }

  // 2. Convert tool invocations to blocks
  if (aiMessage.toolInvocations && aiMessage.toolInvocations.length > 0) {
    for (const tool of aiMessage.toolInvocations) {
      const toolBlock = toolInvocationToBlock(tool, aiMessage.id, order++)
      blocks.push(toolBlock)
    }
  }

  // 3. Handle experimental features (future)
  // - annotations
  // - data
  // - experimental_attachments

  return blocks
}

/**
 * Convert a tool invocation to a Block
 *
 * Tool invocations from AI SDK are converted to 'command' type blocks,
 * which allows them to be rendered with execution status.
 */
function toolInvocationToBlock(
  tool: ToolInvocation,
  messageId: string,
  order: number
): Block {
  // Map AI SDK tool state to Tool component state
  let toolState: 'input-streaming' | 'input-available' | 'output-available' | 'output-error' = 'input-streaming'

  switch (tool.state) {
    case 'partial-call':
      toolState = 'input-streaming'
      break
    case 'call':
      toolState = 'input-available'
      break
    case 'result':
      toolState = 'output-available'
      break
  }

  const metadata: BlockMetadata = {
    toolName: tool.toolName,
    toolCallId: tool.toolCallId,
    type: 'tool-call',
    state: toolState,
    args: tool.args,
  }

  // Add result if available
  if (tool.state === 'result' && hasToolResult(tool)) {
    metadata.result = tool.result
    metadata.executedAt = new Date().toISOString()
  }

  // Simple content for text rendering fallback
  const content = `${tool.toolName}(${JSON.stringify(tool.args)})`

  return {
    id: `block-tool-${tool.toolCallId}`,
    messageId,
    type: 'tool',
    content,
    metadata,
    order,
    createdAt: new Date().toISOString(),
  }
}

/**
 * Convert multiple AI SDK messages to our Message format with Blocks
 *
 * This is useful when initializing a conversation from AI SDK's message history.
 *
 * @example
 * ```typescript
 * const { messages } = useChat()
 * const ourMessages = aiMessagesToMessages(messages, conversationId)
 * setMessages(ourMessages)
 * ```
 */
export function aiMessagesToMessages(
  aiMessages: AIMessage[],
  conversationId: string
): Message[] {
  return aiMessages.map(aiMsg => ({
    id: aiMsg.id,
    conversationId,
    role: aiMsg.role as 'user' | 'assistant',
    content: typeof aiMsg.content === 'string' ? aiMsg.content : '',
    timestamp: aiMsg.createdAt?.getTime() || Date.now(),
    blocks: aiMessageToBlocks(aiMsg, conversationId),
  }))
}

// ============================================================================
// Block → AI SDK Conversion (Reverse)
// ============================================================================

/**
 * Convert Block array back to AI SDK Message
 *
 * This is the reverse operation, needed when we want to:
 * - Re-initialize AI SDK with our message history
 * - Edit/regenerate messages
 * - Share conversation with AI SDK
 *
 * @param blocks - Array of blocks from our system
 * @param role - Message role (user/assistant)
 * @returns AI SDK Message
 *
 * @example
 * ```typescript
 * const blocks = message.blocks
 * const aiMessage = blocksToAIMessage(blocks, 'assistant')
 * // Use with setMessages() from useChat
 * ```
 */
export function blocksToAIMessage(
  blocks: Block[],
  role: 'user' | 'assistant' | 'system' = 'assistant'
): AIMessage {
  if (blocks.length === 0) {
    throw new Error('Cannot convert empty block array to AIMessage')
  }

  const messageId = blocks[0].messageId
  const createdAt = new Date(blocks[0].createdAt)

  // Reconstruct content from text blocks
  const textBlocks = blocks.filter(b =>
    b.type === 'text' ||
    b.type === 'code' ||
    b.type === 'command'
  )

  const content = textBlocks
    .sort((a, b) => a.order - b.order)
    .map(formatBlockContent)
    .join('\n\n')

  // Reconstruct tool invocations
  const toolInvocations = blocks
    .filter(b => b.metadata.toolCallId)
    .map(blockToToolInvocation)

  return {
    id: messageId,
    role,
    content,
    createdAt,
    ...(toolInvocations.length > 0 && { toolInvocations }),
  }
}

/**
 * Format a block's content for AI SDK message
 */
function formatBlockContent(block: Block): string {
  switch (block.type) {
    case 'text':
      return block.content

    case 'code':
      return `\`\`\`${block.metadata.language || ''}\n${block.content}\n\`\`\``

    case 'command':
      return `\`\`\`bash\n${block.content}\n\`\`\``

    case 'diff':
      return `\`\`\`diff\n${block.content}\n\`\`\``

    default:
      return block.content
  }
}

/**
 * Convert a block with tool metadata back to ToolInvocation
 */
function blockToToolInvocation(block: Block): ToolInvocation {
  const toolName = block.metadata.toolName || 'unknown'
  const toolCallId = block.metadata.toolCallId || nanoid()

  // Parse args from content (best effort)
  let args: Record<string, unknown> = {}
  try {
    const jsonMatch = block.content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      args = JSON.parse(jsonMatch[0])
    }
  } catch {
    // If parsing fails, use empty args
  }

  // Determine state based on metadata
  const state = block.metadata.exitCode !== undefined ? 'result' : 'call'

  const baseInvocation: ToolInvocation = {
    toolCallId,
    toolName,
    args,
    state,
  }

  if (state === 'result') {
    return {
      ...baseInvocation,
      state: 'result',
      result: block.metadata.executedAt
        ? 'Execution completed'
        : undefined,
    } as ToolInvocation
  }

  return baseInvocation
}

/**
 * Convert our Message (with Blocks) to AI SDK Message
 *
 * Convenience function for single message conversion.
 */
export function messageToAIMessage(message: Message): AIMessage {
  if (message.blocks && message.blocks.length > 0) {
    return blocksToAIMessage(message.blocks, message.role)
  }

  // Fallback: no blocks, just use raw content
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: new Date(message.timestamp),
  }
}

/**
 * Convert multiple Messages to AI SDK format
 *
 * Useful when initializing useChat with existing conversation.
 *
 * @example
 * ```typescript
 * const existingMessages = await loadMessages(conversationId)
 * const aiMessages = messagesToAIMessages(existingMessages)
 * const { messages } = useChat({ initialMessages: aiMessages })
 * ```
 */
export function messagesToAIMessages(messages: Message[]): AIMessage[] {
  return messages.map(messageToAIMessage)
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Merge AI SDK message updates with existing blocks
 *
 * During streaming, AI SDK sends partial messages. This function helps
 * merge the updates without losing block metadata.
 *
 * @param existingBlocks - Current blocks for the message
 * @param updatedAIMessage - New message data from AI SDK
 * @returns Updated block array
 */
export function mergeMessageUpdate(
  existingBlocks: Block[],
  updatedAIMessage: AIMessage,
  conversationId: string
): Block[] {
  const newBlocks = aiMessageToBlocks(updatedAIMessage, conversationId)

  // Simple merge strategy: replace all blocks
  // Future: Could be smarter about preserving user interactions (bookmarks, etc)
  return newBlocks
}

/**
 * Extract text content from blocks (for search, preview, etc.)
 */
export function blocksToText(blocks: Block[]): string {
  return blocks
    .filter(b => b.type === 'text')
    .map(b => b.content)
    .join('\n\n')
}

/**
 * Count tokens in blocks (approximate)
 * Uses a simple heuristic: ~4 chars per token
 */
export function estimateBlockTokens(blocks: Block[]): number {
  const totalChars = blocks.reduce((sum, block) => sum + block.content.length, 0)
  return Math.ceil(totalChars / 4)
}

// ============================================================================
// Type Exports
// ============================================================================

export type {
  AIMessage,
  ToolInvocation,
}
