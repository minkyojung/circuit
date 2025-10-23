/**
 * History Panel Component
 *
 * Displays MCP call history with filtering and detailed view.
 */

import { useState, useMemo } from 'react'
import { useCallHistory } from '@/hooks/useCallHistory'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronRight, CheckCircle, XCircle, Clock, RefreshCw, Download, TrendingUp } from 'lucide-react'
import { useFeatureFlag } from '@/lib/featureFlags'

interface HistoryPanelProps {
  serverId?: string // Filter by server (optional)
}

export function HistoryPanel({ serverId }: HistoryPanelProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [expandedCall, setExpandedCall] = useState<string | null>(null)
  const analyticsEnabled = useFeatureFlag('historyAnalytics')

  const { calls, stats, loading, error, hasMore, fetchMore, refresh } = useCallHistory({
    serverId,
    status: statusFilter === 'all' ? undefined : (statusFilter as any),
    limit: 50,
  })

  // Calculate top tools
  const topTools = useMemo(() => {
    const toolCounts = new Map<string, number>()
    calls.forEach(call => {
      const tool = call.toolName || call.method
      toolCounts.set(tool, (toolCounts.get(tool) || 0) + 1)
    })

    return Array.from(toolCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))
  }, [calls])

  // Calculate success rate
  const successRate = useMemo(() => {
    if (!stats || stats.totalCalls === 0) return 0
    return Math.round((stats.successCount / stats.totalCalls) * 100)
  }, [stats])

  // Export history to JSON
  const exportToJSON = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      stats,
      calls: calls.map(call => ({
        id: call.id,
        serverId: call.serverId,
        toolName: call.toolName,
        method: call.method,
        status: call.status,
        timestamp: call.timestamp,
        duration: call.duration,
        request: call.request,
        response: call.response,
      }))
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mcp-history-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Export history to CSV
  const exportToCSV = () => {
    const headers = ['ID', 'Server', 'Tool', 'Method', 'Status', 'Timestamp', 'Duration (ms)']
    const rows = calls.map(call => [
      call.id,
      call.serverId,
      call.toolName || '',
      call.method,
      call.status,
      new Date(call.timestamp).toISOString(),
      call.duration?.toString() || ''
    ])

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mcp-history-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp)
    const now = Date.now()
    const diff = now - timestamp

    // Less than 1 minute
    if (diff < 60 * 1000) {
      return 'just now'
    }

    // Less than 1 hour
    if (diff < 60 * 60 * 1000) {
      const minutes = Math.floor(diff / (60 * 1000))
      return `${minutes}m ago`
    }

    // Less than 24 hours
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / (60 * 60 * 1000))
      return `${hours}h ago`
    }

    // Show date and time
    return date.toLocaleString()
  }

  const formatDuration = (duration?: number): string => {
    if (!duration) return 'N/A'
    if (duration < 1000) return `${duration}ms`
    return `${(duration / 1000).toFixed(2)}s`
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-3.5 w-3.5 text-[var(--circuit-success)]" />
      case 'error':
        return <XCircle className="h-3.5 w-3.5 text-[var(--circuit-error)]" />
      case 'pending':
        return <Clock className="h-3.5 w-3.5 text-[var(--text-muted)]" />
      default:
        return null
    }
  }

  const formatJSON = (str: string): string => {
    try {
      const obj = JSON.parse(str)
      return JSON.stringify(obj, null, 2)
    } catch {
      return str
    }
  }

  if (loading && calls.length === 0) {
    return (
      <Card className="p-4 glass-card border-0">
        <div className="text-center text-xs text-[var(--text-muted)]">
          Loading history...
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="p-4 glass-card border-0">
        <div className="text-center text-xs text-[var(--circuit-error)]">
          Error loading history: {error}
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header with Stats and Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Call History
          </h3>

          {stats && (
            <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
              <span>{stats.totalCalls} calls</span>
              <span>•</span>
              <span className="text-[var(--circuit-success)]">
                {stats.successCount} success
              </span>
              <span>•</span>
              <span className="text-[var(--circuit-error)]">
                {stats.errorCount} errors
              </span>
              {stats.avgDuration > 0 && (
                <>
                  <span>•</span>
                  <span>avg {formatDuration(stats.avgDuration)}</span>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative group">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1.5"
              disabled={calls.length === 0}
            >
              <Download className="h-3 w-3" />
              Export
            </Button>
            {calls.length > 0 && (
              <div className="hidden group-hover:block absolute right-0 top-8 bg-[var(--bg-card)] border border-[var(--glass-border)] rounded shadow-lg z-10 min-w-[120px]">
                <button
                  onClick={exportToJSON}
                  className="block w-full px-3 py-1.5 text-left text-xs text-[var(--text-primary)] hover:bg-[var(--glass-hover)] transition-colors"
                >
                  Export JSON
                </button>
                <button
                  onClick={exportToCSV}
                  className="block w-full px-3 py-1.5 text-left text-xs text-[var(--text-primary)] hover:bg-[var(--glass-hover)] transition-colors"
                >
                  Export CSV
                </button>
              </div>
            )}
          </div>

          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1.5"
            onClick={refresh}
            disabled={loading}
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Analytics Dashboard */}
      {analyticsEnabled && stats && stats.totalCalls > 0 && (
        <Card className="p-3 glass-card border border-white/5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-3.5 w-3.5 text-[var(--circuit-orange)]" />
            <h4 className="text-xs font-semibold text-[var(--text-primary)]">Analytics</h4>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Success Rate */}
            <div className="space-y-1">
              <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Success Rate</div>
              <div className="flex items-baseline gap-1">
                <span className={`text-xl font-bold ${successRate >= 90 ? 'text-[var(--circuit-success)]' : successRate >= 70 ? 'text-[var(--circuit-orange)]' : 'text-[var(--circuit-error)]'}`}>
                  {successRate}%
                </span>
                <span className="text-[10px] text-[var(--text-muted)]">
                  {stats.successCount}/{stats.totalCalls}
                </span>
              </div>
            </div>

            {/* Average Duration */}
            <div className="space-y-1">
              <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Avg Duration</div>
              <div className="text-xl font-bold text-[var(--text-primary)]">
                {formatDuration(stats.avgDuration)}
              </div>
            </div>
          </div>

          {/* Top Tools */}
          {topTools.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[var(--glass-border)]">
              <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-2">Top Tools</div>
              <div className="space-y-1.5">
                {topTools.map(({ name, count }) => {
                  const percentage = Math.round((count / calls.length) * 100)
                  return (
                    <div key={name} className="space-y-0.5">
                      <div className="flex items-center justify-between text-xs">
                        <code className="text-[var(--circuit-orange)] font-mono">{name}</code>
                        <span className="text-[var(--text-muted)]">{count} ({percentage}%)</span>
                      </div>
                      <div className="h-1 bg-[var(--glass-bg)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--circuit-orange)]"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Status Filters */}
      <div className="flex items-center gap-2">
        {['all', 'success', 'error'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`
              px-3 py-1 text-xs rounded-full transition-all
              ${statusFilter === status
                ? 'bg-[var(--circuit-orange)]/40 text-[var(--circuit-orange)] font-medium'
                : 'bg-[var(--glass-bg)] text-[var(--text-secondary)] hover:bg-[var(--glass-hover)]'
              }
            `}
          >
            {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Call List */}
      <div className="space-y-2">
        {calls.length === 0 ? (
          <Card className="p-6 glass-card border-0 text-center">
            <p className="text-xs text-[var(--text-muted)]">
              No call history yet
            </p>
          </Card>
        ) : (
          calls.map((call) => (
            <Card
              key={call.id}
              className="glass-card border border-white/5 overflow-hidden"
            >
              <div className="p-3">
                {/* Call Summary */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 flex-1">
                    <button
                      onClick={() =>
                        setExpandedCall(expandedCall === call.id ? null : call.id)
                      }
                      className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      {expandedCall === call.id ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                    </button>

                    {getStatusIcon(call.status)}

                    <code className="text-xs font-medium text-[var(--circuit-orange)]">
                      {call.toolName || call.method}
                    </code>

                    <span className="text-[11px] text-[var(--text-muted)]">
                      {formatTimestamp(call.timestamp)}
                    </span>

                    {call.duration && (
                      <Badge className="bg-[var(--glass-bg)] text-[var(--text-muted)] border-0 text-[11px] px-1.5 py-0">
                        {formatDuration(call.duration)}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedCall === call.id && (
                  <div className="mt-3 pt-3 border-t border-[var(--glass-border)]">
                    {/* Request */}
                    <div className="mb-3">
                      <div className="text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        Request
                      </div>
                      <pre className="text-[10px] text-[var(--text-muted)] font-mono bg-[var(--glass-bg)] rounded p-2 overflow-x-auto">
                        {formatJSON(call.request.raw)}
                      </pre>
                    </div>

                    {/* Response */}
                    {call.response && (
                      <div>
                        <div className="text-xs font-semibold text-[var(--text-secondary)] mb-1">
                          Response
                        </div>
                        <pre className="text-[10px] text-[var(--text-muted)] font-mono bg-[var(--glass-bg)] rounded p-2 overflow-x-auto max-h-60">
                          {call.response.error
                            ? formatJSON(JSON.stringify(call.response.error))
                            : formatJSON(call.response.raw || '')}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Load More */}
      {hasMore && (
        <div className="text-center">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={fetchMore}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Load More'}
          </Button>
        </div>
      )}
    </div>
  )
}
