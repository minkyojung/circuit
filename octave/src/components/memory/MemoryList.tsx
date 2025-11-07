/**
 * Memory List Display
 */

import { MemoryCard } from './MemoryCard'
import type { ProjectMemory } from '../../../electron/memoryStorage'

interface MemoryListProps {
  memories: ProjectMemory[]
  onEdit: (memory: ProjectMemory) => void
  onDelete: (memory: ProjectMemory) => void
}

export function MemoryList({ memories, onEdit, onDelete }: MemoryListProps) {
  if (memories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-12">
        <div className="text-4xl mb-4">🧠</div>
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
          No memories yet
        </h3>
        <p className="text-sm text-[var(--text-muted)] max-w-sm">
          Create your first project memory to help Claude Code remember your coding
          conventions, decisions, and patterns.
        </p>
      </div>
    )
  }

  // Group by type
  const grouped: Record<string, ProjectMemory[]> = {}
  memories.forEach((memory) => {
    if (!grouped[memory.type]) {
      grouped[memory.type] = []
    }
    grouped[memory.type].push(memory)
  })

  const typeOrder = ['convention', 'decision', 'rule', 'note', 'snippet']
  const sortedTypes = Object.keys(grouped).sort(
    (a, b) => typeOrder.indexOf(a) - typeOrder.indexOf(b)
  )

  const typeIcons: Record<string, string> = {
    convention: '📝',
    decision: '💡',
    rule: '⚠️',
    note: '📄',
    snippet: '💻',
  }

  return (
    <div className="space-y-6">
      {sortedTypes.map((type) => (
        <div key={type}>
          <h3 className="text-xs font-semibold text-[var(--text-secondary)] mb-3 flex items-center gap-2">
            <span>{typeIcons[type] || '📦'}</span>
            {type.toUpperCase()}S ({grouped[type].length})
          </h3>
          <div className="space-y-3">
            {grouped[type].map((memory) => (
              <MemoryCard
                key={memory.id}
                memory={memory}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
