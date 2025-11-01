/**
 * PlanReviewMessage Component
 *
 * Inline plan review integrated into chat messages
 * Shows todo drafts in a hierarchical, expandable format
 */

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Check,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Play,
  X,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import type { TodoDraft, TodoGenerationResult } from '../../types/todo'

interface PlanReviewMessageProps {
  result: TodoGenerationResult
  onConfirm: (todos: TodoDraft[]) => void
  onCancel: () => void
}

export const PlanReviewMessage: React.FC<PlanReviewMessageProps> = ({
  result,
  onConfirm,
  onCancel,
}) => {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set(
    result.todos.map((_, i) => i) // Auto-expand all
  ))

  const handleToggleExpand = (index: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const handleConfirm = () => {
    onConfirm(result.todos)
  }

  const totalTime = result.todos.reduce((sum, t) => sum + (t.estimatedDuration || 0), 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'my-4 p-4 rounded-lg border border-border',
        'bg-muted/30',
        'space-y-3'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-base">Plan Ready for Review</h3>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Claude analyzed the codebase and created a detailed plan
          </p>
        </div>
        <button
          onClick={onCancel}
          className="p-1 rounded hover:bg-muted transition-colors"
          title="Dismiss plan"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <Check className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground">
            {result.todos.length} {result.todos.length === 1 ? 'task' : 'tasks'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground">
            ~{formatDuration(totalTime)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground capitalize">{result.complexity}</span>
        </div>
      </div>

      {/* Reasoning */}
      {result.reasoning && (
        <div className="px-3 py-2 rounded bg-muted/50 text-xs text-muted-foreground">
          {result.reasoning}
        </div>
      )}

      {/* Task List */}
      <div className="space-y-1.5">
        {result.todos.map((todo, index) => (
          <TodoItem
            key={index}
            todo={todo}
            index={index}
            isExpanded={expandedIds.has(index)}
            onToggleExpand={() => handleToggleExpand(index)}
            depth={0}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
        <button
          onClick={onCancel}
          className={cn(
            'px-3 py-1.5 rounded-md text-sm',
            'border border-border hover:bg-muted transition-colors'
          )}
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          className={cn(
            'px-4 py-1.5 rounded-md text-sm font-medium',
            'bg-primary text-primary-foreground',
            'hover:opacity-90 transition-opacity',
            'flex items-center gap-2'
          )}
        >
          <Play className="w-3.5 h-3.5" />
          Start Tasks
        </button>
      </div>
    </motion.div>
  )
}

interface TodoItemProps {
  todo: TodoDraft
  index: number
  isExpanded: boolean
  onToggleExpand: () => void
  depth: number
}

const TodoItem: React.FC<TodoItemProps> = ({
  todo,
  index,
  isExpanded,
  onToggleExpand,
  depth,
}) => {
  const hasChildren = todo.children && todo.children.length > 0

  return (
    <div
      className={cn(
        'group rounded-md border border-border/50',
        'bg-background/50 hover:bg-background transition-colors',
        depth > 0 && 'ml-6'
      )}
    >
      <div
        className="flex items-start gap-2 p-2 cursor-pointer"
        onClick={onToggleExpand}
      >
        {/* Expand button */}
        <button
          className="flex-shrink-0 mt-0.5 text-muted-foreground hover:text-foreground transition-colors"
          onClick={(e) => {
            e.stopPropagation()
            onToggleExpand()
          }}
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <div className="text-sm font-medium">
            {depth === 0 && `${index + 1}. `}
            {todo.content}
          </div>

          {/* Inline metadata */}
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            {todo.complexity && (
              <span className="px-1.5 py-0.5 rounded bg-muted/50">
                {todo.complexity}
              </span>
            )}
            {todo.priority && (
              <span
                className={cn(
                  'px-1.5 py-0.5 rounded',
                  todo.priority === 'critical' && 'bg-destructive/20 text-destructive',
                  todo.priority === 'high' && 'bg-warning/20 text-warning',
                  todo.priority === 'medium' && 'bg-muted/50',
                  todo.priority === 'low' && 'bg-muted/50'
                )}
              >
                {todo.priority}
              </span>
            )}
            {todo.estimatedDuration && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDuration(todo.estimatedDuration)}
              </span>
            )}
          </div>

          {/* Details when expanded */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2 space-y-1.5"
              >
                {todo.description && (
                  <p className="text-xs text-muted-foreground">{todo.description}</p>
                )}

                {todo.activeForm && (
                  <p className="text-xs text-muted-foreground/70 italic">
                    {todo.activeForm}...
                  </p>
                )}

                {/* Nested children */}
                {hasChildren && (
                  <div className="mt-2 space-y-1">
                    {todo.children!.map((child, childIndex) => (
                      <TodoItem
                        key={childIndex}
                        todo={child}
                        index={childIndex}
                        isExpanded={false}
                        onToggleExpand={() => {}}
                        depth={depth + 1}
                      />
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
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
