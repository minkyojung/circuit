/**
 * PlanReviewMessage Component
 *
 * Inline plan review integrated into chat messages
 * Shows todo drafts in a hierarchical, expandable format
 */

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, ChevronDown, ChevronRight, Check } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { TodoDraft, TodoGenerationResult } from '../../types/todo'

interface PlanReviewMessageProps {
  result: TodoGenerationResult
  isConfirmed?: boolean
  onConfirm: (todos: TodoDraft[]) => void
  onCancel: () => void
}

export const PlanReviewMessage: React.FC<PlanReviewMessageProps> = ({
  result,
  isConfirmed = false,
  onConfirm,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(isConfirmed)

  // Confirmed plan - collapsible
  if (isConfirmed) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="my-2"
      >
        {/* Collapsed header */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            'flex items-center gap-2 py-1.5 text-[11px] font-light',
            'text-muted-foreground/60 hover:text-muted-foreground',
            'transition-colors'
          )}
        >
          {isCollapsed ? (
            <ChevronRight className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
          <Check className="w-3 h-3" />
          <span>Plan</span>
          <span className="text-muted-foreground/40">({result.todos.length} tasks)</span>
        </button>

        {/* Expanded content */}
        <AnimatePresence>
          {!isCollapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className={cn(
                'space-y-1 pl-5 pt-1 pb-2 mt-1',
                'bg-muted/20 border border-border/30 rounded-md px-3 py-2'
              )}>
                {result.todos.map((todo, index) => (
                  <TodoItem
                    key={index}
                    todo={todo}
                    depth={0}
                    isCompleted={true}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    )
  }

  // Pending plan - always expanded with Start button
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'my-3 py-3 px-4 space-y-3',
        'bg-muted/20 border border-border/30 rounded-lg'
      )}
    >
      {/* Task List - minimalist, only checkboxes and content */}
      <div className="space-y-1">
        {result.todos.map((todo, index) => (
          <TodoItem
            key={index}
            todo={todo}
            depth={0}
            isCompleted={false}
          />
        ))}
      </div>

      {/* Actions - only Start button */}
      <div className="flex items-center justify-end pt-1">
        <button
          onClick={() => onConfirm(result.todos)}
          className={cn(
            'h-8 px-4 rounded-md text-xs font-medium',
            'bg-primary text-primary-foreground shadow-sm',
            'hover:bg-primary/90 transition-colors',
            'inline-flex items-center gap-1.5',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
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
  depth: number
  isCompleted: boolean
}

const TodoItem: React.FC<TodoItemProps> = ({
  todo,
  depth,
  isCompleted,
}) => {
  const hasChildren = todo.children && todo.children.length > 0

  return (
    <div className={cn(depth > 0 && 'ml-6')}>
      {/* Checkbox + Content only */}
      <div className="flex items-start gap-2.5 py-1">
        {/* Checkbox - empty or checked */}
        <div className="flex-shrink-0 mt-0.5">
          {isCompleted ? (
            <div className="w-3.5 h-3.5 rounded border-2 border-primary/70 bg-primary/70 flex items-center justify-center">
              <Check className="w-2.5 h-2.5 text-primary-foreground" strokeWidth={3} />
            </div>
          ) : (
            <div className="w-3.5 h-3.5 rounded border-2 border-muted-foreground/40" />
          )}
        </div>

        {/* Content - plain text only, with strikethrough if completed */}
        <div className={cn(
          'flex-1 min-w-0 text-[11.5px] font-light leading-relaxed',
          isCompleted
            ? 'line-through text-muted-foreground/60'
            : 'text-muted-foreground/90'
        )}>
          {todo.content}
        </div>
      </div>

      {/* Nested children with indentation */}
      {hasChildren && (
        <div className="mt-0.5">
          {todo.children!.map((child, childIndex) => (
            <TodoItem
              key={childIndex}
              todo={child}
              depth={depth + 1}
              isCompleted={isCompleted}
            />
          ))}
        </div>
      )}
    </div>
  )
}
