/**
 * Memory Tab: Project Context & Knowledge Management
 *
 * Allows users to view and manage project-specific memories:
 * - Conventions (coding standards, patterns)
 * - Decisions (architectural choices)
 * - Rules (linting, testing requirements)
 * - Notes (general project info)
 * - Snippets (reusable code patterns)
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Search } from 'lucide-react'
import { MemoryStats } from '@/components/memory/MemoryStats'
import { MemoryList } from '@/components/memory/MemoryList'
import { MemoryForm } from '@/components/memory/MemoryForm'
import { useProjectPath } from '@/App'
import type { ProjectMemory, MemoryStats as Stats } from '../../electron/memoryStorage'

const { ipcRenderer } = window.require('electron')

export function MemoryTab() {
  const { projectPath, isLoading: isLoadingPath } = useProjectPath()

  // State
  const [memories, setMemories] = useState<ProjectMemory[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingMemory, setEditingMemory] = useState<ProjectMemory | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<string | undefined>(undefined)

  // Load memories and stats
  useEffect(() => {
    if (!projectPath || isLoadingPath) return

    loadMemories()
    loadStats()

    // Poll stats every 2 seconds
    const interval = setInterval(loadStats, 2000)
    return () => clearInterval(interval)
  }, [projectPath, isLoadingPath])

  const loadMemories = async () => {
    try {
      setIsLoading(true)
      const result = await ipcRenderer.invoke('circuit:memory-list', {
        projectPath,
        limit: 1000,
      })

      if (result.success) {
        setMemories(result.memories || [])
      } else {
        console.error('Failed to load memories:', result.error)
      }
    } catch (error) {
      console.error('Error loading memories:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const result = await ipcRenderer.invoke('circuit:memory-stats', projectPath)

      if (result.success) {
        setStats(result.stats)
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const handleCreate = () => {
    setEditingMemory(null)
    setSelectedTemplate(undefined)
    setShowForm(true)
  }

  const handleCreateFromTemplate = (template: string) => {
    setEditingMemory(null)
    setSelectedTemplate(template)
    setShowForm(true)
  }

  const handleEdit = (memory: ProjectMemory) => {
    setEditingMemory(memory)
    setSelectedTemplate(undefined)
    setShowForm(true)
  }

  const handleDelete = async (memory: ProjectMemory) => {
    if (!confirm(`Delete "${memory.key}"?`)) return

    try {
      const result = await ipcRenderer.invoke(
        'circuit:memory-delete',
        projectPath,
        memory.key
      )

      if (result.success) {
        await loadMemories()
        await loadStats()
      } else {
        alert(`Failed to delete: ${result.error}`)
      }
    } catch (error) {
      console.error('Error deleting memory:', error)
      alert(`Error: ${error}`)
    }
  }

  const handleSave = async () => {
    setShowForm(false)
    setEditingMemory(null)
    await loadMemories()
    await loadStats()
  }

  const handleExport = async () => {
    try {
      const result = await ipcRenderer.invoke('circuit:memory-export', projectPath)

      if (result.success) {
        // Create download
        const dataStr = JSON.stringify(result.memories, null, 2)
        const dataBlob = new Blob([dataStr], { type: 'application/json' })
        const url = URL.createObjectURL(dataBlob)
        const link = document.createElement('a')
        link.href = url
        link.download = `circuit-memory-${Date.now()}.json`
        link.click()
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Error exporting:', error)
    }
  }

  // Filter memories
  const filteredMemories = memories.filter((memory) => {
    // Type filter
    if (typeFilter && memory.type !== typeFilter) return false

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        memory.key.toLowerCase().includes(query) ||
        memory.value.toLowerCase().includes(query)
      )
    }

    return true
  })

  return (
    <div className="h-full flex gap-6">
      {/* Left Sidebar - Stats & Filters */}
      <aside className="w-[300px] flex flex-col gap-4">
        {/* Stats */}
        <MemoryStats stats={stats} onTypeClick={setTypeFilter} />

        {/* Quick Filters */}
        <div className="glass-card p-4">
          <h3 className="text-xs font-semibold text-[var(--text-secondary)] mb-3">
            QUICK FILTERS
          </h3>
          <div className="flex flex-col gap-1.5">
            {['convention', 'decision', 'rule', 'note', 'snippet'].map((type) => (
              <button
                key={type}
                onClick={() => setTypeFilter(typeFilter === type ? null : type)}
                className={`
                  px-3 py-1.5 text-xs text-left rounded transition-all
                  ${
                    typeFilter === type
                      ? 'bg-[var(--circuit-orange)]/25 text-[var(--circuit-orange)] font-medium'
                      : 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--glass-hover)] hover:text-[var(--text-primary)]'
                  }
                `}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}s
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="glass-card p-4">
          <h3 className="text-xs font-semibold text-[var(--text-secondary)] mb-3">
            ACTIONS
          </h3>
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="w-full justify-start text-xs"
            >
              Export JSON
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content - Memory List */}
      <main className="flex-1 flex flex-col gap-4">
        {/* Header */}
        <div className="flex flex-col gap-3">
          {/* Quick Start Templates (Conductor style) */}
          {memories.length === 0 && !isLoading && (
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-medium text-[var(--text-secondary)]">Quick Start:</span>
                <span className="text-xs text-[var(--text-muted)]">Choose a template to get started</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'naming-convention', label: '📝 Naming Convention', desc: 'File and variable naming rules' },
                  { key: 'api-pattern', label: '🔌 API Pattern', desc: 'REST API design standards' },
                  { key: 'error-handling', label: '⚠️ Error Handling', desc: 'Error handling strategy' },
                  { key: 'file-structure', label: '📁 File Structure', desc: 'Project organization' },
                ].map((template) => (
                  <button
                    key={template.key}
                    onClick={() => handleCreateFromTemplate(template.key)}
                    className="flex-1 min-w-[200px] px-4 py-3 text-left border border-dashed border-[var(--glass-border)] rounded-lg hover:border-[var(--circuit-orange)] hover:bg-[var(--glass-hover)] transition-all group"
                  >
                    <div className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--circuit-orange)]">
                      {template.label}
                    </div>
                    <div className="text-xs text-[var(--text-muted)] mt-0.5">
                      {template.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search and Actions */}
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
              <Input
                placeholder="Search memories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button onClick={handleCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              New Memory
            </Button>
          </div>
        </div>

        {/* Memory List */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-[var(--text-muted)]">
              Loading memories...
            </div>
          ) : filteredMemories.length === 0 && memories.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <div className="text-4xl mb-4">🧠</div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                  No Memories Yet
                </h3>
                <p className="text-sm text-[var(--text-muted)] mb-6">
                  Teach Claude Code about your project's patterns, conventions, and decisions.
                  Choose a template above to get started.
                </p>
              </div>
            </div>
          ) : filteredMemories.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <div className="text-4xl mb-4">🔍</div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                  No Matching Memories
                </h3>
                <p className="text-sm text-[var(--text-muted)]">
                  Try adjusting your search or filter.
                </p>
              </div>
            </div>
          ) : (
            <MemoryList
              memories={filteredMemories}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          )}
        </div>
      </main>

      {/* Memory Form Modal */}
      {showForm && (
        <MemoryForm
          projectPath={projectPath}
          memory={editingMemory}
          initialTemplate={selectedTemplate}
          onSave={handleSave}
          onCancel={() => {
            setShowForm(false)
            setEditingMemory(null)
            setSelectedTemplate(undefined)
          }}
        />
      )}
    </div>
  )
}
