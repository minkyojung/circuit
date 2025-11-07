/**
 * TodoItem Component
 *
 * Displays a single todo with status indicator, progress, and actions
 */

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Circle, X, ChevronRight, ChevronDown, Clock, AlertCircle, Play, Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { TodoNode, TodoStatus } from '../../types/todo'
import { useAgent } from '../../contexts/AgentContext'

interface TodoItemProps {
  todo: TodoNode
  depth?: number
  isExpanded?: boolean
  onToggleExpand?: (todoId: string) => void
  onStatusChange?: (todoId: string, status: TodoStatus) => void
  onDelete?: (todoId: string) => void
  workspaceId?: string
  onRunAgent?: (todoId: string) => void
}

const STATUS_CONFIG: Record<
  TodoStatus,
  {
    icon: React.ComponentType<{ className?: string }>
    color: string
    bgColor: string
    label: string
  }
> = {
  pending: {
    icon: Circle,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    label: 'Pending',
  },
  in_progress: {
    icon: Clock,
    color: 'text-info',
    bgColor: 'bg-info/10',
    label: 'In Progress',
  },
  completed: {
    icon: Check,
    color: 'text-success',
    bgColor: 'bg-success/10',
    label: 'Completed',
  },
  failed: {
    icon: X,
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    label: 'Failed',
  },
  skipped: {
    icon: AlertCircle,
    color: 'text-warning',
    bgColor: 'bg-warning/10',
    label: 'Skipped',
  },
}

export const TodoItem: React.FC<TodoItemProps> = ({
  todo,
  depth = 0,
  isExpanded: controlledExpanded,
  onToggleExpand,
  onStatusChange,
  onDelete,
  workspaceId,
  onRunAgent,
}) => {
  const [isLocalExpanded, setIsLocalExpanded] = useState(false)
  const { getAgentState } = useAgent()

  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : isLocalExpanded
  const hasChildren = todo.children && todo.children.length > 0

  const handleToggleExpand = () => {
    if (onToggleExpand) {
      onToggleExpand(todo.id)
    } else {
      setIsLocalExpanded((prev) => !prev)
    }
  }

  const config = STATUS_CONFIG[todo.status]
  const StatusIcon = config.icon

  // Check agent state
  const agentState = getAgentState(todo.id)
  const isAgentRunning = agentState?.state === 'running'
  const agentFailed = agentState?.state === 'failed'

  // Calculate progress
  let effectiveProgress = todo.progress || 0
  if (hasChildren) {
    // Calculate progress from children
    const totalChildren = todo.children.length
    const completedChildren = todo.children.filter(
      (c) => c.status === 'completed' || c.status === 'skipped'
    ).length
    effectiveProgress = Math.round((completedChildren / totalChildren) * 100)
  }

  return (
    <div className={cn('relative', depth > 0 && 'ml-6')}>
      {/* Connecting line for nested items */}
      {depth > 0 && (
        <div className="absolute left-[-24px] top-0 bottom-0 w-px bg-border" />
      )}

      {/* Main todo item */}
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.15 }}
        className={cn(
          'group relative flex items-center gap-3 rounded-lg p-3',
          'border border-transparent',
          'hover:border-border hover:bg-muted/50',
          'transition-colors duration-150',
          config.bgColor
        )}
      >
        {/* Expand/collapse button */}
        {hasChildren && (
          <button
            onClick={handleToggleExpand}
            className={cn(
              'flex-shrink-0 w-5 h-5 flex items-center justify-center',
              'text-muted-foreground hover:text-foreground',
              'transition-colors'
            )}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        )}

        {/* Status icon */}
        <div className={cn('flex-shrink-0', config.color)}>
          <StatusIcon className="w-5 h-5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'text-sm font-medium',
                todo.status === 'completed' && 'line-through opacity-60',
                todo.status === 'skipped' && 'line-through opacity-40'
              )}
            >
              {todo.status === 'in_progress' && todo.activeForm
                ? todo.activeForm
                : todo.content}
            </span>

            {/* Priority badge */}
            {todo.priority && todo.priority !== 'medium' && (
              <span
                className={cn(
                  'px-1.5 py-0.5 text-[10px] font-semibold rounded-full',
                  todo.priority === 'critical' &&
                    'bg-destructive/20 text-destructive',
                  todo.priority === 'high' && 'bg-warning/20 text-warning',
                  todo.priority === 'low' && 'bg-muted text-muted-foreground'
                )}
              >
                {todo.priority}
              </span>
            )}

            {/* Complexity badge */}
            {todo.complexity && todo.complexity !== 'medium' && (
              <span
                className={cn(
                  'px-1.5 py-0.5 text-[10px] rounded-full',
                  'bg-muted text-muted-foreground'
                )}
              >
                {todo.complexity}
              </span>
            )}
          </div>

          {/* Description */}
          {todo.description && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
              {todo.description}
            </p>
          )}

          {/* Progress bar */}
          {(todo.progress !== undefined || hasChildren) && effectiveProgress > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${effectiveProgress}%` }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className={cn('h-full rounded-full', config.color.replace('text-', 'bg-'))}
                />
              </div>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {effectiveProgress}%
              </span>
            </div>
          )}

          {/* Timing info */}
          {todo.estimatedDuration && todo.status === 'pending' && (
            <div className="mt-1 text-[10px] text-muted-foreground">
              Est. {formatDuration(todo.estimatedDuration)}
            </div>
          )}
          {todo.actualDuration && todo.status === 'completed' && (
            <div className="mt-1 text-[10px] text-muted-foreground">
              Took {formatDuration(todo.actualDuration)}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Run Agent button - only show for pending todos */}
          {todo.status === 'pending' && onRunAgent && !isAgentRunning && (
            <button
              onClick={() => onRunAgent(todo.id)}
              className={cn(
                'p-1 rounded hover:bg-primary/10',
                'text-muted-foreground hover:text-primary',
                'transition-colors'
              )}
              title="Run with Agent"
            >
              <Play className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Agent running indicator - always visible when running */}
          {isAgentRunning && (
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-info/10 opacity-100">
              <Loader2 className="w-3.5 h-3.5 text-info animate-spin" />
              <span className="text-[10px] text-info font-medium">Agent</span>
            </div>
          )}

          {/* Agent failed indicator */}
          {agentFailed && (
            <div
              className="flex items-center gap-1 px-2 py-1 rounded bg-destructive/10 opacity-100"
              title={agentState?.error || 'Agent failed'}
            >
              <AlertCircle className="w-3.5 h-3.5 text-destructive" />
              <span className="text-[10px] text-destructive font-medium">Failed</span>
            </div>
          )}

          {/* Status cycle button */}
          {todo.status !== 'completed' && onStatusChange && !isAgentRunning && (
            <button
              onClick={() => {
                const nextStatus: Record<TodoStatus, TodoStatus> = {
                  pending: 'in_progress',
                  in_progress: 'completed',
                  completed: 'completed',
                  failed: 'pending',
                  skipped: 'pending',
                }
                onStatusChange(todo.id, nextStatus[todo.status])
              }}
              className={cn(
                'p-1 rounded hover:bg-background/50',
                'text-muted-foreground hover:text-foreground',
                'transition-colors'
              )}
              title="Next status"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Delete button */}
          {onDelete && !isAgentRunning && (
            <button
              onClick={() => onDelete(todo.id)}
              className={cn(
                'p-1 rounded hover:bg-destructive/10',
                'text-muted-foreground hover:text-destructive',
                'transition-colors'
              )}
              title="Delete todo"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </motion.div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="mt-2"
        >
          {todo.children.map((child) => (
            <TodoItem
              key={child.id}
              todo={child}
              depth={depth + 1}
              onToggleExpand={onToggleExpand}
              onStatusChange={onStatusChange}
              onDelete={onDelete}
              workspaceId={workspaceId}
              onRunAgent={onRunAgent}
            />
          ))}
        </motion.div>
      )}
    </div>
  )
}

/**
 * Format duration in seconds to human-readable string
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`
  }
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
  }
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
}
