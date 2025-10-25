/**
 * Individual Memory Card
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Edit2, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import type { ProjectMemory } from '../../../electron/memoryStorage'

interface MemoryCardProps {
  memory: ProjectMemory
  onEdit: (memory: ProjectMemory) => void
  onDelete: (memory: ProjectMemory) => void
}

export function MemoryCard({ memory, onEdit, onDelete }: MemoryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const priorityColors = {
    high: 'bg-red-500/20 text-red-400 border-red-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  }

  const typeColors = {
    convention: 'bg-blue-500/20 text-blue-400',
    decision: 'bg-yellow-500/20 text-yellow-400',
    rule: 'bg-red-500/20 text-red-400',
    note: 'bg-gray-500/20 text-gray-400',
    snippet: 'bg-green-500/20 text-green-400',
  }

  return (
    <Card className="glass-card p-4 hover:bg-[var(--glass-hover)] transition-colors">
      {/* Header */}
      <div className="flex items-start gap-3 mb-2">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-semibold text-[var(--text-primary)] truncate">
              {memory.key}
            </h4>
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 ${typeColors[memory.type]}`}
            >
              {memory.type}
            </Badge>
          </div>

          {/* Preview (collapsed) */}
          {!isExpanded && (
            <p className="text-xs text-[var(--text-muted)] line-clamp-2">
              {memory.value}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(memory)}
            className="h-7 w-7 p-0"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(memory)}
            className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="ml-7 space-y-3">
          {/* Full Value */}
          <div className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">
            {memory.value}
          </div>

          {/* Metadata */}
          {memory.metadata && (
            <div className="text-xs text-[var(--text-muted)] bg-[var(--glass-hover)] rounded p-2">
              <span className="font-medium">Metadata:</span> {memory.metadata}
            </div>
          )}

          {/* Footer Info */}
          <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 ${priorityColors[memory.priority]}`}
            >
              {memory.priority} priority
            </Badge>
            <span>Used {memory.usageCount}×</span>
            <span>
              Updated {new Date(memory.updatedAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      )}
    </Card>
  )
}
