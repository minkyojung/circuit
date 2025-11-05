/**
 * Tests for PlanModeHandler Service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PlanModeHandler } from '../PlanModeHandler'
import type { Message } from '@/types/conversation'
import { ipcRendererMock } from '@/test/setup'

// Mock config/features
vi.mock('@/config/features', () => ({
  FEATURES: {
    PLAN_MODE: true,
  },
}))

// Mock planModeUtils
vi.mock('@/lib/planModeUtils', () => ({
  extractTodoWriteFromBlocks: vi.fn(),
  extractPlanFromText: vi.fn(),
}))

import { extractTodoWriteFromBlocks, extractPlanFromText } from '@/lib/planModeUtils'

describe('PlanModeHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const mockAssistantMessage: Message = {
    id: 'assistant-msg-1',
    conversationId: 'conv-1',
    role: 'assistant',
    content: 'Response content',
    timestamp: Date.now(),
    metadata: {},
  }

  const mockTodoWriteData = {
    todos: [
      {
        content: 'Task 1',
        activeForm: 'Doing Task 1',
        status: 'pending' as const,
        complexity: 'simple' as const,
        priority: 'medium' as const,
        estimatedDuration: 30,
        order: 0,
        depth: 0,
      },
    ],
  }

  describe('validatePlanMode', () => {
    it('should return early if PLAN_MODE feature is disabled', async () => {
      // Temporarily disable PLAN_MODE
      const { FEATURES } = await import('@/config/features')
      FEATURES.PLAN_MODE = false

      const onMessageUpdate = vi.fn()

      const result = await PlanModeHandler.validatePlanMode({
        assistantMessage: mockAssistantMessage,
        assistantMessageId: 'assistant-msg-1',
        blocks: [],
        responseMessage: 'Response',
        currentThinkingMode: 'plan',
        sessionId: 'session-1',
        onMessageUpdate,
      })

      expect(result).toEqual({
        hasPlan: false,
        todoWriteData: null,
        retryTriggered: false,
      })

      // Re-enable for other tests
      FEATURES.PLAN_MODE = true
    })

    it('should return early if not in Plan Mode', async () => {
      const onMessageUpdate = vi.fn()

      const result = await PlanModeHandler.validatePlanMode({
        assistantMessage: mockAssistantMessage,
        assistantMessageId: 'assistant-msg-1',
        blocks: [],
        responseMessage: 'Response',
        currentThinkingMode: 'normal', // Not in plan mode
        sessionId: 'session-1',
        onMessageUpdate,
      })

      expect(result).toEqual({
        hasPlan: false,
        todoWriteData: null,
        retryTriggered: false,
      })

      expect(extractTodoWriteFromBlocks).not.toHaveBeenCalled()
    })

    it('should extract plan from blocks successfully', async () => {
      const onMessageUpdate = vi.fn()
      vi.mocked(extractTodoWriteFromBlocks).mockReturnValue(mockTodoWriteData)

      const result = await PlanModeHandler.validatePlanMode({
        assistantMessage: mockAssistantMessage,
        assistantMessageId: 'assistant-msg-1',
        blocks: [{ type: 'command', content: 'plan data' }],
        responseMessage: 'Response',
        currentThinkingMode: 'plan',
        sessionId: 'session-1',
        onMessageUpdate,
      })

      expect(result).toEqual({
        hasPlan: true,
        todoWriteData: mockTodoWriteData,
        retryTriggered: false,
      })

      expect(extractTodoWriteFromBlocks).toHaveBeenCalledWith([
        { type: 'command', content: 'plan data' },
      ])

      // Should not fallback to text extraction
      expect(extractPlanFromText).not.toHaveBeenCalled()
    })

    it('should fallback to text extraction if blocks extraction fails', async () => {
      const onMessageUpdate = vi.fn()
      vi.mocked(extractTodoWriteFromBlocks).mockReturnValue(null)
      vi.mocked(extractPlanFromText).mockReturnValue(mockTodoWriteData)

      const result = await PlanModeHandler.validatePlanMode({
        assistantMessage: mockAssistantMessage,
        assistantMessageId: 'assistant-msg-1',
        blocks: [],
        responseMessage: 'Plan: Task 1',
        currentThinkingMode: 'plan',
        sessionId: 'session-1',
        onMessageUpdate,
      })

      expect(result).toEqual({
        hasPlan: true,
        todoWriteData: mockTodoWriteData,
        retryTriggered: false,
      })

      expect(extractTodoWriteFromBlocks).toHaveBeenCalled()
      expect(extractPlanFromText).toHaveBeenCalledWith('Plan: Task 1')
    })

    it('should trigger retry when no plan found on first attempt', async () => {
      const onMessageUpdate = vi.fn()
      vi.mocked(extractTodoWriteFromBlocks).mockReturnValue(null)
      vi.mocked(extractPlanFromText).mockReturnValue(null)

      const result = await PlanModeHandler.validatePlanMode({
        assistantMessage: mockAssistantMessage,
        assistantMessageId: 'assistant-msg-1',
        blocks: [],
        responseMessage: 'No plan here',
        currentThinkingMode: 'plan',
        sessionId: 'session-1',
        onMessageUpdate,
      })

      expect(result).toEqual({
        hasPlan: false,
        todoWriteData: null,
        retryTriggered: true,
      })

      // Should update message with retry attempt
      expect(onMessageUpdate).toHaveBeenCalledWith('assistant-msg-1', {
        metadata: {
          planRetryAttempt: 1,
        },
      })

      // Fast-forward setTimeout
      vi.advanceTimersByTime(1000)

      // Should send retry message
      expect(ipcRendererMock.send).toHaveBeenCalledWith(
        'claude:send-message',
        'session-1',
        expect.stringContaining('You are in PLAN MODE'),
        [],
        'plan'
      )
    })

    it('should show error message when retry fails', async () => {
      const onMessageUpdate = vi.fn()
      vi.mocked(extractTodoWriteFromBlocks).mockReturnValue(null)
      vi.mocked(extractPlanFromText).mockReturnValue(null)

      ipcRendererMock.invoke.mockResolvedValue({ success: true })

      const messageWithRetry: Message = {
        ...mockAssistantMessage,
        metadata: {
          planRetryAttempt: 1, // Already tried once
        },
      }

      const result = await PlanModeHandler.validatePlanMode({
        assistantMessage: messageWithRetry,
        assistantMessageId: 'assistant-msg-1',
        blocks: [],
        responseMessage: 'Still no plan',
        currentThinkingMode: 'plan',
        sessionId: 'session-1',
        onMessageUpdate,
      })

      expect(result).toEqual({
        hasPlan: false,
        todoWriteData: null,
        retryTriggered: false,
      })

      // Should update message with error
      expect(onMessageUpdate).toHaveBeenCalledWith('assistant-msg-1', {
        content: expect.stringContaining('⚠️  **Plan Mode Error**'),
        metadata: expect.objectContaining({
          planGenerationFailed: true,
        }),
      })

      // Should save error message
      expect(ipcRendererMock.invoke).toHaveBeenCalledWith(
        'message:save',
        expect.objectContaining({
          content: expect.stringContaining('⚠️  **Plan Mode Error**'),
          metadata: expect.objectContaining({
            planGenerationFailed: true,
          }),
        })
      )
    })

    it('should handle empty todos array as no plan', async () => {
      const onMessageUpdate = vi.fn()
      vi.mocked(extractTodoWriteFromBlocks).mockReturnValue({
        todos: [], // Empty array
      })

      const result = await PlanModeHandler.validatePlanMode({
        assistantMessage: mockAssistantMessage,
        assistantMessageId: 'assistant-msg-1',
        blocks: [],
        responseMessage: 'Response',
        currentThinkingMode: 'plan',
        sessionId: 'session-1',
        onMessageUpdate,
      })

      // Should trigger retry since empty todos is treated as no plan
      expect(result.retryTriggered).toBe(true)
    })
  })
})
