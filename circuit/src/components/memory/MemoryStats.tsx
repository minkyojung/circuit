/**
 * Memory Statistics Display
 */

import type { MemoryStats } from '../../../electron/memoryStorage'

interface MemoryStatsProps {
  stats: MemoryStats | null
  onTypeClick?: (type: string) => void
}

export function MemoryStats({ stats, onTypeClick }: MemoryStatsProps) {
  if (!stats) {
    return (
      <div className="glass-card p-4">
        <div className="text-xs text-[var(--text-muted)]">Loading stats...</div>
      </div>
    )
  }

  const typeIcons: Record<string, string> = {
    convention: '📝',
    decision: '💡',
    rule: '⚠️',
    note: '📄',
    snippet: '💻',
  }

  return (
    <div className="glass-card p-4">
      <h3 className="text-xs font-semibold text-[var(--text-secondary)] mb-3">
        STATISTICS
      </h3>

      {/* Total */}
      <div className="mb-4">
        <div className="text-2xl font-bold text-[var(--text-primary)]">
          {stats.totalMemories}
        </div>
        <div className="text-xs text-[var(--text-muted)]">Total Memories</div>
      </div>

      {/* By Type */}
      {Object.keys(stats.byType).length > 0 && (
        <div className="mb-4">
          <div className="text-xs font-medium text-[var(--text-secondary)] mb-2">
            By Type
          </div>
          <div className="flex flex-col gap-1.5">
            {Object.entries(stats.byType).map(([type, count]) => (
              <button
                key={type}
                onClick={() => onTypeClick?.(type)}
                className="flex items-center justify-between px-2 py-1 rounded hover:bg-[var(--glass-hover)] transition-colors text-left"
              >
                <span className="text-xs text-[var(--text-secondary)] flex items-center gap-1.5">
                  <span>{typeIcons[type] || '📦'}</span>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </span>
                <span className="text-xs font-medium text-[var(--text-primary)]">
                  {count}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* By Priority */}
      {Object.keys(stats.byPriority).length > 0 && (
        <div className="mb-4">
          <div className="text-xs font-medium text-[var(--text-secondary)] mb-2">
            By Priority
          </div>
          <div className="flex flex-col gap-1.5">
            {Object.entries(stats.byPriority).map(([priority, count]) => (
              <div
                key={priority}
                className="flex items-center justify-between px-2 py-1"
              >
                <span className="text-xs text-[var(--text-secondary)]">
                  {priority.charAt(0).toUpperCase() + priority.slice(1)}
                </span>
                <span className="text-xs font-medium text-[var(--text-primary)]">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Most Used */}
      {stats.mostUsed.length > 0 && (
        <div>
          <div className="text-xs font-medium text-[var(--text-secondary)] mb-2">
            Most Used
          </div>
          <div className="flex flex-col gap-1.5">
            {stats.mostUsed.slice(0, 5).map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between px-2 py-1"
              >
                <span className="text-xs text-[var(--text-secondary)] truncate flex-1">
                  {item.key}
                </span>
                <span className="text-xs font-medium text-[var(--circuit-orange)] ml-2">
                  {item.usageCount}×
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
