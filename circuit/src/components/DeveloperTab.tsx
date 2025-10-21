import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

export function DeveloperTab() {
  const [selectedServer, setSelectedServer] = useState<string>('')
  const [isRunning, setIsRunning] = useState(false)
  const [customCommand, setCustomCommand] = useState('')

  return (
    <div className="space-y-4">
      {/* Server Controls */}
      <Card className="p-4 border-border">
        <div className="space-y-4">
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium">Select Server</label>
              <Select value={selectedServer} onValueChange={setSelectedServer}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a server..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="echo">Echo Server</SelectItem>
                  <SelectItem value="weather">Weather Server</SelectItem>
                  <SelectItem value="custom">Custom Server...</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={() => setIsRunning(!isRunning)}
              variant={isRunning ? "destructive" : "default"}
              className="h-10"
            >
              {isRunning ? "Stop" : "Start"}
            </Button>
          </div>

          {selectedServer === 'custom' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Custom Server Command</label>
              <Input
                placeholder="node path/to/server.js"
                value={customCommand}
                onChange={(e) => setCustomCommand(e.target.value)}
              />
            </div>
          )}

          {isRunning && (
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="default" className="bg-green-600">Running</Badge>
              <span className="text-muted-foreground">Connected to {selectedServer}</span>
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
            <Button variant="outline" size="sm">
              Send Request
            </Button>
          </div>
          <ScrollArea className="h-[500px]">
            <div className="p-4 space-y-3">
              {isRunning ? (
                <>
                  <MessageItem
                    type="request"
                    method="initialize"
                    timestamp="14:23:01"
                  />
                  <MessageItem
                    type="response"
                    method="initialize"
                    timestamp="14:23:01"
                    latency={45}
                  />
                  <MessageItem
                    type="request"
                    method="tools/list"
                    timestamp="14:23:02"
                  />
                  <MessageItem
                    type="response"
                    method="tools/list"
                    timestamp="14:23:02"
                    latency={12}
                  />
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  Start a server to see messages
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
                  <CapabilitySection
                    title="Tools"
                    count={3}
                    items={[
                      { name: 'get_weather', description: 'Get weather for a location' },
                      { name: 'search', description: 'Search the web' },
                      { name: 'calculate', description: 'Perform calculations' },
                    ]}
                  />
                  <Separator />
                  <CapabilitySection
                    title="Prompts"
                    count={2}
                    items={[
                      { name: 'code_review', description: 'Review code snippets' },
                      { name: 'explain', description: 'Explain concepts' },
                    ]}
                  />
                  <Separator />
                  <CapabilitySection
                    title="Resources"
                    count={1}
                    items={[
                      { name: 'docs', description: 'API documentation' },
                    ]}
                  />
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

      {/* Performance Metrics */}
      {isRunning && (
        <Card className="p-4 border-border">
          <h3 className="text-sm font-semibold mb-3">Performance Metrics</h3>
          <div className="grid grid-cols-4 gap-4">
            <MetricCard label="Total Requests" value="24" />
            <MetricCard label="Avg Latency" value="28ms" />
            <MetricCard label="Fastest" value="12ms" />
            <MetricCard label="Slowest" value="145ms" />
          </div>
        </Card>
      )}
    </div>
  )
}

function MessageItem({
  type,
  method,
  timestamp,
  latency
}: {
  type: 'request' | 'response'
  method: string
  timestamp: string
  latency?: number
}) {
  return (
    <div className="border border-border rounded-lg p-3 space-y-2 text-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={type === 'request' ? 'outline' : 'secondary'} className="text-xs">
            {type === 'request' ? '→' : '←'}
          </Badge>
          <span className="font-medium">{method}</span>
        </div>
        <div className="flex items-center gap-2">
          {latency && (
            <Badge variant="outline" className="text-xs bg-green-950 text-green-400 border-green-800">
              {latency}ms
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">{timestamp}</span>
        </div>
      </div>
      <div className="text-xs text-muted-foreground font-mono bg-muted/50 p-2 rounded">
        {type === 'request' ? 'Request sent' : 'Response received'}
      </div>
    </div>
  )
}

function CapabilitySection({
  title,
  count,
  items
}: {
  title: string
  count: number
  items: Array<{ name: string; description: string }>
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
              <Button variant="ghost" size="sm" className="h-7 text-xs">
                Try it
              </Button>
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
