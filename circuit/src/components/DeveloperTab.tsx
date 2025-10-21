import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { mcpClient, BUILTIN_SERVERS } from '@/lib/mcp-client'
import type { MessageLog, Tool, Prompt, Resource, MCPServerConfig } from '@/types/mcp'

export function DeveloperTab() {
  const [selectedServerId, setSelectedServerId] = useState<string>('')
  const [customCommand, setCustomCommand] = useState('')
  const [customArgs, setCustomArgs] = useState('')

  const [serverStatus, setServerStatus] = useState<'stopped' | 'starting' | 'running' | 'error'>('stopped')
  const [serverInfo, setServerInfo] = useState<any>(null)
  const [serverError, setServerError] = useState<string>('')
  const [messages, setMessages] = useState<MessageLog[]>([])

  const [tools, setTools] = useState<Tool[]>([])
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [resources, setResources] = useState<Resource[]>([])

  // Tool testing state
  const [testingTool, setTestingTool] = useState<Tool | null>(null)
  const [toolArgs, setToolArgs] = useState<Record<string, string>>({})

  const [metrics, setMetrics] = useState({
    totalRequests: 0,
    avgLatency: 0,
    minLatency: Infinity,
    maxLatency: 0
  })

  // Listen to MCP events
  useEffect(() => {
    const removeListener = mcpClient.addEventListener((event) => {
      console.log('[MCP Event]', event)

      switch (event.type) {
        case 'initialized':
          setServerStatus('running')
          setServerInfo(event.serverInfo)
          // Auto-fetch capabilities
          if (selectedServerId) {
            fetchCapabilities(selectedServerId)
          }
          break

        case 'status':
          setServerStatus(event.status)
          if (event.status === 'stopped') {
            setTools([])
            setPrompts([])
            setResources([])
            setServerInfo(null)
            setServerError('')
          }
          break

        case 'message':
          const msg = event.message as MessageLog
          setMessages(prev => [...prev, msg])

          // Update metrics
          if (msg.latency) {
            setMetrics(prev => ({
              totalRequests: prev.totalRequests + 1,
              avgLatency: (prev.avgLatency * prev.totalRequests + msg.latency) / (prev.totalRequests + 1),
              minLatency: Math.min(prev.minLatency, msg.latency),
              maxLatency: Math.max(prev.maxLatency, msg.latency)
            }))
          }
          break

        case 'error':
          console.error('[MCP Error]', event.error)
          setServerStatus('error')
          setServerError(event.error || 'Unknown error')
          break

        case 'log':
          console.log(`[MCP Log ${event.level}]`, event.message)
          break
      }
    })

    return removeListener
  }, [selectedServerId])

  const fetchCapabilities = async (serverId: string) => {
    try {
      const [toolsList, promptsList, resourcesList] = await Promise.all([
        mcpClient.listTools(serverId),
        mcpClient.listPrompts(serverId),
        mcpClient.listResources(serverId)
      ])

      setTools(toolsList || [])
      setPrompts(promptsList || [])
      setResources(resourcesList || [])
    } catch (error) {
      console.error('Failed to fetch capabilities:', error)
    }
  }

  const handleStart = async () => {
    if (!selectedServerId) {
      alert('Please select a server')
      return
    }

    setServerStatus('starting')
    setServerError('')
    setMessages([])
    setMetrics({
      totalRequests: 0,
      avgLatency: 0,
      minLatency: Infinity,
      maxLatency: 0
    })

    let config: MCPServerConfig

    if (selectedServerId === 'custom') {
      if (!customCommand.trim()) {
        alert('Please enter a command')
        setServerStatus('stopped')
        return
      }

      config = {
        id: 'custom',
        name: 'Custom Server',
        command: customCommand.split(' ')[0],
        args: customArgs ? customArgs.split(' ') : customCommand.split(' ').slice(1)
      }
    } else {
      const builtin = BUILTIN_SERVERS.find(s => s.id === selectedServerId)
      if (!builtin) {
        alert('Server not found')
        setServerStatus('stopped')
        return
      }
      config = builtin
    }

    const result = await mcpClient.startServer(config)
    if (!result.success) {
      setServerStatus('error')
      setServerError(result.error || 'Failed to start server')
    }
  }

  const handleStop = async () => {
    if (!selectedServerId) return

    const result = await mcpClient.stopServer(selectedServerId)
    if (result.success) {
      setServerStatus('stopped')
      setMessages([])
      setTools([])
      setPrompts([])
      setResources([])
      setServerInfo(null)
    } else {
      alert(`Failed to stop server: ${result.error}`)
    }
  }

  const handleTryTool = (toolName: string) => {
    const tool = tools.find(t => t.name === toolName)
    if (!tool) return

    setTestingTool(tool)
    setToolArgs({})
  }

  const handleExecuteTool = async () => {
    if (!testingTool || !selectedServerId) return

    // Build arguments with type coercion
    const args: Record<string, any> = {}

    if (testingTool.inputSchema.properties) {
      for (const [key, schema] of Object.entries(testingTool.inputSchema.properties)) {
        const propSchema = schema as any
        const value = toolArgs[key]

        if (value !== undefined && value !== '') {
          if (propSchema.type === 'number') {
            args[key] = parseFloat(value)
          } else if (propSchema.type === 'boolean') {
            args[key] = value.toLowerCase() === 'true'
          } else {
            args[key] = value
          }
        }
      }
    }

    try {
      const result = await mcpClient.callTool(selectedServerId, testingTool.name, args)

      if (result.success) {
        alert(`Tool result:\n${JSON.stringify(result.result, null, 2)}`)
      } else {
        alert(`Tool failed: ${result.error}`)
      }
    } catch (error) {
      alert(`Error: ${error}`)
    }

    setTestingTool(null)
    setToolArgs({})
  }

  const isRunning = serverStatus === 'running'

  return (
    <div className="space-y-4">
      {/* Server Controls */}
      <Card className="p-4 border-border">
        <div className="space-y-4">
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium">Select Server</label>
              <Select
                value={selectedServerId}
                onValueChange={setSelectedServerId}
                disabled={serverStatus === 'starting' || isRunning}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a server..." />
                </SelectTrigger>
                <SelectContent>
                  {BUILTIN_SERVERS.map(server => (
                    <SelectItem key={server.id} value={server.id}>
                      {server.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Custom Server...</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={isRunning ? handleStop : handleStart}
              variant={isRunning ? "destructive" : "default"}
              className="h-10"
              disabled={serverStatus === 'starting'}
            >
              {serverStatus === 'starting' ? 'Starting...' : isRunning ? "Stop" : "Start"}
            </Button>
          </div>

          {selectedServerId === 'custom' && !isRunning && (
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Command</label>
                <Input
                  placeholder="node"
                  value={customCommand}
                  onChange={(e) => setCustomCommand(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Arguments (space-separated)</label>
                <Input
                  placeholder="server.js --port 3000"
                  value={customArgs}
                  onChange={(e) => setCustomArgs(e.target.value)}
                />
              </div>
            </div>
          )}

          {isRunning && serverInfo && (
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="default" className="bg-green-600">Running</Badge>
              <span className="text-muted-foreground">
                {serverInfo.name} v{serverInfo.version}
              </span>
            </div>
          )}

          {serverStatus === 'error' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="destructive">Error</Badge>
                <span className="text-muted-foreground">Server failed to start</span>
              </div>
              {serverError && (
                <div className="text-xs text-destructive bg-destructive/10 p-2 rounded border border-destructive/20 font-mono max-h-32 overflow-auto">
                  {serverError}
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Main Content Area - Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Messages Panel */}
        <Card className="border-border">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold">Messages</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMessages([])}
              disabled={messages.length === 0}
            >
              Clear
            </Button>
          </div>
          <ScrollArea className="h-[500px]">
            <div className="p-4 space-y-3">
              {messages.length > 0 ? (
                messages.map((msg, index) => (
                  <MessageItem key={`${msg.id}-${msg.timestamp}-${index}`} message={msg} />
                ))
              ) : (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  {isRunning ? 'No messages yet' : 'Start a server to see messages'}
                </div>
              )}
            </div>
          </ScrollArea>
        </Card>

        {/* Server Explorer Panel */}
        <Card className="border-border">
          <div className="p-4 border-b border-border">
            <h3 className="text-sm font-semibold">Server Explorer</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Auto-discovered capabilities
            </p>
          </div>
          <ScrollArea className="h-[500px]">
            <div className="p-4">
              {isRunning ? (
                <div className="space-y-4">
                  {tools.length > 0 && (
                    <>
                      <CapabilitySection
                        title="Tools"
                        count={tools.length}
                        items={tools.map(t => ({
                          name: t.name,
                          description: t.description || 'No description'
                        }))}
                        onTry={handleTryTool}
                      />
                      <Separator />
                    </>
                  )}

                  {prompts.length > 0 && (
                    <>
                      <CapabilitySection
                        title="Prompts"
                        count={prompts.length}
                        items={prompts.map(p => ({
                          name: p.name,
                          description: p.description || 'No description'
                        }))}
                      />
                      <Separator />
                    </>
                  )}

                  {resources.length > 0 && (
                    <CapabilitySection
                      title="Resources"
                      count={resources.length}
                      items={resources.map(r => ({
                        name: r.name,
                        description: r.description || r.uri
                      }))}
                    />
                  )}

                  {tools.length === 0 && prompts.length === 0 && resources.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground text-sm">
                      No capabilities discovered yet
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  Start a server to explore capabilities
                </div>
              )}
            </div>
          </ScrollArea>
        </Card>
      </div>

      {/* Tool Testing Form */}
      {testingTool && (
        <Card className="p-4 border-border">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Test Tool: {testingTool.name}</h3>
                <p className="text-xs text-muted-foreground">{testingTool.description}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setTestingTool(null)}>
                Cancel
              </Button>
            </div>

            {testingTool.inputSchema.properties && (
              <div className="space-y-3">
                {Object.entries(testingTool.inputSchema.properties).map(([key, schema]) => {
                  const propSchema = schema as any
                  const isRequired = testingTool.inputSchema.required?.includes(key)

                  return (
                    <div key={key} className="space-y-2">
                      <label className="text-sm font-medium">
                        {key}
                        {isRequired && <span className="text-destructive ml-1">*</span>}
                      </label>
                      <Input
                        placeholder={propSchema.description || key}
                        value={toolArgs[key] || ''}
                        onChange={(e) => setToolArgs({ ...toolArgs, [key]: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Type: {propSchema.type || 'string'}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={handleExecuteTool} className="flex-1">
                Execute
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Performance Metrics */}
      {isRunning && metrics.totalRequests > 0 && (
        <Card className="p-4 border-border">
          <h3 className="text-sm font-semibold mb-3">Performance Metrics</h3>
          <div className="grid grid-cols-4 gap-4">
            <MetricCard label="Total Requests" value={metrics.totalRequests.toString()} />
            <MetricCard label="Avg Latency" value={`${metrics.avgLatency.toFixed(1)}ms`} />
            <MetricCard label="Fastest" value={`${metrics.minLatency === Infinity ? '-' : metrics.minLatency}ms`} />
            <MetricCard label="Slowest" value={`${metrics.maxLatency || '-'}ms`} />
          </div>
        </Card>
      )}
    </div>
  )
}

function MessageItem({ message }: { message: MessageLog }) {
  const formatTimestamp = (ts: number) => {
    const date = new Date(ts)
    return date.toLocaleTimeString()
  }

  const getBadgeVariant = () => {
    switch (message.type) {
      case 'request': return 'outline'
      case 'response': return 'secondary'
      case 'error': return 'destructive'
      default: return 'default'
    }
  }

  const getIcon = () => {
    switch (message.type) {
      case 'request': return '→'
      case 'response': return '←'
      case 'notification': return '⚡'
      case 'error': return '✕'
      default: return '•'
    }
  }

  return (
    <div className="border border-border rounded-lg p-3 space-y-2 text-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={getBadgeVariant()} className="text-xs">
            {getIcon()}
          </Badge>
          <span className="font-medium font-mono text-xs">{message.method || 'notification'}</span>
        </div>
        <div className="flex items-center gap-2">
          {message.latency && (
            <Badge variant="outline" className="text-xs bg-green-950 text-green-400 border-green-800">
              {message.latency}ms
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">{formatTimestamp(message.timestamp)}</span>
        </div>
      </div>
      <div className="text-xs text-muted-foreground font-mono bg-muted/50 p-2 rounded max-h-32 overflow-auto">
        {JSON.stringify(message.data, null, 2)}
      </div>
    </div>
  )
}

function CapabilitySection({
  title,
  count,
  items,
  onTry
}: {
  title: string
  count: number
  items: Array<{ name: string; description: string }>
  onTry?: (name: string) => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">{title}</h4>
        <Badge variant="secondary" className="text-xs">{count}</Badge>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.name} className="border border-border rounded-lg p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium font-mono">{item.name}</span>
              {onTry && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => onTry(item.name)}
                >
                  Try it
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{item.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border rounded-lg p-3">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  )
}
