/**
 * MCPTimeline - Real-time MCP request-response timeline
 *
 * Displays a live stream of MCP tool calls with:
 * - Request/response details
 * - Success/error status
 * - Performance metrics (latency)
 * - Server and tool filtering
 * - Statistics summary
 *
 * Data source: SQLite history via circuit:history-get IPC
 */

import { useState, useEffect, useCallback } from 'react';
import { Activity, CheckCircle2, XCircle, Clock, Filter, RefreshCw, TrendingUp, Zap, AlertCircle } from 'lucide-react';
import { Stack } from '../ui/stack';
import { Inline } from '../ui/inline';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';

// @ts-ignore - Electron IPC
const { ipcRenderer } = window.require('electron');

interface MCPCall {
  id: string;
  timestamp: number;
  duration?: number;
  serverId: string;
  serverName: string;
  method: string;
  toolName?: string;
  requestParams: string;
  responseResult?: string;
  responseError?: string;
  status: 'pending' | 'success' | 'error' | 'timeout';
}

interface CallStats {
  totalCalls: number;
  successCount: number;
  errorCount: number;
  successRate: number;
  avgDuration: number;
}

type FilterType = 'all' | 'success' | 'error';

interface MCPTimelineProps {
  /** Maximum number of calls to display (default: 50) */
  limit?: number;
  /** Auto-refresh interval in ms (default: 5000ms, 0 to disable) */
  refreshInterval?: number;
  /** Optional server filter */
  serverId?: string;
}

export function MCPTimeline({
  limit = 50,
  refreshInterval = 5000,
  serverId,
}: MCPTimelineProps) {
  const [calls, setCalls] = useState<MCPCall[]>([]);
  const [stats, setStats] = useState<CallStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');

  const loadData = useCallback(async () => {
    try {
      const query: any = { limit };
      if (serverId) {
        query.serverId = serverId;
      }

      // Load calls and stats in parallel
      const [callsResult, statsResult] = await Promise.all([
        ipcRenderer.invoke('circuit:history-get', query),
        ipcRenderer.invoke('circuit:history-get-stats', serverId ? { serverId } : {})
      ]);

      if (callsResult.success) {
        setCalls(callsResult.calls);
        setError(null);
      } else {
        setError(callsResult.error || 'Failed to load history');
      }

      if (statsResult.success) {
        setStats(statsResult.stats);
      }
    } catch (err) {
      console.error('[MCPTimeline] Failed to load data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [limit, serverId]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh
  useEffect(() => {
    if (refreshInterval === 0) return;

    const interval = setInterval(loadData, refreshInterval);
    return () => clearInterval(interval);
  }, [loadData, refreshInterval]);

  const toggleExpand = (callId: string) => {
    setExpandedCallId(expandedCallId === callId ? null : callId);
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDuration = (duration?: number) => {
    if (!duration) return '—';
    if (duration < 1000) return `${Math.round(duration)}ms`;
    return `${(duration / 1000).toFixed(2)}s`;
  };

  const getStatusIcon = (status: MCPCall['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'timeout':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-400 animate-pulse" />;
    }
  };

  const getStatusColor = (status: MCPCall['status'], duration?: number) => {
    // Slow calls get special highlighting
    if (duration && duration >= 1000) {
      return 'border-l-orange-500';
    }

    switch (status) {
      case 'success':
        return 'border-l-green-500';
      case 'error':
        return 'border-l-red-500';
      case 'timeout':
        return 'border-l-yellow-500';
      default:
        return 'border-l-gray-400';
    }
  };

  const getDurationColor = (duration?: number) => {
    if (!duration) return 'text-muted-foreground';
    if (duration < 100) return 'text-green-600';
    if (duration < 1000) return 'text-yellow-600';
    return 'text-red-600 font-bold';
  };

  // Filter calls based on selected filter
  const filteredCalls = calls.filter(call => {
    if (filter === 'success') return call.status === 'success';
    if (filter === 'error') return call.status === 'error' || call.status === 'timeout';
    return true;
  });

  if (isLoading) {
    return (
      <Stack space="4" className="p-4">
        <Inline space="2" align="center">
          <Activity className="w-4 h-4 animate-spin" />
          <span className="text-sm text-muted-foreground">Loading MCP timeline...</span>
        </Inline>
      </Stack>
    );
  }

  if (error) {
    return (
      <Stack space="4" className="p-4">
        <div className="text-sm text-destructive">Error: {error}</div>
        <Button onClick={loadData} size="sm">
          Retry
        </Button>
      </Stack>
    );
  }

  if (calls.length === 0) {
    return (
      <Stack space="4" className="p-4">
        <div className="text-center py-8 text-sm text-muted-foreground">
          <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No MCP calls yet</p>
          <p className="text-xs mt-1">Tool calls will appear here as they happen</p>
        </div>
      </Stack>
    );
  }

  return (
    <Stack space="0" className="h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-sidebar-border bg-sidebar">
        <Inline space="2" align="center">
          <Activity className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">MCP Timeline</span>
          <span className="text-xs text-muted-foreground">({filteredCalls.length})</span>
        </Inline>
        <Button onClick={loadData} size="sm" variant="ghost">
          <RefreshCw className="w-3 h-3" />
        </Button>
      </div>

      {/* Stats Summary */}
      {stats && (
        <div className="px-4 py-3 border-b border-sidebar-border bg-sidebar-accent/30">
          <div className="grid grid-cols-3 gap-3 text-xs">
            {/* Total Calls */}
            <div className="flex items-center gap-2">
              <TrendingUp className="w-3 h-3 text-blue-500" />
              <div>
                <div className="text-muted-foreground">Total</div>
                <div className="font-semibold">{stats.totalCalls}</div>
              </div>
            </div>

            {/* Success Rate */}
            <div className="flex items-center gap-2">
              <CheckCircle2 className={cn(
                "w-3 h-3",
                stats.successRate >= 0.95 ? "text-green-500" :
                stats.successRate >= 0.8 ? "text-yellow-500" : "text-red-500"
              )} />
              <div>
                <div className="text-muted-foreground">Success</div>
                <div className="font-semibold">{(stats.successRate * 100).toFixed(0)}%</div>
              </div>
            </div>

            {/* Avg Duration */}
            <div className="flex items-center gap-2">
              <Zap className={cn(
                "w-3 h-3",
                stats.avgDuration < 100 ? "text-green-500" :
                stats.avgDuration < 500 ? "text-yellow-500" : "text-red-500"
              )} />
              <div>
                <div className="text-muted-foreground">Avg</div>
                <div className="font-semibold">{formatDuration(stats.avgDuration)}</div>
              </div>
            </div>
          </div>

          {/* Warnings for slow calls */}
          {calls.some(c => c.duration && c.duration >= 1000) && (
            <div className="mt-2 flex items-center gap-2 text-xs text-orange-600">
              <AlertCircle className="w-3 h-3" />
              <span>{calls.filter(c => c.duration && c.duration >= 1000).length} slow calls (&gt;1s)</span>
            </div>
          )}
        </div>
      )}

      {/* Filter Buttons */}
      <div className="px-4 py-2 border-b border-sidebar-border bg-sidebar">
        <Inline space="2">
          <button
            onClick={() => setFilter('all')}
            className={cn(
              "px-2 py-1 text-xs rounded transition-colors",
              filter === 'all'
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            )}
          >
            All ({calls.length})
          </button>
          <button
            onClick={() => setFilter('success')}
            className={cn(
              "px-2 py-1 text-xs rounded transition-colors",
              filter === 'success'
                ? "bg-green-500 text-white"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            )}
          >
            Success ({calls.filter(c => c.status === 'success').length})
          </button>
          <button
            onClick={() => setFilter('error')}
            className={cn(
              "px-2 py-1 text-xs rounded transition-colors",
              filter === 'error'
                ? "bg-red-500 text-white"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            )}
          >
            Errors ({calls.filter(c => c.status === 'error' || c.status === 'timeout').length})
          </button>
        </Inline>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto">
        {filteredCalls.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <Filter className="w-6 h-6 mx-auto mb-2 opacity-50" />
            <p>No {filter} calls</p>
          </div>
        ) : (
          <Stack space="0">
            {filteredCalls.map((call) => {
              const isExpanded = expandedCallId === call.id;
              const hasError = call.status === 'error';
              const isSlow = call.duration && call.duration >= 1000;

              return (
                <div
                  key={call.id}
                  className={cn(
                    'border-l-2 border-b border-sidebar-border hover:bg-sidebar-accent/50 cursor-pointer transition-colors',
                    getStatusColor(call.status, call.duration),
                    isSlow && 'bg-orange-500/5'
                  )}
                  onClick={() => toggleExpand(call.id)}
                >
                  <div className="p-3">
                    {/* Main row */}
                    <Inline space="3" align="center" className="mb-1">
                      {getStatusIcon(call.status)}
                      <span className="text-xs text-muted-foreground font-mono">
                        {formatTimestamp(call.timestamp)}
                      </span>
                      <span className="text-sm font-medium flex-1">
                        {call.serverName}
                      </span>
                      <span className={cn('text-xs font-mono', getDurationColor(call.duration))}>
                        {isSlow && '⚠ '}
                        {formatDuration(call.duration)}
                      </span>
                    </Inline>

                    {/* Tool name */}
                    <div className="ml-7 text-sm">
                      <span className="text-muted-foreground">→ </span>
                      <span className="font-mono">
                        {call.toolName || call.method}
                      </span>
                    </div>

                    {/* Error preview */}
                    {hasError && !isExpanded && (
                      <div className="ml-7 mt-1 text-xs text-red-500">
                        {JSON.parse(call.responseError || '{}').message || 'Error occurred'}
                      </div>
                    )}

                    {/* Expanded details */}
                    {isExpanded && (
                      <Stack space="2" className="ml-7 mt-3 p-3 bg-sidebar rounded text-xs">
                        {/* Request */}
                        <div>
                          <div className="text-muted-foreground font-semibold mb-1">Request</div>
                          <pre className="overflow-x-auto p-2 bg-background rounded font-mono text-xs">
                            {JSON.stringify(JSON.parse(call.requestParams || '{}'), null, 2)}
                          </pre>
                        </div>

                        {/* Response */}
                        {call.status === 'success' && call.responseResult && (
                          <div>
                            <div className="text-green-600 font-semibold mb-1">Response</div>
                            <pre className="overflow-x-auto p-2 bg-background rounded font-mono text-xs max-h-40">
                              {JSON.stringify(JSON.parse(call.responseResult), null, 2)}
                            </pre>
                          </div>
                        )}

                        {/* Error */}
                        {hasError && call.responseError && (
                          <div>
                            <div className="text-red-500 font-semibold mb-1">Error</div>
                            <pre className="overflow-x-auto p-2 bg-background rounded font-mono text-xs">
                              {JSON.stringify(JSON.parse(call.responseError), null, 2)}
                            </pre>
                          </div>
                        )}

                        {/* Metadata */}
                        <div className="text-muted-foreground pt-2 border-t border-sidebar-border">
                          <div>Server: {call.serverId}</div>
                          <div>Method: {call.method}</div>
                          <div>Call ID: {call.id}</div>
                        </div>
                      </Stack>
                    )}
                  </div>
                </div>
              );
            })}
          </Stack>
        )}
      </div>
    </Stack>
  );
}
