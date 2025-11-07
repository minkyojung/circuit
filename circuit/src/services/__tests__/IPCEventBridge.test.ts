/**
 * Integration Tests for IPCEventBridge Service
 *
 * Tests the 7 IPC event handlers that orchestrate message flow
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { IPCEventBridge } from '../IPCEventBridge'
import type { Message } from '@/types/conversation'
import type { ThinkingStep } from '@/types/thinking'
import type { IPCEventCallbacks, IPCEventDependencies } from '../IPCEventBridge'
import { ipcRendererMock } from '@/test/setup'

// Mock specialized processors
vi.mock('../MessageProcessor', () => ({
  MessageProcessor: {
    processResponse: vi.fn(),
    autoOpenReasoning: vi.fn(),
  },
}))

vi.mock('../PlanModeHandler', () => ({
  PlanModeHandler: {
    validatePlanMode: vi.fn(),
  },
}))

vi.mock('../TodoWriteProcessor', () => ({
  TodoWriteProcessor: {
    processTodoWrite: vi.fn(),
  },
}))

vi.mock('../FileChangeDetector', () => ({
  FileChangeDetector: {
    processFileChanges: vi.fn(() => []),
  },
}))

import { MessageProcessor } from '../MessageProcessor'
import { PlanModeHandler } from '../PlanModeHandler'
import { TodoWriteProcessor } from '../TodoWriteProcessor'
import { FileChangeDetector } from '../FileChangeDetector'

describe('IPCEventBridge', () => {
  const createMockRefs = () => ({
    isMountedRef: { current: true },
    sessionIdRef: { current: 'session-1' },
    conversationIdRef: { current: 'conv-1' },
    workspacePathRef: { current: '/workspace' },
    pendingUserMessageRef: { current: null },
    pendingAssistantMessageIdRef: { current: null },
    thinkingStartTimeRef: { current: 0 },
    currentStepMessageRef: { current: '' },
    thinkingStepsRef: { current: [] },
    thinkingTimerRef: { current: null },
    currentThinkingModeRef: { current: 'normal' as const },
    messageThinkingStepsRef: { current: {} },
  })

  const createMockCallbacks = (): IPCEventCallbacks => ({
    onMessagesUpdate: vi.fn(),
    onMessageAdd: vi.fn(),
    onMessageUpdate: vi.fn(),
    onThinkingStepsUpdate: vi.fn(),
    onThinkingStepAdd: vi.fn(),
    onMessageThinkingStepsUpdate: vi.fn(),
    onCurrentDurationUpdate: vi.fn(),
    onOpenReasoningIdUpdate: vi.fn(),
    onIsSendingUpdate: vi.fn(),
    onIsCancellingUpdate: vi.fn(),
    onPendingAssistantMessageIdUpdate: vi.fn(),
    onFileEdit: vi.fn(),
  })

  const createMockDependencies = (overrides: Partial<IPCEventDependencies> = {}): IPCEventDependencies => {
    const refs = createMockRefs()
    return {
      sessionId: 'session-1',
      conversationId: 'conv-1',
      workspacePath: '/workspace',
      workspaceId: 'workspace-1',
      pendingAssistantMessageId: null,
      thinkingSteps: [],
      ...refs,
      ...overrides,
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })



  describe('registerListeners and unregisterListeners', () => {
    it('should register all IPC listeners', () => {
      const dependencies = createMockDependencies()
      const callbacks = createMockCallbacks()
      const bridge = new IPCEventBridge(dependencies, callbacks)

      bridge.registerListeners()

      // Should register 7 listeners with correct event names
      expect(ipcRendererMock.on).toHaveBeenCalledWith('claude:thinking-start', expect.any(Function))
      expect(ipcRendererMock.on).toHaveBeenCalledWith('claude:milestone', expect.any(Function))
      expect(ipcRendererMock.on).toHaveBeenCalledWith('claude:thinking-complete', expect.any(Function))
      expect(ipcRendererMock.on).toHaveBeenCalledWith('claude:response-complete', expect.any(Function))
      expect(ipcRendererMock.on).toHaveBeenCalledWith('claude:response-error', expect.any(Function))
      expect(ipcRendererMock.on).toHaveBeenCalledWith('claude:message-cancelled', expect.any(Function))
      expect(ipcRendererMock.on).toHaveBeenCalledWith('execute-tasks', expect.any(Function))
    })

    it('should unregister all IPC listeners', () => {
      const dependencies = createMockDependencies()
      const callbacks = createMockCallbacks()
      const bridge = new IPCEventBridge(dependencies, callbacks)

      bridge.unregisterListeners()

      // Should unregister 7 listeners
      expect(ipcRendererMock.removeListener).toHaveBeenCalledWith('claude:thinking-start', expect.any(Function))
      expect(ipcRendererMock.removeListener).toHaveBeenCalledWith('claude:milestone', expect.any(Function))
      expect(ipcRendererMock.removeListener).toHaveBeenCalledWith('claude:thinking-complete', expect.any(Function))
      expect(ipcRendererMock.removeListener).toHaveBeenCalledWith('claude:response-complete', expect.any(Function))
      expect(ipcRendererMock.removeListener).toHaveBeenCalledWith('claude:response-error', expect.any(Function))
      expect(ipcRendererMock.removeListener).toHaveBeenCalledWith('claude:message-cancelled', expect.any(Function))
      expect(ipcRendererMock.removeListener).toHaveBeenCalledWith('execute-tasks', expect.any(Function))
    })
  })
})
