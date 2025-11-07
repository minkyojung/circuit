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
const ipcRenderer = window.electron.ipcRenderer;

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
        alert('전역 메모리 생성 완료! 모든 대화에서 공유됩니다.')
        await loadMemories()
      } else {
        console.error('❌ Failed:', result.error)
        alert(`실패: ${result.error}`)
      }
    } catch (error) {
      console.error('Error:', error)
      alert(`오류: ${error}`)
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
        alert('대화 메모리 생성 완료! 이 대화에서만 사용됩니다.')
        await loadMemories()
      } else {
        console.error('❌ Failed:', result.error)
        alert(`실패: ${result.error}`)
      }
    } catch (error) {
      console.error('Error:', error)
      alert(`오류: ${error}`)
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
        alert('캐시를 비웠습니다!')
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

    if (!confirm('이 워크스페이스의 모든 테스트 메모리를 삭제할까요?')) return

    setLoading(true)
    try {
      const result = await ipcRenderer.invoke('circuit:memory-clear-project', workspace.path)
      if (result.success) {
        console.log('✅ Cleared', result.count, 'memories')
        alert(`${result.count}개 메모리 삭제 완료`)
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
        워크스페이스를 선택해주세요
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4 max-w-2xl">
      <div className="flex items-center gap-2 mb-4">
        <FlaskConical size={20} className="text-primary" />
        <h2 className="text-lg font-semibold">메모리 테스트 패널</h2>
      </div>

      {/* Input Controls */}
      <div className="space-y-3 p-3 bg-sidebar-accent/30 rounded-lg">
        <div>
          <Label htmlFor="test-key" className="text-xs">메모리 키</Label>
          <Input
            id="test-key"
            value={testKey}
            onChange={(e) => setTestKey(e.target.value)}
            placeholder="test-memory"
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label htmlFor="test-value" className="text-xs">메모리 값</Label>
          <Input
            id="test-value"
            value={testValue}
            onChange={(e) => setTestValue(e.target.value)}
            placeholder="안녕하세요!"
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
          전역 메모리 생성
        </Button>
        <Button
          onClick={createConversationMemory}
          disabled={loading || !conversationId}
          variant="outline"
          size="sm"
          className="w-full"
        >
          <Plus size={14} className="mr-1" />
          대화 메모리 생성
        </Button>
        <Button
          onClick={loadMemories}
          disabled={loading}
          variant="outline"
          size="sm"
          className="w-full"
        >
          <RefreshCw size={14} className="mr-1" />
          새로고침
        </Button>
        <Button
          onClick={clearCache}
          disabled={loading}
          variant="outline"
          size="sm"
          className="w-full"
        >
          <Database size={14} className="mr-1" />
          캐시 비우기
        </Button>
      </div>

      {/* Cache Statistics */}
      {cacheStats && (
        <div className="p-3 bg-primary/10 rounded-lg space-y-2">
          <div className="text-xs font-semibold text-primary">캐시 통계</div>
          <div className="text-xs space-y-1">
            <div>캐시 크기: <span className="font-mono">{cacheStats.cacheSize}</span> 프로젝트</div>
            {cacheStats.entries.length > 0 && (
              <div className="mt-2 space-y-1">
                {cacheStats.entries.map((entry: any, i: number) => (
                  <div key={i} className="pl-2 border-l-2 border-primary/30">
                    <div className="font-mono text-[10px]">{entry.projectPath.split('/').pop()}</div>
                    <div className="text-[10px] text-muted-foreground">
                      전역: {entry.globalMemoryCount} | 대화: {entry.conversationCount} |
                      경과: {Math.floor(entry.age / 1000)}초
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
              전역 메모리 (공유됨) - {globalMemories.length}개
            </div>
          </div>
          <div className="text-[10px] text-muted-foreground max-h-32 overflow-y-auto space-y-1">
            {globalMemories.length === 0 ? (
              <div>아직 전역 메모리가 없습니다</div>
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
              전체 메모리 (전역 + 대화) - {conversationMemories.length}개
            </div>
          </div>
          <div className="text-[10px] text-muted-foreground max-h-32 overflow-y-auto space-y-1">
            {conversationMemories.length === 0 ? (
              <div>아직 메모리가 없습니다</div>
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
          테스트 메모리 전체 삭제
        </Button>
      </div>

      {/* Instructions */}
      <div className="text-[10px] text-muted-foreground space-y-1 p-3 bg-sidebar-accent/20 rounded">
        <div className="font-semibold mb-1">📋 사용 방법:</div>
        <div>1. 전역 메모리 생성 → 다른 대화로 전환 → 똑같이 보이는지 확인</div>
        <div>2. 대화 메모리 생성 → 다른 대화로 전환 → 안 보이는지 확인</div>
        <div>3. 메모리 생성할 때마다 캐시 통계 변화 확인</div>
        <div>4. 워크스페이스 전환 → 캐시 분리 확인</div>
      </div>
    </div>
  )
}
