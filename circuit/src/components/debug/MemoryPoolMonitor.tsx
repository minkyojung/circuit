/**
 * Memory Pool Monitor Component
 *
 * Displays SharedMemoryPool statistics and allows testing
 * the multi-conversation memory optimization.
 *
 * Usage: Add to any component to monitor memory pool performance
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

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

  const loadStats = async () => {
    try {
      setLoading(true)
      setError(null)

      const result = await ipcRenderer.invoke('circuit:memory-pool-stats')

      if (result.success) {
        setStats(result.stats)
      } else {
        setError(result.error)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const clearCache = async () => {
    try {
      setLoading(true)
      setError(null)

      const result = await ipcRenderer.invoke('circuit:memory-pool-clear')

      if (result.success) {
        await loadStats()
      } else {
        setError(result.error)
      }
    } catch (err: any) {
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
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Memory Pool Monitor</CardTitle>
            <CardDescription>
              SharedMemoryPool cache statistics for multi-conversation optimization
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadStats}
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={clearCache}
              disabled={loading || !stats || stats.cacheSize === 0}
            >
              Clear Cache
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="text-sm text-destructive mb-4">
            Error: {error}
          </div>
        )}

        {stats && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex items-center gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Cache Size</div>
                <div className="text-2xl font-bold">{stats.cacheSize}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Status</div>
                <Badge variant={stats.cacheSize > 0 ? 'default' : 'secondary'}>
                  {stats.cacheSize > 0 ? 'Active' : 'Empty'}
                </Badge>
              </div>
            </div>

            {/* Cache Entries */}
            {stats.entries.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-2">Cache Entries</div>
                <div className="space-y-2">
                  {stats.entries.map((entry, index) => (
                    <div
                      key={index}
                      className="border rounded-lg p-3 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-mono truncate flex-1">
                          {entry.projectPath}
                        </div>
                        <Badge variant="outline" className="ml-2">
                          {formatAge(entry.age)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>
                          Global: <span className="font-medium text-foreground">{entry.globalMemoryCount}</span>
                        </span>
                        <span>
                          Conversations: <span className="font-medium text-foreground">{entry.conversationCount}</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {stats.cacheSize === 0 && (
              <div className="text-sm text-muted-foreground text-center py-8">
                No cache entries. Memories will be cached as conversations are loaded.
              </div>
            )}

            {/* Performance Info */}
            <div className="mt-4 p-3 bg-muted rounded-lg text-xs space-y-1">
              <div className="font-medium">How it works:</div>
              <div className="text-muted-foreground">
                • Global memories are shared across all conversations (cached once)
              </div>
              <div className="text-muted-foreground">
                • Conversation memories are cached per conversation
              </div>
              <div className="text-muted-foreground">
                • Cache TTL: 5 minutes (auto-refresh on access)
              </div>
              <div className="text-muted-foreground">
                • Expected reduction: 50-90% depending on conversation count
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
