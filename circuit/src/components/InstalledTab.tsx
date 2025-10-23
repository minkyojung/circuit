/**
 * Installed Tab: Real-time MCP Server Monitoring
 * Shows all installed servers with health status, metrics, and controls
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronRight, Play, Square, AlertCircle, RefreshCw, FileText, Activity, Trash2, Copy, Check } from 'lucide-react'

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold mb-1 text-[var(--text-primary)]">Installed Servers</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Monitor and manage your MCP servers
        </p>
      </div>

      {/* Server List */}
      <div className="space-y-3">
        {servers.length === 0 && (
          <Card className="p-6 glass-card text-center">
            <p className="text-sm text-[var(--text-muted)]">
              No MCP servers installed yet. Visit the Discover tab to install servers.
            </p>
          </Card>
        )}

        {servers.map(server => (
          <Card key={server.id} className="glass-card overflow-hidden">
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                {/* Server Info */}
                <div className="flex items-center gap-3 flex-1">
                  <button
                    onClick={() => setExpandedServer(expandedServer === server.id ? null : server.id)}
                    className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    {expandedServer === server.id ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>

                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                      {server.name}
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        className={`text-[10px] px-2 py-0 ${
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
                          <span className="text-[10px] text-[var(--text-muted)]">
                            {server.toolCount} tools
                          </span>
                          <span className="text-[10px] text-[var(--text-muted)]">
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

              {/* Stats (Running only) */}
              {server.status === 'running' && (
                <div className="flex items-center gap-4 text-[10px] text-[var(--text-muted)] mb-2">
                  <div className="flex items-center gap-1.5">
                    <Activity className="h-3 w-3" />
                    <span>{server.stats.callCount} calls</span>
                  </div>
                  {server.stats.callCount > 0 && (
                    <>
                      <span>Avg: {server.stats.avgCallDuration}ms</span>
                      <span className={server.stats.errorCount > 0 ? 'text-[var(--circuit-error)]' : ''}>
                        {server.stats.errorCount} errors
                      </span>
                    </>
                  )}
                </div>
              )}

              {/* Available Tools */}
              {server.status === 'running' && server.tools && server.tools.length > 0 && (
                <div className="mt-3 border-t border-[var(--glass-border)] pt-3">
                  <div className="text-xs font-medium text-[var(--text-secondary)] mb-2">
                    🔧 Available Tools ({server.tools.length})
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {server.tools.slice(0, 6).map((tool) => (
                      <div
                        key={tool.name}
                        className="p-2 rounded bg-[#110F0E] border border-[var(--glass-border)] hover:border-[var(--circuit-orange)]/30 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <code className="text-xs font-medium text-[var(--circuit-orange)]">
                            {tool.name}
                          </code>
                          <button
                            onClick={() => handleCopyPrompt(tool.name, tool.description)}
                            className="flex-shrink-0 p-1 rounded hover:bg-[var(--glass-bg)] transition-colors"
                            title="Copy prompt for Claude Code"
                          >
                            {copiedTool === tool.name ? (
                              <Check className="h-3 w-3 text-[var(--circuit-success)]" />
                            ) : (
                              <Copy className="h-3 w-3 text-[var(--text-muted)]" />
                            )}
                          </button>
                        </div>
                        {tool.description && (
                          <p className="text-[10px] text-[var(--text-muted)] line-clamp-2">
                            {tool.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                  {server.tools.length > 6 && (
                    <div className="text-center mt-2">
                      <span className="text-[10px] text-[var(--text-muted)]">
                        +{server.tools.length - 6} more tools
                      </span>
                    </div>
                  )}
                  <div className="mt-3 p-2 rounded bg-[var(--circuit-orange)]/10 border border-[var(--circuit-orange)]/20">
                    <p className="text-[10px] text-[var(--text-secondary)]">
                      💡 <strong>Using in Claude Code:</strong> These tools are automatically available. Click the copy button to get a prompt, then paste it into Claude Code.
                    </p>
                  </div>
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
    </div>
  )
}
