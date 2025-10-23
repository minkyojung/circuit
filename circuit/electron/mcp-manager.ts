/**
 * MCP Server Manager
 * Manages lifecycle, monitoring, and communication with MCP servers
 */

import { spawn, ChildProcess } from 'child_process'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { getHistoryStorage } from './historyStorage.js'
import { getPrivacyFilter } from './privacyFilter.js'

// Types
export interface MCPServerConfig {
  id: string
  name: string
  packageId: string
  command: string
  args: string[]
  env?: Record<string, string>
  autoStart?: boolean
  autoRestart?: boolean
}

export interface Tool {
  name: string
  description?: string
  inputSchema: any
}

export interface Prompt {
  name: string
  description?: string
  arguments?: any[]
}

export interface Resource {
  uri: string
  name?: string
  description?: string
  mimeType?: string
}

export interface ServerInstance {
  id: string
  name: string
  config: MCPServerConfig

  // Process
  process?: ChildProcess
  transport?: StdioClientTransport
  client?: Client

  // State
  status: 'stopped' | 'starting' | 'running' | 'error'
  startedAt?: number
  lastHealthCheck?: number
  error?: string

  // Capabilities
  tools: Tool[]
  prompts: Prompt[]
  resources: Resource[]

  // Observability
  stats: {
    callCount: number
    errorCount: number
    lastCallDuration: number
    totalDuration: number
  }

  // Timers
  healthCheckInterval?: NodeJS.Timeout
  idleTimer?: NodeJS.Timeout
}

export interface ServerStatus {
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

export class MCPServerManager {
  public servers = new Map<string, ServerInstance>()
  private configPath: string
  private logsDir: string
  private serversDir: string
  private toolsCache = new Map<string, { tools: Tool[], expiry: number }>()

  constructor() {
    const homeDir = os.homedir()
    const circuitDir = path.join(homeDir, '.circuit')

    this.configPath = path.join(circuitDir, 'config.json')
    this.logsDir = path.join(circuitDir, 'logs')
    this.serversDir = path.join(circuitDir, 'servers')

    this.ensureDirectories()
    this.loadConfig()
  }

  private ensureDirectories() {
    const dirs = [
      path.dirname(this.configPath),
      this.logsDir,
      this.serversDir
    ]

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    })
  }

  /**
   * Normalize server ID for filesystem safety and consistency
   * @example '@slack/mcp-server' -> 'slack-mcp-server'
   * @example '@modelcontextprotocol/server-github' -> 'modelcontextprotocol-server-github'
   */
  private normalizeServerId(id: string): string {
    return id.replace(/^@/, '').replace(/\//g, '-')
  }

  private loadConfig() {
    if (!fs.existsSync(this.configPath)) {
      this.saveConfig({ servers: {} })
      return
    }

    try {
      const data = fs.readFileSync(this.configPath, 'utf-8')
      const config = JSON.parse(data)

      let needsMigration = false
      const processedIds = new Set<string>()

      // Initialize server instances from config
      Object.values(config.servers || {}).forEach((serverConfig: any) => {
        // Normalize the ID during load (migration for old configs)
        const normalizedId = this.normalizeServerId(serverConfig.id)

        // Skip duplicates (in case config has both old and new versions)
        if (processedIds.has(normalizedId)) {
          console.log(`[Config Migration] Skipping duplicate: ${serverConfig.id} (already loaded as ${normalizedId})`)
          needsMigration = true
          return
        }

        processedIds.add(normalizedId)

        // Check if this is an old config that needs migration
        if (normalizedId !== serverConfig.id) {
          console.log(`[Config Migration] ${serverConfig.id} -> ${normalizedId}`)
          needsMigration = true
        }

        // Update config with normalized ID
        const updatedConfig = {
          ...serverConfig,
          id: normalizedId
        }

        this.servers.set(normalizedId, {
          id: normalizedId,
          name: serverConfig.name,
          config: updatedConfig,
          status: 'stopped',
          tools: [],
          prompts: [],
          resources: [],
          stats: {
            callCount: 0,
            errorCount: 0,
            lastCallDuration: 0,
            totalDuration: 0
          }
        })
      })

      // Save migrated config (removes duplicates and normalizes IDs)
      if (needsMigration) {
        console.log('[Config Migration] Saving normalized config...')
        this.saveConfig()
      }
    } catch (error) {
      console.error('Failed to load config:', error)
    }
  }

  private saveConfig(config?: any) {
    if (!config) {
      // Generate config from current servers
      const servers: Record<string, MCPServerConfig> = {}
      this.servers.forEach(server => {
        servers[server.id] = server.config
      })
      config = { servers }
    }

    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2))
  }

  /**
   * Install a new MCP server
   * @returns The normalized server ID
   */
  async install(packageId: string, config: Partial<MCPServerConfig>): Promise<string> {
    // Always normalize the ID to be filesystem-safe
    const normalizedId = this.normalizeServerId(config.id || packageId)
    const name = config.name || packageId

    // Check if already installed
    if (this.servers.has(normalizedId)) {
      throw new Error(`Server ${normalizedId} is already installed`)
    }

    const serverConfig: MCPServerConfig = {
      id: normalizedId,
      name,
      packageId,
      command: config.command || 'npx',
      args: config.args || ['-y', packageId],
      env: config.env,
      autoStart: config.autoStart !== undefined ? config.autoStart : true,
      autoRestart: config.autoRestart !== undefined ? config.autoRestart : true
    }

    // Create server instance
    const instance: ServerInstance = {
      id: normalizedId,
      name,
      config: serverConfig,
      status: 'stopped',
      tools: [],
      prompts: [],
      resources: [],
      stats: {
        callCount: 0,
        errorCount: 0,
        lastCallDuration: 0,
        totalDuration: 0
      }
    }

    this.servers.set(normalizedId, instance)
    this.saveConfig()

    console.log(`Installed MCP server: ${name} (${normalizedId})`)

    return normalizedId
  }

  /**
   * Start an MCP server
   */
  async start(serverId: string): Promise<void> {
    const server = this.servers.get(serverId)
    if (!server) {
      throw new Error(`Server ${serverId} not found`)
    }

    if (server.status === 'running') {
      console.log(`Server ${serverId} is already running`)
      return
    }

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`🚀 Starting MCP server: ${server.name}`)
    console.log(`   ID: ${serverId}`)
    console.log(`   Command: ${server.config.command}`)
    console.log(`   Args: ${server.config.args.join(' ')}`)
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

    server.status = 'starting'

    try {
      // Prepare environment
      const processEnv = {
        ...process.env,
        ...server.config.env
      }

      console.log(`[${serverId}] Step 1/6: Creating StdioClientTransport...`)

      // Create MCP client with StdioClientTransport
      const transport = new StdioClientTransport({
        command: server.config.command,
        args: server.config.args,
        env: processEnv
      })

      console.log(`[${serverId}] Step 2/6: Transport created (process will spawn on connect)`)

      console.log(`[${serverId}] Step 3/6: Creating MCP Client...`)

      const client = new Client({
        name: 'circuit-client',
        version: '1.0.0'
      }, {
        capabilities: {}
      })

      console.log(`[${serverId}] Step 4/6: Connecting client to transport...`)
      console.log(`[${serverId}] This will spawn the child process and send MCP initialize request...`)

      // Add timeout to catch hanging connections
      const connectTimeout = setTimeout(() => {
        console.error(`[${serverId}] ⏱️  Connection timeout after 10s`)
      }, 10000)

      try {
        await client.connect(transport)
        clearTimeout(connectTimeout)
        console.log(`[${serverId}] ✅ Step 5/6: Client connected successfully`)
      } catch (connectError) {
        clearTimeout(connectTimeout)
        console.error(`[${serverId}] ❌ Connection failed:`, connectError)
        throw connectError
      }

      // NOW access the child process (spawned during connect)
      // @ts-ignore - accessing internal property
      const childProcess = transport._process

      if (!childProcess) {
        console.error(`[${serverId}] ❌ No child process after connection`)
        throw new Error('Transport did not spawn child process')
      }

      console.log(`[${serverId}] Step 6/6: Setting up process monitoring (PID: ${childProcess.pid})`)

      // Setup logging AFTER connection
      this.setupLogging(serverId, childProcess)

      // Monitor process state
      childProcess.on('error', (error) => {
        console.error(`[${serverId}] ❌ Process error:`, error)
        this.handleServerError(serverId, error)
      })

      childProcess.on('exit', (code, signal) => {
        console.log(`[${serverId}] 🛑 Process exited (code: ${code}, signal: ${signal})`)
        server.status = 'stopped'

        if (server.config.autoRestart && code !== 0) {
          console.log(`[${serverId}] 🔄 Auto-restarting in 2s...`)
          setTimeout(() => this.start(serverId), 2000)
        }
      })

      // Log stderr in real-time and detect npm errors
      if (childProcess.stderr) {
        let stderrBuffer = ''
        childProcess.stderr.on('data', (data) => {
          const output = data.toString()
          stderrBuffer += output
          console.error(`[${serverId}] stderr:`, output.trim())

          // Detect npm 404 errors for better error messages
          if (output.includes('npm error code E404') || output.includes('404 Not Found')) {
            console.error(`[${serverId}] ⚠️  Package not found in npm registry`)
            server.error = `Package '${server.config.packageId}' not found in npm registry. Please verify the package name.`
          }
        })
      }

      // Update server instance
      server.process = childProcess
      server.transport = transport
      server.client = client
      server.status = 'running'
      server.startedAt = Date.now()

      console.log(`[${serverId}] ✅ Server running successfully`)
      console.log(`[${serverId}] Fetching capabilities...`)

      // Fetch initial capabilities
      await this.fetchServerCapabilities(serverId)

      console.log(`[${serverId}] Starting health check...`)

      // Start health check
      this.startHealthCheck(serverId)

      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      console.log(`✅ ${server.name} startup complete`)
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

    } catch (error) {
      console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      console.error(`❌ Failed to start ${server.name}:`, error)
      console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      this.handleServerError(serverId, error as Error)
      throw error
    }
  }

  /**
   * Uninstall an MCP server
   */
  async uninstall(serverId: string): Promise<void> {
    const server = this.servers.get(serverId)
    if (!server) {
      throw new Error(`Server ${serverId} not found`)
    }

    console.log(`Uninstalling MCP server: ${server.name} (${serverId})`)

    // Stop the server first if running
    if (server.status === 'running') {
      await this.stop(serverId)
    }

    // Remove from servers map
    this.servers.delete(serverId)

    // Save updated config
    this.saveConfig()

    console.log(`Uninstalled MCP server: ${server.name}`)
  }

  /**
   * Stop an MCP server
   */
  async stop(serverId: string): Promise<void> {
    const server = this.servers.get(serverId)
    if (!server) {
      throw new Error(`Server ${serverId} not found`)
    }

    if (server.status === 'stopped') {
      console.log(`Server ${serverId} is already stopped`)
      return
    }

    console.log(`Stopping MCP server: ${server.name}`)

    try {
      // Clear timers
      if (server.healthCheckInterval) {
        clearInterval(server.healthCheckInterval)
      }
      if (server.idleTimer) {
        clearTimeout(server.idleTimer)
      }

      // Close client
      if (server.client) {
        await server.client.close()
      }

      // Kill process
      if (server.process) {
        server.process.kill()
      }

      // Update state
      server.status = 'stopped'
      server.process = undefined
      server.transport = undefined
      server.client = undefined
      server.tools = []
      server.prompts = []
      server.resources = []

      console.log(`Server ${serverId} stopped`)
    } catch (error) {
      console.error(`Failed to stop server ${serverId}:`, error)
      throw error
    }
  }

  /**
   * Restart an MCP server
   */
  async restart(serverId: string): Promise<void> {
    await this.stop(serverId)
    await new Promise(resolve => setTimeout(resolve, 1000))
    await this.start(serverId)
  }

  /**
   * Fetch server capabilities (tools, prompts, resources)
   */
  private async fetchServerCapabilities(serverId: string): Promise<void> {
    const server = this.servers.get(serverId)
    if (!server || !server.client) return

    try {
      const [toolsResult, promptsResult, resourcesResult] = await Promise.all([
        server.client.listTools().catch(() => ({ tools: [] })),
        server.client.listPrompts().catch(() => ({ prompts: [] })),
        server.client.listResources().catch(() => ({ resources: [] }))
      ])

      server.tools = toolsResult.tools || []
      server.prompts = promptsResult.prompts || []
      server.resources = resourcesResult.resources || []

      console.log(`Fetched capabilities for ${serverId}: ${server.tools.length} tools, ${server.prompts.length} prompts`)

      // Update cache
      this.toolsCache.set(serverId, {
        tools: server.tools,
        expiry: Date.now() + 60000 // 1 minute TTL
      })
    } catch (error) {
      console.error(`Failed to fetch capabilities for ${serverId}:`, error)
    }
  }

  /**
   * List tools from a server (with caching)
   */
  async listTools(serverId: string): Promise<Tool[]> {
    const cached = this.toolsCache.get(serverId)
    if (cached && cached.expiry > Date.now()) {
      return cached.tools
    }

    const server = this.servers.get(serverId)
    if (!server || !server.client || server.status !== 'running') {
      return []
    }

    try {
      const result = await server.client.listTools()
      const tools = (result.tools || []) as any

      this.toolsCache.set(serverId, {
        tools,
        expiry: Date.now() + 60000
      })

      return tools
    } catch (error) {
      console.error(`Failed to list tools for ${serverId}:`, error)
      return []
    }
  }

  /**
   * Call a tool
   */
  async callTool(serverId: string, toolName: string, args: any): Promise<any> {
    const server = this.servers.get(serverId)
    if (!server) {
      throw new Error(`Server ${serverId} not found`)
    }

    // Auto-start if stopped
    if (server.status !== 'running') {
      console.log(`Auto-starting ${serverId} for tool call`)
      await this.start(serverId)
    }

    if (!server.client) {
      throw new Error(`Server ${serverId} client not available`)
    }

    // Reset idle timer
    this.startIdleTimer(serverId)

    // Measure performance
    const startTime = Date.now()

    // Record call in history (async, don't block)
    this.recordCallStart(serverId, server.name, toolName, args).catch(error => {
      console.error('[MCPManager] Failed to record call start:', error)
    })

    try {
      const result = await server.client.callTool({
        name: toolName,
        arguments: args
      })

      const duration = Date.now() - startTime

      // Update stats
      server.stats.callCount++
      server.stats.lastCallDuration = duration
      server.stats.totalDuration += duration

      console.log(`Tool call ${toolName} completed in ${duration}ms`)

      // Record success in history (async, don't block)
      this.recordCallSuccess(serverId, server.name, toolName, args, result, duration).catch(error => {
        console.error('[MCPManager] Failed to record call success:', error)
      })

      return result
    } catch (error) {
      server.stats.errorCount++
      console.error(`Tool call ${toolName} failed:`, error)

      // Record error in history (async, don't block)
      const duration = Date.now() - startTime
      this.recordCallError(serverId, server.name, toolName, args, error, duration).catch(err => {
        console.error('[MCPManager] Failed to record call error:', err)
      })

      throw error
    }
  }

  /**
   * Get server status
   */
  async getStatus(serverId: string): Promise<ServerStatus> {
    const server = this.servers.get(serverId)
    if (!server) {
      throw new Error(`Server ${serverId} not found`)
    }

    return {
      id: server.id,
      name: server.name,
      status: server.status,
      uptime: server.startedAt ? Date.now() - server.startedAt : undefined,
      stats: {
        callCount: server.stats.callCount,
        errorCount: server.stats.errorCount,
        avgCallDuration: server.stats.callCount > 0
          ? Math.round(server.stats.totalDuration / server.stats.callCount)
          : 0
      },
      toolCount: server.tools.length,
      tools: server.tools,
      prompts: server.prompts,
      error: server.error
    }
  }

  /**
   * Get all server statuses
   */
  async getAllStatuses(): Promise<ServerStatus[]> {
    const statuses: ServerStatus[] = []

    for (const [serverId] of this.servers) {
      const status = await this.getStatus(serverId)
      statuses.push(status)
    }

    return statuses
  }

  /**
   * Get logs for a server
   */
  async getLogs(serverId: string, lines: number = 100): Promise<string[]> {
    // Sanitize serverId for filesystem safety (must match setupLogging)
    const safeServerId = serverId.replace(/[@/\\:*?"<>|]/g, '-')
    const logPath = path.join(this.logsDir, `${safeServerId}.log`)

    if (!fs.existsSync(logPath)) {
      return []
    }

    try {
      const data = fs.readFileSync(logPath, 'utf-8')
      const allLines = data.split('\n').filter(line => line.trim())
      return allLines.slice(-lines)
    } catch (error) {
      console.error(`Failed to read logs for ${serverId}:`, error)
      return []
    }
  }

  /**
   * Find server by tool name
   */
  async findServerByTool(toolName: string): Promise<string | null> {
    for (const [serverId, server] of this.servers) {
      if (server.status !== 'running') continue

      const tools = await this.listTools(serverId)
      if (tools.some(t => t.name === toolName)) {
        return serverId
      }
    }
    return null
  }

  /**
   * Start all auto-start servers
   */
  async startAllAutoStartServers(): Promise<void> {
    const toStart = Array.from(this.servers.values())
      .filter(s => s.config.autoStart)
      .map(s => s.id)

    if (toStart.length === 0) {
      console.log('No auto-start servers configured')
      return
    }

    console.log(`Starting ${toStart.length} auto-start servers...`)
    await Promise.all(toStart.map(id => this.start(id).catch(err => {
      console.error(`Failed to auto-start ${id}:`, err)
    })))
  }

  /**
   * Setup logging for a server process
   */
  private setupLogging(serverId: string, process: ChildProcess): void {
    // Sanitize serverId for filesystem safety
    const safeServerId = serverId.replace(/[@/\\:*?"<>|]/g, '-')
    const logPath = path.join(this.logsDir, `${safeServerId}.log`)

    // Ensure log directory exists
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true })
    }

    const logStream = fs.createWriteStream(logPath, { flags: 'a' })

    const timestamp = () => new Date().toISOString()

    if (process.stdout) {
      process.stdout.on('data', (data) => {
        logStream.write(`[${timestamp()}] [stdout] ${data}`)
      })
    }

    if (process.stderr) {
      process.stderr.on('data', (data) => {
        logStream.write(`[${timestamp()}] [stderr] ${data}`)
      })
    }

    process.on('exit', () => {
      logStream.end()
    })

    // Rotate logs if too large
    this.rotateLogs(serverId)
  }

  /**
   * Rotate logs if they exceed 100MB
   */
  private rotateLogs(serverId: string): void {
    // Sanitize serverId for filesystem safety (must match setupLogging)
    const safeServerId = serverId.replace(/[@/\\:*?"<>|]/g, '-')
    const logPath = path.join(this.logsDir, `${safeServerId}.log`)

    if (!fs.existsSync(logPath)) return

    const stats = fs.statSync(logPath)
    const maxSize = 100 * 1024 * 1024 // 100MB

    if (stats.size > maxSize) {
      const timestamp = Date.now()
      const archivePath = `${logPath}.${timestamp}`
      fs.renameSync(logPath, archivePath)
      console.log(`Rotated logs for ${serverId}: ${archivePath}`)

      // TODO: Compress with gzip
    }
  }

  /**
   * Start health check for a server
   */
  private startHealthCheck(serverId: string): void {
    const server = this.servers.get(serverId)
    if (!server) return

    // Clear existing interval
    if (server.healthCheckInterval) {
      clearInterval(server.healthCheckInterval)
    }

    server.healthCheckInterval = setInterval(async () => {
      if (!server.client || server.status !== 'running') {
        return
      }

      try {
        // Ping by listing tools
        await server.client.listTools()
        server.lastHealthCheck = Date.now()
        server.error = undefined
      } catch (error) {
        console.error(`Health check failed for ${serverId}:`, error)
        this.handleServerError(serverId, error as Error)
      }
    }, 30000) // 30 seconds
  }

  /**
   * Start idle timer (auto-stop after 5 min of inactivity)
   */
  private startIdleTimer(serverId: string): void {
    const server = this.servers.get(serverId)
    if (!server) return

    if (server.idleTimer) {
      clearTimeout(server.idleTimer)
    }

    server.idleTimer = setTimeout(() => {
      console.log(`Stopping idle server: ${serverId}`)
      this.stop(serverId).catch(err => {
        console.error(`Failed to stop idle server ${serverId}:`, err)
      })
    }, 5 * 60 * 1000) // 5 minutes
  }

  /**
   * Handle server error
   */
  private handleServerError(serverId: string, error: Error): void {
    const server = this.servers.get(serverId)
    if (!server) return

    server.status = 'error'
    server.error = error.message

    console.error(`Server ${serverId} error:`, error.message)

    // Auto-restart if enabled
    if (server.config.autoRestart && server.status === 'error') {
      console.log(`Auto-restarting ${serverId} due to error...`)
      setTimeout(() => {
        this.restart(serverId).catch(err => {
          console.error(`Failed to auto-restart ${serverId}:`, err)
        })
      }, 5000)
    }
  }

  // ============================================================================
  // Call History Recording
  // ============================================================================

  /**
   * Record start of a tool call
   */
  private async recordCallStart(
    serverId: string,
    serverName: string,
    toolName: string,
    args: any
  ): Promise<void> {
    // This is a placeholder - actual implementation would store pending call
    // For now, we'll just record the complete call (success or error)
  }

  /**
   * Record successful tool call
   */
  private async recordCallSuccess(
    serverId: string,
    serverName: string,
    toolName: string,
    args: any,
    result: any,
    duration: number
  ): Promise<void> {
    try {
      const storage = await getHistoryStorage()
      const filter = getPrivacyFilter()

      // Create call record
      const call = {
        timestamp: Date.now(),
        duration,
        serverId,
        serverName,
        method: 'tools/call',
        toolName,
        requestParams: JSON.stringify(args || {}),
        requestRaw: JSON.stringify({ name: toolName, arguments: args }),
        responseResult: JSON.stringify(result || {}),
        responseRaw: JSON.stringify(result),
        status: 'success' as const,
        source: 'claude-code',
      }

      // Apply privacy filters
      const sanitized = filter.sanitizeCall(call)

      // Store in database
      await storage.storeCall(sanitized)
    } catch (error) {
      console.error('[MCPManager] Failed to record call success:', error)
      // Don't throw - history recording should not break tool calls
    }
  }

  /**
   * Record failed tool call
   */
  private async recordCallError(
    serverId: string,
    serverName: string,
    toolName: string,
    args: any,
    error: any,
    duration: number
  ): Promise<void> {
    try {
      const storage = await getHistoryStorage()
      const filter = getPrivacyFilter()

      // Create call record
      const call = {
        timestamp: Date.now(),
        duration,
        serverId,
        serverName,
        method: 'tools/call',
        toolName,
        requestParams: JSON.stringify(args || {}),
        requestRaw: JSON.stringify({ name: toolName, arguments: args }),
        responseError: JSON.stringify({
          code: -1,
          message: error?.message || String(error),
          data: error?.data,
        }),
        responseRaw: JSON.stringify({ error }),
        status: 'error' as const,
        source: 'claude-code',
      }

      // Apply privacy filters
      const sanitized = filter.sanitizeCall(call)

      // Store in database
      await storage.storeCall(sanitized)
    } catch (err) {
      console.error('[MCPManager] Failed to record call error:', err)
      // Don't throw - history recording should not break tool calls
    }
  }

  /**
   * Cleanup on shutdown
   */
  async cleanup(): Promise<void> {
    console.log('Cleaning up MCP Server Manager...')

    const stopPromises = Array.from(this.servers.keys()).map(id =>
      this.stop(id).catch(err => console.error(`Failed to stop ${id}:`, err))
    )

    await Promise.all(stopPromises)
    console.log('All MCP servers stopped')

    // Close history storage
    try {
      const storage = await getHistoryStorage()
      await storage.close()
    } catch (error) {
      console.error('Failed to close history storage:', error)
    }
  }
}

// Singleton instance
let instance: MCPServerManager | null = null

export function getMCPManager(): MCPServerManager {
  if (!instance) {
    instance = new MCPServerManager()
  }
  return instance
}
