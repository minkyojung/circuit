import React from 'react'
import { usePeekPanel } from '@/hooks/usePeekPanel'
import type { TestResultData, CustomPeekData, MCPPeekData, MultiMCPPeekData, MCPServerState, DeploymentPeekData, GitHubPeekData } from '@/hooks/usePeekPanel'
import { CheckCircle2, XCircle, Loader2, Info, Server, AlertTriangle, GitBranch, GitPullRequest, GitCommit, MessageSquare } from 'lucide-react'

/**
 * Format timestamp to human-readable "time ago"
 */
function formatTimeAgo(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return 'now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

/**
 * Circuit Peek Panel
 *
 * Corner-anchored mini panel with 2 states:
 * - Peek: Tab only visible (mostly off-screen, 12px visible) - default state
 * - Compact: Full content visible (240x60, Cursor-style compact design)
 */
export function PeekPanel() {
  const { state, data, autoHideProgress, expand, collapse } = usePeekPanel()

  // Peek shows tab only, compact fills the window
  // No CSS animation - let Electron handle the window animation
  const containerClass = state === 'peek'
    ? 'w-full h-full flex items-end justify-end p-0 overflow-hidden'
    : 'w-full h-full flex items-center justify-center p-0 overflow-hidden'

  return (
    <div className={containerClass}>
      {/* If we have data, always show CompactView regardless of state */}
      {/* Only show PeekTab when no data (idle state) */}
      {data ? (
        <CompactView data={data} autoHideProgress={autoHideProgress} onCollapse={collapse} />
      ) : (
        state === 'peek' && <PeekTab data={data} onExpand={expand} />
      )}
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
      bg: 'bg-muted',
      shadow: '',
      animate: ''
    }

    if (data.type === 'test-result') {
      const testData = data as TestResultData
      switch (testData.status) {
        case 'running':
          return {
            bg: 'bg-primary',
            shadow: '',
            animate: 'animate-pulse'
          }
        case 'success':
          return {
            bg: 'bg-success',
            shadow: '',
            animate: ''
          }
        case 'failure':
          return {
            bg: 'bg-destructive',
            shadow: '',
            animate: 'animate-pulse'
          }
        default:
          return {
            bg: 'bg-muted',
            shadow: '',
            animate: ''
          }
      }
    }

    if (data.type === 'mcp' || data.type === 'multi-mcp') {
      return {
        bg: 'bg-primary',
        shadow: '',
        animate: 'animate-pulse'
      }
    }

    if (data.type === 'deployment') {
      const deployData = data as DeploymentPeekData
      switch (deployData.status) {
        case 'building':
          return {
            bg: 'bg-primary',
            shadow: '',
            animate: 'animate-pulse'
          }
        case 'success':
          return {
            bg: 'bg-success',
            shadow: '',
            animate: ''
          }
        case 'failed':
          return {
            bg: 'bg-destructive',
            shadow: '',
            animate: 'animate-pulse'
          }
        case 'cancelled':
          return {
            bg: 'bg-warning',
            shadow: '',
            animate: ''
          }
        default:
          return {
            bg: 'bg-muted',
            shadow: '',
            animate: ''
          }
      }
    }

    return {
      bg: 'bg-muted',
      shadow: '',
      animate: ''
    }
  }

  const statusDot = getStatusDot()

  return (
    <div
      onClick={onExpand}
      className="w-full h-full flex flex-col items-center justify-center gap-3 cursor-pointer bg-transparent hover:bg-white/10 transition-all duration-200 group"
    >
      {/* Status Dot - larger and more prominent */}
      <div
        className={`
          w-3.5 h-3.5 rounded-full
          ${statusDot.bg}
          ${statusDot.shadow}
          ${statusDot.animate}
          border border-white/30
          group-hover:scale-110
          transition-transform duration-200
        `}
      />

      {/* Vertical bar hint */}
      <div className="w-0.5 h-6 bg-gradient-to-b from-white/20 to-transparent rounded-full" />
    </div>
  )
}

/**
 * Compact View - Full content with glassmorphism
 */
function CompactView({
  data,
  autoHideProgress,
  onCollapse
}: {
  data: any
  autoHideProgress: number
  onCollapse: () => void
}) {
  if (!data) return null

  // Force animation re-trigger on data changes
  const [animationKey, setAnimationKey] = React.useState(0)

  React.useEffect(() => {
    if (data) {
      setAnimationKey(k => k + 1)
    }
  }, [data?.type, data?.timestamp])

  // Glassmorphism styles (blur provided by Electron vibrancy)
  const glassClass = `
    bg-[var(--glass-bg)]
    border border-[var(--glass-border)]
    rounded-lg
    shadow-2xl
    cursor-pointer
    transition-all duration-300 cubic-bezier(0.68, -0.55, 0.265, 1.55)
    hover:bg-[var(--glass-hover)]
    hover:scale-[1.01]
    hover:shadow-[0_4px_24px_rgba(217,119,87,0.4)]
    relative
    overflow-hidden
    bounce-in
  `

  // Multi-server view
  if (data.type === 'multi-mcp') {
    const multiData = data as MultiMCPPeekData
    const servers = Object.values(multiData.servers)
    const errorServers = servers.filter(s => s.status === 'error')
    const highlightServer = errorServers[0] || servers.sort((a, b) => b.lastActivityTime - a.lastActivityTime)[0]
    const now = Date.now()
    const timeAgo = highlightServer?.lastActivityTime ? formatTimeAgo(now - highlightServer.lastActivityTime) : 'now'

    // Status dot component (smaller for compact design)
    const StatusDot = ({ status }: { status: MCPServerState['status'] }) => {
      const dotColors = {
        starting: 'bg-warning  animate-pulse',
        running: 'bg-primary ',
        error: 'bg-destructive ',
        stopped: 'bg-muted '
      }
      return <div className={`w-2 h-2 rounded-full ${dotColors[status]} ring-1 ring-white/20`} />
    }

    const getMessage = () => {
      if (errorServers.length > 0) {
        return `${errorServers.length} server${errorServers.length !== 1 ? 's' : ''} error`
      }
      return `${servers.length} server${servers.length !== 1 ? 's' : ''} active`
    }

    return (
      <div
        key={animationKey}
        className={`${glassClass} w-full h-full flex flex-col justify-center px-2 py-1.5 gap-0`}
        onClick={onCollapse}
      >
        {/* Primary Message - Compact */}
        <div className="flex items-center gap-1.5">
          {/* Avatar-group style status dots (overlapping) */}
          <div className="flex items-center -space-x-0.5 flex-shrink-0">
            {servers.slice(0, 3).map((s, i) => (
              <div key={i} className="relative">
                <StatusDot status={s.status} />
              </div>
            ))}
            {servers.length > 3 && (
              <span className="text-[9px] text-white/50 ml-1">+{servers.length - 3}</span>
            )}
          </div>

          {/* Main Message - Light and compact */}
          <span className="text-xs font-normal text-white truncate flex-1">
            {getMessage()}
          </span>

          {/* Error indicator */}
          {errorServers.length > 0 && (
            <AlertTriangle className="h-3 w-3 text-destructive flex-shrink-0" />
          )}

          {/* Time - Right aligned */}
          <span className="text-[10px] text-white/40 flex-shrink-0">{timeAgo}</span>
        </div>

        {/* Secondary Details - Ultra subtle */}
        <div className="flex items-center gap-1 pl-[20px]">
          <span className="text-[10px] text-white/50">{multiData.totalActivityCount} requests</span>
          {highlightServer?.recentActivity[0]?.latency && (
            <>
              <span className="text-[10px] text-white/30">•</span>
              <span className="text-[10px] text-white/40">{highlightServer.recentActivity[0].latency}ms</span>
            </>
          )}
        </div>
      </div>
    )
  }

  if (data.type === 'test-result') {
    const testData = data as TestResultData
    const now = Date.now()
    const timeAgo = testData.timestamp ? formatTimeAgo(now - testData.timestamp) : 'now'

    const getMessage = () => {
      if (testData.status === 'running') return 'Running tests...'
      if (testData.status === 'success') return `${testData.passed || 0} tests passed`
      return `${testData.failed || 0} test${(testData.failed || 0) !== 1 ? 's' : ''} failed`
    }

    return (
      <div
        key={animationKey}
        className={`${glassClass} w-full h-full flex flex-col justify-center px-2 py-1.5 gap-0`}
        onClick={onCollapse}
      >
        {/* Primary Message - Compact */}
        <div className="flex items-center gap-1.5">
          {/* Status Icon */}
          {testData.status === 'running' && <Loader2 className="h-3 w-3 text-primary animate-spin flex-shrink-0" />}
          {testData.status === 'success' && <CheckCircle2 className="h-3 w-3 text-success flex-shrink-0" />}
          {testData.status === 'failure' && <XCircle className="h-3 w-3 text-destructive flex-shrink-0" />}

          {/* Main Message - Light and compact */}
          <span className="text-xs font-normal text-white truncate flex-1">
            {getMessage()}
          </span>

          {/* Time - Right aligned */}
          <span className="text-[10px] text-white/40 flex-shrink-0">{timeAgo}</span>
        </div>

        {/* Secondary Details - Ultra subtle */}
        {testData.total && (
          <div className="flex items-center gap-1 pl-[16px]">
            <span className="text-[10px] text-white/50">{testData.total} total</span>
            {testData.duration && (
              <>
                <span className="text-[10px] text-white/30">•</span>
                <span className="text-[10px] text-white/40">{(testData.duration / 1000).toFixed(1)}s</span>
              </>
            )}
          </div>
        )}

        {/* Auto-hide progress bar */}
        {autoHideProgress > 0 && (
          <div className="absolute bottom-0 left-0 w-full h-0.5 bg-white/10 rounded-b-lg overflow-hidden">
            <div
              className="h-full bg-[var(--circuit-orange)] transition-all duration-100 ease-linear"
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
    const now = Date.now()
    const timeAgo = latestActivity?.timestamp ? formatTimeAgo(now - latestActivity.timestamp) : 'now'

    // Status icon compact
    const getStatusIcon = () => {
      switch (mcpData.status) {
        case 'starting':
          return <Loader2 className="h-3 w-3 text-warning animate-spin flex-shrink-0" />
        case 'running':
          return <Server className="h-3 w-3 text-primary flex-shrink-0" />
        case 'error':
          return <XCircle className="h-3 w-3 text-destructive flex-shrink-0" />
        default:
          return <Server className="h-3 w-3 text-muted-foreground flex-shrink-0" />
      }
    }

    const getMessage = () => {
      if (mcpData.status === 'starting') return `${mcpData.serverName} starting`
      if (mcpData.status === 'error') return `${mcpData.serverName} error`
      if (mcpData.recentActivity.length > 0) {
        return `${mcpData.serverName} • ${mcpData.recentActivity.length} request${mcpData.recentActivity.length !== 1 ? 's' : ''}`
      }
      return mcpData.serverName
    }

    return (
      <div
        key={animationKey}
        className={`${glassClass} w-full h-full flex flex-col justify-center px-2 py-1.5 gap-0`}
        onClick={onCollapse}
      >
        {/* Primary Message - Compact */}
        <div className="flex items-center gap-1.5">
          {getStatusIcon()}

          {/* Main Message - Light and compact */}
          <span className="text-xs font-normal text-white truncate flex-1">
            {getMessage()}
          </span>

          {/* Time - Right aligned */}
          <span className="text-[10px] text-white/40 flex-shrink-0">{timeAgo}</span>
        </div>

        {/* Secondary Details - Ultra subtle */}
        {latestActivity && (
          <div className="flex items-center gap-1 pl-[16px]">
            {latestActivity.latency && (
              <span className="text-[10px] text-white/50">{latestActivity.latency}ms</span>
            )}
            {latestActivity.method && latestActivity.latency && (
              <span className="text-[10px] text-white/30">•</span>
            )}
            {latestActivity.method && (
              <span className="text-[10px] text-white/40 truncate">{latestActivity.method}</span>
            )}
          </div>
        )}
      </div>
    )
  }

  if (data.type === 'custom') {
    const customData = data as CustomPeekData
    const now = Date.now()
    const timeAgo = customData.timestamp ? formatTimeAgo(now - customData.timestamp) : 'now'

    const getIcon = () => {
      switch (customData.variant) {
        case 'success': return <CheckCircle2 className="h-3 w-3 text-success flex-shrink-0" />
        case 'error': return <XCircle className="h-3 w-3 text-destructive flex-shrink-0" />
        case 'warning': return <AlertTriangle className="h-3 w-3 text-warning flex-shrink-0" />
        default: return <Info className="h-3 w-3 text-primary flex-shrink-0" />
      }
    }

    return (
      <div
        key={animationKey}
        className={`${glassClass} w-full h-full flex flex-col justify-center px-2 py-1.5 gap-0`}
        onClick={onCollapse}
      >
        {/* Primary Message - Compact */}
        <div className="flex items-center gap-1.5">
          {getIcon()}

          {/* Main Message - Light and compact */}
          <span className="text-xs font-normal text-white truncate flex-1">
            {customData.message}
          </span>

          {/* Time - Right aligned */}
          <span className="text-[10px] text-white/40 flex-shrink-0">{timeAgo}</span>
        </div>

        {/* Secondary Details - Ultra subtle */}
        {customData.title && (
          <div className="flex items-center gap-1 pl-[16px]">
            <span className="text-[10px] text-white/50 truncate">{customData.title}</span>
          </div>
        )}
      </div>
    )
  }

  if (data.type === 'deployment') {
    const deployData = data as DeploymentPeekData
    const now = Date.now()
    const timeAgo = deployData.timestamp ? formatTimeAgo(now - deployData.timestamp) : 'now'

    const statusText = {
      building: 'Building',
      success: 'deployed',
      failed: 'failed to deploy',
      cancelled: 'cancelled'
    }[deployData.status]

    return (
      <div
        key={animationKey}
        className={`${glassClass} w-full h-full flex flex-col justify-center px-2 py-1.5 gap-0`}
        onClick={onCollapse}
      >
        {/* Primary Message - Compact */}
        <div className="flex items-center gap-1.5">
          {/* Status Icon */}
          {deployData.status === 'building' && <Loader2 className="h-3 w-3 text-primary animate-spin flex-shrink-0" />}
          {deployData.status === 'success' && <CheckCircle2 className="h-3 w-3 text-success flex-shrink-0" />}
          {deployData.status === 'failed' && <XCircle className="h-3 w-3 text-destructive flex-shrink-0" />}
          {deployData.status === 'cancelled' && <Info className="h-3 w-3 text-warning flex-shrink-0" />}

          {/* Main Message - Light and compact */}
          <span className="text-xs font-normal text-white truncate flex-1">
            {deployData.projectName} {statusText}
          </span>

          {/* Time - Right aligned */}
          <span className="text-[10px] text-white/40 flex-shrink-0">{timeAgo}</span>
        </div>

        {/* Secondary Details - Ultra subtle */}
        <div className="flex items-center gap-1 pl-[16px]">
          <span className="text-[10px] text-white/50">{deployData.branch}</span>
          <span className="text-[10px] text-white/30">•</span>
          <span className="text-[10px] text-white/40 truncate">{deployData.commit.slice(0, 7)}</span>
        </div>

        {/* Auto-hide progress bar */}
        {autoHideProgress > 0 && (
          <div className="absolute bottom-0 left-0 w-full h-0.5 bg-white/10 rounded-b-lg overflow-hidden">
            <div
              className="h-full bg-[var(--circuit-orange)] transition-all duration-100 ease-linear"
              style={{ width: `${100 - autoHideProgress}%` }}
            />
          </div>
        )}
      </div>
    )
  }

  if (data.type === 'github') {
    const githubData = data as GitHubPeekData
    const now = Date.now()
    const timeAgo = formatTimeAgo(now - githubData.timestamp)

    // Push event
    if (githubData.eventType === 'push' && githubData.push) {
      const { ref, pusher, commits } = githubData.push
      return (
        <div
          key={animationKey}
          className={`${glassClass} w-full h-full flex flex-col justify-center px-2 py-1.5 gap-0`}
          onClick={onCollapse}
        >
          <div className="flex items-center gap-1.5">
            <GitBranch className="h-3 w-3 text-primary flex-shrink-0" />
            <span className="text-xs font-normal text-white truncate flex-1">
              {pusher} pushed to {ref}
            </span>
            <span className="text-[10px] text-white/40 flex-shrink-0">{timeAgo}</span>
          </div>
          <div className="flex items-center gap-1 pl-[16px]">
            <span className="text-[10px] text-white/50">{commits.length} commit{commits.length !== 1 ? 's' : ''}</span>
            <span className="text-[10px] text-white/30">•</span>
            <span className="text-[10px] text-white/40 truncate">{commits[0]?.sha}</span>
          </div>

          {/* Auto-hide progress bar */}
          {autoHideProgress > 0 && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-white/10 rounded-b-lg overflow-hidden">
              <div
                className="h-full bg-[var(--circuit-orange)] transition-all duration-100 ease-linear"
                style={{ width: `${100 - autoHideProgress}%` }}
              />
            </div>
          )}
        </div>
      )
    }

    // Pull Request event
    if (githubData.eventType === 'pull_request' && githubData.pullRequest) {
      const { number, title, action, author, merged } = githubData.pullRequest
      const isMerged = merged || action === 'merged'
      const isClosed = action === 'closed'

      return (
        <div
          key={animationKey}
          className={`${glassClass} w-full h-full flex flex-col justify-center px-2 py-1.5 gap-0`}
          onClick={onCollapse}
        >
          <div className="flex items-center gap-1.5">
            {isMerged && <GitPullRequest className="h-3 w-3 text-purple-400 flex-shrink-0" />}
            {isClosed && !isMerged && <XCircle className="h-3 w-3 text-destructive flex-shrink-0" />}
            {!isClosed && !isMerged && <GitPullRequest className="h-3 w-3 text-success flex-shrink-0" />}
            <span className="text-xs font-normal text-white truncate flex-1">
              PR #{number} {action}
            </span>
            <span className="text-[10px] text-white/40 flex-shrink-0">{timeAgo}</span>
          </div>
          <div className="flex items-center gap-1 pl-[16px]">
            <span className="text-[10px] text-white/50 truncate">{title}</span>
            <span className="text-[10px] text-white/30">•</span>
            <span className="text-[10px] text-white/40">{author}</span>
          </div>

          {/* Auto-hide progress bar */}
          {autoHideProgress > 0 && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-white/10 rounded-b-lg overflow-hidden">
              <div
                className="h-full bg-[var(--circuit-orange)] transition-all duration-100 ease-linear"
                style={{ width: `${100 - autoHideProgress}%` }}
              />
            </div>
          )}
        </div>
      )
    }

    // Check Run event (CI/CD)
    if (githubData.eventType === 'check_run' && githubData.checkRun) {
      const { name, status, conclusion, branch, commit } = githubData.checkRun
      const isCompleted = status === 'completed'
      const isSuccess = conclusion === 'success'
      const isFailure = conclusion === 'failure'

      return (
        <div
          key={animationKey}
          className={`${glassClass} w-full h-full flex flex-col justify-center px-2 py-1.5 gap-0`}
          onClick={onCollapse}
        >
          <div className="flex items-center gap-1.5">
            {!isCompleted && <Loader2 className="h-3 w-3 text-primary animate-spin flex-shrink-0" />}
            {isCompleted && isSuccess && <CheckCircle2 className="h-3 w-3 text-success flex-shrink-0" />}
            {isCompleted && isFailure && <XCircle className="h-3 w-3 text-destructive flex-shrink-0" />}
            {isCompleted && !isSuccess && !isFailure && <Info className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
            <span className="text-xs font-normal text-white truncate flex-1">
              {name} {isCompleted ? conclusion : status}
            </span>
            <span className="text-[10px] text-white/40 flex-shrink-0">{timeAgo}</span>
          </div>
          <div className="flex items-center gap-1 pl-[16px]">
            <span className="text-[10px] text-white/50">{branch}</span>
            <span className="text-[10px] text-white/30">•</span>
            <span className="text-[10px] text-white/40">{commit}</span>
          </div>

          {/* Auto-hide progress bar */}
          {autoHideProgress > 0 && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-white/10 rounded-b-lg overflow-hidden">
              <div
                className="h-full bg-[var(--circuit-orange)] transition-all duration-100 ease-linear"
                style={{ width: `${100 - autoHideProgress}%` }}
              />
            </div>
          )}
        </div>
      )
    }

    // Review event
    if (githubData.eventType === 'review' && githubData.review) {
      const { reviewer, state, pullRequestNumber } = githubData.review
      const isApproved = state === 'approved'
      const isChangesRequested = state === 'changes_requested'

      return (
        <div
          key={animationKey}
          className={`${glassClass} w-full h-full flex flex-col justify-center px-2 py-1.5 gap-0`}
          onClick={onCollapse}
        >
          <div className="flex items-center gap-1.5">
            {isApproved && <CheckCircle2 className="h-3 w-3 text-success flex-shrink-0" />}
            {isChangesRequested && <XCircle className="h-3 w-3 text-warning flex-shrink-0" />}
            {!isApproved && !isChangesRequested && <MessageSquare className="h-3 w-3 text-primary flex-shrink-0" />}
            <span className="text-xs font-normal text-white truncate flex-1">
              {reviewer} reviewed PR #{pullRequestNumber}
            </span>
            <span className="text-[10px] text-white/40 flex-shrink-0">{timeAgo}</span>
          </div>
          <div className="flex items-center gap-1 pl-[16px]">
            <span className="text-[10px] text-white/50">
              {isApproved && 'Approved'}
              {isChangesRequested && 'Changes requested'}
              {!isApproved && !isChangesRequested && 'Commented'}
            </span>
          </div>

          {/* Auto-hide progress bar */}
          {autoHideProgress > 0 && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-white/10 rounded-b-lg overflow-hidden">
              <div
                className="h-full bg-[var(--circuit-orange)] transition-all duration-100 ease-linear"
                style={{ width: `${100 - autoHideProgress}%` }}
              />
            </div>
          )}
        </div>
      )
    }

    // Commit comment event
    if (githubData.eventType === 'commit_comment' && githubData.commitComment) {
      const { author, commit, body } = githubData.commitComment
      return (
        <div
          key={animationKey}
          className={`${glassClass} w-full h-full flex flex-col justify-center px-2 py-1.5 gap-0`}
          onClick={onCollapse}
        >
          <div className="flex items-center gap-1.5">
            <GitCommit className="h-3 w-3 text-primary flex-shrink-0" />
            <span className="text-xs font-normal text-white truncate flex-1">
              {author} commented on {commit}
            </span>
            <span className="text-[10px] text-white/40 flex-shrink-0">{timeAgo}</span>
          </div>
          <div className="flex items-center gap-1 pl-[16px]">
            <span className="text-[10px] text-white/50 truncate">{body}</span>
          </div>

          {/* Auto-hide progress bar */}
          {autoHideProgress > 0 && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-white/10 rounded-b-lg overflow-hidden">
              <div
                className="h-full bg-[var(--circuit-orange)] transition-all duration-100 ease-linear"
                style={{ width: `${100 - autoHideProgress}%` }}
              />
            </div>
          )}
        </div>
      )
    }
  }

  return null
}

export default PeekPanel
