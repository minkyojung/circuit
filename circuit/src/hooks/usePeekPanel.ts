import { useState, useEffect, useCallback, useRef } from 'react'

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
 * MCP Server Data (Single Server)
 */
export interface MCPPeekData {
  type: 'mcp'
  serverId: string
  serverName: string
  status: 'starting' | 'running' | 'error' | 'stopped'
  recentActivity: MCPActivity[]
}

/**
 * MCP Server State (for multi-server tracking)
 */
export interface MCPServerState {
  serverId: string
  serverName: string
  status: 'starting' | 'running' | 'error' | 'stopped'
  recentActivity: MCPActivity[]
  lastActivityTime: number  // For sorting/priority
}

/**
 * Multi MCP Server Data
 */
export interface MultiMCPPeekData {
  type: 'multi-mcp'
  servers: Record<string, MCPServerState>  // serverId → state
  focusedServerId: string | null            // Currently selected server
  totalActivityCount: number                // Total activity count across all servers
}

/**
 * Deployment/Build Event Data (Vercel, Netlify, etc.)
 */
export interface DeploymentPeekData {
  type: 'deployment'
  source: 'vercel' | 'netlify' | 'github-pages' | 'custom'
  status: 'building' | 'success' | 'failed' | 'cancelled'
  projectName: string
  branch: string
  commit: string
  timestamp: number
  duration?: number
  // For failed builds
  error?: {
    message: string
    file?: string
    line?: number
    code?: string
  }
  // Deep link data
  url?: string
  logUrl?: string
}

/**
 * Git/GitHub Event Data (CI, PR, etc.)
 */
export interface GitPeekData {
  type: 'git'
  eventType: 'push' | 'pr' | 'ci' | 'review'
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled'
  title: string
  branch: string
  commit?: string
  timestamp: number
  // CI-specific
  checks?: {
    name: string
    status: 'pending' | 'running' | 'success' | 'failed'
    conclusion?: string
  }[]
  // Deep link
  url?: string
}

/**
 * Generic Event Data (extensible for future integrations)
 */
export interface GenericEventData {
  type: 'generic'
  category: string  // 'linter', 'formatter', 'security-scan', etc.
  status: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  timestamp: number
  // Optional details
  details?: {
    file?: string
    line?: number
    code?: string
    suggestion?: string
  }
  // Actions
  actions?: {
    label: string
    action: string  // IPC event name or URL
  }[]
}

/**
 * Peek Data Union Type
 */
export type PeekData =
  | TestResultData
  | CustomPeekData
  | MCPPeekData
  | MultiMCPPeekData
  | DeploymentPeekData
  | GitPeekData
  | GenericEventData
  | null

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

  // Track all MCP servers for multi-server support
  const mcpServers = useRef<Record<string, MCPServerState>>({})

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
   * Set focused server (for multi-MCP mode)
   */
  const setFocusedServer = useCallback((serverId: string) => {
    if (data?.type === 'multi-mcp') {
      setData({
        ...data,
        focusedServerId: serverId
      })
    }
  }, [data])

  /**
   * Open detailed view in main window
   */
  const openInWindow = useCallback((targetData?: PeekData) => {
    const dataToOpen = targetData || data
    if (!dataToOpen) return

    try {
      const { ipcRenderer } = require('electron')

      // Send event to main process to open in main window
      ipcRenderer.send('peek:open-in-window', {
        type: dataToOpen.type,
        data: dataToOpen
      })

      // Optionally hide panel after opening
      // hide()
    } catch (e) {
      console.warn('IPC not available for openInWindow:', e)
    }
  }, [data])

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

      // Helper: Extract summary from message
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

      // Helper: Build MultiMCPPeekData from current servers
      const buildMultiMCPData = (): MultiMCPPeekData => {
        const servers = mcpServers.current
        const serverList = Object.values(servers)

        // Calculate total activity count
        const totalActivityCount = serverList.reduce(
          (sum, s) => sum + s.recentActivity.length,
          0
        )

        // Determine focused server (priority: error > user selection > most recent)
        let focusedServerId: string | null = null

        // Check if current data has a focused server
        if (data?.type === 'multi-mcp' && data.focusedServerId) {
          focusedServerId = data.focusedServerId
        } else {
          // Auto-focus: error server first, then most recent activity
          const errorServer = serverList.find(s => s.status === 'error')
          if (errorServer) {
            focusedServerId = errorServer.serverId
          } else if (serverList.length > 0) {
            // Sort by last activity time
            const sorted = [...serverList].sort((a, b) => b.lastActivityTime - a.lastActivityTime)
            focusedServerId = sorted[0].serverId
          }
        }

        return {
          type: 'multi-mcp',
          servers,
          focusedServerId,
          totalActivityCount
        }
      }

      // Helper: Build single MCP data (backward compatibility)
      const buildSingleMCPData = (serverId: string): MCPPeekData => {
        const server = mcpServers.current[serverId]
        return {
          type: 'mcp',
          serverId: server.serverId,
          serverName: server.serverName,
          status: server.status,
          recentActivity: server.recentActivity
        }
      }

      // Main event handler
      const handleMCPEvent = (event: any, payload: any) => {
        const { serverId, type, message, ...rest } = payload

        // 1. Update server state
        if (type === 'initialized') {
          // Server just started
          mcpServers.current[serverId] = {
            serverId,
            serverName: rest.serverInfo?.name || serverId,
            status: 'running',
            recentActivity: [],
            lastActivityTime: Date.now()
          }
        } else if (type === 'message' && message) {
          // Activity event
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

            // Update server's activity list
            const server = mcpServers.current[serverId]
            if (server) {
              server.recentActivity.unshift(activity)
              server.recentActivity = server.recentActivity.slice(0, 5) // Keep last 5
              server.lastActivityTime = Date.now()

              // Note: Individual activity failures don't change server status
              // Server status is only changed by explicit status events from main process
            }
          }
        } else if (type === 'status') {
          // Status update
          const server = mcpServers.current[serverId]
          if (server) {
            server.status = rest.status
            if (rest.status === 'stopped') {
              // Remove stopped server after delay
              setTimeout(() => {
                delete mcpServers.current[serverId]
              }, 1000)
            }
          }
        }

        // 2. Determine UI mode (single vs multi)
        const serverCount = Object.keys(mcpServers.current).length

        if (serverCount === 0) {
          // All servers stopped
          hide(true)
          return
        }

        if (serverCount === 1) {
          // Single server mode (backward compatibility)
          const singleServerId = Object.keys(mcpServers.current)[0]
          const singleData = buildSingleMCPData(singleServerId)

          if (type === 'initialized') {
            show('compact', singleData)
          } else if (type === 'message') {
            const activity = mcpServers.current[singleServerId].recentActivity[0]
            if (activity) {
              if (state === 'hidden' || state === 'dot') {
                show('compact', singleData)
              } else {
                setData(singleData)
              }

              // Auto-dismiss or expand based on result
              if (activity.success && state !== 'expanded') {
                setTimeout(() => {
                  if (state === 'compact') {
                    show('dot', singleData)
                  }
                }, 3000)
              } else if (!activity.success) {
                show('expanded', singleData)
              }
            }
          } else if (type === 'status' && rest.status === 'stopped') {
            hide(true)
          }
        } else {
          // Multi-server mode
          const multiData = buildMultiMCPData()

          if (type === 'initialized') {
            // New server joined
            if (state === 'hidden') {
              show('compact', multiData)
            } else {
              setData(multiData)
            }
          } else if (type === 'message') {
            // Activity update
            const activity = mcpServers.current[serverId]?.recentActivity[0]
            if (activity) {
              if (state === 'hidden' || state === 'dot') {
                show('compact', multiData)
              } else {
                setData(multiData)
              }

              // Expand on error
              if (!activity.success) {
                show('expanded', multiData)
              }
            }
          } else if (type === 'status' && rest.status === 'stopped') {
            // Server stopped - update multi view
            setData(buildMultiMCPData())
          }
        }
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
    collapse,
    setFocusedServer,
    openInWindow
  }
}
