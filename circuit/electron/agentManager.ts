/**
 * Agent Manager - MVP Version
 *
 * Manages multiple Agent Workers
 * Phase 1: Basic management only (no queue yet)
 */

import { AgentWorker, AgentContext, AgentResult, AgentStatus } from './agentWorker'
import type { ConversationStorage, Todo } from './conversationStorage'
import { EventBroadcaster } from './eventBroadcaster'

/**
 * Agent Manager Singleton
 *
 * Manages lifecycle of multiple agents
 */
export class AgentManager {
  private static instance: AgentManager | null = null
  private activeAgents: Map<string, AgentWorker> = new Map()
  private maxConcurrent = 2  // Phase 1: Hardcoded
  private storage: ConversationStorage | null = null

  private constructor() {
    console.log('[AgentManager] Instance created')
  }

  static getInstance(): AgentManager {
    if (!AgentManager.instance) {
      AgentManager.instance = new AgentManager()
    }
    return AgentManager.instance
  }

  /**
   * Set storage instance (called from main.cjs)
   */
  setStorage(storage: ConversationStorage): void {
    this.storage = storage
  }

  /**
   * Start an agent for a todo
   * Phase 1: Simple version, no queue
   */
  async startAgent(todo: Todo, context: AgentContext): Promise<void> {
    console.log(`[AgentManager] Start request for todo: ${todo.id}`)

    // Atomic check and reserve: prevent race condition
    if (this.activeAgents.has(todo.id)) {
      throw new Error(`Agent for todo ${todo.id} is already running`)
    }

    // Reserve slot immediately (atomic operation)
    const worker = new AgentWorker(todo.id, context)
    this.activeAgents.set(todo.id, worker)

    // Phase 1: No concurrent limit check yet
    // Execute the agent
    try {
      await this.executeAgent(todo, context, worker)
    } catch (error) {
      // Clean up on failure to start
      this.activeAgents.delete(todo.id)
      throw error
    }
  }

  /**
   * Execute agent (internal)
   * Worker must already be in activeAgents map
   */
  private async executeAgent(todo: Todo, context: AgentContext, worker: AgentWorker): Promise<void> {
    // Verify worker is in map (sanity check)
    if (!this.activeAgents.has(todo.id)) {
      throw new Error(`Race condition detected: worker not in activeAgents for ${todo.id}`)
    }

    try {
      // Update todo status: pending → in_progress
      if (this.storage) {
        this.storage.updateTodoStatus(todo.id, 'in_progress', 0)
      }

      console.log(`[AgentManager] Executing agent for todo: ${todo.id}`)

      // Broadcast started event
      EventBroadcaster.broadcastAgentStarted(todo.id)

      // Execute
      const result = await worker.execute()

      // Success
      await this.handleAgentSuccess(todo, result)

    } catch (error) {
      // Failure
      await this.handleAgentFailure(todo, error as Error)

    } finally {
      // Cleanup
      this.activeAgents.delete(todo.id)
      console.log(`[AgentManager] Cleaned up agent for todo: ${todo.id}`)
    }
  }

  /**
   * Handle agent success
   */
  private async handleAgentSuccess(todo: Todo, result: AgentResult): Promise<void> {
    console.log(`[AgentManager] Agent completed: ${todo.id}`)

    // Update todo status
    if (this.storage) {
      this.storage.updateTodoStatus(todo.id, 'completed', 100, Date.now())

      // Add summary message to conversation
      const message = {
        id: this.generateId(),
        conversationId: todo.conversationId,
        role: 'assistant' as const,
        content: this.formatAgentResult(todo, result),
        timestamp: Date.now(),
        metadata: JSON.stringify({
          agentGenerated: true,
          todoId: todo.id,
          duration: result.duration
        })
      }
      this.storage.saveMessage(message)
    }

    // Broadcast completed event
    EventBroadcaster.broadcastAgentCompleted(todo.id, result)

    console.log(`[AgentManager] Agent result saved for todo: ${todo.id}`)
  }

  /**
   * Handle agent failure
   */
  private async handleAgentFailure(todo: Todo, error: Error): Promise<void> {
    console.error(`[AgentManager] Agent failed: ${todo.id}`, error)

    // Update todo status
    if (this.storage) {
      this.storage.updateTodoStatus(todo.id, 'failed', undefined, Date.now())
    }

    // Broadcast failed event
    EventBroadcaster.broadcastAgentFailed(todo.id, {
      message: error.message,
      stack: error.stack
    })
  }

  /**
   * Cancel an agent
   */
  async cancelAgent(todoId: string): Promise<void> {
    const worker = this.activeAgents.get(todoId)
    if (!worker) {
      console.log(`[AgentManager] No agent running for todo: ${todoId}`)
      return
    }

    console.log(`[AgentManager] Cancelling agent: ${todoId}`)
    worker.cancel()
    this.activeAgents.delete(todoId)

    // Update todo status back to pending
    if (this.storage) {
      this.storage.updateTodoStatus(todoId, 'pending', 0)
    }

    // Broadcast cancelled event
    EventBroadcaster.broadcastAgentCancelled(todoId)
  }

  /**
   * Get agent status
   */
  getAgentStatus(todoId: string): AgentStatus | null {
    const worker = this.activeAgents.get(todoId)
    if (!worker) {
      return null
    }

    return worker.getStatus()
  }

  /**
   * Get all agent statuses
   */
  getAllAgentStatuses(): AgentStatus[] {
    const statuses: AgentStatus[] = []

    for (const [todoId, worker] of this.activeAgents) {
      statuses.push(worker.getStatus())
    }

    return statuses
  }

  /**
   * Format agent result as conversation message
   */
  private formatAgentResult(todo: Todo, result: AgentResult): string {
    return `**Agent completed: ${todo.content}**

**Duration**: ${Math.floor(result.duration / 1000)}s

**Summary**:
${result.summary}

---
_This message was generated by a background agent._`
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  }
}

/**
 * Get singleton instance
 */
export function getAgentManager(): AgentManager {
  return AgentManager.getInstance()
}
