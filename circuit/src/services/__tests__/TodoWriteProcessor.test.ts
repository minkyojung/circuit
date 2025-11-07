/**
 * Tests for TodoWriteProcessor Service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TodoWriteProcessor } from '../TodoWriteProcessor'
import type { Message } from '@/types/conversation'
import type { TodoDraft } from '@/types/todo'
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
  convertClaudeTodosToDrafts: vi.fn(),
  calculateOverallComplexity: vi.fn(() => 'moderate'),
  calculateTotalTime: vi.fn(() => 120),
}))

import {
  extractTodoWriteFromBlocks,
  extractPlanFromText,
  convertClaudeTodosToDrafts,
} from '@/lib/planModeUtils'

describe('TodoWriteProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
        status: 'pending',
        complexity: 'simple',
        priority: 'medium',
        estimatedDuration: 30,
        order: 0,
        depth: 0,
      },
    ],
  }

  const mockTodoDrafts: TodoDraft[] = [
    {
      content: 'Task 1',
      activeForm: 'Doing Task 1',
      status: 'pending',
      complexity: 'simple',
      priority: 'medium',
      estimatedDuration: 30,
      order: 0,
      depth: 0,
    },
  ]

  describe('processTodoWrite', () => {
    it('should return early if PLAN_MODE feature is disabled', async () => {
      const { FEATURES } = await import('@/config/features')
      FEATURES.PLAN_MODE = false

      const onMessageUpdate = vi.fn()

      const result = await TodoWriteProcessor.processTodoWrite({
        assistantMessage: mockAssistantMessage,
        assistantMessageId: 'assistant-msg-1',
        blocks: [],
        responseMessage: 'Response',
        currentThinkingMode: 'plan',
        workspacePath: '/workspace',
        onMessageUpdate,
      })

      expect(result).toEqual({
        hasTodoWrite: false,
        todoResult: null,
        displayMode: null,
      })

      FEATURES.PLAN_MODE = true
    })

    it('should return false if no TodoWrite found', async () => {
      const onMessageUpdate = vi.fn()
      vi.mocked(extractTodoWriteFromBlocks).mockReturnValue(null)
      vi.mocked(extractPlanFromText).mockReturnValue(null)

      const result = await TodoWriteProcessor.processTodoWrite({
        assistantMessage: mockAssistantMessage,
        assistantMessageId: 'assistant-msg-1',
        blocks: [],
        responseMessage: 'No todos',
        currentThinkingMode: 'normal',
        workspacePath: '/workspace',
        onMessageUpdate,
      })

      expect(result).toEqual({
        hasTodoWrite: false,
        todoResult: null,
        displayMode: null,
      })
    })

    it('should extract TodoWrite from blocks successfully', async () => {
      const onMessageUpdate = vi.fn()
      vi.mocked(extractTodoWriteFromBlocks).mockReturnValue(mockTodoWriteData)
      vi.mocked(convertClaudeTodosToDrafts).mockReturnValue(mockTodoDrafts)
      ipcRendererMock.invoke.mockResolvedValue({ success: true })

      const result = await TodoWriteProcessor.processTodoWrite({
        assistantMessage: mockAssistantMessage,
        assistantMessageId: 'assistant-msg-1',
        blocks: [{ type: 'command', content: 'todos' }],
        responseMessage: 'Response',
        currentThinkingMode: 'normal',
        workspacePath: '/workspace',
        onMessageUpdate,
      })

      expect(result.hasTodoWrite).toBe(true)
      expect(result.todoResult).toBeDefined()
      expect(result.todoResult?.todos).toEqual(mockTodoDrafts)
      expect(extractTodoWriteFromBlocks).toHaveBeenCalled()
      expect(extractPlanFromText).not.toHaveBeenCalled() // Should not fallback
    })

    it('should fallback to text extraction if blocks extraction fails', async () => {
      const onMessageUpdate = vi.fn()
      vi.mocked(extractTodoWriteFromBlocks).mockReturnValue(null)
      vi.mocked(extractPlanFromText).mockReturnValue(mockTodoWriteData)
      vi.mocked(convertClaudeTodosToDrafts).mockReturnValue(mockTodoDrafts)
      ipcRendererMock.invoke.mockResolvedValue({ success: true })

      const result = await TodoWriteProcessor.processTodoWrite({
        assistantMessage: mockAssistantMessage,
        assistantMessageId: 'assistant-msg-1',
        blocks: [],
        responseMessage: 'Response with todos',
        currentThinkingMode: 'normal',
        workspacePath: '/workspace',
        onMessageUpdate,
      })

      expect(result.hasTodoWrite).toBe(true)
      expect(extractPlanFromText).toHaveBeenCalledWith('Response with todos')
    })

    it('should display in sidebar for Plan Mode', async () => {
      const onMessageUpdate = vi.fn()
      vi.mocked(extractTodoWriteFromBlocks).mockReturnValue(mockTodoWriteData)
      vi.mocked(convertClaudeTodosToDrafts).mockReturnValue(mockTodoDrafts)

      // Mock file reading (for syncTodoStatus)
      ipcRendererMock.invoke.mockImplementation((channel: string) => {
        if (channel === 'workspace:read-file') {
          return Promise.resolve({ success: false }) // No todos.json
        }
        return Promise.resolve({ success: true })
      })

      const result = await TodoWriteProcessor.processTodoWrite({
        assistantMessage: mockAssistantMessage,
        assistantMessageId: 'assistant-msg-1',
        blocks: [{ type: 'command', content: 'todos' }],
        responseMessage: 'Response',
        currentThinkingMode: 'plan',
        workspacePath: '/workspace',
        onMessageUpdate,
      })

      expect(result.displayMode).toBe('plan')

      // Should update message with planResult
      expect(onMessageUpdate).toHaveBeenCalledWith('assistant-msg-1', {
        metadata: expect.objectContaining({
          planResult: expect.any(Object),
          hasPendingPlan: true,
        }),
      })

      // Should save to database
      expect(ipcRendererMock.invoke).toHaveBeenCalledWith(
        'message:save',
        expect.objectContaining({
          metadata: expect.objectContaining({
            planResult: expect.any(Object),
            hasPendingPlan: true,
          }),
        })
      )
    })

    it('should display inline for Normal Mode', async () => {
      const onMessageUpdate = vi.fn()
      vi.mocked(extractTodoWriteFromBlocks).mockReturnValue(mockTodoWriteData)
      vi.mocked(convertClaudeTodosToDrafts).mockReturnValue(mockTodoDrafts)
      ipcRendererMock.invoke.mockResolvedValue({ success: true })

      const result = await TodoWriteProcessor.processTodoWrite({
        assistantMessage: mockAssistantMessage,
        assistantMessageId: 'assistant-msg-1',
        blocks: [{ type: 'command', content: 'todos' }],
        responseMessage: 'Response',
        currentThinkingMode: 'normal',
        workspacePath: '/workspace',
        onMessageUpdate,
      })

      expect(result.displayMode).toBe('inline')

      // Should update message with todoWriteResult (not planResult)
      expect(onMessageUpdate).toHaveBeenCalledWith('assistant-msg-1', {
        metadata: expect.objectContaining({
          todoWriteResult: expect.any(Object),
        }),
      })

      // Should NOT have hasPendingPlan
      expect(onMessageUpdate).not.toHaveBeenCalledWith(
        'assistant-msg-1',
        expect.objectContaining({
          metadata: expect.objectContaining({
            hasPendingPlan: true,
          }),
        })
      )
    })

    it('should handle empty todos array as no TodoWrite', async () => {
      const onMessageUpdate = vi.fn()
      vi.mocked(extractTodoWriteFromBlocks).mockReturnValue({
        todos: [], // Empty
      })

      const result = await TodoWriteProcessor.processTodoWrite({
        assistantMessage: mockAssistantMessage,
        assistantMessageId: 'assistant-msg-1',
        blocks: [],
        responseMessage: 'Response',
        currentThinkingMode: 'normal',
        workspacePath: '/workspace',
        onMessageUpdate,
      })

      expect(result.hasTodoWrite).toBe(false)
    })

    it('should sync todo status in Plan Mode when todos.json exists', async () => {
      const onMessageUpdate = vi.fn()
      vi.mocked(extractTodoWriteFromBlocks).mockReturnValue({
        todos: [
          {
            content: 'Task 1',
            status: 'completed', // Changed status
          },
        ],
      })
      vi.mocked(convertClaudeTodosToDrafts).mockReturnValue(mockTodoDrafts)

      // Mock file operations
      const mockTodosFile = {
        todos: [
          {
            id: 'todo-1',
            content: 'Task 1',
            status: 'pending',
          },
        ],
      }

      ipcRendererMock.invoke.mockImplementation((channel: string, ...args: any[]) => {
        if (channel === 'workspace:read-file') {
          return Promise.resolve({
            success: true,
            content: JSON.stringify(mockTodosFile),
          })
        }
        if (channel === 'todos:update-status') {
          return Promise.resolve({ success: true })
        }
        if (channel === 'workspace:write-file') {
          return Promise.resolve({ success: true })
        }
        return Promise.resolve({ success: true })
      })

      await TodoWriteProcessor.processTodoWrite({
        assistantMessage: mockAssistantMessage,
        assistantMessageId: 'assistant-msg-1',
        blocks: [],
        responseMessage: 'Response',
        currentThinkingMode: 'plan',
        workspacePath: '/workspace',
        onMessageUpdate,
      })

      // Should read todos.json
      expect(ipcRendererMock.invoke).toHaveBeenCalledWith(
        'workspace:read-file',
        '/workspace',
        '.circuit/todos.json'
      )

      // Should update todo status in database
      expect(ipcRendererMock.invoke).toHaveBeenCalledWith(
        'todos:update-status',
        expect.objectContaining({
          todoId: 'todo-1',
          status: 'completed',
          completedAt: expect.any(Number),
        })
      )

      // Should write updated todos.json
      expect(ipcRendererMock.invoke).toHaveBeenCalledWith(
        'workspace:write-file',
        '/workspace',
        '.circuit/todos.json',
        expect.stringContaining('"status": "completed"')
      )
    })

    it('should create correct todoResult with metadata', async () => {
      const onMessageUpdate = vi.fn()
      vi.mocked(extractTodoWriteFromBlocks).mockReturnValue(mockTodoWriteData)
      vi.mocked(convertClaudeTodosToDrafts).mockReturnValue(mockTodoDrafts)
      ipcRendererMock.invoke.mockResolvedValue({ success: true })

      const result = await TodoWriteProcessor.processTodoWrite({
        assistantMessage: mockAssistantMessage,
        assistantMessageId: 'assistant-msg-1',
        blocks: [],
        responseMessage: 'Response',
        currentThinkingMode: 'plan',
        workspacePath: '/workspace',
        onMessageUpdate,
      })

      expect(result.todoResult).toEqual({
        todos: mockTodoDrafts,
        complexity: 'moderate',
        estimatedTotalTime: 120,
        confidence: 0.95,
        reasoning: 'Claude analyzed codebase and created detailed plan in Plan Mode',
      })
    })
  })
})
