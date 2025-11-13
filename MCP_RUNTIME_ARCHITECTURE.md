# Octave MCP Runtime Architecture

> **Product Direction**: Octave as MCP Package Manager, Discover Platform, Playground, and Health Monitor

**Last Updated**: 2025-01-23

---

## Executive Summary

Octave은 **MCP 서버를 직접 실행하고 관리하는 중앙 런타임 플랫폼**입니다.

Claude Code, Cursor, Windsurf 등의 AI 코딩 도구가 Octave이 실행하는 MCP 서버들을 통해 도구를 사용하도록 하여, 사용자가 **한 곳에서 모든 MCP를 관리**할 수 있게 합니다.

### Core Value Propositions

1. **One-Click Installation** - "Add to Claude" 버튼 클릭만으로 MCP 설치
2. **Unified Management** - 모든 AI 도구의 MCP를 Octave에서 통합 관리
3. **Real-time Monitoring** - 서버 상태, 성능, 로그 실시간 확인
4. **Instant Testing** - Playground에서 즉시 도구 테스트

---

## Architecture Decision: 방식 2 (Octave as Runtime)

### Comparison with Alternative Approach

| 항목 | ❌ 방식 1: CLI 래퍼 | ✅ 방식 2: Octave Runtime |
|------|-------------------|--------------------------|
| **설치 방법** | `claude mcp add` 실행 | Octave이 MCP 프로세스 spawn |
| **MCP 실행 주체** | Claude Code | Octave |
| **Octave 종료 시** | MCP 계속 작동 | MCP 중단 (Trade-off) |
| **상태 모니터링** | ❌ 불가능 | ✅ 완전한 가시성 |
| **로그 수집** | ❌ 없음 | ✅ 실시간 수집 |
| **디버깅** | ❌ 어려움 | ✅ 쉬움 |
| **성능 메트릭** | ❌ 없음 | ✅ API 호출 수, 응답 시간 |
| **제품 가치** | 낮음 (단순 UI) | 높음 (플랫폼) |

**선택 이유**: Octave의 핵심 가치는 "관리 및 모니터링"이므로, MCP를 직접 실행해야 합니다.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Octave Electron App                    │
├─────────────────────────────────────────────────────────────┤
│  Renderer Process                                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ DiscoverTab │  │InstalledTab │  │PlaygroundTab│         │
│  │             │  │             │  │             │         │
│  │ • Search    │  │ • Status    │  │ • Test Tools│         │
│  │ • Install   │  │ • Logs      │  │ • Try MCP   │         │
│  │ • Recommend │  │ • Metrics   │  │ • Debug     │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│         │                 │                 │                │
│         └─────────────────┴─────────────────┘                │
│                          │                                   │
│                          │ IPC                               │
├──────────────────────────┼───────────────────────────────────┤
│  Main Process            │                                   │
│  ┌───────────────────────▼────────────────────────┐         │
│  │        MCP Server Manager                      │         │
│  │  ┌──────────────────────────────────────────┐  │         │
│  │  │  Server Lifecycle Management             │  │         │
│  │  │  • install() - npm install / npx cache   │  │         │
│  │  │  • start() - spawn process + transport   │  │         │
│  │  │  • stop() - graceful shutdown            │  │         │
│  │  │  • restart() - stop + start              │  │         │
│  │  └──────────────────────────────────────────┘  │         │
│  │  ┌──────────────────────────────────────────┐  │         │
│  │  │  MCP Protocol Handling                   │  │         │
│  │  │  • StdioClientTransport                  │  │         │
│  │  │  • Client.listTools()                    │  │         │
│  │  │  • Client.callTool()                     │  │         │
│  │  │  • Client.listPrompts()                  │  │         │
│  │  └──────────────────────────────────────────┘  │         │
│  │  ┌──────────────────────────────────────────┐  │         │
│  │  │  Monitoring & Observability              │  │         │
│  │  │  • Health checks (30s interval)          │  │         │
│  │  │  • Log collection (stderr/stdout)        │  │         │
│  │  │  • Performance metrics (call count, etc) │  │         │
│  │  │  • Error tracking & auto-restart         │  │         │
│  │  └──────────────────────────────────────────┘  │         │
│  └───────────────────────┬────────────────────────┘         │
│                          │                                   │
│  ┌───────────────────────▼────────────────────────┐         │
│  │        HTTP API Server (localhost:3737)        │         │
│  │  • GET  /mcp/tools - All tools from all servers│         │
│  │  • POST /mcp/call - Proxy tool call            │         │
│  │  • GET  /mcp/status - Server health            │         │
│  └────────────────────────────────────────────────┘         │
└─────────────────────────┬───────────────────────────────────┘
                          │
         ┌────────────────┴────────────────┐
         │                                 │
    ┌────▼────┐                   ┌────────▼────────┐
    │ MCP     │                   │ MCP             │
    │ Server  │                   │ Server          │
    │ GitHub  │                   │ Slack           │
    │         │                   │                 │
    │ Process │                   │ Process         │
    └─────────┘                   └─────────────────┘

                          │
         ┌────────────────┴────────────────┐
         │ circuit-proxy (stdio)           │
         │ • MCP 프록시 서버               │
         │ • Octave HTTP API 호출         │
         └────────┬────────────────────────┘
                  │
         ┌────────▼────────┐
         │ Claude Code     │
         │ Cursor          │
         │ Windsurf        │
         └─────────────────┘
```

---

## Component Details

### 1. MCP Server Manager (Electron Main)

**Location**: `circuit/electron/mcp-manager.ts`

```typescript
class MCPServerManager {
  private servers: Map<string, ServerInstance>

  // Core lifecycle
  async install(packageId: string, config: MCPPackageConfig): Promise<void>
  async start(serverId: string): Promise<void>
  async stop(serverId: string): Promise<void>
  async restart(serverId: string): Promise<void>

  // Protocol operations
  async listTools(serverId: string): Promise<Tool[]>
  async callTool(serverId: string, toolName: string, args: any): Promise<any>
  async listPrompts(serverId: string): Promise<Prompt[]>
  async listResources(serverId: string): Promise<Resource[]>

  // Monitoring
  async getStatus(serverId: string): Promise<ServerStatus>
  async getLogs(serverId: string, lines?: number): Promise<string[]>
  async getMetrics(serverId: string): Promise<ServerMetrics>

  // Internal
  private startHealthCheck(serverId: string): void
  private setupLogging(serverId: string, process: ChildProcess): void
  private handleServerError(serverId: string, error: Error): void
}
```

**ServerInstance Structure**:
```typescript
interface ServerInstance {
  id: string
  name: string
  config: MCPServerConfig

  // Process
  process: ChildProcess
  transport: StdioClientTransport
  client: Client

  // State
  status: 'stopped' | 'starting' | 'running' | 'error'
  startedAt: number
  lastHealthCheck: number
  error?: string

  // Observability
  logs: string[]
  stats: {
    callCount: number
    errorCount: number
    lastCallDuration: number
    avgCallDuration: number
  }

  // Capabilities
  tools: Tool[]
  prompts: Prompt[]
  resources: Resource[]

  // Config
  autoStart: boolean
  autoRestart: boolean
  idleTimer?: NodeJS.Timeout
}
```

---

### 2. IPC API (Main ↔ Renderer)

**Location**: `circuit/electron/main.cjs`

```typescript
// Installation
ipcMain.handle('circuit:mcp-install', async (event, packageId, config) => {
  return await mcpManager.install(packageId, config)
})

// Lifecycle
ipcMain.handle('circuit:mcp-start', async (event, serverId) => {
  return await mcpManager.start(serverId)
})

ipcMain.handle('circuit:mcp-stop', async (event, serverId) => {
  return await mcpManager.stop(serverId)
})

ipcMain.handle('circuit:mcp-restart', async (event, serverId) => {
  return await mcpManager.restart(serverId)
})

// Queries
ipcMain.handle('circuit:mcp-list-tools', async (event, serverId) => {
  return await mcpManager.listTools(serverId)
})

ipcMain.handle('circuit:mcp-get-status', async (event, serverId) => {
  return await mcpManager.getStatus(serverId)
})

ipcMain.handle('circuit:mcp-get-all-status', async () => {
  const statuses = []
  for (const [id, server] of mcpManager.servers) {
    statuses.push(await mcpManager.getStatus(id))
  }
  return statuses
})

ipcMain.handle('circuit:mcp-get-logs', async (event, serverId, lines = 100) => {
  return await mcpManager.getLogs(serverId, lines)
})

// Tool execution
ipcMain.handle('circuit:mcp-call-tool', async (event, serverId, toolName, args) => {
  return await mcpManager.callTool(serverId, toolName, args)
})
```

---

### 3. HTTP API Server (Octave → Claude Code)

**Location**: `circuit/electron/api-server.ts`

```typescript
import express from 'express'
import cors from 'cors'

const app = express()
app.use(cors())
app.use(express.json())

// List all tools from all running servers
app.get('/mcp/tools', async (req, res) => {
  const allTools = []

  for (const [serverId, server] of mcpManager.servers) {
    if (server.status !== 'running') continue

    const tools = await server.client.listTools()
    allTools.push(...tools.tools.map(t => ({
      ...t,
      _serverId: serverId,
      _serverName: server.name
    })))
  }

  res.json({ tools: allTools })
})

// Call a tool (proxy to actual server)
app.post('/mcp/call', async (req, res) => {
  const { toolName, arguments: args } = req.body

  // Find which server has this tool
  const serverId = await mcpManager.findServerByTool(toolName)

  if (!serverId) {
    return res.status(404).json({ error: 'Tool not found' })
  }

  try {
    const result = await mcpManager.callTool(serverId, toolName, args)
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

// Health status
app.get('/mcp/status', async (req, res) => {
  const statuses = {}

  for (const [serverId, server] of mcpManager.servers) {
    statuses[serverId] = {
      status: server.status,
      uptime: Date.now() - server.startedAt,
      stats: server.stats
    }
  }

  res.json(statuses)
})

app.listen(3737, () => {
  console.log('Octave MCP API listening on http://localhost:3737')
})
```

---

### 4. Octave Proxy (Claude Code Integration)

**Location**: `~/.circuit/bin/circuit-proxy`

사용자가 Claude Code에서 단 한 번만 설치:
```bash
claude mcp add circuit -s stdio ~/.circuit/bin/circuit-proxy
```

**Implementation**:
```typescript
#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

const CIRCUIT_API = 'http://localhost:3737'

const server = new Server({
  name: 'circuit-proxy',
  version: '1.0.0'
})

// List all tools from Octave
server.setRequestHandler('tools/list', async () => {
  const res = await fetch(`${CIRCUIT_API}/mcp/tools`)
  const data = await res.json()
  return { tools: data.tools }
})

// Proxy tool calls to Octave
server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params

  const res = await fetch(`${CIRCUIT_API}/mcp/call`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toolName: name, arguments: args })
  })

  return await res.json()
})

// Start stdio transport
const transport = new StdioServerTransport()
await server.connect(transport)
```

---

## Data Flow Examples

### Example 1: Installing GitHub MCP

```
1. User clicks "Add to Claude" on GitHub MCP card
   → DiscoverTab.handleInstall()

2. IPC: circuit:mcp-install
   → mcpManager.install('@modelcontextprotocol/server-github', config)
   → npm install OR npx cache to ~/.circuit/servers/github/

3. IPC: circuit:mcp-start
   → mcpManager.start('github')
   → spawn('npx', ['-y', '@modelcontextprotocol/server-github'])
   → StdioClientTransport connects
   → Client.listTools() → Store in server.tools

4. UI updates
   → Navigate to InstalledTab
   → Show "GitHub Server ✅ Running, 3 tools available"
```

---

### Example 2: Claude Code Calls GitHub Tool

```
1. User in Claude Code: "Search my starred repos"
   → Claude Code MCP client calls circuit-proxy

2. circuit-proxy receives tools/call
   → toolName: "search_repositories"
   → arguments: { query: "user:me stars:>100" }

3. circuit-proxy → HTTP POST to localhost:3737/mcp/call
   → Octave API Server receives request

4. API Server → mcpManager.callTool('github', 'search_repositories', ...)
   → Octave's MCP Client calls actual GitHub MCP server

5. GitHub MCP server responds
   → Octave records metrics (call count, duration)
   → Returns result to API Server

6. API Server → circuit-proxy → Claude Code
   → User sees search results
```

---

### Example 3: Monitoring Server Health

```
1. Octave Main starts health check loop (30s interval)
   → mcpManager.startHealthCheck('github')

2. Every 30s:
   → Try client.listTools() as ping
   → If success: server.status = 'running', update lastHealthCheck
   → If error: server.status = 'error', store error message

3. If autoRestart enabled and error:
   → mcpManager.restart('github')
   → Log restart event

4. InstalledTab polls status every 1s
   → IPC: circuit:mcp-get-all-status
   → UI updates with real-time status
```

---

## File System Structure

```
~/.circuit/
├── servers/                    # Installed MCP servers
│   ├── github/
│   │   └── node_modules/...
│   ├── slack/
│   └── notion/
├── logs/                       # Server logs
│   ├── github.log
│   ├── slack.log
│   └── notion.log.1234.gz     # Rotated logs
├── config.json                 # Octave configuration
│   {
│     "servers": {
│       "github": {
│         "id": "github",
│         "packageId": "@modelcontextprotocol/server-github",
│         "command": "npx",
│         "args": ["-y", "@modelcontextprotocol/server-github"],
│         "autoStart": true,
│         "autoRestart": true
│       }
│     }
│   }
└── bin/
    └── circuit-proxy           # Claude Code integration
```

---

## Performance Optimizations

### 1. Lazy Loading
```typescript
// MCP 서버는 첫 도구 호출 시 시작
async callTool(serverId: string, toolName: string, args: any) {
  let server = this.servers.get(serverId)

  if (!server || server.status !== 'running') {
    await this.start(serverId)
  }

  return await server.client.callTool({ name: toolName, arguments: args })
}
```

### 2. Tool Cache
```typescript
// listTools 결과를 1분간 캐싱
private toolsCache = new Map<string, { tools: Tool[], expiry: number }>()

async listTools(serverId: string) {
  const cached = this.toolsCache.get(serverId)
  if (cached && cached.expiry > Date.now()) {
    return cached.tools
  }

  const tools = await server.client.listTools()
  this.toolsCache.set(serverId, {
    tools: tools.tools,
    expiry: Date.now() + 60000
  })
  return tools.tools
}
```

### 3. Idle Timeout
```typescript
// 5분간 미사용 시 자동 중지 (메모리 절약)
private startIdleTimer(serverId: string) {
  const server = this.servers.get(serverId)

  clearTimeout(server.idleTimer)
  server.idleTimer = setTimeout(() => {
    console.log(`Stopping idle server: ${serverId}`)
    this.stop(serverId)
  }, 5 * 60 * 1000)
}

async callTool(serverId: string, toolName: string, args: any) {
  this.startIdleTimer(serverId)  // Reset timer on every call
  // ... rest of implementation
}
```

### 4. Log Rotation
```typescript
// 100MB 초과 시 로그 압축
private rotateLogs(serverId: string) {
  const logPath = `~/.circuit/logs/${serverId}.log`
  const stats = fs.statSync(logPath)

  if (stats.size > 100 * 1024 * 1024) {
    const timestamp = Date.now()
    fs.renameSync(logPath, `${logPath}.${timestamp}`)
    execSync(`gzip ${logPath}.${timestamp}`)
  }
}
```

### 5. Parallel Server Start
```typescript
// Octave 시작 시 모든 autoStart 서버 병렬 시작
async startAllAutoStartServers() {
  const config = this.loadConfig()
  const toStart = Object.values(config.servers)
    .filter(s => s.autoStart)
    .map(s => s.id)

  await Promise.all(toStart.map(id => this.start(id)))
}
```

---

## Implementation Phases

### Phase 1: Core Runtime (Week 1-2)
- [ ] MCP Server Manager 기본 구현
  - install/start/stop/restart
  - StdioClientTransport 연동
- [ ] IPC API 구현
- [ ] DiscoverTab 설치 로직
- [ ] InstalledTab 상태 모니터링 UI

### Phase 2: Monitoring & Observability (Week 3)
- [ ] Health check 시스템
- [ ] Log collection & rotation
- [ ] Performance metrics
- [ ] Auto-restart logic

### Phase 3: Claude Code Integration (Week 4)
- [ ] HTTP API Server
- [ ] circuit-proxy 구현
- [ ] 설치 자동화 (~/. circuit/bin/)

### Phase 4: Performance & Polish (Week 5)
- [ ] Lazy loading
- [ ] Tool caching
- [ ] Idle timeout
- [ ] Parallel server start

---

## Trade-offs & Mitigations

### Trade-off 1: Octave 종료 시 MCP 중단
**Problem**: Octave이 꺼지면 Claude Code가 도구 사용 불가

**Mitigation**:
- Octave을 macOS Login Items에 자동 추가
- Octave 백그라운드 모드 (메뉴바만 표시)
- "Octave이 꺼졌습니다" 알림을 Claude Code에서 표시 가능

### Trade-off 2: 메모리 사용량 증가
**Problem**: 모든 MCP 서버를 Octave이 실행하면 메모리 사용

**Mitigation**:
- Lazy loading (미사용 서버는 종료)
- Idle timeout (5분 미사용 시 자동 종료)
- 사용자가 autoStart 선택 가능

### Trade-off 3: 구현 복잡도
**Problem**: 프로세스 관리, 에러 처리, 로그 수집 등 복잡

**Mitigation**:
- 단계별 구현 (Phase 1부터)
- 기존 MCP SDK 활용 (StdioClientTransport)
- 철저한 에러 핸들링

---

## Success Criteria

### Technical
- [ ] 10개 MCP 서버 동시 실행 시 메모리 < 500MB
- [ ] Tool call latency < 100ms (proxy overhead)
- [ ] 99.9% uptime (auto-restart)
- [ ] Log rotation 정상 작동

### User Experience
- [ ] "Add to Claude" → Claude Code에서 사용 가능까지 < 30초
- [ ] Octave UI에서 모든 서버 상태 실시간 확인
- [ ] 에러 발생 시 3초 내 UI에 표시
- [ ] Claude Code 사용 중 Octave 투명하게 작동

---

## Next Steps

1. **Immediate**: MCP Server Manager 구현 시작
   - `circuit/electron/mcp-manager.ts` 생성
   - install/start/stop 기본 로직

2. **Week 1**: InstalledTab과 연동
   - IPC API 추가
   - 실시간 상태 모니터링 UI

3. **Week 2**: DiscoverTab 설치 로직
   - "Add to Claude" 버튼 구현
   - 설치 → 시작 → Installed 탭 이동

4. **Week 3+**: HTTP API, circuit-proxy, 성능 최적화
