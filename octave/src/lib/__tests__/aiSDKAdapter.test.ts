/**
 * Tests for AI SDK Adapter
 *
 * These tests verify bidirectional conversion between AI SDK types
 * and our Block-based message system.
 */

import { describe, it, expect } from 'vitest'
import type { Message as AIMessage } from 'ai'
import type { Message, Block } from '@/types/conversation'
import {
  aiMessageToBlocks,
  blocksToAIMessage,
  messageToAIMessage,
  messagesToAIMessages,
  aiMessagesToMessages,
  blocksToText,
  estimateBlockTokens,
} from '../aiSDKAdapter'

describe('aiSDKAdapter', () => {
  // ============================================================================
  // AI SDK → Blocks Conversion
  // ============================================================================

  describe('aiMessageToBlocks', () => {
    it('should convert simple text message to blocks', () => {
      const aiMessage: AIMessage = {
        id: 'msg-1',
        role: 'assistant',
        parts: [
          { type: 'text', text: 'Hello, world!' }
        ],
        createdAt: new Date('2024-01-01'),
      }

      const blocks = aiMessageToBlocks(aiMessage, 'conv-1')

      expect(blocks).toHaveLength(1)
      expect(blocks[0].type).toBe('text')
      expect(blocks[0].content).toBe('Hello, world!')
      expect(blocks[0].messageId).toBe('msg-1')
    })

    it('should convert message with code blocks', () => {
      const aiMessage: AIMessage = {
        id: 'msg-2',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: `Here's some code:

\`\`\`typescript
function hello() {
  console.log('Hello!');
}
\`\`\`

That's it!`
          }
        ],
        createdAt: new Date('2024-01-01'),
      }

      const blocks = aiMessageToBlocks(aiMessage, 'conv-1')

      expect(blocks.length).toBeGreaterThan(1)

      const codeBlock = blocks.find(b => b.type === 'code')
      expect(codeBlock).toBeDefined()
      expect(codeBlock?.metadata.language).toBe('typescript')
      expect(codeBlock?.content).toContain('function hello()')
    })

    it('should convert tool invocations to command blocks', () => {
      const aiMessage: AIMessage = {
        id: 'msg-3',
        role: 'assistant',
        parts: [
          { type: 'text', text: 'Let me search for that.' },
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'search',
            state: 'call',
            input: { query: 'test' },
          },
        ],
        createdAt: new Date('2024-01-01'),
      }

      const blocks = aiMessageToBlocks(aiMessage, 'conv-1')

      const toolBlock = blocks.find(b => b.metadata.toolCallId === 'call-1')
      expect(toolBlock).toBeDefined()
      expect(toolBlock?.type).toBe('tool')  // AI SDK adapter creates 'tool' blocks
      expect(toolBlock?.content).toContain('search')
      expect(toolBlock?.content).toContain('test')
    })

    it('should handle tool invocation with result', () => {
      const aiMessage: AIMessage = {
        id: 'msg-4',
        role: 'assistant',
        parts: [
          { type: 'text', text: 'Here are the search results.' },
          {
            type: 'tool-result',
            toolCallId: 'call-2',
            toolName: 'search',
            state: 'output-available',
            input: { query: 'test' },
            output: { items: ['result1', 'result2'] },
          },
        ],
        createdAt: new Date('2024-01-01'),
      }

      const blocks = aiMessageToBlocks(aiMessage, 'conv-1')

      const toolBlock = blocks.find(b => b.metadata.toolCallId === 'call-2')
      expect(toolBlock).toBeDefined()
      // Tool content is formatted as toolName(args), result is in metadata
      expect(toolBlock?.content).toContain('search')
      expect(toolBlock?.metadata.result).toBeDefined()
      expect(toolBlock?.metadata.result).toEqual({ items: ['result1', 'result2'] })
    })

    it('should maintain block order', () => {
      const aiMessage: AIMessage = {
        id: 'msg-5',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: `First paragraph.

\`\`\`js
const x = 1;
\`\`\`

Second paragraph.`
          }
        ],
        createdAt: new Date('2024-01-01'),
      }

      const blocks = aiMessageToBlocks(aiMessage, 'conv-1')

      expect(blocks[0].order).toBe(0)
      expect(blocks[1].order).toBe(1)
      expect(blocks[2].order).toBe(2)
    })
  })

  describe('aiMessagesToMessages', () => {
    it('should convert multiple AI messages', () => {
      const aiMessages: AIMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          parts: [{ type: 'text', text: 'Hello' }],
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          parts: [{ type: 'text', text: 'Hi there!' }],
          createdAt: new Date('2024-01-01'),
        },
      ]

      const messages = aiMessagesToMessages(aiMessages, 'conv-1')

      expect(messages).toHaveLength(2)
      expect(messages[0].role).toBe('user')
      expect(messages[1].role).toBe('assistant')
      expect(messages[0].conversationId).toBe('conv-1')
      expect(messages[1].conversationId).toBe('conv-1')
    })
  })

  // ============================================================================
  // Blocks → AI SDK Conversion
  // ============================================================================

  describe('blocksToAIMessage', () => {
    it('should convert text blocks back to AI message', () => {
      const blocks: Block[] = [
        {
          id: 'block-1',
          messageId: 'msg-1',
          type: 'text',
          content: 'Hello, world!',
          metadata: {},
          order: 0,
          createdAt: new Date('2024-01-01').toISOString(),
        },
      ]

      const aiMessage = blocksToAIMessage(blocks, 'assistant')

      expect(aiMessage.id).toBe('msg-1')
      expect(aiMessage.role).toBe('assistant')
      // AI SDK v5 uses parts array
      expect(aiMessage.parts).toBeDefined()
      expect(aiMessage.parts[0].type).toBe('text')
      expect(aiMessage.parts[0].text).toBe('Hello, world!')
    })

    it('should convert code blocks with proper markdown', () => {
      const blocks: Block[] = [
        {
          id: 'block-1',
          messageId: 'msg-2',
          type: 'text',
          content: 'Here is code:',
          metadata: {},
          order: 0,
          createdAt: new Date('2024-01-01').toISOString(),
        },
        {
          id: 'block-2',
          messageId: 'msg-2',
          type: 'code',
          content: 'const x = 1;',
          metadata: { language: 'javascript' },
          order: 1,
          createdAt: new Date('2024-01-01').toISOString(),
        },
      ]

      const aiMessage = blocksToAIMessage(blocks, 'assistant')

      // AI SDK v5 uses parts array
      expect(aiMessage.parts).toBeDefined()
      expect(aiMessage.parts[0].type).toBe('text')
      expect(aiMessage.parts[0].text).toContain('```javascript')
      expect(aiMessage.parts[0].text).toContain('const x = 1;')
      expect(aiMessage.parts[0].text).toContain('```')
    })

    it('should reconstruct tool invocations from blocks', () => {
      const blocks: Block[] = [
        {
          id: 'block-1',
          messageId: 'msg-3',
          type: 'tool',  // Must be 'tool' type, not 'command'
          content: 'search({"query":"test"})',
          metadata: {
            toolName: 'search',
            toolCallId: 'call-1',
            args: { query: 'test' },
            state: 'input-available',
          },
          order: 0,
          createdAt: new Date('2024-01-01').toISOString(),
        },
      ]

      const aiMessage = blocksToAIMessage(blocks, 'assistant')

      // AI SDK v5 uses parts array, not toolInvocations
      expect(aiMessage.parts).toBeDefined()
      // Tool parts have type 'tool-{toolName}' in AI SDK v5
      const toolParts = aiMessage.parts.filter(p => p.type.startsWith('tool-'))
      expect(toolParts).toHaveLength(1)
      expect(toolParts[0].toolName || toolParts[0].type.replace('tool-', '')).toBe('search')
      expect(toolParts[0].toolCallId).toBe('call-1')
    })

    it('should throw error for empty block array', () => {
      expect(() => blocksToAIMessage([], 'assistant')).toThrow()
    })
  })

  describe('messageToAIMessage', () => {
    it('should convert message with blocks', () => {
      const message: Message = {
        id: 'msg-1',
        conversationId: 'conv-1',
        role: 'assistant',
        content: 'Hello',
        timestamp: Date.now(),
        blocks: [
          {
            id: 'block-1',
            messageId: 'msg-1',
            type: 'text',
            content: 'Hello',
            metadata: {},
            order: 0,
            createdAt: new Date().toISOString(),
          },
        ],
      }

      const aiMessage = messageToAIMessage(message)

      expect(aiMessage.id).toBe('msg-1')
      expect(aiMessage.role).toBe('assistant')
      // AI SDK v5 uses parts array
      expect(aiMessage.parts).toBeDefined()
      expect(aiMessage.parts[0].type).toBe('text')
      expect(aiMessage.parts[0].text).toBe('Hello')
    })

    it('should fallback to raw content when no blocks', () => {
      const message: Message = {
        id: 'msg-2',
        conversationId: 'conv-1',
        role: 'user',
        content: 'Raw content',
        timestamp: Date.now(),
      }

      const aiMessage = messageToAIMessage(message)

      // AI SDK v5 uses parts array even for fallback
      expect(aiMessage.parts).toBeDefined()
      expect(aiMessage.parts[0].type).toBe('text')
      expect(aiMessage.parts[0].text).toBe('Raw content')
    })
  })

  describe('messagesToAIMessages', () => {
    it('should convert multiple messages', () => {
      const messages: Message[] = [
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          role: 'user',
          content: 'Hello',
          timestamp: Date.now(),
          blocks: [
            {
              id: 'block-1',
              messageId: 'msg-1',
              type: 'text',
              content: 'Hello',
              metadata: {},
              order: 0,
              createdAt: new Date().toISOString(),
            },
          ],
        },
        {
          id: 'msg-2',
          conversationId: 'conv-1',
          role: 'assistant',
          content: 'Hi',
          timestamp: Date.now(),
          blocks: [
            {
              id: 'block-2',
              messageId: 'msg-2',
              type: 'text',
              content: 'Hi',
              metadata: {},
              order: 0,
              createdAt: new Date().toISOString(),
            },
          ],
        },
      ]

      const aiMessages = messagesToAIMessages(messages)

      expect(aiMessages).toHaveLength(2)
      expect(aiMessages[0].role).toBe('user')
      expect(aiMessages[1].role).toBe('assistant')
    })
  })

  // ============================================================================
  // Utility Functions
  // ============================================================================

  describe('blocksToText', () => {
    it('should extract text from text blocks only', () => {
      const blocks: Block[] = [
        {
          id: 'block-1',
          messageId: 'msg-1',
          type: 'text',
          content: 'First paragraph',
          metadata: {},
          order: 0,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'block-2',
          messageId: 'msg-1',
          type: 'code',
          content: 'const x = 1;',
          metadata: {},
          order: 1,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'block-3',
          messageId: 'msg-1',
          type: 'text',
          content: 'Second paragraph',
          metadata: {},
          order: 2,
          createdAt: new Date().toISOString(),
        },
      ]

      const text = blocksToText(blocks)

      expect(text).toContain('First paragraph')
      expect(text).toContain('Second paragraph')
      expect(text).not.toContain('const x = 1')
    })
  })

  describe('estimateBlockTokens', () => {
    it('should estimate tokens based on character count', () => {
      const blocks: Block[] = [
        {
          id: 'block-1',
          messageId: 'msg-1',
          type: 'text',
          content: 'A'.repeat(100), // 100 chars ≈ 25 tokens
          metadata: {},
          order: 0,
          createdAt: new Date().toISOString(),
        },
        {
          id: 'block-2',
          messageId: 'msg-1',
          type: 'text',
          content: 'B'.repeat(100), // 100 chars ≈ 25 tokens
          metadata: {},
          order: 1,
          createdAt: new Date().toISOString(),
        },
      ]

      const tokens = estimateBlockTokens(blocks)

      expect(tokens).toBeGreaterThan(0)
      expect(tokens).toBeLessThanOrEqual(200 / 4 + 1) // 200 chars / 4 + buffer
    })
  })

  // ============================================================================
  // Round-trip Tests
  // ============================================================================

  describe('round-trip conversion', () => {
    it('should preserve content through AI → Block → AI conversion', () => {
      const original: AIMessage = {
        id: 'msg-1',
        role: 'assistant',
        parts: [{ type: 'text', text: 'Hello, world!' }],
        createdAt: new Date('2024-01-01'),
      }

      const blocks = aiMessageToBlocks(original, 'conv-1')
      const converted = blocksToAIMessage(blocks, 'assistant')

      // AI SDK v5 uses parts array, not content
      expect(converted.parts).toBeDefined()
      expect(converted.parts[0].type).toBe('text')
      expect(converted.parts[0].text).toBe('Hello, world!')
      expect(converted.role).toBe(original.role)
    })

    it('should preserve code blocks through round-trip', () => {
      const original: AIMessage = {
        id: 'msg-2',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: `Text before

\`\`\`typescript
const x = 1;
\`\`\`

Text after`
          }
        ],
        createdAt: new Date('2024-01-01'),
      }

      const blocks = aiMessageToBlocks(original, 'conv-1')
      const converted = blocksToAIMessage(blocks, 'assistant')

      // AI SDK v5 uses parts array
      expect(converted.parts).toBeDefined()
      expect(converted.parts[0].type).toBe('text')
      // Should contain code block markers
      expect(converted.parts[0].text).toContain('```typescript')
      expect(converted.parts[0].text).toContain('const x = 1;')
    })
  })
})
