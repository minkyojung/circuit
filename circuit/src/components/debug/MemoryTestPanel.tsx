/**
 * Memory Test Panel
 *
 * Quick UI for testing SharedMemoryPool functionality:
 * - Create global/conversation memories
 * - View cache statistics
 * - Verify memory sharing across conversations
 */

import { useState } from 'react'
import { Database, Plus, Trash2, RefreshCw, FlaskConical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Workspace } from '@/types/workspace'

// @ts-ignore
const { ipcRenderer } = window.require('electron')

interface MemoryTestPanelProps {
  workspace: Workspace | null
  conversationId: string | null
}

export function MemoryTestPanel({ workspace, conversationId }: MemoryTestPanelProps) {
  const [testKey, setTestKey] = useState('test-memory')
  const [testValue, setTestValue] = useState('Hello from Circuit!')
  const [globalMemories, setGlobalMemories] = useState<any[]>([])
  const [conversationMemories, setConversationMemories] = useState<any[]>([])
  const [cacheStats, setCacheStats] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const createGlobalMemory = async () => {
    if (!workspace) {
      alert('No workspace selected')
      return
    }

    setLoading(true)
    try {
      const result = await ipcRenderer.invoke('circuit:memory-store', {
        projectPath: workspace.path,
        key: `${testKey}-global-${Date.now()}`,
        value: JSON.stringify({ message: testValue, type: 'global', timestamp: Date.now() }),
        type: 'note',
        priority: 'medium',
        scope: 'global',
        metadata: JSON.stringify({ tags: ['test', 'global'] })
      })

      if (result.success) {
        console.log('✅ Global memory created:', result.id)
        alert('Global memory created! This will be shared across all conversations.')
        await loadMemories()
      } else {
        console.error('❌ Failed:', result.error)
        alert(`Failed: ${result.error}`)
      }
    } catch (error) {
      console.error('Error:', error)
      alert(`Error: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  const createConversationMemory = async () => {
    if (!workspace || !conversationId) {
      alert('No workspace or conversation selected')
      return
    }

    setLoading(true)
    try {
      const result = await ipcRenderer.invoke('circuit:memory-store', {
        projectPath: workspace.path,
        key: `${testKey}-conv-${Date.now()}`,
        value: JSON.stringify({ message: testValue, type: 'conversation', timestamp: Date.now() }),
        type: 'note',
        priority: 'medium',
        scope: 'conversation',
        conversationId,
        metadata: JSON.stringify({ tags: ['test', 'conversation'] })
      })

      if (result.success) {
        console.log('✅ Conversation memory created:', result.id)
        alert('Conversation memory created! This is only for this conversation.')
        await loadMemories()
      } else {
        console.error('❌ Failed:', result.error)
        alert(`Failed: ${result.error}`)
      }
    } catch (error) {
      console.error('Error:', error)
      alert(`Error: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  const loadMemories = async () => {
    if (!workspace) return

    setLoading(true)
    try {
      // Load global memories
      const globalResult = await ipcRenderer.invoke('circuit:memory-get-global', workspace.path)
      if (globalResult.success) {
        setGlobalMemories(globalResult.memories || [])
        console.log('📦 Global memories:', globalResult.memories?.length || 0)
      }

      // Load conversation memories (if conversation is selected)
      if (conversationId) {
        const convResult = await ipcRenderer.invoke('circuit:memory-get-conversation', workspace.path, conversationId)
        if (convResult.success) {
          setConversationMemories(convResult.memories || [])
          console.log('📦 Conversation memories:', convResult.memories?.length || 0)
        }
      }

      // Load cache stats
      const statsResult = await ipcRenderer.invoke('circuit:memory-pool-stats')
      if (statsResult.success) {
        setCacheStats(statsResult.stats)
        console.log('📊 Cache stats:', statsResult.stats)
      }
    } catch (error) {
      console.error('Error loading memories:', error)
    } finally {
      setLoading(false)
    }
  }

  const clearCache = async () => {
    setLoading(true)
    try {
      const result = await ipcRenderer.invoke('circuit:memory-pool-clear')
      if (result.success) {
        console.log('✅ Cache cleared')
        alert('Cache cleared!')
        await loadMemories()
      }
    } catch (error) {
      console.error('Error clearing cache:', error)
    } finally {
      setLoading(false)
    }
  }

  const clearProjectMemories = async () => {
    if (!workspace) return

    if (!confirm('Delete all test memories for this workspace?')) return

    setLoading(true)
    try {
      const result = await ipcRenderer.invoke('circuit:memory-clear-project', workspace.path)
      if (result.success) {
        console.log('✅ Cleared', result.count, 'memories')
        alert(`Deleted ${result.count} memories`)
        await loadMemories()
      }
    } catch (error) {
      console.error('Error clearing memories:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!workspace) {
    return (
      <div className="p-4 text-sm text-muted-foreground text-center">
        Select a workspace to test memory
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4 max-w-2xl">
      <div className="flex items-center gap-2 mb-4">
        <FlaskConical size={20} className="text-primary" />
        <h2 className="text-lg font-semibold">Memory Test Panel</h2>
      </div>

      {/* Input Controls */}
      <div className="space-y-3 p-3 bg-sidebar-accent/30 rounded-lg">
        <div>
          <Label htmlFor="test-key" className="text-xs">Memory Key</Label>
          <Input
            id="test-key"
            value={testKey}
            onChange={(e) => setTestKey(e.target.value)}
            placeholder="test-memory"
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label htmlFor="test-value" className="text-xs">Memory Value</Label>
          <Input
            id="test-value"
            value={testValue}
            onChange={(e) => setTestValue(e.target.value)}
            placeholder="Hello from Circuit!"
            className="h-8 text-sm"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={createGlobalMemory}
          disabled={loading}
          variant="outline"
          size="sm"
          className="w-full"
        >
          <Plus size={14} className="mr-1" />
          Create Global Memory
        </Button>
        <Button
          onClick={createConversationMemory}
          disabled={loading || !conversationId}
          variant="outline"
          size="sm"
          className="w-full"
        >
          <Plus size={14} className="mr-1" />
          Create Conv Memory
        </Button>
        <Button
          onClick={loadMemories}
          disabled={loading}
          variant="outline"
          size="sm"
          className="w-full"
        >
          <RefreshCw size={14} className="mr-1" />
          Refresh
        </Button>
        <Button
          onClick={clearCache}
          disabled={loading}
          variant="outline"
          size="sm"
          className="w-full"
        >
          <Database size={14} className="mr-1" />
          Clear Cache
        </Button>
      </div>

      {/* Cache Statistics */}
      {cacheStats && (
        <div className="p-3 bg-primary/10 rounded-lg space-y-2">
          <div className="text-xs font-semibold text-primary">Cache Statistics</div>
          <div className="text-xs space-y-1">
            <div>Cache Size: <span className="font-mono">{cacheStats.cacheSize}</span> projects</div>
            {cacheStats.entries.length > 0 && (
              <div className="mt-2 space-y-1">
                {cacheStats.entries.map((entry: any, i: number) => (
                  <div key={i} className="pl-2 border-l-2 border-primary/30">
                    <div className="font-mono text-[10px]">{entry.projectPath.split('/').pop()}</div>
                    <div className="text-[10px] text-muted-foreground">
                      Global: {entry.globalMemoryCount} | Conv: {entry.conversationCount} |
                      Age: {Math.floor(entry.age / 1000)}s
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Memory Lists */}
      <div className="space-y-3">
        {/* Global Memories */}
        <div className="p-3 bg-green-500/10 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-green-600">
              Global Memories (Shared) - {globalMemories.length}
            </div>
          </div>
          <div className="text-[10px] text-muted-foreground max-h-32 overflow-y-auto space-y-1">
            {globalMemories.length === 0 ? (
              <div>No global memories yet</div>
            ) : (
              globalMemories.map((mem, i) => (
                <div key={i} className="font-mono">
                  {mem.key}: {JSON.stringify(mem.value).slice(0, 50)}...
                </div>
              ))
            )}
          </div>
        </div>

        {/* Conversation Memories */}
        <div className="p-3 bg-blue-500/10 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-blue-600">
              All Memories (Global + Conv) - {conversationMemories.length}
            </div>
          </div>
          <div className="text-[10px] text-muted-foreground max-h-32 overflow-y-auto space-y-1">
            {conversationMemories.length === 0 ? (
              <div>No memories for this conversation yet</div>
            ) : (
              conversationMemories.map((mem, i) => (
                <div key={i} className="font-mono">
                  {mem.key}: {JSON.stringify(mem.value).slice(0, 50)}...
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="pt-3 border-t">
        <Button
          onClick={clearProjectMemories}
          disabled={loading}
          variant="destructive"
          size="sm"
          className="w-full"
        >
          <Trash2 size={14} className="mr-1" />
          Clear All Test Memories
        </Button>
      </div>

      {/* Instructions */}
      <div className="text-[10px] text-muted-foreground space-y-1 p-3 bg-sidebar-accent/20 rounded">
        <div className="font-semibold mb-1">📋 Test Instructions:</div>
        <div>1. Create global memory → switch conversations → check it's shared</div>
        <div>2. Create conv memory → switch conversations → check it's isolated</div>
        <div>3. Watch cache stats update as you create memories</div>
        <div>4. Switch workspaces → verify cache isolation</div>
      </div>
    </div>
  )
}
