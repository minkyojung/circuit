import { usePeekPanel } from '@/hooks/usePeekPanel'
import type { TestResultData, CustomPeekData, MCPPeekData, MCPActivity, MultiMCPPeekData, MCPServerState, DeploymentPeekData } from '@/hooks/usePeekPanel'
import { CheckCircle2, XCircle, Loader2, Info, Server, Zap, AlertTriangle, Rocket, ExternalLink } from 'lucide-react'

/**
 * Circuit Peek Panel
 *
 * Corner-anchored mini panel with 2 states:
 * - Peek: Tab only visible (mostly off-screen, 12px visible) - default state
 * - Compact: Full content visible (260x80)
 */
export function PeekPanel() {
  const { state, data, autoHideProgress, expand, collapse, setFocusedServer, openInWindow } = usePeekPanel()

  // Peek shows tab only, compact fills the window
  // No CSS animation - let Electron handle the window animation
  const containerClass = state === 'peek'
    ? 'w-full h-full flex items-end justify-end p-0'
    : 'w-full h-full flex items-center justify-center p-0'

  return (
    <div className={containerClass}>
      {state === 'peek' && <PeekTab data={data} onExpand={expand} />}
      {state === 'compact' && <CompactView data={data} autoHideProgress={autoHideProgress} onCollapse={collapse} setFocusedServer={setFocusedServer} openInWindow={openInWindow} />}
    </div>
  )
}

/**
 * Peek Tab - Vertical tab visible when mostly off-screen
 * Shows status dot and pending event count
 */
function PeekTab({ data, onExpand }: { data: any; onExpand: () => void }) {
  const getStatusDot = () => {
    if (!data) return {
      bg: 'bg-[#846961]',
      shadow: 'shadow-[0_0_20px_rgba(132,105,97,0.6)]',
      animate: ''
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
            shadow: 'shadow-[0_0_25px_rgba(74,222,128,0.9)]',
            animate: ''
          }
        case 'failure':
          return {
            bg: 'bg-[#ef4444]',
            shadow: 'shadow-[0_0_25px_rgba(239,68,68,0.9)]',
            animate: 'animate-pulse'
          }
        default:
          return {
            bg: 'bg-[#846961]',
            shadow: 'shadow-[0_0_20px_rgba(132,105,97,0.6)]',
            animate: ''
          }
      }
    }

    if (data.type === 'mcp' || data.type === 'multi-mcp') {
      return {
        bg: 'bg-[#D97757]',
        shadow: 'shadow-[0_0_25px_rgba(217,119,87,0.9)]',
        animate: 'animate-pulse'
      }
    }

    if (data.type === 'deployment') {
      const deployData = data as DeploymentPeekData
      switch (deployData.status) {
        case 'building':
          return {
            bg: 'bg-[#D97757]',
            shadow: 'shadow-[0_0_25px_rgba(217,119,87,0.9)]',
            animate: 'animate-pulse'
          }
        case 'success':
          return {
            bg: 'bg-[#4ade80]',
            shadow: 'shadow-[0_0_25px_rgba(74,222,128,0.9)]',
            animate: ''
          }
        case 'failed':
          return {
            bg: 'bg-[#ef4444]',
            shadow: 'shadow-[0_0_25px_rgba(239,68,68,0.9)]',
            animate: 'animate-pulse'
          }
        case 'cancelled':
          return {
            bg: 'bg-[#AE7663]',
            shadow: 'shadow-[0_0_20px_rgba(174,118,99,0.6)]',
            animate: ''
          }
        default:
          return {
            bg: 'bg-[#846961]',
            shadow: 'shadow-[0_0_20px_rgba(132,105,97,0.6)]',
            animate: ''
          }
      }
    }

    return {
      bg: 'bg-[#846961]',
      shadow: 'shadow-[0_0_20px_rgba(132,105,97,0.6)]',
      animate: ''
    }
  }

  const statusDot = getStatusDot()

  return (
    <div
      onClick={onExpand}
      className="w-full h-full flex flex-col items-center justify-center gap-4 cursor-pointer bg-transparent hover:bg-white/5 transition-colors"
    >
      {/* Status Dot */}
      <div
        className={`
          w-3 h-3 rounded-full
          ${statusDot.bg}
          ${statusDot.shadow}
          ${statusDot.animate}
          border border-white/20
        `}
      />

      {/* Pending count (future) */}
      {/* <div className="text-xs text-white/50">⋮</div> */}
    </div>
  )
}

/**
 * Compact View - Full content with glassmorphism
 */
function CompactView({
  data,
  autoHideProgress,
  onCollapse,
  setFocusedServer,
  openInWindow
}: {
  data: any
  autoHideProgress: number
  onCollapse: () => void
  setFocusedServer: (serverId: string) => void
  openInWindow: () => void
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
    relative
    overflow-hidden
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
        onClick={onCollapse}
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
        onClick={onCollapse}
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
        {/* Auto-hide progress bar */}
        {autoHideProgress > 0 && (
          <div className="absolute bottom-0 left-0 w-full h-0.5 bg-white/10">
            <div
              className="h-full bg-gradient-to-r from-[#D97757] to-[#4ade80] transition-all duration-100 ease-linear"
              style={{ width: `${100 - autoHideProgress}%` }}
            />
          </div>
        )}
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
        onClick={onCollapse}
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
        onClick={onCollapse}
      >
        <div className="flex items-center gap-2">
          {getIcon()}
          <span className="text-xs font-medium text-white/90 truncate">{customData.message}</span>
        </div>
      </div>
    )
  }

  if (data.type === 'deployment') {
    const deployData = data as DeploymentPeekData
    return (
      <div
        className={`${glassClass} w-full h-full flex items-center justify-center px-3`}
        onClick={onCollapse}
      >
        <div className="flex items-center gap-2">
          {deployData.status === 'building' && <Loader2 className="h-4 w-4 text-[#D97757] animate-spin" />}
          {deployData.status === 'success' && <CheckCircle2 className="h-4 w-4 text-[#4ade80]" />}
          {deployData.status === 'failed' && <XCircle className="h-4 w-4 text-[#ef4444]" />}
          {deployData.status === 'cancelled' && <Info className="h-4 w-4 text-[#AE7663]" />}
          <Rocket className="h-4 w-4 text-white/70" />
          <span className="text-xs font-medium text-white/90 truncate">{deployData.projectName}</span>
          <span className="text-xs text-white/30">•</span>
          <span className="text-xs text-white/60 truncate">{deployData.branch}</span>
        </div>
        {/* Auto-hide progress bar */}
        {autoHideProgress > 0 && (
          <div className="absolute bottom-0 left-0 w-full h-0.5 bg-white/10">
            <div
              className="h-full bg-gradient-to-r from-[#D97757] to-[#4ade80] transition-all duration-100 ease-linear"
              style={{ width: `${100 - autoHideProgress}%` }}
            />
          </div>
        )}
      </div>
    )
  }

  return null
}

export default PeekPanel
