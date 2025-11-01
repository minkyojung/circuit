/**
 * TodoConfirmationDialog Component
 *
 * Shows todo drafts for user confirmation before execution
 */

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Check,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Trash2,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import type { TodoDraft, TodoGenerationResult } from '../../types/todo'

interface TodoConfirmationDialogProps {
  isOpen: boolean
  result: TodoGenerationResult | null
  onConfirm: (todos: TodoDraft[]) => void
  onCancel: () => void
}

export const TodoConfirmationDialog: React.FC<TodoConfirmationDialogProps> = ({
  isOpen,
  result,
  onConfirm,
  onCancel,
}) => {
  const [editableTodos, setEditableTodos] = useState<TodoDraft[]>(result?.todos || [])
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())

  // Update when result changes
  React.useEffect(() => {
    if (result?.todos) {
      setEditableTodos(result.todos)
      // Auto-expand all by default
      setExpandedIds(new Set(result.todos.map((_, i) => i)))
    }
  }, [result])

  if (!isOpen || !result) return null

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

  const handleContentChange = (index: number, newContent: string) => {
    setEditableTodos((prev) =>
      prev.map((todo, i) => (i === index ? { ...todo, content: newContent } : todo))
    )
  }

  const handleDelete = (index: number) => {
    setEditableTodos((prev) => prev.filter((_, i) => i !== index))
  }

  const handleConfirm = () => {
    onConfirm(editableTodos)
  }

  const totalTime = editableTodos.reduce((sum, t) => sum + (t.estimatedDuration || 0), 0)

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="fixed inset-0 bg-black/50 z-50"
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className={cn(
              'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
              'w-[90vw] max-w-2xl max-h-[80vh]',
              'bg-card rounded-lg border border-border shadow-xl',
              'flex flex-col',
              'z-50'
            )}
          >
            {/* Header */}
            <div className="flex-shrink-0 px-6 py-4 border-b border-border">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Confirm Tasks</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Review and edit tasks before starting
                  </p>
                </div>
                <button
                  onClick={onCancel}
                  className="p-2 rounded-lg hover:bg-muted transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Summary */}
              <div className="flex items-center gap-4 mt-4 text-sm">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {editableTodos.length} {editableTodos.length === 1 ? 'task' : 'tasks'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    ~{formatDuration(totalTime)} estimated
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground capitalize">{result.complexity}</span>
                </div>
              </div>

              {/* AI Reasoning */}
              {result.reasoning && (
                <div className="mt-3 px-3 py-2 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                  {result.reasoning}
                </div>
              )}
            </div>

            {/* Task List */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
              {editableTodos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <AlertCircle className="w-12 h-12 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">No tasks to show</p>
                </div>
              ) : (
                editableTodos.map((todo, index) => (
                  <TodoDraftItem
                    key={index}
                    todo={todo}
                    index={index}
                    isExpanded={expandedIds.has(index)}
                    onToggleExpand={() => handleToggleExpand(index)}
                    onContentChange={(newContent) => handleContentChange(index, newContent)}
                    onDelete={() => handleDelete(index)}
                  />
                ))
              )}
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 px-6 py-4 border-t border-border">
              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={onCancel}
                  className={cn(
                    'px-4 py-2 rounded-lg',
                    'border border-border',
                    'hover:bg-muted transition-colors',
                    'text-sm font-medium'
                  )}
                >
                  Cancel
                </button>

                <div className="flex items-center gap-2">
                  {/* Future: Add Task button */}
                  {/* <button
                    className={cn(
                      'px-3 py-2 rounded-lg',
                      'border border-border',
                      'hover:bg-muted transition-colors',
                      'text-sm'
                    )}
                  >
                    <Plus className="w-4 h-4" />
                  </button> */}

                  <button
                    onClick={handleConfirm}
                    disabled={editableTodos.length === 0}
                    className={cn(
                      'px-6 py-2 rounded-lg',
                      'bg-primary text-primary-foreground',
                      'hover:opacity-90 transition-opacity',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                      'text-sm font-semibold'
                    )}
                  >
                    Start Tasks
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

interface TodoDraftItemProps {
  todo: TodoDraft
  index: number
  isExpanded: boolean
  onToggleExpand: () => void
  onContentChange: (newContent: string) => void
  onDelete: () => void
}

const TodoDraftItem: React.FC<TodoDraftItemProps> = ({
  todo,
  index,
  isExpanded,
  onToggleExpand,
  onContentChange,
  onDelete,
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(todo.content)

  const handleSave = () => {
    onContentChange(editValue)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditValue(todo.content)
    setIsEditing(false)
  }

  return (
    <div
      className={cn(
        'group relative rounded-lg border border-border',
        'bg-background hover:bg-muted/30 transition-colors',
        'p-3'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Expand button */}
        <button
          onClick={onToggleExpand}
          className="flex-shrink-0 mt-0.5 text-muted-foreground hover:text-foreground transition-colors"
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
          {isEditing ? (
            <div className="space-y-2">
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave()
                  if (e.key === 'Escape') handleCancel()
                }}
                className={cn(
                  'w-full px-2 py-1 rounded border border-border',
                  'bg-background text-sm',
                  'focus:outline-none focus:ring-2 focus:ring-primary'
                )}
                autoFocus
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSave}
                  className="px-2 py-1 rounded text-xs bg-primary text-primary-foreground"
                >
                  Save
                </button>
                <button
                  onClick={handleCancel}
                  className="px-2 py-1 rounded text-xs hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => setIsEditing(true)}
              className="text-sm font-medium cursor-text hover:text-primary transition-colors"
            >
              {index + 1}. {todo.content}
            </div>
          )}

          {/* Details */}
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2 space-y-2"
            >
              {todo.description && (
                <p className="text-xs text-muted-foreground">{todo.description}</p>
              )}

              <div className="flex flex-wrap items-center gap-2 text-xs">
                {todo.priority && (
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded-full',
                      todo.priority === 'critical' && 'bg-destructive/20 text-destructive',
                      todo.priority === 'high' && 'bg-warning/20 text-warning',
                      todo.priority === 'medium' && 'bg-muted text-muted-foreground',
                      todo.priority === 'low' && 'bg-muted text-muted-foreground'
                    )}
                  >
                    {todo.priority}
                  </span>
                )}

                {todo.complexity && (
                  <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {todo.complexity}
                  </span>
                )}

                {todo.estimatedDuration && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {formatDuration(todo.estimatedDuration)}
                  </span>
                )}
              </div>
            </motion.div>
          )}
        </div>

        {/* Delete button */}
        <button
          onClick={onDelete}
          className={cn(
            'flex-shrink-0 p-1 rounded',
            'opacity-0 group-hover:opacity-100 transition-opacity',
            'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
          )}
          title="Delete task"
        >
          <Trash2 className="w-4 h-4" />
        </button>
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
