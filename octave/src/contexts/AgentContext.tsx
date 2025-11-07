/**
 * Agent Context - State Management
 *
 * Manages agent state and IPC communication for background agent workers
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'

// @ts-ignore
const ipcRenderer = window.electron.ipcRenderer;

interface AgentState {
  todoId: string
  state: 'running' | 'completed' | 'failed' | 'cancelled'
  progress: number
  currentTask: string
  error?: string
}

interface AgentContextValue {
  agents: Map<string, AgentState>
  startAgent: (todoId: string, workspaceId?: string, relevantFiles?: string[]) => Promise<void>
  cancelAgent: (todoId: string) => Promise<void>
  getAgentState: (todoId: string) => AgentState | undefined
}

const AgentContext = createContext<AgentContextValue | undefined>(undefined)

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const [agents, setAgents] = useState<Map<string, AgentState>>(new Map())

  // IPC Event Listeners
  useEffect(() => {
    console.log('[AgentContext] Setting up IPC listeners')

    // Agent started
    const handleAgentStarted = (_event: any, data: { todoId: string }) => {
      console.log('[AgentContext] Agent started:', data.todoId)
      setAgents(prev => {
        const next = new Map(prev)
        next.set(data.todoId, {
          todoId: data.todoId,
          state: 'running',
          progress: 0,
          currentTask: 'Starting...'
        })
        return next
      })
    }

    // Agent completed
    const handleAgentCompleted = (_event: any, data: { todoId: string }) => {
      console.log('[AgentContext] Agent completed:', data.todoId)
      setAgents(prev => {
        const next = new Map(prev)
        next.set(data.todoId, {
          todoId: data.todoId,
          state: 'completed',
          progress: 100,
          currentTask: 'Completed'
        })
        return next
      })

      // Auto-remove after 3 seconds
      setTimeout(() => {
        setAgents(prev => {
          const next = new Map(prev)
          next.delete(data.todoId)
          return next
        })
      }, 3000)
    }

    // Agent failed
    const handleAgentFailed = (_event: any, data: {
      todoId: string
      error: { message: string }
    }) => {
      console.error('[AgentContext] Agent failed:', data.todoId, data.error)
      setAgents(prev => {
        const next = new Map(prev)
        next.set(data.todoId, {
          todoId: data.todoId,
          state: 'failed',
          progress: 0,
          currentTask: 'Failed',
          error: data.error.message
        })
        return next
      })
    }

    // Agent cancelled
    const handleAgentCancelled = (_event: any, data: { todoId: string }) => {
      console.log('[AgentContext] Agent cancelled:', data.todoId)
      setAgents(prev => {
        const next = new Map(prev)
        next.delete(data.todoId)
        return next
      })
    }

    ipcRenderer.on('agent:started', handleAgentStarted)
    ipcRenderer.on('agent:completed', handleAgentCompleted)
    ipcRenderer.on('agent:failed', handleAgentFailed)
    ipcRenderer.on('agent:cancelled', handleAgentCancelled)

    return () => {
      console.log('[AgentContext] Cleaning up IPC listeners')
      ipcRenderer.removeListener('agent:started', handleAgentStarted)
      ipcRenderer.removeListener('agent:completed', handleAgentCompleted)
      ipcRenderer.removeListener('agent:failed', handleAgentFailed)
      ipcRenderer.removeListener('agent:cancelled', handleAgentCancelled)
    }
  }, [])

  // Start agent
  const startAgent = useCallback(async (
    todoId: string,
    workspaceId?: string,
    relevantFiles?: string[]
  ) => {
    console.log('[AgentContext] Starting agent for todo:', todoId)

    try {
      const result = await ipcRenderer.invoke('agent:start', {
        todoId,
        workspaceId,
        relevantFiles: relevantFiles || []
      })

      if (!result.success) {
        throw new Error(result.error || 'Failed to start agent')
      }

      console.log('[AgentContext] Agent start request successful')
    } catch (error) {
      console.error('[AgentContext] Failed to start agent:', error)
      throw error
    }
  }, [])

  // Cancel agent
  const cancelAgent = useCallback(async (todoId: string) => {
    console.log('[AgentContext] Cancelling agent for todo:', todoId)

    try {
      const result = await ipcRenderer.invoke('agent:cancel', todoId)

      if (!result.success) {
        throw new Error(result.error || 'Failed to cancel agent')
      }

      console.log('[AgentContext] Agent cancelled successfully')
    } catch (error) {
      console.error('[AgentContext] Failed to cancel agent:', error)
      throw error
    }
  }, [])

  // Get agent state
  const getAgentState = useCallback((todoId: string): AgentState | undefined => {
    return agents.get(todoId)
  }, [agents])

  return (
    <AgentContext.Provider value={{ agents, startAgent, cancelAgent, getAgentState }}>
      {children}
    </AgentContext.Provider>
  )
}

export function useAgent() {
  const context = useContext(AgentContext)
  if (!context) {
    throw new Error('useAgent must be used within AgentProvider')
  }
  return context
}
