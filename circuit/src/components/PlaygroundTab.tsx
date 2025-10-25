/**
 * Playground Tab: Test MCP Tools Interactively
 * Allows users to discover, test, and debug MCP tools from all installed servers
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Play,
  ChevronRight,
  ChevronDown,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Zap,
} from 'lucide-react'

interface Tool {
  name: string
  description?: string
  inputSchema?: {
    type: string
    properties?: Record<string, any>
    required?: string[]
  }
  _serverId?: string
  _serverName?: string
}

interface ToolExecutionResult {
  success: boolean
  result?: any
  error?: string
  duration?: number
}

export function PlaygroundTab() {
  const [tools, setTools] = useState<Tool[]>([])
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null)
  const [toolArgs, setToolArgs] = useState<string>('{}')
  const [executing, setExecuting] = useState(false)
  const [result, setResult] = useState<ToolExecutionResult | null>(null)
  const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set())

  // Fetch all tools on mount
  useEffect(() => {
    fetchTools()
  }, [])

  const fetchTools = async () => {
    try {
      const { ipcRenderer } = window.require('electron')
      const response = await ipcRenderer.invoke('circuit:mcp-get-all-status')

      if (response.success) {
        // Collect tools from all running servers
        const allTools: Tool[] = []

        for (const server of response.statuses) {
          if (server.status === 'running') {
            const toolsResult = await ipcRenderer.invoke('circuit:mcp-list-tools', server.id)

            if (toolsResult.success && toolsResult.tools) {
              for (const tool of toolsResult.tools) {
                allTools.push({
                  ...tool,
                  _serverId: server.id,
                  _serverName: server.name,
                })
              }
            }
          }
        }

        setTools(allTools)
      }
    } catch (error) {
      console.error('Failed to fetch tools:', error)
    }
  }

  const executeTool = async () => {
    if (!selectedTool || !selectedTool._serverId) return

    setExecuting(true)
    setResult(null)

    const startTime = Date.now()

    try {
      const args = JSON.parse(toolArgs)
      const { ipcRenderer } = window.require('electron')

      const response = await ipcRenderer.invoke(
        'circuit:mcp-call-tool',
        selectedTool._serverId,
        selectedTool.name,
        args
      )

      const duration = Date.now() - startTime

      if (response.success) {
        setResult({
          success: true,
          result: response.result,
          duration,
        })
      } else {
        setResult({
          success: false,
          error: response.error,
          duration,
        })
      }
    } catch (error: any) {
      const duration = Date.now() - startTime
      setResult({
        success: false,
        error: error.message,
        duration,
      })
    } finally {
      setExecuting(false)
    }
  }

  const toggleServer = (serverName: string) => {
    const newExpanded = new Set(expandedServers)
    if (newExpanded.has(serverName)) {
      newExpanded.delete(serverName)
    } else {
      newExpanded.add(serverName)
    }
    setExpandedServers(newExpanded)
  }

  // Group tools by server
  const toolsByServer = tools.reduce((acc, tool) => {
    const serverName = tool._serverName || 'Unknown'
    if (!acc[serverName]) {
      acc[serverName] = []
    }
    acc[serverName].push(tool)
    return acc
  }, {} as Record<string, Tool[]>)

  const handleToolSelect = (tool: Tool) => {
    setSelectedTool(tool)
    setResult(null)

    // Generate example args from schema
    if (tool.inputSchema?.properties) {
      const exampleArgs: Record<string, any> = {}
      const props = tool.inputSchema.properties

      for (const [key, value] of Object.entries(props)) {
        const propSchema = value as any
        if (propSchema.type === 'string') {
          exampleArgs[key] = propSchema.default || ''
        } else if (propSchema.type === 'number') {
          exampleArgs[key] = propSchema.default || 0
        } else if (propSchema.type === 'boolean') {
          exampleArgs[key] = propSchema.default || false
        } else if (propSchema.type === 'array') {
          exampleArgs[key] = propSchema.default || []
        } else if (propSchema.type === 'object') {
          exampleArgs[key] = propSchema.default || {}
        }
      }

      setToolArgs(JSON.stringify(exampleArgs, null, 2))
    } else {
      setToolArgs('{}')
    }
  }

  return (
    <div className="flex h-full">
      {/* Left Panel: Tool List */}
      <div className="w-80 border-r border-neutral-800 bg-neutral-950">
        <div className="p-4 border-b border-neutral-800">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-neutral-200">Available Tools</h2>
            <Badge variant="outline" className="text-xs">
              {tools.length}
            </Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchTools}
            className="w-full text-xs"
          >
            <Zap className="w-3 h-3 mr-1" />
            Refresh Tools
          </Button>
        </div>

        <ScrollArea className="h-[calc(100vh-180px)]">
          <div className="p-2">
            {Object.entries(toolsByServer).map(([serverName, serverTools]) => (
              <div key={serverName} className="mb-2">
                <button
                  onClick={() => toggleServer(serverName)}
                  className="w-full flex items-center gap-1 px-2 py-1.5 hover:bg-neutral-900 rounded text-xs font-medium text-neutral-300"
                >
                  {expandedServers.has(serverName) ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                  {serverName}
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {serverTools.length}
                  </Badge>
                </button>

                {expandedServers.has(serverName) && (
                  <div className="ml-2 mt-1">
                    {serverTools.map((tool) => (
                      <button
                        key={tool.name}
                        onClick={() => handleToolSelect(tool)}
                        className={`w-full text-left px-2 py-1.5 rounded text-xs hover:bg-neutral-900 ${
                          selectedTool?.name === tool.name
                            ? 'bg-blue-600/20 text-blue-400'
                            : 'text-neutral-400'
                        }`}
                      >
                        <div className="font-medium">{tool.name}</div>
                        {tool.description && (
                          <div className="text-xs text-neutral-500 truncate mt-0.5">
                            {tool.description}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {tools.length === 0 && (
              <div className="text-center text-neutral-500 text-xs py-8">
                No tools available.
                <br />
                Install and start MCP servers first.
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right Panel: Tool Details & Execution */}
      <div className="flex-1 flex flex-col">
        {selectedTool ? (
          <>
            {/* Tool Header */}
            <div className="p-6 border-b border-neutral-800">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h2 className="text-lg font-semibold text-neutral-100">{selectedTool.name}</h2>
                  <p className="text-sm text-neutral-400 mt-1">
                    {selectedTool.description || 'No description available'}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {selectedTool._serverName}
                </Badge>
              </div>

              {selectedTool.inputSchema && (
                <div className="mt-4 text-xs">
                  <h3 className="font-medium text-neutral-300 mb-2">Input Schema</h3>
                  <pre className="bg-neutral-900 p-3 rounded text-neutral-400 overflow-x-auto">
                    {JSON.stringify(selectedTool.inputSchema, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Input Args */}
            <div className="flex-1 p-6">
              <h3 className="text-sm font-medium text-neutral-300 mb-2">Arguments (JSON)</h3>
              <textarea
                value={toolArgs}
                onChange={(e) => setToolArgs(e.target.value)}
                className="w-full h-48 p-3 bg-neutral-900 border border-neutral-800 rounded text-sm font-mono text-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter tool arguments as JSON..."
              />

              <Button
                onClick={executeTool}
                disabled={executing}
                className="mt-4"
              >
                {executing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Executing...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Execute Tool
                  </>
                )}
              </Button>

              {/* Result */}
              {result && (
                <Card className="mt-6 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {result.success ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          <span className="text-sm font-medium text-green-500">Success</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4 text-red-500" />
                          <span className="text-sm font-medium text-red-500">Error</span>
                        </>
                      )}
                    </div>
                    {result.duration !== undefined && (
                      <Badge variant="secondary" className="text-xs">
                        {result.duration}ms
                      </Badge>
                    )}
                  </div>

                  <ScrollArea className="max-h-96">
                    <pre className="text-xs text-neutral-300 bg-neutral-950 p-3 rounded overflow-x-auto">
                      {result.success
                        ? JSON.stringify(result.result, null, 2)
                        : result.error}
                    </pre>
                  </ScrollArea>
                </Card>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-neutral-500">
            <div className="text-center">
              <Zap className="w-12 h-12 mx-auto mb-4 text-neutral-700" />
              <p className="text-sm">Select a tool from the left panel to test it</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
