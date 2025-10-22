import { usePeekPanel } from '@/hooks/usePeekPanel'
import type { TestResultData, CustomPeekData, MCPPeekData, MCPActivity, MultiMCPPeekData, MCPServerState } from '@/hooks/usePeekPanel'
import { CheckCircle2, XCircle, Loader2, Info, Server, Zap, AlertTriangle } from 'lucide-react'

/**
 * Circuit Peek Panel
 *
 * Corner-anchored mini panel with 3 states:
 * - Dot: Minimal presence, just a colored dot with neon glow
 * - Compact: Single-line summary with glassmorphism
 * - Expanded: Full details with glassmorphism
 */
export function PeekPanel() {
  const { state, data, expand, collapse, hide, setFocusedServer } = usePeekPanel()

  if (state === 'hidden') {
    return null
  }

  // Compact and expanded states should fill the window, dot is just the dot size
  const containerClass = state === 'dot'
    ? 'flex items-center justify-center p-0'
    : 'w-full h-full flex items-center justify-center p-0'

  return (
    <div className={containerClass}>
      {state === 'dot' && <DotView data={data} onExpand={expand} />}
      {state === 'compact' && <CompactView data={data} onExpand={expand} onCollapse={collapse} onHide={hide} />}
      {state === 'expanded' && <ExpandedView data={data} onCollapse={collapse} onHide={hide} setFocusedServer={setFocusedServer} />}
    </div>
  )
}

/**
 * Dot View - Minimal colored indicator with neon glow
 */
function DotView({ data, onExpand }: { data: any; onExpand: () => void }) {
  const getDotStyle = () => {
    if (!data) return {
      bg: 'bg-[#846961]',
      shadow: 'shadow-[0_0_20px_rgba(132,105,97,0.6)]'
    }

    if (data.type === 'test-result') {
      const testData = data as TestResultData
      switch (testData.status) {
        case 'running':
          return {
            bg: 'bg-[#D97757]',
            shadow: 'shadow-[0_0_25px_rgba(217,119,87,0.9)]',
            animate: 'animate-pulse'
          }
        case 'success':
          return {
            bg: 'bg-[#4ade80]',
            shadow: 'shadow-[0_0_25px_rgba(74,222,128,0.9)]'
          }
        case 'failure':
          return {
            bg: 'bg-[#ef4444]',
            shadow: 'shadow-[0_0_25px_rgba(239,68,68,0.9)]'
          }
        default:
          return {
            bg: 'bg-[#846961]',
            shadow: 'shadow-[0_0_20px_rgba(132,105,97,0.6)]'
          }
      }
    }

    if (data.type === 'mcp') {
      const mcpData = data as MCPPeekData
      switch (mcpData.status) {
        case 'starting':
          return {
            bg: 'bg-[#AE7663]',
            shadow: 'shadow-[0_0_25px_rgba(174,118,99,0.9)]',
            animate: 'animate-pulse'
          }
        case 'running':
          return {
            bg: 'bg-[#D97757]',
            shadow: 'shadow-[0_0_25px_rgba(217,119,87,0.9)]',
            animate: 'animate-pulse'
          }
        case 'error':
          return {
            bg: 'bg-[#ef4444]',
            shadow: 'shadow-[0_0_25px_rgba(239,68,68,0.9)]'
          }
        case 'stopped':
          return {
            bg: 'bg-[#846961]',
            shadow: 'shadow-[0_0_20px_rgba(132,105,97,0.6)]'
          }
        default:
          return {
            bg: 'bg-[#846961]',
            shadow: 'shadow-[0_0_20px_rgba(132,105,97,0.6)]'
          }
      }
    }

    if (data.type === 'custom') {
      const customData = data as CustomPeekData
      switch (customData.variant) {
        case 'success':
          return {
            bg: 'bg-[#4ade80]',
            shadow: 'shadow-[0_0_25px_rgba(74,222,128,0.9)]'
          }
        case 'error':
          return {
            bg: 'bg-[#ef4444]',
            shadow: 'shadow-[0_0_25px_rgba(239,68,68,0.9)]'
          }
        case 'warning':
          return {
            bg: 'bg-[#AE7663]',
            shadow: 'shadow-[0_0_25px_rgba(174,118,99,0.9)]'
          }
        default:
          return {
            bg: 'bg-[#D97757]',
            shadow: 'shadow-[0_0_25px_rgba(217,119,87,0.9)]'
          }
      }
    }

    return {
      bg: 'bg-[#846961]',
      shadow: 'shadow-[0_0_20px_rgba(132,105,97,0.6)]'
    }
  }

  const style = getDotStyle()

  return (
    <div
      onClick={onExpand}
      className={`
        w-12 h-12 rounded-full
        ${style.bg}
        ${style.shadow}
        ${style.animate || ''}
        cursor-pointer
        hover:scale-110
        transition-all duration-300 ease-out
        border border-white/20
      `}
    />
  )
}

/**
 * Compact View - Single-line summary with glassmorphism
 */
function CompactView({
  data,
  onExpand,
  onCollapse,
  onHide
}: {
  data: any
  onExpand: () => void
  onCollapse: () => void
  onHide: () => void
}) {
  if (!data) return null

  // Glassmorphism styles (blur provided by Electron vibrancy)
  const glassClass = `
    bg-[#595350]/15
    border border-white/10
    rounded-xl
    shadow-2xl
    cursor-pointer
    transition-all duration-300 ease-out
    hover:bg-[#595350]/25
    hover:scale-[1.02]
    hover:shadow-[0_8px_32px_rgba(217,119,87,0.3)]
  `

  // Multi-server view
  if (data.type === 'multi-mcp') {
    const multiData = data as MultiMCPPeekData
    const servers = Object.values(multiData.servers)
    const errorServers = servers.filter(s => s.status === 'error')
    const runningServers = servers.filter(s => s.status === 'running')
    const highlightServer = errorServers[0] || servers.sort((a, b) => b.lastActivityTime - a.lastActivityTime)[0]

    // Status dot component (smaller)
    const StatusDot = ({ status }: { status: MCPServerState['status'] }) => {
      const dotColors = {
        starting: 'bg-[#AE7663] shadow-[0_0_6px_rgba(174,118,99,0.8)] animate-pulse',
        running: 'bg-[#D97757] shadow-[0_0_8px_rgba(217,119,87,0.9)]',
        error: 'bg-[#ef4444] shadow-[0_0_8px_rgba(239,68,68,0.9)]',
        stopped: 'bg-[#846961] shadow-[0_0_4px_rgba(132,105,97,0.6)]'
      }
      return <div className={`w-1.5 h-1.5 rounded-full ${dotColors[status]} ring-1 ring-white/20`} />
    }

    return (
      <div
        className={`${glassClass} w-full h-full flex items-center justify-center px-3`}
        onClick={onExpand}
        onDoubleClick={onHide}
      >
        {/* Single line: dots + server name + stats */}
        <div className="flex items-center gap-2 w-full">
          {/* Avatar-group style status dots (overlapping) */}
          <div className="flex items-center -space-x-1">
            {servers.slice(0, 5).map((s, i) => (
              <div key={i} className="relative">
                <StatusDot status={s.status} />
              </div>
            ))}
            {servers.length > 5 && (
              <span className="text-[10px] text-white/50 ml-1.5">+{servers.length - 5}</span>
            )}
          </div>

          {/* Server name */}
          <span className="text-xs font-medium text-white/90 truncate flex-shrink-0">
            {highlightServer.serverName}
          </span>

          {/* Separator */}
          <span className="text-xs text-white/30">•</span>

          {/* Stats */}
          <div className="flex items-center gap-1.5 text-xs text-white/60 truncate">
            <span>{runningServers.length} active</span>
            <span className="text-white/30">•</span>
            <span>{multiData.totalActivityCount} req</span>
            {highlightServer.recentActivity[0]?.latency && (
              <>
                <span className="text-white/30">•</span>
                <span className="text-white/50">{highlightServer.recentActivity[0].latency}ms</span>
              </>
            )}
          </div>

          {/* Error indicator */}
          {errorServers.length > 0 && (
            <AlertTriangle className="h-3 w-3 text-[#ef4444] ml-auto flex-shrink-0" />
          )}
        </div>
      </div>
    )
  }

  if (data.type === 'test-result') {
    const testData = data as TestResultData
    return (
      <div
        className={`${glassClass} w-full h-full flex items-center justify-center px-3`}
        onClick={onExpand}
        onDoubleClick={onHide}
      >
        <div className="flex items-center gap-2">
          {testData.status === 'running' && (
            <>
              <Loader2 className="h-4 w-4 text-[#D97757] animate-spin" />
              <span className="text-xs font-medium text-white/90">Running tests...</span>
            </>
          )}
          {testData.status === 'success' && (
            <>
              <CheckCircle2 className="h-4 w-4 text-[#4ade80]" />
              <span className="text-xs font-medium text-white/90">
                {testData.passed}/{testData.total} passed
              </span>
              {testData.duration && (
                <span className="text-xs text-white/50">({(testData.duration / 1000).toFixed(1)}s)</span>
              )}
            </>
          )}
          {testData.status === 'failure' && (
            <>
              <XCircle className="h-4 w-4 text-[#ef4444]" />
              <span className="text-xs font-medium text-white/90">
                {testData.failed}/{testData.total} failed
              </span>
            </>
          )}
        </div>
      </div>
    )
  }

  if (data.type === 'mcp') {
    const mcpData = data as MCPPeekData
    const latestActivity = mcpData.recentActivity[0]

    // Status indicator with neon glow
    const getStatusDot = () => {
      switch (mcpData.status) {
        case 'starting':
          return (
            <div className="w-1.5 h-1.5 rounded-full bg-[#AE7663] shadow-[0_0_8px_rgba(174,118,99,0.8)] animate-pulse" />
          )
        case 'running':
          return (
            <div className="w-1.5 h-1.5 rounded-full bg-[#D97757] shadow-[0_0_8px_rgba(217,119,87,0.9)]" />
          )
        case 'error':
          return (
            <div className="w-1.5 h-1.5 rounded-full bg-[#ef4444] shadow-[0_0_8px_rgba(239,68,68,0.9)]" />
          )
        default:
          return (
            <div className="w-1.5 h-1.5 rounded-full bg-[#846961] shadow-[0_0_6px_rgba(132,105,97,0.6)]" />
          )
      }
    }

    return (
      <div
        className={`${glassClass} w-full h-full flex flex-col justify-center px-3`}
        onClick={onExpand}
        onDoubleClick={onHide}
      >
        <div className="flex items-center gap-2 mb-1">
          {getStatusDot()}
          <Server className="h-3.5 w-3.5 text-white/70" />
          <span className="text-xs font-medium text-white/90 truncate">{mcpData.serverName}</span>
        </div>

        {latestActivity && (
          <div className="flex items-center gap-2 text-xs text-white/60 ml-5">
            <Zap className="h-3 w-3 flex-shrink-0" />
            <span className="truncate flex-1">
              {latestActivity.summary || latestActivity.method}
            </span>
            {latestActivity.latency && (
              <span className="text-white/40 text-xs">{latestActivity.latency}ms</span>
            )}
          </div>
        )}
      </div>
    )
  }

  if (data.type === 'custom') {
    const customData = data as CustomPeekData
    const getIcon = () => {
      switch (customData.variant) {
        case 'success': return <CheckCircle2 className="h-4 w-4 text-[#4ade80]" />
        case 'error': return <XCircle className="h-4 w-4 text-[#ef4444]" />
        case 'warning': return <Info className="h-4 w-4 text-[#AE7663]" />
        default: return <Info className="h-4 w-4 text-[#D97757]" />
      }
    }

    return (
      <div
        className={`${glassClass} w-full h-full flex items-center justify-center px-3`}
        onClick={onExpand}
        onDoubleClick={onHide}
      >
        <div className="flex items-center gap-2">
          {getIcon()}
          <span className="text-xs font-medium text-white/90 truncate">{customData.message}</span>
        </div>
      </div>
    )
  }

  return null
}

/**
 * Expanded View - Full details with glassmorphism
 */
function ExpandedView({
  data,
  onCollapse,
  onHide,
  setFocusedServer
}: {
  data: any
  onCollapse: () => void
  onHide: () => void
  setFocusedServer: (serverId: string) => void
}) {
  if (!data) return null

  // Glassmorphism styles for expanded view (blur provided by Electron vibrancy)
  const glassClass = `
    bg-[#595350]/15
    border border-white/10
    rounded-xl
    shadow-2xl
    transition-all duration-300 ease-out
    w-full h-full
    overflow-hidden
    flex flex-col
  `

  // Multi-server expanded view
  if (data.type === 'multi-mcp') {
    const multiData = data as MultiMCPPeekData
    const servers = Object.values(multiData.servers).sort(
      (a, b) => b.lastActivityTime - a.lastActivityTime
    )
    const focusedServer = multiData.focusedServerId
      ? multiData.servers[multiData.focusedServerId]
      : null

    // Status dot component
    const StatusDot = ({ status }: { status: MCPServerState['status'] }) => {
      const dotColors = {
        starting: 'bg-[#AE7663] shadow-[0_0_8px_rgba(174,118,99,0.9)] animate-pulse',
        running: 'bg-[#D97757] shadow-[0_0_10px_rgba(217,119,87,0.9)]',
        error: 'bg-[#ef4444] shadow-[0_0_10px_rgba(239,68,68,0.9)]',
        stopped: 'bg-[#846961] shadow-[0_0_6px_rgba(132,105,97,0.6)]'
      }
      return <div className={`w-2 h-2 rounded-full ${dotColors[status]}`} />
    }

    return (
      <div className={`${glassClass} p-3`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-white/70" />
            <h3 className="text-xs font-semibold text-white/90">
              MCP Servers ({servers.length})
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCollapse}
              className="text-xs text-white/60 hover:text-white/90 transition-colors px-2 py-1 rounded hover:bg-white/10"
            >
              Collapse
            </button>
            <button
              onClick={onHide}
              className="text-sm text-white/60 hover:text-white/90 transition-colors px-1.5 py-0.5 rounded hover:bg-white/10"
            >
              ×
            </button>
          </div>
        </div>

        {/* Server List */}
        <div className="space-y-1 mb-3 max-h-24 overflow-y-auto">
          {servers.map((server) => {
            const isFocused = server.serverId === multiData.focusedServerId
            const activityCount = server.recentActivity.length

            return (
              <div
                key={server.serverId}
                onClick={() => setFocusedServer(server.serverId)}
                className={`
                  flex items-center gap-2 px-2 py-1.5 rounded-lg
                  cursor-pointer transition-all duration-200
                  ${isFocused
                    ? 'bg-[#D97757]/20 border border-[#D97757]/30'
                    : 'bg-white/5 hover:bg-white/10 border border-transparent'
                  }
                `}
              >
                <StatusDot status={server.status} />
                <Server className="h-3 w-3 text-white/60 flex-shrink-0" />
                <span className={`text-xs flex-1 truncate ${
                  isFocused ? 'text-white/90 font-medium' : 'text-white/70'
                }`}>
                  {server.serverName}
                </span>
                <div className="flex items-center gap-1.5">
                  {activityCount > 0 && (
                    <>
                      <Zap className="h-3 w-3 text-[#D97757]" />
                      <span className="text-xs text-white/50">{activityCount}</span>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Activity Details */}
        {focusedServer && focusedServer.recentActivity.length > 0 && (
          <div className="flex-1 overflow-y-auto">
            <div className="text-xs font-medium text-white/70 mb-1.5">
              Recent Activity
            </div>
            <div className="space-y-1.5">
              {focusedServer.recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="bg-white/5 hover:bg-white/10 rounded-lg p-2 text-xs transition-all duration-200"
                >
                  <div className="flex items-start gap-2">
                    <Zap className="h-3 w-3 text-[#D97757] mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white/80 truncate text-xs">
                          {activity.method}
                        </span>
                        <div
                          className={`
                            w-1.5 h-1.5 rounded-full
                            ${activity.success
                              ? 'bg-[#4ade80] shadow-[0_0_8px_rgba(74,222,128,0.8)]'
                              : 'bg-[#ef4444] shadow-[0_0_8px_rgba(239,68,68,0.8)]'
                            }
                          `}
                        />
                      </div>
                      {activity.summary && (
                        <div className="text-white/50 truncate mt-0.5 text-xs">
                          {activity.summary}
                        </div>
                      )}
                      {activity.error && (
                        <div className="text-[#ef4444] text-xs mt-0.5 truncate">
                          Error: {activity.error}
                        </div>
                      )}
                    </div>
                    {activity.latency && (
                      <span className="text-white/40 shrink-0 text-xs">
                        {activity.latency}ms
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {focusedServer && focusedServer.recentActivity.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-xs text-white/50">
            No recent activity
          </div>
        )}
      </div>
    )
  }

  if (data.type === 'test-result') {
    const testData = data as TestResultData
    return (
      <div className={`${glassClass} p-3`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {testData.status === 'running' && <Loader2 className="h-4 w-4 text-[#D97757] animate-spin" />}
            {testData.status === 'success' && <CheckCircle2 className="h-4 w-4 text-[#4ade80]" />}
            {testData.status === 'failure' && <XCircle className="h-4 w-4 text-[#ef4444]" />}
            <h3 className="text-xs font-semibold text-white/90">Test Results</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCollapse}
              className="text-xs text-white/60 hover:text-white/90 transition-colors px-2 py-1 rounded hover:bg-white/10"
            >
              Collapse
            </button>
            <button
              onClick={onHide}
              className="text-sm text-white/60 hover:text-white/90 transition-colors px-1.5 py-0.5 rounded hover:bg-white/10"
            >
              ×
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-2">
          <div className="text-center bg-white/5 rounded-lg py-1.5 px-1">
            <div className="text-xs text-white/50">Passed</div>
            <div className="text-base font-semibold text-[#4ade80]">{testData.passed || 0}</div>
          </div>
          <div className="text-center bg-white/5 rounded-lg py-1.5 px-1">
            <div className="text-xs text-white/50">Failed</div>
            <div className="text-base font-semibold text-[#ef4444]">{testData.failed || 0}</div>
          </div>
          <div className="text-center bg-white/5 rounded-lg py-1.5 px-1">
            <div className="text-xs text-white/50">Total</div>
            <div className="text-base font-semibold text-white/90">{testData.total || 0}</div>
          </div>
        </div>

        {/* Duration */}
        {testData.duration && (
          <div className="text-xs text-white/50 mb-2">
            Duration: {(testData.duration / 1000).toFixed(2)}s
          </div>
        )}

        {/* Errors */}
        {testData.errors && testData.errors.length > 0 && (
          <div className="flex-1 overflow-y-auto">
            <div className="text-xs font-medium text-white/70 mb-1">Errors:</div>
            <div className="bg-[#332925]/40 rounded-lg p-2 text-xs font-mono text-[#ef4444] space-y-1">
              {testData.errors.map((error, i) => (
                <div key={i} className="truncate hover:bg-white/5 px-1 rounded cursor-pointer transition-colors">
                  {error}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  if (data.type === 'mcp') {
    const mcpData = data as MCPPeekData

    // Status indicator with neon glow
    const getStatusDot = () => {
      switch (mcpData.status) {
        case 'starting':
          return <div className="w-2 h-2 rounded-full bg-[#AE7663] shadow-[0_0_10px_rgba(174,118,99,0.9)] animate-pulse" />
        case 'running':
          return <div className="w-2 h-2 rounded-full bg-[#D97757] shadow-[0_0_10px_rgba(217,119,87,0.9)]" />
        case 'error':
          return <div className="w-2 h-2 rounded-full bg-[#ef4444] shadow-[0_0_10px_rgba(239,68,68,0.9)]" />
        default:
          return <div className="w-2 h-2 rounded-full bg-[#846961] shadow-[0_0_8px_rgba(132,105,97,0.6)]" />
      }
    }

    return (
      <div className={`${glassClass} p-3`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {getStatusDot()}
            <Server className="h-3.5 w-3.5 text-white/70" />
            <h3 className="text-xs font-semibold text-white/90">{mcpData.serverName}</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCollapse}
              className="text-xs text-white/60 hover:text-white/90 transition-colors px-2 py-1 rounded hover:bg-white/10"
            >
              Collapse
            </button>
            <button
              onClick={onHide}
              className="text-sm text-white/60 hover:text-white/90 transition-colors px-1.5 py-0.5 rounded hover:bg-white/10"
            >
              ×
            </button>
          </div>
        </div>

        {/* Status */}
        <div className="text-xs text-white/50 mb-2">
          Status: <span className="font-medium capitalize text-white/70">{mcpData.status}</span>
        </div>

        {/* Recent Activity */}
        {mcpData.recentActivity.length > 0 && (
          <div className="flex-1 overflow-y-auto">
            <div className="text-xs font-medium text-white/70 mb-1.5">Recent Activity</div>
            <div className="space-y-1.5">
              {mcpData.recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="bg-white/5 hover:bg-white/10 rounded-lg p-2 text-xs transition-all duration-200 cursor-pointer"
                >
                  <div className="flex items-start gap-2">
                    <Zap className="h-3 w-3 text-[#D97757] mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white/80 truncate text-xs">
                          {activity.method}
                        </span>
                        <div
                          className={`
                            w-1.5 h-1.5 rounded-full
                            ${activity.success
                              ? 'bg-[#4ade80] shadow-[0_0_8px_rgba(74,222,128,0.8)]'
                              : 'bg-[#ef4444] shadow-[0_0_8px_rgba(239,68,68,0.8)]'
                            }
                          `}
                        />
                      </div>
                      {activity.summary && (
                        <div className="text-white/50 truncate mt-0.5 text-xs">
                          {activity.summary}
                        </div>
                      )}
                      {activity.error && (
                        <div className="text-[#ef4444] text-xs mt-0.5 truncate">
                          Error: {activity.error}
                        </div>
                      )}
                    </div>
                    {activity.latency && (
                      <span className="text-white/40 shrink-0 text-xs">{activity.latency}ms</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  if (data.type === 'custom') {
    const customData = data as CustomPeekData
    return (
      <div className={`${glassClass} p-3`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-white/90">{customData.title}</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={onCollapse}
              className="text-xs text-white/60 hover:text-white/90 transition-colors px-2 py-1 rounded hover:bg-white/10"
            >
              Collapse
            </button>
            <button
              onClick={onHide}
              className="text-sm text-white/60 hover:text-white/90 transition-colors px-1.5 py-0.5 rounded hover:bg-white/10"
            >
              ×
            </button>
          </div>
        </div>

        {/* Message */}
        <div className="flex-1 overflow-y-auto text-xs text-white/80">
          {customData.message}
        </div>
      </div>
    )
  }

  return null
}

export default PeekPanel
