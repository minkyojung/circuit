/**
 * History Panel Component
 *
 * Displays MCP call history with filtering and detailed view.
 */

import { useState } from 'react'
import { useCallHistory } from '@/hooks/useCallHistory'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronRight, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react'

interface HistoryPanelProps {
  serverId?: string // Filter by server (optional)
}

export function HistoryPanel({ serverId }: HistoryPanelProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [expandedCall, setExpandedCall] = useState<string | null>(null)

  const { calls, stats, loading, error, hasMore, fetchMore, refresh } = useCallHistory({
    serverId,
    status: statusFilter === 'all' ? undefined : (statusFilter as any),
    limit: 50,
  })

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
