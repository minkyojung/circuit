import { usePeekPanel } from '@/hooks/usePeekPanel'
import type { TestResultData, CustomPeekData, MCPPeekData, MCPActivity } from '@/hooks/usePeekPanel'
import { CheckCircle2, XCircle, Loader2, Info, Server, Zap } from 'lucide-react'

/**
 * Circuit Peek Panel
 *
 * Corner-anchored mini panel with 3 states:
 * - Dot: Minimal presence, just a colored dot
 * - Compact: Single-line summary
 * - Expanded: Full details
 */
export function PeekPanel() {
  const { state, data, expand, collapse, hide } = usePeekPanel()

  if (state === 'hidden') {
    return null
  }

  return (
    <div className="w-full h-full flex items-center justify-center">
      {state === 'dot' && <DotView data={data} onExpand={expand} />}
      {state === 'compact' && <CompactView data={data} onExpand={expand} onCollapse={collapse} onHide={hide} />}
      {state === 'expanded' && <ExpandedView data={data} onCollapse={collapse} onHide={hide} />}
    </div>
  )
}

/**
 * Dot View - Minimal colored indicator
 */
function DotView({ data, onExpand }: { data: any; onExpand: () => void }) {
  const getColor = () => {
    if (!data) return 'bg-gray-400'

    if (data.type === 'test-result') {
      const testData = data as TestResultData
      switch (testData.status) {
        case 'running': return 'bg-blue-400 animate-pulse'
        case 'success': return 'bg-green-400'
        case 'failure': return 'bg-red-400'
        default: return 'bg-gray-400'
      }
    }

    if (data.type === 'mcp') {
      const mcpData = data as MCPPeekData
      switch (mcpData.status) {
        case 'starting': return 'bg-yellow-400 animate-pulse'
        case 'running': return 'bg-blue-500 animate-pulse'
        case 'error': return 'bg-red-500'
        case 'stopped': return 'bg-gray-400'
        default: return 'bg-gray-400'
      }
    }

    if (data.type === 'custom') {
      const customData = data as CustomPeekData
      switch (customData.variant) {
        case 'success': return 'bg-green-400'
        case 'error': return 'bg-red-400'
        case 'warning': return 'bg-yellow-400'
        default: return 'bg-blue-400'
      }
    }

    return 'bg-gray-400'
  }

  return (
    <div
      onClick={onExpand}
      className={`w-12 h-12 rounded-full ${getColor()} shadow-lg cursor-pointer hover:scale-110 transition-transform`}
    />
  )
}

/**
 * Compact View - Single-line summary
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

  if (data.type === 'test-result') {
    const testData = data as TestResultData
    return (
      <div
        className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3 cursor-pointer hover:bg-white transition-colors"
        onClick={onExpand}
        onDoubleClick={onHide}
      >
        <div className="flex items-center gap-3">
          {testData.status === 'running' && (
            <>
              <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
              <span className="text-sm font-medium text-gray-700">Running tests...</span>
            </>
          )}
          {testData.status === 'success' && (
            <>
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span className="text-sm font-medium text-gray-700">
                {testData.passed}/{testData.total} passed
              </span>
              {testData.duration && (
                <span className="text-xs text-gray-500">({(testData.duration / 1000).toFixed(1)}s)</span>
              )}
            </>
          )}
          {testData.status === 'failure' && (
            <>
              <XCircle className="h-5 w-5 text-red-500" />
              <span className="text-sm font-medium text-gray-700">
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

    // Status indicator (colored dot)
    const getStatusDot = () => {
      switch (mcpData.status) {
        case 'starting':
          return <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
        case 'running':
          return <div className="w-2 h-2 rounded-full bg-blue-500" />
        case 'error':
          return <div className="w-2 h-2 rounded-full bg-red-500" />
        default:
          return <div className="w-2 h-2 rounded-full bg-gray-400" />
      }
    }

    return (
      <div
        className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3 cursor-pointer hover:bg-white transition-colors"
        onClick={onExpand}
        onDoubleClick={onHide}
      >
        <div className="flex items-center gap-2 mb-1">
          {getStatusDot()}
          <Server className="h-4 w-4 text-gray-600" />
          <span className="text-sm font-medium text-gray-700">{mcpData.serverName}</span>
        </div>

        {latestActivity && (
          <div className="flex items-center gap-2 text-xs text-gray-600 ml-6">
            <Zap className="h-3 w-3" />
            <span className="truncate flex-1">
              {latestActivity.summary || latestActivity.method}
            </span>
            {latestActivity.latency && (
              <span className="text-gray-400">{latestActivity.latency}ms</span>
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
        case 'success': return <CheckCircle2 className="h-5 w-5 text-green-500" />
        case 'error': return <XCircle className="h-5 w-5 text-red-500" />
        case 'warning': return <Info className="h-5 w-5 text-yellow-500" />
        default: return <Info className="h-5 w-5 text-blue-500" />
      }
    }

    return (
      <div
        className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3 cursor-pointer hover:bg-white transition-colors"
        onClick={onExpand}
        onDoubleClick={onHide}
      >
        <div className="flex items-center gap-3">
          {getIcon()}
          <span className="text-sm font-medium text-gray-700">{customData.message}</span>
        </div>
      </div>
    )
  }

  return null
}

/**
 * Expanded View - Full details
 */
function ExpandedView({
  data,
  onCollapse,
  onHide
}: {
  data: any
  onCollapse: () => void
  onHide: () => void
}) {
  if (!data) return null

  if (data.type === 'test-result') {
    const testData = data as TestResultData
    return (
      <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-4 w-full h-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {testData.status === 'running' && <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />}
            {testData.status === 'success' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
            {testData.status === 'failure' && <XCircle className="h-5 w-5 text-red-500" />}
            <h3 className="text-sm font-semibold text-gray-800">Test Results</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCollapse}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Collapse
            </button>
            <button
              onClick={onHide}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="text-center">
            <div className="text-xs text-gray-500">Passed</div>
            <div className="text-lg font-semibold text-green-600">{testData.passed || 0}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500">Failed</div>
            <div className="text-lg font-semibold text-red-600">{testData.failed || 0}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500">Total</div>
            <div className="text-lg font-semibold text-gray-700">{testData.total || 0}</div>
          </div>
        </div>

        {/* Duration */}
        {testData.duration && (
          <div className="text-xs text-gray-500 mb-3">
            Duration: {(testData.duration / 1000).toFixed(2)}s
          </div>
        )}

        {/* Errors */}
        {testData.errors && testData.errors.length > 0 && (
          <div className="flex-1 overflow-y-auto">
            <div className="text-xs font-medium text-gray-700 mb-1">Errors:</div>
            <div className="bg-gray-50 rounded p-2 text-xs font-mono text-red-600 space-y-1">
              {testData.errors.map((error, i) => (
                <div key={i} className="truncate">
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

    // Status indicator (colored dot)
    const getStatusDot = () => {
      switch (mcpData.status) {
        case 'starting':
          return <div className="w-2.5 h-2.5 rounded-full bg-yellow-400 animate-pulse" />
        case 'running':
          return <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
        case 'error':
          return <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
        default:
          return <div className="w-2.5 h-2.5 rounded-full bg-gray-400" />
      }
    }

    return (
      <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-4 w-full h-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {getStatusDot()}
            <Server className="h-4 w-4 text-gray-600" />
            <h3 className="text-sm font-semibold text-gray-800">{mcpData.serverName}</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCollapse}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Collapse
            </button>
            <button
              onClick={onHide}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
          </div>
        </div>

        {/* Status */}
        <div className="text-xs text-gray-500 mb-3">
          Status: <span className="font-medium capitalize">{mcpData.status}</span>
        </div>

        {/* Recent Activity */}
        {mcpData.recentActivity.length > 0 && (
          <div className="flex-1 overflow-y-auto">
            <div className="text-xs font-medium text-gray-700 mb-2">Recent Activity</div>
            <div className="space-y-2">
              {mcpData.recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="bg-gray-50 rounded p-2 text-xs"
                >
                  <div className="flex items-start gap-2 mb-1">
                    <Zap className="h-3 w-3 text-gray-500 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-700 truncate">
                          {activity.method}
                        </span>
                        <div className={`w-1.5 h-1.5 rounded-full ${activity.success ? 'bg-green-500' : 'bg-red-500'}`} />
                      </div>
                      {activity.summary && (
                        <div className="text-gray-600 truncate mt-0.5">
                          {activity.summary}
                        </div>
                      )}
                      {activity.error && (
                        <div className="text-red-600 text-xs mt-0.5 truncate">
                          Error: {activity.error}
                        </div>
                      )}
                    </div>
                    {activity.latency && (
                      <span className="text-gray-400 shrink-0">{activity.latency}ms</span>
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
      <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-4 w-full h-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-800">{customData.title}</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={onCollapse}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Collapse
            </button>
            <button
              onClick={onHide}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
          </div>
        </div>

        {/* Message */}
        <div className="flex-1 overflow-y-auto text-sm text-gray-700">
          {customData.message}
        </div>
      </div>
    )
  }

  return null
}

export default PeekPanel
