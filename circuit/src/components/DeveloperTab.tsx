import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Server, Play, Square, AlertCircle, Activity } from 'lucide-react'
import { mcpClient, BUILTIN_SERVERS } from '@/lib/mcp-client'
import type { MessageLog, Tool, Prompt, Resource, MCPServerConfig } from '@/types/mcp'

// Server state tracker
interface ServerState {
  id: string
  name: string
  status: 'stopped' | 'starting' | 'running' | 'error'
  info: any | null
  error: string
  messages: MessageLog[]
  tools: Tool[]
  prompts: Prompt[]
  resources: Resource[]
  metrics: {
    totalRequests: number
    avgLatency: number
    lastActivity: number | null
  }
}

export function DeveloperTab() {
  // Track all servers state
  const [servers, setServers] = useState<Map<string, ServerState>>(new Map())

  // Initialize servers from BUILTIN_SERVERS
  useEffect(() => {
    const initialServers = new Map<string, ServerState>()
    BUILTIN_SERVERS.forEach(config => {
      initialServers.set(config.id, {
        id: config.id,
        name: config.name,
        status: 'stopped',
        info: null,
        error: '',
        messages: [],
        tools: [],
        prompts: [],
        resources: [],
        metrics: {
          totalRequests: 0,
          avgLatency: 0,
          lastActivity: null
        }
      })
    })
    setServers(initialServers)
  }, [])

  // Listen to MCP events for all servers
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
            server.info = event.serverInfo
            // Auto-fetch capabilities
            fetchCapabilities(serverId, server)
            break

          case 'status':
            server.status = event.status
            if (event.status === 'stopped') {
              server.tools = []
              server.prompts = []
              server.resources = []
              server.info = null
              server.error = ''
              server.messages = []
              server.metrics = {
                totalRequests: 0,
                avgLatency: 0,
                lastActivity: null
              }
            }
            break

          case 'message':
            const msg = event.message as MessageLog
            server.messages = [...server.messages, msg]

            // Update metrics
            if (msg.latency !== undefined) {
              const { totalRequests, avgLatency } = server.metrics
              server.metrics = {
                totalRequests: totalRequests + 1,
                avgLatency: (avgLatency * totalRequests + msg.latency) / (totalRequests + 1),
                lastActivity: Date.now()
              }
            }
            break

          case 'error':
            server.status = 'error'
            server.error = event.error || 'Unknown error'
            break

          case 'log':
            // Log messages handled internally
            break
        }

        newServers.set(serverId, server)
        return newServers
      })
    })

    return removeListener
  }, [])

  const fetchCapabilities = async (serverId: string, server: ServerState) => {
    try {
      const [toolsList, promptsList, resourcesList] = await Promise.all([
        mcpClient.listTools(serverId),
        mcpClient.listPrompts(serverId),
        mcpClient.listResources(serverId)
      ])

      setServers(prev => {
        const newServers = new Map(prev)
        const updatedServer = newServers.get(serverId)
        if (updatedServer) {
          updatedServer.tools = toolsList || []
          updatedServer.prompts = promptsList || []
          updatedServer.resources = resourcesList || []
          newServers.set(serverId, updatedServer)
        }
        return newServers
      })
    } catch (error) {
      // Failed to fetch capabilities
    }
  }

  const handleStart = async (serverId: string) => {
    const builtin = BUILTIN_SERVERS.find(s => s.id === serverId)
    if (!builtin) {
      alert('Server not found')
      return
    }

    // Update status to starting
    setServers(prev => {
      const newServers = new Map(prev)
      const server = newServers.get(serverId)
      if (server) {
        server.status = 'starting'
        server.error = ''
        server.messages = []
        server.metrics = {
          totalRequests: 0,
          avgLatency: 0,
          lastActivity: null
        }
        newServers.set(serverId, server)
      }
      return newServers
    })

    const result = await mcpClient.startServer(builtin)
    if (!result.success) {
      setServers(prev => {
        const newServers = new Map(prev)
        const server = newServers.get(serverId)
        if (server) {
          server.status = 'error'
          server.error = result.error || 'Failed to start server'
          newServers.set(serverId, server)
        }
        return newServers
      })
    }
  }

  const handleStop = async (serverId: string) => {
    const result = await mcpClient.stopServer(serverId)
    if (!result.success) {
      alert(`Failed to stop server: ${result.error}`)
    }
  }

  // Format time ago
  const formatTimeAgo = (ms: number | null): string => {
    if (!ms) return 'never'
    const seconds = Math.floor((Date.now() - ms) / 1000)
    if (seconds < 60) return 'now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    return `${hours}h ago`
  }

  const serverList = Array.from(servers.values())
  const runningServers = serverList.filter(s => s.status === 'running')
  const errorServers = serverList.filter(s => s.status === 'error')

  return (
    <div className="space-y-6">
      {/* Overview Cards Grid */}
      <div>
        <h2 className="text-sm font-semibold text-white/90 mb-3">MCP Servers</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {serverList.map(server => (
            <ServerCard
              key={server.id}
              server={server}
              onStart={() => handleStart(server.id)}
              onStop={() => handleStop(server.id)}
            />
          ))}
        </div>
      </div>

      <Separator className="bg-white/10" />

      {/* Detailed Server List */}
      <div>
        <h3 className="text-sm font-semibold text-white/90 mb-3">Server Details</h3>
        {serverList.length > 0 ? (
          <Accordion type="multiple" className="space-y-2">
            {serverList.map(server => (
              <AccordionItem
                key={server.id}
                value={server.id}
                className="border border-[var(--glass-border)] rounded-lg bg-[var(--glass-bg)] overflow-hidden"
              >
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-white/5">
                  <div className="flex items-center justify-between w-full pr-2">
                    <div className="flex items-center gap-3">
                      <Server className="h-4 w-4 text-white/60" />
                      <span className="text-sm font-medium text-white/90">{server.name}</span>
                    </div>
                    <ServerStatusBadge status={server.status} />
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <ServerDetails server={server} />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : (
          <div className="text-center py-12 text-white/40 text-sm">
            No servers available
          </div>
        )}
      </div>
    </div>
  )
}

// Server Overview Card Component
function ServerCard({
  server,
  onStart,
  onStop
}: {
  server: ServerState
  onStart: () => void
  onStop: () => void
}) {
  const isRunning = server.status === 'running'
  const isStarting = server.status === 'starting'
  const isError = server.status === 'error'

  const totalCapabilities = server.tools.length + server.prompts.length + server.resources.length

  return (
    <Card className="p-3 border-[var(--glass-border)] bg-[var(--glass-bg)] hover:bg-[var(--glass-hover)] transition-colors">
      <div className="space-y-2">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-xs font-medium text-white/90 truncate">{server.name}</h3>
          </div>
          <ServerStatusDot status={server.status} />
        </div>

        {/* Stats */}
        <div className="space-y-1 text-xs">
          {isRunning && (
            <>
              <div className="text-white/50">{totalCapabilities} capabilities</div>
              <div className="text-white/40">{server.metrics.totalRequests} requests</div>
              {server.metrics.avgLatency > 0 && (
                <div className="text-white/40">{server.metrics.avgLatency.toFixed(0)}ms avg</div>
              )}
            </>
          )}
          {isError && (
            <div className="text-[#ef4444] text-[10px] line-clamp-2">{server.error}</div>
          )}
          {!isRunning && !isError && !isStarting && (
            <div className="text-white/40">Stopped</div>
          )}
          {isStarting && (
            <div className="text-[#D97757]">Starting...</div>
          )}
        </div>

        {/* Actions */}
        <div className="pt-1">
          {isRunning ? (
            <Button
              onClick={onStop}
              size="sm"
              variant="ghost"
              className="w-full h-7 text-xs text-white/60 hover:text-white/90 hover:bg-white/10"
            >
              <Square className="h-3 w-3 mr-1.5" />
              Stop
            </Button>
          ) : (
            <Button
              onClick={onStart}
              size="sm"
              variant="ghost"
              disabled={isStarting}
              className="w-full h-7 text-xs text-white/60 hover:text-white/90 hover:bg-white/10"
            >
              <Play className="h-3 w-3 mr-1.5" />
              {isStarting ? 'Starting...' : 'Start'}
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}

// Status Dot (Minimal, subdued colors)
function ServerStatusDot({ status }: { status: ServerState['status'] }) {
  const colors = {
    stopped: 'bg-[#595350]',          // ⚫ Gray - idle
    starting: 'bg-[#D97757] animate-pulse', // 🟠 Orange - warning (only for starting)
    running: 'bg-[#846961]',          // 🟤 Brown - subdued active
    error: 'bg-[#ef4444] animate-pulse'     // 🔴 Red - error only!
  }

  return (
    <div className={`w-2 h-2 rounded-full ${colors[status]} flex-shrink-0`} />
  )
}

// Status Badge (for accordion header)
function ServerStatusBadge({ status }: { status: ServerState['status'] }) {
  const config = {
    stopped: { label: 'Stopped', className: 'bg-[#595350]/20 text-[#595350] border-[#595350]/30' },
    starting: { label: 'Starting', className: 'bg-[#D97757]/20 text-[#D97757] border-[#D97757]/30' },
    running: { label: 'Active', className: 'bg-[#846961]/20 text-[#846961] border-[#846961]/40' },
    error: { label: 'Error', className: 'bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/30' }
  }

  const { label, className } = config[status]

  return (
    <Badge variant="outline" className={`text-xs font-normal ${className}`}>
      {label}
    </Badge>
  )
}

// Server Details (Accordion content)
function ServerDetails({ server }: { server: ServerState }) {
  const formatTimeAgo = (ms: number | null): string => {
    if (!ms) return 'never'
    const seconds = Math.floor((Date.now() - ms) / 1000)
    if (seconds < 60) return 'now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    return `${hours}h ago`
  }

  const isRunning = server.status === 'running'

  return (
    <div className="space-y-4 pt-3">
      {/* Server Info */}
      {server.info && (
        <div className="flex items-center gap-2 text-xs text-white/60">
          <Server className="h-3 w-3" />
          <span>{server.info.name} v{server.info.version}</span>
        </div>
      )}

      {/* Error */}
      {server.error && (
        <div className="flex items-start gap-2 text-xs">
          <AlertCircle className="h-3 w-3 text-[#ef4444] flex-shrink-0 mt-0.5" />
          <span className="text-[#ef4444]">{server.error}</span>
        </div>
      )}

      {/* Capabilities Summary */}
      {isRunning && (
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="space-y-1">
            <div className="text-white/40">Tools</div>
            <div className="text-white/80 font-medium">{server.tools.length}</div>
          </div>
          <div className="space-y-1">
            <div className="text-white/40">Prompts</div>
            <div className="text-white/80 font-medium">{server.prompts.length}</div>
          </div>
          <div className="space-y-1">
            <div className="text-white/40">Resources</div>
            <div className="text-white/80 font-medium">{server.resources.length}</div>
          </div>
        </div>
      )}

      {/* Activity */}
      {isRunning && server.metrics.totalRequests > 0 && (
        <div className="flex items-center gap-2 text-xs">
          <Activity className="h-3 w-3 text-white/40" />
          <span className="text-white/60">
            {server.metrics.totalRequests} requests • {server.metrics.avgLatency.toFixed(0)}ms avg
          </span>
          {server.metrics.lastActivity && (
            <>
              <span className="text-white/30">•</span>
              <span className="text-white/40">{formatTimeAgo(server.metrics.lastActivity)}</span>
            </>
          )}
        </div>
      )}

      {/* Tools List (collapsed) */}
      {isRunning && server.tools.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-white/70">Available Tools</div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {server.tools.slice(0, 5).map(tool => (
              <div key={tool.name} className="text-xs text-white/50 font-mono">
                {tool.name}
              </div>
            ))}
            {server.tools.length > 5 && (
              <div className="text-xs text-white/40">
                +{server.tools.length - 5} more...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
