/**
 * Memory Pool Monitor Component
 *
 * Compact monitor for SharedMemoryPool statistics
 * Designed to fit in TodoPanel sidebar
 */

import { useState, useEffect } from 'react'
import { Database, RefreshCw, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// @ts-ignore
const { ipcRenderer } = window.require('electron')

interface CacheEntry {
  projectPath: string
  globalMemoryCount: number
  conversationCount: number
  age: number
}

interface PoolStats {
  cacheSize: number
  entries: CacheEntry[]
}

export function MemoryPoolMonitor() {
  const [stats, setStats] = useState<PoolStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)

  const loadStats = async () => {
    try {
      setLoading(true)
      setError(null)

      console.log('[MemoryPoolMonitor] Loading stats...')
      const result = await ipcRenderer.invoke('circuit:memory-pool-stats')
      console.log('[MemoryPoolMonitor] Result:', result)

      if (result.success) {
        setStats(result.stats)
        console.log('[MemoryPoolMonitor] Stats updated:', result.stats)
      } else {
        console.error('[MemoryPoolMonitor] Error:', result.error)
        setError(result.error)
      }
    } catch (err: any) {
      console.error('[MemoryPoolMonitor] Exception:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const clearCache = async () => {
    try {
      setLoading(true)
      setError(null)

      console.log('[MemoryPoolMonitor] Clearing cache...')
      const result = await ipcRenderer.invoke('circuit:memory-pool-clear')
      console.log('[MemoryPoolMonitor] Clear result:', result)

      if (result.success) {
        console.log('[MemoryPoolMonitor] Cache cleared, reloading stats...')
        await loadStats()
      } else {
        console.error('[MemoryPoolMonitor] Clear error:', result.error)
        setError(result.error)
      }
    } catch (err: any) {
      console.error('[MemoryPoolMonitor] Clear exception:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStats()

    // Auto-refresh every 5 seconds
    const interval = setInterval(loadStats, 5000)

    return () => clearInterval(interval)
  }, [])

  const formatAge = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${Math.floor(ms / 1000)}s`
    return `${Math.floor(ms / 60000)}m`
  }

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database size={14} className="text-sidebar-foreground-muted" />
          <span className="text-xs font-medium text-sidebar-foreground">
            Memory Pool
          </span>
          {stats && stats.cacheSize > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
              {stats.cacheSize}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={loadStats}
            disabled={loading}
            className="p-1 rounded hover:bg-sidebar-hover text-sidebar-foreground-muted hover:text-sidebar-foreground transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={12} className={cn(loading && 'animate-spin')} />
          </button>
          {stats && stats.cacheSize > 0 && (
            <button
              onClick={clearCache}
              disabled={loading}
              className="p-1 rounded hover:bg-sidebar-hover text-sidebar-foreground-muted hover:text-destructive transition-colors disabled:opacity-50"
              title="Clear Cache"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="text-[10px] text-destructive bg-destructive/10 rounded px-2 py-1">
          {error}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="space-y-1">
          {/* Summary */}
          <div className="flex items-center justify-between text-[10px] text-sidebar-foreground-muted">
            <span>Cache: {stats.cacheSize === 0 ? 'Empty' : 'Active'}</span>
            {stats.cacheSize > 0 && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="hover:text-sidebar-foreground transition-colors"
              >
                {isExpanded ? 'Hide' : 'Show'} details
              </button>
            )}
          </div>

          {/* Expanded Details */}
          {isExpanded && stats.entries.length > 0 && (
            <div className="space-y-1 pt-1">
              {stats.entries.map((entry, index) => (
                <div
                  key={index}
                  className="text-[10px] bg-sidebar-accent/30 rounded p-2 space-y-0.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sidebar-foreground-muted truncate flex-1 mr-2">
                      {entry.projectPath.split('/').pop()}
                    </span>
                    <span className="text-sidebar-foreground-muted/60">
                      {formatAge(entry.age)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sidebar-foreground-muted/70">
                    <span>Global: {entry.globalMemoryCount}</span>
                    <span>Conv: {entry.conversationCount}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Info when empty */}
          {stats.cacheSize === 0 && (
            <div className="text-[10px] text-sidebar-foreground-muted/60 text-center py-2">
              Memories will be cached when loaded
            </div>
          )}
        </div>
      )}
    </div>
  )
}
