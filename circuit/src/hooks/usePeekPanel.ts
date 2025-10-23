import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Panel States
 * - peek: Tab only visible (60x60, mostly off-screen) - default state
 * - compact: Full content visible (240x60, Cursor-style compact design)
 */
export type PeekPanelState = 'peek' | 'compact'

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
  timestamp?: number
}

/**
 * Custom Peek Data
 */
export interface CustomPeekData {
  type: 'custom'
  title: string
  message: string
  variant?: 'info' | 'success' | 'warning' | 'error'
  timestamp?: number
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
 * GitHub Event Data
 */
export interface GitHubPeekData {
  type: 'github'
  eventType: 'push' | 'pull_request' | 'check_run' | 'review' | 'commit_comment'
  repository: string
  timestamp: number

  // Push events
  push?: {
    ref: string  // branch name
    pusher: string
    commits: Array<{
      sha: string
      message: string
      author: string
    }>
    compareUrl?: string
  }

  // Pull Request events
  pullRequest?: {
    number: number
    title: string
    action: 'opened' | 'closed' | 'reopened' | 'merged' | 'review_requested'
    author: string
    state: 'open' | 'closed'
    merged: boolean
    mergeable?: boolean
    url: string
  }

  // Check Run events (CI/CD)
  checkRun?: {
    name: string
    status: 'queued' | 'in_progress' | 'completed'
    conclusion?: 'success' | 'failure' | 'cancelled' | 'skipped' | 'timed_out'
    branch: string
    commit: string
    detailsUrl?: string
  }

  // Review events
  review?: {
    pullRequestNumber: number
    reviewer: string
    state: 'approved' | 'changes_requested' | 'commented'
    body?: string
  }

  // Commit comment
  commitComment?: {
    commit: string
    author: string
    body: string
    path?: string  // file path if comment on specific file
  }
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
  | GitHubPeekData
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
  const [state, setState] = useState<PeekPanelState>('peek')  // Start with tab visible
  const [data, setData] = useState<PeekData>(null)
  const [autoHideProgress, setAutoHideProgress] = useState<number>(0) // 0-100, for progress bar

  // Track all MCP servers for multi-server support
  const mcpServers = useRef<Record<string, MCPServerState>>({})

  // Track auto-hide timer to prevent stale closures from hiding the panel
  const autoHideTimerRef = useRef<number | null>(null)
  const autoHideIntervalRef = useRef<number | null>(null)

  /**
   * Clear any pending auto-hide timer
   */
  const clearAutoHideTimer = useCallback(() => {
    if (autoHideTimerRef.current) {
      clearTimeout(autoHideTimerRef.current)
      autoHideTimerRef.current = null
    }
    if (autoHideIntervalRef.current) {
      clearInterval(autoHideIntervalRef.current)
      autoHideIntervalRef.current = null
    }
    setAutoHideProgress(0)
  }, [])

  /**
   * Set auto-hide timer (used for success states)
   */
  const setAutoHideTimer = useCallback((delayMs: number) => {
    // Clear any existing timer first
    clearAutoHideTimer()

    // Reset progress
    setAutoHideProgress(0)

    // Update progress bar every 50ms
    const intervalMs = 50
    const totalSteps = delayMs / intervalMs
    let currentStep = 0

    autoHideIntervalRef.current = setInterval(() => {
      currentStep++
      const progress = (currentStep / totalSteps) * 100
      setAutoHideProgress(Math.min(progress, 100))
    }, intervalMs)

    // Set main timer to collapse to peek
    autoHideTimerRef.current = setTimeout(() => {
      // Clear interval
      if (autoHideIntervalRef.current) {
        clearInterval(autoHideIntervalRef.current)
        autoHideIntervalRef.current = null
      }

      // Collapse to peek state
      setState((currentState) => {
        if (currentState === 'compact') {
          try {
            const { ipcRenderer } = window.require('electron')
            ipcRenderer.send('peek:resize', {
              state: 'peek',
              data: null
            })
          } catch (e) {
            console.warn('IPC not available:', e)
          }
          setAutoHideProgress(0)
          return 'peek'
        }
        return currentState
      })
      autoHideTimerRef.current = null
    }, delayMs)
  }, [clearAutoHideTimer])

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
      const { ipcRenderer } = window.require('electron')
      ipcRenderer.send('peek:resize', {
        state: newState,
        data: newData || data
      })
    } catch (e) {
      console.warn('IPC not available:', e)
    }
  }, [data])

  /**
   * Hide panel (collapses to peek state)
   * @param clearData - If true, clears the panel data. Default: false (preserves data)
   */
  const hide = useCallback((clearData = false) => {
    // Clear any pending auto-hide timer
    clearAutoHideTimer()

    if (clearData) {
      setData(null)
    }

    // Collapse to peek instead of hiding
    show('peek')
  }, [clearAutoHideTimer, show])

  /**
   * Expand to compact (show full content)
   */
  const expand = useCallback(() => {
    show('compact')
  }, [show])

  /**
   * Collapse to peek (show tab only)
   */
  const collapse = useCallback(() => {
    show('peek')
  }, [show])

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
      const { ipcRenderer } = window.require('electron')

      const payload = {
        type: dataToOpen.type,
        data: dataToOpen
      }

      // Send event to main process to open in main window
      ipcRenderer.send('peek:open-in-window', payload)

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
      const { ipcRenderer } = window.require('electron')

      // Test started → show peek (tab only)
      const handleTestStart = () => {
        show('peek', {
          type: 'test-result',
          status: 'running'
        })
      }

      // Test completed → show compact with results
      const handleTestComplete = (_event: any, result: any) => {
        const testData: TestResultData = {
          type: 'test-result',
          status: result.success ? 'success' : 'failure',
          passed: result.passed,
          failed: result.failed,
          total: result.total,
          duration: result.duration,
          errors: result.errors
        }

        // Clear any existing auto-hide timer
        clearAutoHideTimer()

        show('compact', testData)

        // Auto-dismiss after 5s if success (but NOT if failed)
        if (result.success) {
          setAutoHideTimer(5000)
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
  }, [show, clearAutoHideTimer, setAutoHideTimer])

  /**
   * Listen for MCP events from Electron main process
   */
  useEffect(() => {
    try {
      const { ipcRenderer } = window.require('electron')

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
      const handleMCPEvent = (_event: any, payload: any) => {
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
          // All servers stopped - collapse to peek
          show('peek')
          setData(null)
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
              if (state === 'peek') {
                show('compact', singleData)
              } else {
                setData(singleData)
              }

              // Auto-dismiss to peek on success
              if (activity.success) {
                setTimeout(() => {
                  if (state === 'compact') {
                    show('peek', singleData)
                  }
                }, 3000)
              }
            }
          } else if (type === 'status' && rest.status === 'stopped') {
            show('peek')
            setData(null)
          }
        } else {
          // Multi-server mode
          const multiData = buildMultiMCPData()

          if (type === 'initialized') {
            // New server joined
            if (state === 'peek') {
              show('compact', multiData)
            } else {
              setData(multiData)
            }
          } else if (type === 'message') {
            // Activity update
            const activity = mcpServers.current[serverId]?.recentActivity[0]
            if (activity) {
              if (state === 'peek') {
                show('compact', multiData)
              } else {
                setData(multiData)
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
   * Listen for deployment events from Electron main process (Vercel webhooks)
   */
  useEffect(() => {
    try {
      const { ipcRenderer } = window.require('electron')

      const handleDeploymentEvent = (_event: any, deploymentData: DeploymentPeekData) => {
        // Clear any existing auto-hide timer first
        clearAutoHideTimer()

        // Show appropriate view based on deployment status
        if (deploymentData.status === 'building') {
          // Building - show compact, no auto-hide
          show('compact', deploymentData)
        } else if (deploymentData.status === 'success') {
          // Success - show compact, auto-collapse to peek after 5s
          show('compact', deploymentData)
          setAutoHideTimer(5000)
        } else {
          // Failed or cancelled - show compact, NO auto-hide
          show('compact', deploymentData)
        }
      }

      ipcRenderer.on('deployment:event', handleDeploymentEvent)

      return () => {
        ipcRenderer.removeListener('deployment:event', handleDeploymentEvent)
      }
    } catch (e) {
      console.warn('IPC not available for deployment events:', e)
    }
  }, [show, clearAutoHideTimer, setAutoHideTimer])

  /**
   * Listen for GitHub events from Electron main process (GitHub webhooks)
   */
  useEffect(() => {
    try {
      const { ipcRenderer } = window.require('electron')

      const handleGitHubEvent = (_event: any, githubData: GitHubPeekData) => {
        // Clear any existing auto-hide timer first
        clearAutoHideTimer()

        // Show compact view for all GitHub events
        show('compact', githubData)

        // Auto-hide after 5 seconds
        setAutoHideTimer(5000)
      }

      ipcRenderer.on('github:event', handleGitHubEvent)

      return () => {
        ipcRenderer.removeListener('github:event', handleGitHubEvent)
      }
    } catch (e) {
      console.warn('IPC not available for GitHub events:', e)
    }
  }, [show, clearAutoHideTimer, setAutoHideTimer])

  /**
   * Keyboard shortcuts and IPC toggle events
   */
  useEffect(() => {
    // Local keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to collapse to peek
      if (e.key === 'Escape' && state === 'compact') {
        e.preventDefault()
        collapse()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    // Global shortcut from main process (Cmd+T)
    try {
      const { ipcRenderer } = window.require('electron')

      const handleToggle = () => {
        if (state === 'peek') {
          // Expand to compact
          const defaultData: CustomPeekData = {
            type: 'custom',
            title: 'Circuit Peek',
            message: 'Waiting for activity... Start an MCP server or run tests.',
            variant: 'info'
          }
          show('compact', data || defaultData)
        } else {
          // Collapse to peek
          collapse()
        }
      }

      const handleShow = () => {
        // Show compact with default message if no data
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

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      clearAutoHideTimer()
    }
  }, [clearAutoHideTimer])

  return {
    state,
    data,
    autoHideProgress,
    show,
    hide,
    expand,
    collapse,
    setFocusedServer,
    openInWindow
  }
}
