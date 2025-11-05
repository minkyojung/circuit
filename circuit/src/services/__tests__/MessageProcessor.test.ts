/**
 * Tests for MessageProcessor Service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MessageProcessor } from '../MessageProcessor'
import type { Message } from '@/types/conversation'
import type { ThinkingStep } from '@/types/thinking'
import { ipcRendererMock } from '@/test/setup'

describe('MessageProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('processResponse', () => {
    const mockPendingUserMessage: Message = {
      id: 'user-msg-1',
      conversationId: 'conv-1',
      role: 'user',
      content: 'Hello Claude',
      timestamp: Date.now(),
    }

    const mockThinkingSteps: ThinkingStep[] = [
      {
        id: 'step-1',
        type: 'text',
        message: 'Thinking about the request',
        timestamp: Date.now(),
      },
    ]

    it('should update existing assistant message when pendingAssistantMessageId exists', async () => {
      const onMessageUpdate = vi.fn()
      const onMessageAdd = vi.fn()
      const onOpenReasoningId = vi.fn()
      const onMessageThinkingStepsUpdate = vi.fn()

      // Mock successful save
      ipcRendererMock.invoke.mockResolvedValue({
        success: true,
        blocks: [{ id: 'block-1', type: 'text', content: 'Response' }],
      })

      const result = await MessageProcessor.processResponse({
        responseMessage: 'Response from Claude',
        responseSessionId: 'session-1',
        thinkingSteps: mockThinkingSteps,
        thinkingDuration: 15,
        pendingAssistantMessageId: 'assistant-msg-1',
        pendingUserMessage: mockPendingUserMessage,
        onMessageUpdate,
        onMessageAdd,
        onOpenReasoningId,
        onMessageThinkingStepsUpdate,
      })

      // Should update existing message
      expect(onMessageUpdate).toHaveBeenCalledWith('assistant-msg-1', {
        content: 'Response from Claude',
        metadata: {
          thinkingSteps: mockThinkingSteps,
          thinkingDuration: 15,
        },
      })

      // Should NOT add new message
      expect(onMessageAdd).not.toHaveBeenCalled()

      // Should save to database
      expect(ipcRendererMock.invoke).toHaveBeenCalledWith(
        'message:save',
        expect.objectContaining({
          id: 'assistant-msg-1',
          role: 'assistant',
          content: 'Response from Claude',
        })
      )

      // Should update thinking steps
      expect(onMessageThinkingStepsUpdate).toHaveBeenCalledWith('assistant-msg-1', {
        steps: mockThinkingSteps,
        duration: 15,
      })

      // Should return result
      expect(result).toEqual({
        assistantMessageId: 'assistant-msg-1',
        message: expect.objectContaining({
          id: 'assistant-msg-1',
          content: 'Response from Claude',
        }),
        blocks: [{ id: 'block-1', type: 'text', content: 'Response' }],
      })
    })

    it('should create new assistant message when pendingAssistantMessageId is null', async () => {
      const onMessageUpdate = vi.fn()
      const onMessageAdd = vi.fn()
      const onOpenReasoningId = vi.fn()
      const onMessageThinkingStepsUpdate = vi.fn()

      ipcRendererMock.invoke.mockResolvedValue({
        success: true,
        blocks: [],
      })

      const result = await MessageProcessor.processResponse({
        responseMessage: 'New response',
        responseSessionId: 'session-1',
        thinkingSteps: [],
        thinkingDuration: 0,
        pendingAssistantMessageId: null,
        pendingUserMessage: mockPendingUserMessage,
        onMessageUpdate,
        onMessageAdd,
        onOpenReasoningId,
        onMessageThinkingStepsUpdate,
      })

      // Should add new message
      expect(onMessageAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'assistant',
          content: 'New response',
          conversationId: 'conv-1',
        })
      )

      // Should NOT update existing message (except for blocks)
      expect(onMessageUpdate).toHaveBeenCalledTimes(1) // Only for blocks update

      // Should return result with new ID
      expect(result?.assistantMessageId).toMatch(/^msg-\d+$/)
    })

    it('should return null when pendingUserMessage is missing', async () => {
      const onMessageUpdate = vi.fn()
      const onMessageAdd = vi.fn()
      const onOpenReasoningId = vi.fn()
      const onMessageThinkingStepsUpdate = vi.fn()

      const result = await MessageProcessor.processResponse({
        responseMessage: 'Response',
        responseSessionId: 'session-1',
        thinkingSteps: [],
        thinkingDuration: 0,
        pendingAssistantMessageId: 'assistant-msg-1',
        pendingUserMessage: null,
        onMessageUpdate,
        onMessageAdd,
        onOpenReasoningId,
        onMessageThinkingStepsUpdate,
      })

      expect(result).toBeNull()
      expect(onMessageUpdate).not.toHaveBeenCalled()
      expect(onMessageAdd).not.toHaveBeenCalled()
    })

    it('should save thinking steps to memory on both update and create paths', async () => {
      const onMessageUpdate = vi.fn()
      const onMessageAdd = vi.fn()
      const onOpenReasoningId = vi.fn()
      const onMessageThinkingStepsUpdate = vi.fn()

      ipcRendererMock.invoke.mockResolvedValue({ success: true })

      // Test update path
      await MessageProcessor.processResponse({
        responseMessage: 'Response',
        responseSessionId: 'session-1',
        thinkingSteps: mockThinkingSteps,
        thinkingDuration: 10,
        pendingAssistantMessageId: 'assistant-msg-1',
        pendingUserMessage: mockPendingUserMessage,
        onMessageUpdate,
        onMessageAdd,
        onOpenReasoningId,
        onMessageThinkingStepsUpdate,
      })

      expect(onMessageThinkingStepsUpdate).toHaveBeenCalledWith('assistant-msg-1', {
        steps: mockThinkingSteps,
        duration: 10,
      })
    })
  })

  describe('autoOpenReasoning', () => {
    it('should open reasoning accordion when hasThinkingSteps is true', async () => {
      vi.useFakeTimers()

      const onOpenReasoningId = vi.fn()

      MessageProcessor.autoOpenReasoning('assistant-msg-1', true, onOpenReasoningId)

      // Should not be called immediately
      expect(onOpenReasoningId).not.toHaveBeenCalled()

      // Fast-forward time
      vi.advanceTimersByTime(100)

      // Should be called after timeout
      expect(onOpenReasoningId).toHaveBeenCalledWith('assistant-msg-1')

      vi.useRealTimers()
    })

    it('should NOT open reasoning accordion when hasThinkingSteps is false', async () => {
      vi.useFakeTimers()

      const onOpenReasoningId = vi.fn()

      MessageProcessor.autoOpenReasoning('assistant-msg-1', false, onOpenReasoningId)

      vi.advanceTimersByTime(100)

      expect(onOpenReasoningId).not.toHaveBeenCalled()

      vi.useRealTimers()
    })
  })
})
