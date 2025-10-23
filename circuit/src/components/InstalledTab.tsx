/**
 * Installed Tab: Manage MCP Servers
 * Docker Desktop-style list view
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronRight, Play, Square, AlertCircle, RefreshCw, Settings, FileText } from 'lucide-react'
import { mcpClient, BUILTIN_SERVERS } from '@/lib/mcp-client'
import type { Tool, MCPServerConfig } from '@/types/mcp'

interface ServerState {
  id: string
  name: string
  status: 'stopped' | 'starting' | 'running' | 'error'
  tools: Tool[]
  prompts: any[]
  resources: any[]
  error?: string
  lastUsed?: number
  expanded?: boolean
}

export function InstalledTab() {
  const [servers, setServers] = useState<Map<string, ServerState>>(new Map())
  const [expandedServer, setExpandedServer] = useState<string | null>(null)

  // Initialize servers
  useEffect(() => {
    const initialServers = new Map<string, ServerState>()
    BUILTIN_SERVERS.forEach(config => {
      initialServers.set(config.id, {
        id: config.id,
        name: config.name,
        status: 'stopped',
        tools: [],
        prompts: [],
        resources: []
      })
    })
    setServers(initialServers)
  }, [])

  // Listen to MCP events
  useEffect(() => {
    const removeListener = mcpClient.addEventListener((event) => {
      const serverId = event.serverId
      if (!serverId) return

      setServers(prev => {
        const newServers = new Map(prev)
        const server = newServers.get(serverId)
        if (!server) return prev

        switch (event.type) {
          case 'initialized':
            server.status = 'running'
            server.lastUsed = Date.now()
            fetchServerCapabilities(serverId)
            break

          case 'status':
            server.status = event.status
            if (event.status === 'stopped') {
              server.tools = []
              server.prompts = []
              server.resources = []
              server.error = undefined
            }
            break

          case 'error':
            server.status = 'error'
            server.error = event.error
            break
        }

        newServers.set(serverId, { ...server })
        return newServers
      })
    })

    return removeListener
  }, [])

  const fetchServerCapabilities = async (serverId: string) => {
    try {
      const [tools, prompts, resources] = await Promise.all([
        mcpClient.listTools(serverId),
        mcpClient.listPrompts(serverId),
        mcpClient.listResources(serverId)
      ])

      setServers(prev => {
        const newServers = new Map(prev)
        const server = newServers.get(serverId)
        if (server) {
          server.tools = tools || []
          server.prompts = prompts || []
          server.resources = resources || []
          newServers.set(serverId, { ...server })
        }
        return newServers
      })
    } catch (error) {
      console.error(`Failed to fetch capabilities for ${serverId}:`, error)
    }
  }

  const handleToggleServer = async (serverId: string) => {
    const server = servers.get(serverId)
    if (!server) return

    const config = BUILTIN_SERVERS.find(s => s.id === serverId)
    if (!config) return

    if (server.status === 'running') {
      await mcpClient.stopServer(serverId)
    } else {
      setServers(prev => {
        const newServers = new Map(prev)
        const s = newServers.get(serverId)
        if (s) {
          s.status = 'starting'
          newServers.set(serverId, { ...s })
        }
        return newServers
      })
      await mcpClient.startServer(config)
    }
  }

  const toggleExpand = (serverId: string) => {
    setExpandedServer(expandedServer === serverId ? null : serverId)
  }

  const getStatusIcon = (status: ServerState['status']) => {
    switch (status) {
      case 'running':
        return <div className="h-2 w-2 rounded-full bg-[var(--circuit-success)]" />
      case 'starting':
        return <RefreshCw className="h-3 w-3 text-[var(--circuit-orange)] animate-spin" />
      case 'error':
        return <AlertCircle className="h-3 w-3 text-[var(--circuit-error)]" />
      default:
        return <div className="h-2 w-2 rounded-full bg-[var(--text-muted)] opacity-50" />
    }
  }

  const getStatusText = (status: ServerState['status']) => {
    switch (status) {
      case 'running':
        return 'Running'
      case 'starting':
        return 'Starting...'
      case 'error':
        return 'Error'
      default:
        return 'Stopped'
    }
  }

  const formatTimeAgo = (timestamp?: number) => {
    if (!timestamp) return 'Never used'
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  const serversArray = Array.from(servers.values())
  const runningCount = serversArray.filter(s => s.status === 'running').length
  const errorCount = serversArray.filter(s => s.status === 'error').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold mb-1 text-[var(--text-primary)]">Installed</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Manage your MCP servers
        </p>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm">
          <div className="h-2 w-2 rounded-full bg-[var(--circuit-success)]" />
          <span className="text-[var(--text-secondary)]">
            {runningCount} running
          </span>
        </div>
        {errorCount > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <AlertCircle className="h-3 w-3 text-[var(--circuit-error)]" />
            <span className="text-[var(--circuit-error)]">
              {errorCount} error{errorCount > 1 ? 's' : ''}
            </span>
          </div>
        )}
        <div className="text-sm text-[var(--text-muted)]">
          {serversArray.length} total
        </div>
      </div>

      {/* Server List */}
      <div className="space-y-2">
        {serversArray.map(server => {
          const isExpanded = expandedServer === server.id

          return (
            <Card
              key={server.id}
              className="glass-card border-[var(--glass-border)] overflow-hidden"
            >
              {/* Main Row */}
              <div className="p-4 flex items-center gap-4">
                {/* Expand Toggle */}
                <button
                  onClick={() => toggleExpand(server.id)}
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>

                {/* Status Indicator */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {getStatusIcon(server.status)}
                </div>

                {/* Name & Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                      {server.name}
                    </h3>
                    {server.status === 'running' && (
                      <Badge className="bg-[var(--circuit-success)]/20 text-[var(--circuit-success)] border-0 text-[10px] px-2 py-0">
                        {getStatusText(server.status)}
                      </Badge>
                    )}
                    {server.status === 'error' && (
                      <Badge className="bg-[var(--circuit-error)]/20 text-[var(--circuit-error)] border-0 text-[10px] px-2 py-0">
                        {getStatusText(server.status)}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                    {server.status === 'running' && (
                      <>
                        <span>{server.tools.length} tools</span>
                        <span>•</span>
                        <span>{server.prompts.length} prompts</span>
                        <span>•</span>
                      </>
                    )}
                    {server.status === 'error' && server.error ? (
                      <span className="text-[var(--circuit-error)]">{server.error}</span>
                    ) : (
                      <span>{formatTimeAgo(server.lastUsed)}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {server.status === 'running' ? (
                    <Button
                      onClick={() => handleToggleServer(server.id)}
                      size="sm"
                      variant="outline"
                      className="gap-1.5 h-7 text-xs"
                    >
                      <Square className="h-3 w-3" />
                      Stop
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleToggleServer(server.id)}
                      size="sm"
                      className="gap-1.5 h-7 text-xs"
                      disabled={server.status === 'starting'}
                    >
                      {server.status === 'starting' ? (
                        <>
                          <RefreshCw className="h-3 w-3 animate-spin" />
                          Starting...
                        </>
                      ) : (
                        <>
                          <Play className="h-3 w-3" />
                          Start
                        </>
                      )}
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                  >
                    <Settings className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && server.status === 'running' && (
                <div className="border-t border-[var(--glass-border)] p-4 space-y-3 bg-[var(--glass-bg)]">
                  {/* Tools */}
                  {server.tools.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-[var(--text-secondary)] mb-2">
                        Tools ({server.tools.length})
                      </h4>
                      <div className="space-y-1">
                        {server.tools.map(tool => (
                          <div
                            key={tool.name}
                            className="text-xs bg-[var(--glass-card)] px-3 py-2 rounded flex items-start gap-2"
                          >
                            <code className="text-[var(--circuit-orange)] font-mono flex-shrink-0">
                              {tool.name}
                            </code>
                            {tool.description && (
                              <span className="text-[var(--text-muted)] text-[11px] line-clamp-1">
                                {tool.description}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Prompts */}
                  {server.prompts.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-[var(--text-secondary)] mb-2">
                        Prompts ({server.prompts.length})
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {server.prompts.map((prompt, i) => (
                          <span
                            key={i}
                            className="text-[10px] px-2 py-1 rounded bg-[var(--glass-card)] text-[var(--text-muted)]"
                          >
                            {prompt.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Error Details */}
              {isExpanded && server.status === 'error' && server.error && (
                <div className="border-t border-[var(--glass-border)] p-4 bg-[var(--glass-bg)]">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-[var(--circuit-error)] flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-medium text-[var(--circuit-error)] mb-1">
                        Error Details
                      </h4>
                      <p className="text-xs text-[var(--text-muted)] font-mono">
                        {server.error}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {serversArray.length === 0 && (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-[var(--text-muted)] mx-auto mb-3 opacity-50" />
          <p className="text-sm text-[var(--text-muted)]">
            No MCP servers installed
          </p>
          <Button size="sm" className="mt-4">
            Browse Discover Tab
          </Button>
        </div>
      )}
    </div>
  )
}
