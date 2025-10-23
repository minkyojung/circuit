/**
 * React Hook for MCP Call History
 *
 * Provides access to call history with filtering, pagination, and statistics.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { MCPCall, HistoryQuery, CallStats } from '../types/history'

interface UseCallHistoryResult {
  calls: MCPCall[]
  stats: CallStats | null
  loading: boolean
  error: string | null
  hasMore: boolean
  fetchMore: () => Promise<void>
  refresh: () => Promise<void>
}

/**
 * Hook to fetch and manage call history
 */
export function useCallHistory(query: HistoryQuery = {}): UseCallHistoryResult {
  const [calls, setCalls] = useState<MCPCall[]>([])
  const [stats, setStats] = useState<CallStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<number | undefined>()

  // Stable query key to prevent infinite loops
  const queryKey = useMemo(() => JSON.stringify(query), [
    query.serverId,
    query.toolName,
    query.status,
    query.after,
    query.before,
    query.cursor,
    query.limit,
    query.searchQuery,
  ])

  // Fetch history
  const fetchHistory = useCallback(async (cursor?: number) => {
    try {
      setLoading(true)
      setError(null)

      const { ipcRenderer } = (window as any).require('electron')

      // Fetch calls
      const historyResult = await ipcRenderer.invoke('circuit:history-get', {
        ...query,
        cursor,
        limit: query.limit || 50,
      })

      if (!historyResult.success) {
        throw new Error(historyResult.error)
      }

      // Parse calls (deserialize JSON fields)
      const parsedCalls = historyResult.calls.map((call: any) => ({
        ...call,
        request: {
          params: JSON.parse(call.requestParams),
          raw: call.requestRaw,
        },
        response: call.responseResult || call.responseError ? {
          result: call.responseResult ? JSON.parse(call.responseResult) : undefined,
          error: call.responseError ? JSON.parse(call.responseError) : undefined,
          raw: call.responseRaw,
        } : undefined,
        metadata: {
          source: call.source,
          sessionId: call.sessionId,
          conversationId: call.conversationId,
          truncated: call.truncated,
        },
      }))

      if (cursor) {
        // Append to existing calls (pagination)
        setCalls(prev => [...prev, ...parsedCalls])
      } else {
        // Replace calls (initial load or refresh)
        setCalls(parsedCalls)
      }

      setHasMore(historyResult.hasMore || false)
      setNextCursor(historyResult.nextCursor)

      // Fetch stats
      const statsResult = await ipcRenderer.invoke('circuit:history-get-stats', query)
      if (statsResult.success) {
        setStats(statsResult.stats)
      }
    } catch (err: any) {
      console.error('[useCallHistory] Error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [queryKey])

  // Initial fetch
  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  // Fetch more (pagination)
  const fetchMore = useCallback(async () => {
    if (!hasMore || loading) return
    await fetchHistory(nextCursor)
  }, [hasMore, loading, nextCursor, fetchHistory])

  // Refresh
  const refresh = useCallback(async () => {
    await fetchHistory()
  }, [fetchHistory])

  return {
    calls,
    stats,
    loading,
    error,
    hasMore,
    fetchMore,
    refresh,
  }
}

/**
 * Hook to clear all history
 */
export function useClearHistory() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clearHistory = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const { ipcRenderer } = (window as any).require('electron')
      const result = await ipcRenderer.invoke('circuit:history-clear')

      if (!result.success) {
        throw new Error(result.error)
      }

      return true
    } catch (err: any) {
      console.error('[useClearHistory] Error:', err)
      setError(err.message)
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  return { clearHistory, loading, error }
}
