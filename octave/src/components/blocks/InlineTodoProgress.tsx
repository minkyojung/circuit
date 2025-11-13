/**
 * InlineTodoProgress - Displays Claude's TodoWrite output inline in chat
 *
 * Shows agent's work progress directly in the conversation, distinct from
 * Plan Mode which displays in the right sidebar.
 */

import React, { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Circle, Clock, Check, X, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Todo {
  content: string
  activeForm: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped'
  complexity?: 'trivial' | 'simple' | 'moderate' | 'complex' | 'very_complex'
  priority?: 'low' | 'medium' | 'high' | 'critical'
  estimatedDuration?: number
  description?: string
}

interface InlineTodoProgressProps {
  todos: Todo[]
  defaultExpanded?: boolean
  showProgressBar?: boolean
  autoCollapseOnComplete?: boolean
  onToggle?: (expanded: boolean) => void
}

/**
 * Get status icon and color based on todo status
 */
const getStatusIcon = (status: Todo['status']) => {
  switch (status) {
    case 'pending':
      return { icon: Circle, color: 'text-muted-foreground' }
    case 'in_progress':
      return { icon: Clock, color: 'text-blue-500' }
    case 'completed':
      return { icon: Check, color: 'text-primary' }
    case 'failed':
      return { icon: X, color: 'text-red-500' }
    case 'skipped':
      return { icon: AlertCircle, color: 'text-yellow-500' }
  }
}

/**
 * Calculate progress percentage
 */
const calculateProgress = (todos: Todo[]): number => {
  if (todos.length === 0) return 0
  const completed = todos.filter(t => t.status === 'completed').length
  return Math.round((completed / todos.length) * 100)
}

/**
 * Get status counts
 */
const getStatusCounts = (todos: Todo[]) => {
  return {
    completed: todos.filter(t => t.status === 'completed').length,
    inProgress: todos.filter(t => t.status === 'in_progress').length,
    failed: todos.filter(t => t.status === 'failed').length,
    total: todos.length,
  }
}

export const InlineTodoProgress: React.FC<InlineTodoProgressProps> = ({
  todos,
  defaultExpanded = true,
  showProgressBar = true,
  autoCollapseOnComplete = true,
  onToggle,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const progress = calculateProgress(todos)
  const counts = getStatusCounts(todos)
  const isComplete = counts.completed === counts.total

  // Auto-collapse when complete
  useEffect(() => {
    if (autoCollapseOnComplete && isComplete && isExpanded) {
      const timer = setTimeout(() => {
        setIsExpanded(false)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [isComplete, autoCollapseOnComplete, isExpanded])

  const handleToggle = () => {
    const newExpanded = !isExpanded
    setIsExpanded(newExpanded)
    onToggle?.(newExpanded)
  }

  return (
    <div
      className={cn(
        'inline-todo-progress',
        'border border-border border-l-4 border-l-primary',
        'bg-sidebar/50 rounded-lg',
        'my-2 transition-all duration-200',
        isExpanded ? 'p-4' : 'p-3'
      )}
    >
      {/* Header - always visible */}
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={handleToggle}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {isExpanded ? (
            <ChevronDown size={16} className="text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight size={16} className="text-muted-foreground shrink-0" />
          )}

          <div className="flex items-center gap-2 flex-1 min-w-0">
            {isComplete ? (
              <Check size={16} className="text-primary shrink-0" />
            ) : counts.inProgress > 0 ? (
              <Clock size={16} className="text-blue-500 shrink-0 animate-pulse" />
            ) : (
              <Circle size={16} className="text-muted-foreground shrink-0" />
            )}

            <span className="text-sm font-medium text-foreground">
              {isComplete
                ? `✓ Completed ${counts.total} task${counts.total > 1 ? 's' : ''}`
                : counts.inProgress > 0
                ? `Working... (${counts.completed}/${counts.total})`
                : `${counts.total} task${counts.total > 1 ? 's' : ''} planned`}
            </span>
          </div>
        </div>

        {!isExpanded && showProgressBar && (
          <div className="flex items-center gap-2 ml-2">
            <span className="text-xs text-muted-foreground font-mono">
              {progress}%
            </span>
          </div>
        )}
      </div>

      {/* Progress bar - visible when collapsed */}
      {!isExpanded && showProgressBar && (
        <div className="mt-2 ml-6">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full transition-all duration-500 bg-primary"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Expanded content */}
      {isExpanded && (
        <div className="mt-3 ml-6 space-y-2">
          {/* Progress bar */}
          {showProgressBar && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-mono text-muted-foreground">{progress}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full transition-all duration-500 bg-primary"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Todo list */}
          <div className="space-y-1.5 pt-2">
            {todos.map((todo, index) => {
              const { icon: StatusIcon, color } = getStatusIcon(todo.status)

              return (
                <div
                  key={index}
                  className={cn(
                    'flex items-start gap-2 text-sm p-2 rounded',
                    'hover:bg-sidebar/50 transition-colors'
                  )}
                >
                  <StatusIcon size={14} className={cn('shrink-0 mt-0.5', color)} />
                  <div className="flex-1 min-w-0">
                    <span
                      className={cn(
                        'text-foreground',
                        todo.status === 'completed' && 'line-through text-muted-foreground',
                        todo.status === 'in_progress' && 'font-medium'
                      )}
                    >
                      {todo.status === 'in_progress' ? todo.activeForm : todo.content}
                    </span>
                    {todo.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {todo.description}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer stats */}
          {counts.failed > 0 && (
            <div className="pt-2 border-t border-border/50">
              <span className="text-xs text-red-500">
                {counts.failed} task{counts.failed > 1 ? 's' : ''} failed
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
