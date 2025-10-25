// MCP Client API for Renderer Process
import type { MCPServerConfig } from '@/types/mcp'

// Get ipcRenderer from window (available because contextIsolation is false)
const ipcRenderer = (window as any).require('electron').ipcRenderer

// Event listeners
type MCPEventListener = (event: MCPEvent) => void

interface MCPEvent {
  serverId: string
  type: 'initialized' | 'status' | 'message' | 'error' | 'log'
  [key: string]: any
}

class MCPClient {
  private listeners: Set<MCPEventListener> = new Set()

  constructor() {
    // Set up IPC event listener
    ipcRenderer.on('mcp-event', (_event: any, data: MCPEvent) => {
      this.listeners.forEach(listener => listener(data))
    })
  }

  addEventListener(listener: MCPEventListener) {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  async startServer(config: MCPServerConfig): Promise<{ success: boolean; result?: any; error?: string }> {
    return ipcRenderer.invoke('mcp:start-server', config)
  }

  async stopServer(serverId: string): Promise<{ success: boolean; error?: string }> {
    return ipcRenderer.invoke('mcp:stop-server', serverId)
  }

  async sendRequest(serverId: string, method: string, params?: any): Promise<{ success: boolean; result?: any; error?: string }> {
    return ipcRenderer.invoke('mcp:send-request', serverId, method, params)
  }

  async getServerStatus(serverId: string): Promise<{ status: string }> {
    return ipcRenderer.invoke('mcp:get-server-status', serverId)
  }

  // Convenience methods for common MCP operations
  async listTools(serverId: string) {
    const response = await this.sendRequest(serverId, 'tools/list', {})
    return response.success ? response.result?.tools : []
  }

  async listPrompts(serverId: string) {
    const response = await this.sendRequest(serverId, 'prompts/list', {})
    return response.success ? response.result?.prompts : []
  }

  async listResources(serverId: string) {
    const response = await this.sendRequest(serverId, 'resources/list', {})
    return response.success ? response.result?.resources : []
  }

  async callTool(serverId: string, toolName: string, args: Record<string, any>) {
    const response = await this.sendRequest(serverId, 'tools/call', {
      name: toolName,
      arguments: args
    })
    return response
  }

  async getPrompt(serverId: string, promptName: string, args?: Record<string, string>) {
    const response = await this.sendRequest(serverId, 'prompts/get', {
      name: promptName,
      arguments: args
    })
    return response
  }

  async readResource(serverId: string, uri: string) {
    const response = await this.sendRequest(serverId, 'resources/read', { uri })
    return response
  }
}

// Export singleton instance
export const mcpClient = new MCPClient()

// Predefined server configurations
export const BUILTIN_SERVERS: MCPServerConfig[] = [
  {
    id: 'echo',
    name: 'Echo Server (Built-in)',
    command: 'node',
    args: ['test-servers/echo-server.cjs']
  },
  {
    id: 'filesystem',
    name: 'Filesystem Server (Built-in)',
    command: 'node',
    args: ['test-servers/filesystem-server.cjs']
  },
  {
    id: 'weather',
    name: 'Weather API (Built-in)',
    command: 'node',
    args: ['test-servers/weather-server.cjs']
  }
]
