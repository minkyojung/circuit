import { useState, useEffect, useCallback } from 'react'

/**
 * Panel States
 */
export type PeekPanelState = 'hidden' | 'dot' | 'compact' | 'expanded'

/**
 * Test Result Data
 */
export interface TestResultData {
  type: 'test-result'
  status: 'running' | 'success' | 'failure'
  passed?: number
  failed?: number
  total?: number
  duration?: number
  errors?: string[]
}

/**
 * Custom Peek Data
 */
export interface CustomPeekData {
  type: 'custom'
  title: string
  message: string
  variant?: 'info' | 'success' | 'warning' | 'error'
}

/**
 * MCP Activity Item
 */
export interface MCPActivity {
  id: string
  method: string
  success: boolean
  latency?: number
  timestamp: number
  error?: string
  summary?: string  // e.g., "read /path/to/file.ts"
}

/**
 * MCP Server Data
 */
export interface MCPPeekData {
  type: 'mcp'
  serverId: string
  serverName: string
  status: 'starting' | 'running' | 'error' | 'stopped'
  recentActivity: MCPActivity[]
}

/**
 * Peek Data Union Type
 */
export type PeekData = TestResultData | CustomPeekData | MCPPeekData | null

/**
 * Hook for managing the Circuit Peek Panel
 *
 * Features:
 * - Auto-show on test start/complete
 * - Manual show/hide via keyboard/mouse
 * - Auto-dismiss on success (after delay)
 * - Expandable states: dot → compact → expanded
 */
export function usePeekPanel() {
  const [state, setState] = useState<PeekPanelState>('hidden')
  const [data, setData] = useState<PeekData>(null)

  /**
   * Show panel with specific state and data
   */
  const show = useCallback((newState: PeekPanelState, newData?: PeekData) => {
    setState(newState)
    if (newData !== undefined) {
      setData(newData)
    }

    // Notify Electron to resize window
    try {
      const { ipcRenderer } = require('electron')
      ipcRenderer.send('peek:resize', {
        state: newState,
        data: newData || data
      })
    } catch (e) {
      console.warn('IPC not available:', e)
    }
  }, [data])

  /**
   * Hide panel
   * @param clearData - If true, clears the panel data. Default: false (preserves data)
   */
  const hide = useCallback((clearData = false) => {
    setState('hidden')
    if (clearData) {
      setData(null)
    }

    try {
      const { ipcRenderer } = require('electron')
      ipcRenderer.send('peek:resize', {
        state: 'hidden',
        data: clearData ? null : data
      })
    } catch (e) {
      console.warn('IPC not available:', e)
    }
  }, [data])

  /**
   * Expand to next state
   */
  const expand = useCallback(() => {
    const nextState: Record<PeekPanelState, PeekPanelState> = {
      'hidden': 'dot',
      'dot': 'compact',
      'compact': 'expanded',
      'expanded': 'expanded'
    }
    show(nextState[state])
  }, [state, show])

  /**
   * Collapse to previous state
   */
  const collapse = useCallback(() => {
    const prevState: Record<PeekPanelState, PeekPanelState> = {
      'hidden': 'hidden',
      'dot': 'hidden',
      'compact': 'dot',
      'expanded': 'compact'
    }
    show(prevState[state])
  }, [state, show])

  /**
   * Listen for test events from Electron main process
   */
  useEffect(() => {
    try {
      const { ipcRenderer } = require('electron')

      // Test started → show dot
      const handleTestStart = () => {
        show('dot', {
          type: 'test-result',
          status: 'running'
        })
      }

      // Test completed → show compact with results
      const handleTestComplete = (event: any, result: any) => {
        const testData: TestResultData = {
          type: 'test-result',
          status: result.success ? 'success' : 'failure',
          passed: result.passed,
          failed: result.failed,
          total: result.total,
          duration: result.duration,
          errors: result.errors
        }

        show('compact', testData)

        // Auto-dismiss after 5s if success
        if (result.success) {
          setTimeout(() => {
            if (state !== 'expanded') {
              hide()
            }
          }, 5000)
        }
      }

      ipcRenderer.on('test:started', handleTestStart)
      ipcRenderer.on('test:completed', handleTestComplete)

      return () => {
        ipcRenderer.removeListener('test:started', handleTestStart)
        ipcRenderer.removeListener('test:completed', handleTestComplete)
      }
    } catch (e) {
      console.warn('IPC not available in test listener:', e)
    }
  }, [show, hide, state])

  /**
   * Listen for MCP events from Electron main process
   */
  useEffect(() => {
    try {
      const { ipcRenderer } = require('electron')

      // Track MCP activity for each server
      const mcpActivity = new Map<string, MCPActivity[]>()

      const handleMCPEvent = (event: any, payload: any) => {
        const { serverId, type, message, ...rest } = payload

        // Handle different MCP event types
        if (type === 'initialized') {
          // Server just started
          const mcpData: MCPPeekData = {
            type: 'mcp',
            serverId,
            serverName: rest.serverInfo?.name || serverId,
            status: 'running',
            recentActivity: []
          }
          show('dot', mcpData)

          // Auto-expand to compact after 2s
          setTimeout(() => {
            if (state === 'dot') {
              show('compact', mcpData)
            }
          }, 2000)
        } else if (type === 'message' && message) {
          // Track activity
          if (message.type === 'request' || message.type === 'response') {
            const activity: MCPActivity = {
              id: message.id,
              method: message.method || 'unknown',
              success: message.type === 'response' && !message.data?.error,
              latency: message.latency,
              timestamp: message.timestamp,
              error: message.data?.error?.message,
              summary: extractSummary(message)
            }

            // Update activity list for this server
            const activities = mcpActivity.get(serverId) || []
            activities.unshift(activity)
            mcpActivity.set(serverId, activities.slice(0, 5)) // Keep last 5

            // Get current data if it's MCP type
            const currentData = data as MCPPeekData
            if (currentData?.type === 'mcp' && currentData.serverId === serverId) {
              const updatedData: MCPPeekData = {
                ...currentData,
                recentActivity: mcpActivity.get(serverId) || []
              }

              // Show compact on new activity
              if (state === 'hidden' || state === 'dot') {
                show('compact', updatedData)
              } else {
                // Update data without changing state
                setData(updatedData)
              }

              // Auto-dismiss after 3s if success
              if (activity.success && state !== 'expanded') {
                setTimeout(() => {
                  if (state === 'compact') {
                    show('dot', updatedData)
                  }
                }, 3000)
              } else if (!activity.success) {
                // Expand on error
                show('expanded', updatedData)
              }
            }
          }
        } else if (type === 'status' && rest.status === 'stopped') {
          // Server stopped - clear data since server is gone
          if (data && (data as MCPPeekData).type === 'mcp' && (data as MCPPeekData).serverId === serverId) {
            hide(true)  // clearData = true
          }
        }
      }

      // Helper to extract summary from message
      const extractSummary = (message: any): string | undefined => {
        if (message.method?.includes('tools/')) {
          const toolName = message.method.replace('tools/', '')
          if (message.data?.path) {
            return `${toolName}: ${message.data.path}`
          }
          return toolName
        }
        return undefined
      }

      ipcRenderer.on('mcp-event', handleMCPEvent)

      return () => {
        ipcRenderer.removeListener('mcp-event', handleMCPEvent)
      }
    } catch (e) {
      console.warn('IPC not available for MCP events:', e)
    }
  }, [show, hide, state, data])

  /**
   * Keyboard shortcuts and IPC toggle events
   */
  useEffect(() => {
    // Local keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to hide
      if (e.key === 'Escape' && state !== 'hidden') {
        e.preventDefault()
        hide()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    // Global shortcut from main process (Cmd+T)
    try {
      const { ipcRenderer } = require('electron')

      const handleToggle = () => {
        if (state === 'hidden') {
          // Show with default message if no data
          const defaultData: CustomPeekData = {
            type: 'custom',
            title: 'Circuit Peek',
            message: 'Waiting for activity... Start an MCP server or run tests.',
            variant: 'info'
          }
          show('compact', data || defaultData)
        } else {
          hide()
        }
      }

      const handleShow = () => {
        // Show with default message if no data
        const defaultData: CustomPeekData = {
          type: 'custom',
          title: 'Circuit Peek',
          message: 'Waiting for activity... Start an MCP server or run tests.',
          variant: 'info'
        }
        show('compact', data || defaultData)
      }

      ipcRenderer.on('peek:toggle', handleToggle)
      ipcRenderer.on('peek:show', handleShow)

      return () => {
        window.removeEventListener('keydown', handleKeyDown)
        ipcRenderer.removeListener('peek:toggle', handleToggle)
        ipcRenderer.removeListener('peek:show', handleShow)
      }
    } catch (e) {
      console.warn('IPC not available for shortcuts:', e)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [state, show, hide])

  return {
    state,
    data,
    show,
    hide,
    expand,
    collapse
  }
}
