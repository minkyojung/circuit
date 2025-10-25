// MCP (Model Context Protocol) Type Definitions

// JSON-RPC 2.0 base types
export interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: string | number
  method: string
  params?: any
}

export interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: string | number
  result?: any
  error?: JsonRpcError
}

export interface JsonRpcError {
  code: number
  message: string
  data?: any
}

export interface JsonRpcNotification {
  jsonrpc: '2.0'
  method: string
  params?: any
}

// MCP Server Configuration
export interface MCPServerConfig {
  id: string
  name: string
  command: string
  args?: string[]
  env?: Record<string, string>
}

// MCP Protocol Messages
export interface InitializeRequest {
  method: 'initialize'
  params: {
    protocolVersion: string
    capabilities: {
      roots?: {
        listChanged?: boolean
      }
      sampling?: {}
    }
    clientInfo: {
      name: string
      version: string
    }
  }
}

export interface InitializeResult {
  protocolVersion: string
  capabilities: {
    logging?: {}
    prompts?: {
      listChanged?: boolean
    }
    resources?: {
      subscribe?: boolean
      listChanged?: boolean
    }
    tools?: {
      listChanged?: boolean
    }
  }
  serverInfo: {
    name: string
    version: string
  }
}

export interface Tool {
  name: string
  description?: string
  inputSchema: {
    type: 'object'
    properties?: Record<string, any>
    required?: string[]
  }
}

export interface Prompt {
  name: string
  description?: string
  arguments?: Array<{
    name: string
    description?: string
    required?: boolean
  }>
}

export interface Resource {
  uri: string
  name: string
  description?: string
  mimeType?: string
}

// Server Status
export type ServerStatus = 'stopped' | 'starting' | 'running' | 'error'

export interface ServerState {
  config: MCPServerConfig
  status: ServerStatus
  error?: string
  capabilities?: InitializeResult['capabilities']
  serverInfo?: InitializeResult['serverInfo']
  tools?: Tool[]
  prompts?: Prompt[]
  resources?: Resource[]
}

// Message Log
export interface MessageLog {
  id: string
  timestamp: number
  type: 'request' | 'response' | 'notification' | 'error'
  method?: string
  data: any
  latency?: number
}
