/**
 * MCP Call History Type Definitions
 *
 * Comprehensive type system for tracking and analyzing MCP tool calls,
 * requests, responses, and analytics.
 */

/**
 * Status of an MCP call
 */
export type MCPCallStatus = 'pending' | 'success' | 'error' | 'timeout'

/**
 * Direction of MCP communication
 */
export type MCPCallDirection = 'request' | 'response' | 'notification'

/**
 * Source of the MCP call
 */
export type MCPCallSource = 'claude-code' | 'circuit-test' | 'circuit-ui' | 'unknown'

/**
 * Complete MCP call record with request and response
 */
export interface MCPCall {
  // Unique identifier
  id: string // UUID

  // Timing
  timestamp: number // Unix timestamp (ms)
  duration?: number // Execution time in ms

  // Server information
  serverId: string // e.g., 'filesystem-server'
  serverName: string // e.g., 'Filesystem'

  // Call information
  direction: MCPCallDirection
  method: string // e.g., 'tools/call', 'resources/read', 'prompts/get'

  // Tool-specific (for tools/call method)
  toolName?: string // e.g., 'read_file', 'write_file'

  // Request data
  request: {
    params: any // Actual parameters
    raw: string // JSON string of full request
  }

  // Response data (undefined for pending calls)
  response?: {
    result?: any // Success result
    error?: {
      code: number
      message: string
      data?: any
    }
    raw: string // JSON string of full response
  }

  // Status
  status: MCPCallStatus

  // Metadata
  metadata: {
    source: MCPCallSource
    sessionId?: string // Claude session ID (if available)
    conversationId?: string // Conversation ID (if available)
    truncated?: boolean // True if data was truncated for size
  }
}

/**
 * Query parameters for filtering history
 */
export interface HistoryQuery {
  // Server filter
  serverId?: string

  // Tool filter
  toolName?: string

  // Status filter
  status?: MCPCallStatus

  // Time range
  after?: number // Timestamp - show calls after this time
  before?: number // Timestamp - show calls before this time

  // Pagination (cursor-based)
  cursor?: number // Timestamp cursor for pagination
  limit?: number // Max results (default 50)

  // Search
  searchQuery?: string // Search in params/results
}

/**
 * Aggregated statistics for calls
 */
export interface CallStats {
  totalCalls: number
  successCount: number
  errorCount: number
  successRate: number // 0-1
  avgDuration: number // ms
  callsByTool: Record<string, number> // { 'read_file': 123, ... }
  callsByStatus: Record<MCPCallStatus, number>
}

/**
 * Time-series data point for analytics
 */
export interface TimeSeriesPoint {
  timestamp: number
  count: number
  avgDuration?: number
  errorCount?: number
}

/**
 * Complete history result with stats
 */
export interface HistoryResult {
  calls: MCPCall[]
  stats: CallStats
  timeSeries?: TimeSeriesPoint[]
  hasMore: boolean // True if more results available
  nextCursor?: number // Next cursor for pagination
}

/**
 * Privacy configuration for data masking
 */
export interface PrivacyConfig {
  maskFilePaths: boolean // Mask file paths
  maskEnvVars: boolean // Mask environment variables
  maskCredentials: boolean // Mask passwords, API keys, etc.
  maxParamSize: number // Max size of params to store (bytes)
  retention: {
    days: number // Auto-delete after N days (0 = never)
    maxCalls: number // Max calls to keep (0 = unlimited)
  }
}

/**
 * Default privacy configuration
 */
export const DEFAULT_PRIVACY_CONFIG: PrivacyConfig = {
  maskFilePaths: true,
  maskEnvVars: true,
  maskCredentials: true,
  maxParamSize: 100 * 1024, // 100KB
  retention: {
    days: 7, // Keep for 1 week
    maxCalls: 10000, // Max 10k calls
  },
}
