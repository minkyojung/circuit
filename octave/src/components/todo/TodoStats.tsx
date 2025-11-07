/**
 * TodoStats Component
 *
 * Displays statistics and progress overview for todos
 */

import React from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Circle, Clock, XCircle, AlertTriangle } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { TodoStats as TodoStatsType } from '../../types/todo'

interface TodoStatsProps {
  stats: TodoStatsType
  className?: string
}

export const TodoStats: React.FC<TodoStatsProps> = ({ stats, className }) => {
  const { total, pending, inProgress, completed, failed, skipped, completionRate } = stats

  return (
    <div className={cn('rounded-lg border border-border bg-card p-4', className)}>
      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Overall Progress</span>
          <span className="text-sm font-semibold tabular-nums">{completionRate}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${completionRate}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="h-full bg-success rounded-full"
          />
        </div>
      </div>

      {/* Status breakdown */}
      <div className="grid grid-cols-2 gap-3">
        {/* Completed */}
        <StatItem
          icon={CheckCircle2}
          label="Completed"
          value={completed}
          total={total}
          color="text-success"
        />

        {/* In Progress */}
        <StatItem
          icon={Clock}
          label="In Progress"
          value={inProgress}
          total={total}
          color="text-info"
        />

        {/* Pending */}
        <StatItem
          icon={Circle}
          label="Pending"
          value={pending}
          total={total}
          color="text-muted-foreground"
        />

        {/* Failed */}
        {failed > 0 && (
          <StatItem
            icon={XCircle}
            label="Failed"
            value={failed}
            total={total}
            color="text-destructive"
          />
        )}

        {/* Skipped */}
        {skipped > 0 && (
          <StatItem
            icon={AlertTriangle}
            label="Skipped"
            value={skipped}
            total={total}
            color="text-warning"
          />
        )}
      </div>

      {/* Time estimate */}
      {stats.estimatedTimeRemaining > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Est. time remaining</span>
            <span className="font-medium tabular-nums">
              {formatDuration(stats.estimatedTimeRemaining)}
            </span>
          </div>
        </div>
      )}

      {stats.actualTimeSpent > 0 && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Time spent</span>
            <span className="font-medium tabular-nums">
              {formatDuration(stats.actualTimeSpent)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

interface StatItemProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  total: number
  color: string
}

const StatItem: React.FC<StatItemProps> = ({ icon: Icon, label, value, total, color }) => {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0

  return (
    <div className="flex items-center gap-2">
      <Icon className={cn('w-4 h-4 flex-shrink-0', color)} />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="flex items-baseline gap-1">
          <span className="text-sm font-semibold tabular-nums">{value}</span>
          <span className="text-[10px] text-muted-foreground">({percentage}%)</span>
        </div>
      </div>
    </div>
  )
}

function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`
  }
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60)
    return `${minutes}m`
  }
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
}
