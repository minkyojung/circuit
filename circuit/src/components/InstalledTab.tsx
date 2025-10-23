/**
 * Installed Tab: Real-time MCP Server Monitoring
 * Shows all installed servers with health status, metrics, and controls
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronRight, Play, Square, AlertCircle, RefreshCw, FileText, Trash2, Copy, Check } from 'lucide-react'
import { HistoryPanel } from './HistoryPanel'
import { useFeatureFlag } from '@/lib/featureFlags'

interface Tool {
  name: string
  description?: string
  inputSchema: any
}

interface Prompt {
  name: string
  description?: string
  arguments?: any[]
}

interface ServerStatus {
  id: string
  name: string
  status: 'stopped' | 'starting' | 'running' | 'error'
  uptime?: number
  stats: {
    callCount: number
    errorCount: number
    avgCallDuration: number
  }
  toolCount: number
  tools: Tool[]
  prompts: Prompt[]
  error?: string
}

export function InstalledTab() {
  const [servers, setServers] = useState<ServerStatus[]>([])
  const [expandedServer, setExpandedServer] = useState<string | null>(null)
  const [logs, setLogs] = useState<Record<string, string[]>>({})
  const [copiedTool, setCopiedTool] = useState<string | null>(null)

  // Feature flag for history
  const historyEnabled = useFeatureFlag('historyEnabled')

  // Poll server status every second
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const { ipcRenderer } = window.require('electron')
        const result = await ipcRenderer.invoke('circuit:mcp-get-all-status')

        if (result.success) {
          setServers(result.statuses)
        }
      } catch (error) {
        console.error('Failed to fetch server status:', error)
      }
    }

    // Initial fetch
    fetchStatus()

    // Poll every 1 second
    const interval = setInterval(fetchStatus, 1000)

    return () => clearInterval(interval)
  }, [])

  const handleStart = async (serverId: string) => {
    try {
      const { ipcRenderer } = window.require('electron')
      const result = await ipcRenderer.invoke('circuit:mcp-start', serverId)

      if (!result.success) {
        alert(`Failed to start: ${result.error}`)
      }
    } catch (error) {
      console.error('Failed to start server:', error)
    }
  }

  const handleStop = async (serverId: string) => {
    try {
      const { ipcRenderer } = window.require('electron')
      const result = await ipcRenderer.invoke('circuit:mcp-stop', serverId)

      if (!result.success) {
        alert(`Failed to stop: ${result.error}`)
      }
    } catch (error) {
      console.error('Failed to stop server:', error)
    }
  }

  const handleRestart = async (serverId: string) => {
    try {
      const { ipcRenderer } = window.require('electron')
      const result = await ipcRenderer.invoke('circuit:mcp-restart', serverId)

      if (!result.success) {
        alert(`Failed to restart: ${result.error}`)
      }
    } catch (error) {
      console.error('Failed to restart server:', error)
    }
  }

  const handleUninstall = async (serverId: string, serverName: string) => {
    if (!confirm(`Are you sure you want to uninstall "${serverName}"?\n\nThis will remove the server configuration.`)) {
      return
    }

    try {
      const { ipcRenderer } = window.require('electron')
      const result = await ipcRenderer.invoke('circuit:mcp-uninstall', serverId)

      if (!result.success) {
        alert(`Failed to uninstall: ${result.error}`)
      }
    } catch (error) {
      console.error('Failed to uninstall server:', error)
      alert(`Failed to uninstall: ${error}`)
    }
  }

  const handleViewLogs = async (serverId: string) => {
    try {
      const { ipcRenderer } = window.require('electron')
      const result = await ipcRenderer.invoke('circuit:mcp-get-logs', serverId, 100)

      if (result.success) {
        setLogs(prev => ({ ...prev, [serverId]: result.logs }))
        setExpandedServer(expandedServer === serverId ? null : serverId)
      }
    } catch (error) {
      console.error('Failed to get logs:', error)
    }
  }

  const handleCopyPrompt = async (toolName: string, description?: string) => {
    const prompt = description
      ? `Use the ${toolName} tool to ${description.toLowerCase()}`
      : `Use the ${toolName} tool`

    try {
      await navigator.clipboard.writeText(prompt)
      setCopiedTool(toolName)
      setTimeout(() => setCopiedTool(null), 2000)
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
    }
  }

  const formatUptime = (ms?: number): string => {
    if (!ms) return 'N/A'
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  const handleReloadClaudeCode = async () => {
    try {
      const { ipcRenderer } = window.require('electron')
      const result = await ipcRenderer.invoke('circuit:reload-claude-code')

      if (result.success) {
        alert('Claude Code reload command sent! ✓\n\nIf you have VS Code open, the window should reload now.')
      } else {
        alert(`Failed to reload: ${result.error}\n\nYou can manually reload by:\n1. Opening VS Code\n2. Cmd+Shift+P → "Reload Window"`)
      }
    } catch (error) {
      console.error('Failed to reload Claude Code:', error)
      alert('Manual reload required:\n1. Open VS Code\n2. Cmd+Shift+P → "Reload Window"')
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-base font-semibold leading-tight mb-1 text-[var(--text-primary)]">Installed</h1>
          <p className="text-xs leading-normal text-[var(--text-secondary)]">
            Manage your MCP servers • Tools are automatically available in Claude Code
          </p>
        </div>
        <Button
          onClick={handleReloadClaudeCode}
          size="sm"
          variant="outline"
          className="flex items-center gap-2"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Reload Claude Code
        </Button>
      </div>

      {/* Server List */}
      <div className="space-y-2">
        {servers.length === 0 && (
          <Card className="p-6 glass-card text-center border-0">
            <p className="text-xs leading-normal text-[var(--text-muted)]">
              No servers installed. Visit Discover to get started.
            </p>
          </Card>
        )}

        {servers.map(server => (
          <Card key={server.id} className="glass-card overflow-hidden border border-white/5">
            <div className="p-3">
              <div className="flex items-center justify-between mb-2">
                {/* Server Info */}
                <div className="flex items-center gap-2 flex-1">
                  <button
                    onClick={() => setExpandedServer(expandedServer === server.id ? null : server.id)}
                    className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    {expandedServer === server.id ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                  </button>

                  <div className="flex-1">
                    <h3 className="text-sm font-semibold leading-tight text-[var(--text-primary)] mb-0.5">
                      {server.name}
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        className={`text-[11px] px-1.5 py-0 ${
                          server.status === 'running'
                            ? 'bg-[var(--circuit-success)]/20 text-[var(--circuit-success)]'
                            : server.status === 'error'
                            ? 'bg-[var(--circuit-error)]/20 text-[var(--circuit-error)]'
                            : 'bg-[var(--glass-bg)] text-[var(--text-muted)]'
                        } border-0`}
                      >
                        {server.status === 'running' ? '● Running' :
                         server.status === 'error' ? '● Error' :
                         server.status === 'starting' ? '● Starting' : '○ Stopped'}
                      </Badge>

                      {server.status === 'running' && (
                        <>
                          <span className="text-[11px] text-[var(--text-muted)]">
                            {server.toolCount} tools
                          </span>
                          <span className="text-[11px] text-[var(--text-muted)]">
                            Uptime: {formatUptime(server.uptime)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {server.status === 'running' && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs gap-1.5"
                        onClick={() => handleRestart(server.id)}
                      >
                        <RefreshCw className="h-3 w-3" />
                        Restart
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs gap-1.5"
                        onClick={() => handleViewLogs(server.id)}
                      >
                        <FileText className="h-3 w-3" />
                        Logs
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs gap-1.5 text-[var(--circuit-error)]"
                        onClick={() => handleStop(server.id)}
                      >
                        <Square className="h-3 w-3" />
                        Stop
                      </Button>
                    </>
                  )}

                  {(server.status === 'stopped' || server.status === 'error') && (
                    <>
                      <Button
                        size="sm"
                        className="h-7 text-xs gap-1.5"
                        onClick={() => handleStart(server.id)}
                      >
                        <Play className="h-3 w-3" />
                        Start
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs gap-1.5 text-[var(--circuit-error)]"
                        onClick={() => handleUninstall(server.id, server.name)}
                      >
                        <Trash2 className="h-3 w-3" />
                        Uninstall
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Available Tools */}
              {server.status === 'running' && server.tools && server.tools.length > 0 && (
                <div className="mt-2 border-t border-[var(--glass-border)]/50 pt-2">
                  <div className="text-xs font-semibold leading-tight text-[var(--text-secondary)] mb-1.5">
                    🔧 {server.tools.length} {server.tools.length === 1 ? 'Tool' : 'Tools'}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {server.tools.slice(0, 4).map((tool) => (
                      <div
                        key={tool.name}
                        className="p-2 rounded bg-[var(--bg-section)] hover:bg-[var(--bg-card)] border border-white/5 hover:border-white/10 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-1.5 mb-0.5">
                          <code className="text-xs font-medium leading-tight text-[var(--circuit-orange)]">
                            {tool.name}
                          </code>
                          <button
                            onClick={() => handleCopyPrompt(tool.name, tool.description)}
                            className="flex-shrink-0 p-0.5 rounded hover:bg-[var(--glass-bg)] transition-colors"
                            title="Copy prompt"
                          >
                            {copiedTool === tool.name ? (
                              <Check className="h-3 w-3 text-[var(--circuit-success)]" />
                            ) : (
                              <Copy className="h-3 w-3 text-[var(--text-muted)]" />
                            )}
                          </button>
                        </div>
                        {tool.description && (
                          <p className="text-[11px] leading-normal text-[var(--text-muted)] line-clamp-1">
                            {tool.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                  {server.tools.length > 4 && (
                    <div className="text-center mt-1.5">
                      <span className="text-[11px] text-[var(--text-muted)]">
                        +{server.tools.length - 4} more
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Error Message */}
              {server.error && (
                <div className="flex items-start gap-2 p-2 rounded bg-[var(--circuit-error)]/10 text-[var(--circuit-error)]">
                  <AlertCircle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                  <span className="text-[10px]">{server.error}</span>
                </div>
              )}

              {/* Expanded: Logs */}
              {expandedServer === server.id && logs[server.id] && (
                <div className="mt-3 border-t border-[var(--glass-border)] pt-3">
                  <div className="text-xs font-medium text-[var(--text-secondary)] mb-2">
                    Logs (last 100 lines)
                  </div>
                  <div className="bg-[var(--glass-bg)] rounded p-3 max-h-60 overflow-y-auto">
                    <pre className="text-[10px] text-[var(--text-muted)] font-mono whitespace-pre-wrap">
                      {logs[server.id].join('\n') || 'No logs available'}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Call History Panel - Feature Flag Controlled */}
      {historyEnabled && (
        <div className="mt-6">
          <HistoryPanel />
        </div>
      )}
    </div>
  )
}
